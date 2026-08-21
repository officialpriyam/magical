import {
  AgentRole,
  AgentResult,
  AgentStatus,
  AgentTask,
  ExecutionPlan,
  OrchestratorConfig,
  TaskComplexity,
} from './types'
import {
  COMPLEXITY_ANALYSIS_PROMPT,
  PLANNER_SYSTEM_PROMPT,
  ARCHITECT_SYSTEM_PROMPT,
  FRONTEND_SYSTEM_PROMPT,
  BACKEND_SYSTEM_PROMPT,
  REVIEWER_SYSTEM_PROMPT,
  OPTIMIZER_SYSTEM_PROMPT,
  AGENT_DISPLAY_NAMES,
} from './prompts'
import {
  runAgent,
  runAgentsParallel,
  runAgentsSequential,
  StatusCallback,
} from './agent-runner'
import {
  getFallbackChain,
  getModelClient,
  LLMModel,
  LLMModelConfig,
} from '@/lib/models'
import { toPrompt, PromptContext } from '@/lib/prompt'
import { Templates } from '@/lib/templates'
import { fragmentSchema as schema } from '@/lib/schema'
import { DeepPartial } from 'ai'
import { ModelMessage, streamText, type LanguageModel } from 'ai'

const STREAM_TEXT_PROVIDER_IDS = new Set([
  'orcarouter',
  'requesty',
  'llm_gateway',
  'deepseek',
  'nvidia',
])

// ─── Default Execution Plans by Complexity ──────────────────────
const EXECUTION_PLANS: Record<TaskComplexity, AgentRole[]> = {
  simple: ['planner', 'frontend'],
  moderate: ['planner', 'architect', 'frontend', 'reviewer'],
  complex: ['planner', 'architect', 'frontend', 'backend', 'reviewer', 'optimizer'],
  enterprise: ['planner', 'architect', 'frontend', 'backend', 'reviewer', 'optimizer', 'reviewer'],
}

// ─── Parallel Groups ────────────────────────────────────────────
const PARALLEL_GROUPS: Record<TaskComplexity, AgentRole[][]> = {
  simple: [['planner'], ['frontend']],
  moderate: [['planner'], ['architect'], ['frontend', 'backend'], ['reviewer']],
  complex: [
    ['planner'],
    ['architect'],
    ['frontend', 'backend'],
    ['reviewer'],
    ['optimizer'],
  ],
  enterprise: [
    ['planner'],
    ['architect'],
    ['frontend', 'backend'],
    ['reviewer'],
    ['optimizer'],
    ['reviewer'], // Second review pass
  ],
}

// ─── Orchestrator Class ─────────────────────────────────────────
export class Orchestrator {
  private config: OrchestratorConfig
  private statusCallback?: StatusCallback
  private results: AgentResult[] = []
  private startTime: number = 0

  constructor(config: OrchestratorConfig, onStatus?: StatusCallback) {
    this.config = config
    this.statusCallback = onStatus
  }

  // ─── Main Execution Entry Point ─────────────────────────────
  async execute(): Promise<{
    fragment: DeepPartial<any>
    agentsUsed: AgentRole[]
    complexity: TaskComplexity
    totalDuration: number
    agentDurations: Record<string, number>
  }> {
    this.startTime = Date.now()

    // Step 1: Analyze complexity
    const complexity = await this.analyzeComplexity()

    // Step 2: Get execution plan
    const plan = this.getExecutionPlan(complexity)

    // Step 3: Execute agents in order
    const finalFragment = await this.executePlan(plan)

    // Step 4: Aggregate results
    return this.aggregateResults(finalFragment, complexity)
  }

  // ─── Analyze Request Complexity ──────────────────────────────
  private async analyzeComplexity(): Promise<TaskComplexity> {
    this.emitStatus({
      role: 'orchestrator',
      phase: 'thinking',
      message: '🎯 Analyzing your request complexity...',
    })

    try {
      const fallbackChain = getFallbackChain(this.config.model, this.config.config)
      if (fallbackChain.length === 0) {
        return 'moderate' // Default to moderate
      }

      const candidate = fallbackChain[0]
      const modelClient = getModelClient(candidate, this.config.config)
      const useFallback = STREAM_TEXT_PROVIDER_IDS.has(candidate.providerId)

      const systemPrompt = COMPLEXITY_ANALYSIS_PROMPT
      const modelParams = { ...this.config.config }
      delete modelParams.model
      delete modelParams.apiKey
      delete modelParams.baseURL

      let text: string

      if (useFallback) {
        const result = streamText({
          model: modelClient as any,
          system: systemPrompt + '\n\nRespond with ONLY a valid JSON object.',
          messages: this.config.messages,
          maxRetries: 0,
          ...modelParams,
        })
        text = await this.readStream(result.textStream)
      } else {
        const result = streamText({
          model: modelClient as LanguageModel,
          system: systemPrompt,
          messages: this.config.messages,
          maxRetries: 0,
          ...modelParams,
        })
        text = await this.readStream(result.textStream)
      }

      const parsed = this.parseJsonResponse(text)
      const complexity = (parsed?.complexity as TaskComplexity) || 'moderate'

      console.log(`[Orchestrator] Task complexity: ${complexity}`)
      console.log(`[Orchestrator] Reasoning: ${parsed?.reasoning || 'N/A'}`)

      return ['simple', 'moderate', 'complex', 'enterprise'].includes(complexity)
        ? complexity
        : 'moderate'
    } catch (error) {
      console.error('[Orchestrator] Complexity analysis failed, defaulting to moderate:', error)
      return 'moderate'
    }
  }

  // ─── Get Execution Plan ──────────────────────────────────────
  private getExecutionPlan(complexity: TaskComplexity): ExecutionPlan {
    const agents = EXECUTION_PLANS[complexity]
    const parallelGroups = PARALLEL_GROUPS[complexity]

    const tasks: AgentTask[] = agents.map((role, index) => ({
      role,
      description: `${AGENT_DISPLAY_NAMES[role]} task`,
      priority: index,
      dependencies: this.getDependencies(role, agents),
      context: '',
    }))

    return {
      complexity,
      tasks,
      parallelGroups,
      estimatedAgents: agents.length,
    }
  }

  // ─── Get Agent Dependencies ──────────────────────────────────
  private getDependencies(role: AgentRole, allAgents: AgentRole[]): AgentRole[] {
    const dependencyMap: Record<AgentRole, AgentRole[]> = {
      orchestrator: [],
      planner: [],
      architect: ['planner'],
      frontend: ['architect'],
      backend: ['architect'],
      reviewer: ['frontend', 'backend'],
      optimizer: ['reviewer'],
      fixer: [],
    }

    return (dependencyMap[role] || []).filter(dep => allAgents.includes(dep))
  }

  // ─── Execute the Plan ────────────────────────────────────────
  private async executePlan(plan: ExecutionPlan): Promise<DeepPartial<any>> {
    const agentResults: AgentResult[] = []
    let latestFragment: DeepPartial<any> = undefined
    let architectureContext: Record<string, any> = {}

    for (const group of plan.parallelGroups) {
      this.emitStatus({
        role: 'orchestrator',
        phase: 'generating',
        message: `🚀 Running ${group.map(r => AGENT_DISPLAY_NAMES[r]).join(' + ')}...`,
      })

      // Build messages for this group
      const messages = this.buildMessagesForGroup(group, agentResults, latestFragment)

      // Build context for agents
      const context: Record<string, any> = {
        ...architectureContext,
        plan: agentResults.find(r => r.role === 'planner')?.output,
      }

      if (latestFragment) {
        context.existingCode = latestFragment.code
        context.files = latestFragment.files
      }

      if (group.includes('reviewer')) {
        const reviewResult = agentResults.find(r => r.role === 'reviewer')
        if (reviewResult) {
          context.reviewResults = reviewResult.output
        }
      }

      // Run agents in this group (parallel or sequential)
      const groupResults = await this.runAgentGroup(group, messages, context)
      agentResults.push(...groupResults)

      // Update latest fragment
      const fragmentResult = groupResults
        .filter(r => r.success && r.fragment)
        .pop()

      if (fragmentResult?.fragment) {
        latestFragment = fragmentResult.fragment
      }

      // Store architecture context for later agents
      const architectResult = groupResults.find(r => r.role === 'architect')
      if (architectResult?.fragment) {
        architectureContext.architecture = architectResult.fragment
      }

      // Check if reviewer rejected the code
      const reviewerResult = groupResults.find(r => r.role === 'reviewer')
      if (reviewerResult?.fragment && (reviewerResult.fragment as any).approved === false) {
        console.log('[Orchestrator] Code review not approved, running fixer agent...')
        // Inject fixer agent
        const fixerMessages = this.buildFixerMessages(latestFragment, reviewerResult.fragment)
        const fixerResult = await runAgent(
          {
            role: 'fixer',
            systemPrompt: '',
            messages: fixerMessages,
            config: this.config,
            context: {
              reviewResults: reviewerResult.fragment,
              existingCode: latestFragment?.code,
            },
            fallbackChain: getFallbackChain(this.config.model, this.config.config),
          },
          this.statusCallback,
        )

        if (fixerResult.success && fixerResult.fragment) {
          latestFragment = fixerResult.fragment
          agentResults.push(fixerResult)
        }
      }
    }

    this.results = agentResults
    return latestFragment || this.buildDefaultFragment()
  }

  // ─── Run a Group of Agents ───────────────────────────────────
  private async runAgentGroup(
    group: AgentRole[],
    messages: ModelMessage[],
    context: Record<string, any>,
  ): Promise<AgentResult[]> {
    const fallbackChain = getFallbackChain(this.config.model, this.config.config)

    const agentInputs = group.map(role => ({
      role,
      systemPrompt: '',
      messages,
      config: this.config,
      context,
      fallbackChain,
    }))

    // If only one agent, run it directly
    if (agentInputs.length === 1) {
      const result = await runAgent(agentInputs[0], this.statusCallback)
      return [result]
    }

    // For multiple agents, check if they can run in parallel
    // Frontend and Backend can run in parallel
    // Reviewer and Optimizer should run sequentially
    const canParallel = group.every(r =>
      ['frontend', 'backend'].includes(r) ||
      ['reviewer', 'optimizer'].includes(r) === false
    )

    if (canParallel && group.length <= 2) {
      return runAgentsParallel(agentInputs, this.statusCallback)
    }

    return runAgentsSequential(agentInputs, this.statusCallback)
  }

  // ─── Build Messages for Agent Group ──────────────────────────
  private buildMessagesForGroup(
    group: AgentRole[],
    previousResults: AgentResult[],
    latestFragment: DeepPartial<any>,
  ): ModelMessage[] {
    const messages: ModelMessage[] = [...this.config.messages]

    // Add context from previous agents
    if (previousResults.length > 0) {
      const contextParts: string[] = []

      const plannerResult = previousResults.find(r => r.role === 'planner')
      if (plannerResult) {
        contextParts.push(`Planner's plan:\n${plannerResult.output}`)
      }

      const architectResult = previousResults.find(r => r.role === 'architect')
      if (architectResult) {
        contextParts.push(`Architect's design:\n${architectResult.output}`)
      }

      if (contextParts.length > 0) {
        messages.push({
          role: 'user',
          content: `Previous agent outputs:\n\n${contextParts.join('\n\n')}\n\nNow continue with your part of the implementation.`,
        })
      }
    }

    // Add current fragment if exists
    if (latestFragment) {
      messages.push({
        role: 'user',
        content: `Current project state:\n\`\`\`json\n${JSON.stringify(latestFragment, null, 2)}\n\`\`\`\n\nBuild upon this or create the next part.`,
      })
    }

    return messages
  }

  // ─── Build Fixer Messages ────────────────────────────────────
  private buildFixerMessages(
    fragment: DeepPartial<any>,
    reviewResults: any,
  ): ModelMessage[] {
    const messages: ModelMessage[] = [...this.config.messages]

    messages.push({
      role: 'user',
      content: `The code review found issues that need to be fixed.

Current code:
\`\`\`json
${JSON.stringify(fragment, null, 2)}
\`\`\`

Review results:
\`\`\`json
${JSON.stringify(reviewResults, null, 2)}
\`\`\`

Please fix all the issues identified in the review while maintaining the original functionality.`,
    })

    return messages
  }

  // ─── Aggregate Results ───────────────────────────────────────
  private aggregateResults(
    finalFragment: DeepPartial<any>,
    complexity: TaskComplexity,
  ) {
    const totalDuration = Date.now() - this.startTime
    const agentsUsed = this.results.map(r => r.role)
    const agentDurations: Record<string, number> = {}

    for (const result of this.results) {
      agentDurations[result.role] = result.duration || 0
    }

    const reviewResult = this.results.find(r => r.role === 'reviewer')
    const reviewScore = reviewResult?.fragment ? (reviewResult.fragment as any).score : undefined

    // Enhance fragment with agent metadata
    const enhancedFragment = {
      ...finalFragment,
      agent_metadata: {
        agents_used: agentsUsed,
        complexity,
        total_duration: totalDuration,
        agent_durations: agentDurations,
        review_score: reviewScore,
      },
    }

    console.log(`[Orchestrator] Execution complete in ${totalDuration}ms`)
    console.log(`[Orchestrator] Agents used: ${agentsUsed.join(', ')}`)
    console.log(`[Orchestrator] Complexity: ${complexity}`)

    return {
      fragment: enhancedFragment,
      agentsUsed,
      complexity,
      totalDuration,
      agentDurations,
    }
  }

  // ─── Default Fragment ────────────────────────────────────────
  private buildDefaultFragment() {
    return {
      commentary: 'No agents could generate code. Please try again.',
      template: 'default',
      title: 'Error',
      description: 'Generation failed',
      additional_dependencies: [],
      has_additional_dependencies: false,
      install_dependencies_command: '',
      port: null,
      file_path: 'src/App.tsx',
      code: '// Generation failed. Please try again.',
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────
  private emitStatus(status: AgentStatus) {
    this.statusCallback?.(status)
  }

  private async readStream(stream: ReadableStream<string>): Promise<string> {
    const reader = stream.getReader()
    let text = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += value
      }
    } finally {
      reader.releaseLock()
    }
    return text
  }

  private parseJsonResponse(text: string): any {
    try {
      // Try to extract JSON
      const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (codeBlockMatch) {
        return JSON.parse(codeBlockMatch[1].trim())
      }

      const start = text.indexOf('{')
      if (start !== -1) {
        let depth = 0
        let inString = false
        let escaped = false

        for (let i = start; i < text.length; i++) {
          const char = text[i]
          if (inString) {
            if (escaped) { escaped = false }
            else if (char === '\\') { escaped = true }
            else if (char === '"') { inString = false }
            continue
          }
          if (char === '"') { inString = true }
          else if (char === '{') { depth++ }
          else if (char === '}') {
            depth--
            if (depth === 0) {
              return JSON.parse(text.slice(start, i + 1))
            }
          }
        }
      }

      return null
    } catch {
      return null
    }
  }
}

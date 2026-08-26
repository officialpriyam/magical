import { FragmentSchema } from '@/lib/schema'
import { LLMModel, LLMModelConfig } from '@/lib/models'
import { DeepPartial } from 'ai'
import { ModelMessage } from 'ai'

// ─── Agent Roles ───────────────────────────────────────────────
export type AgentRole =
  | 'orchestrator'
  | 'planner'
  | 'architect'
  | 'frontend'
  | 'backend'
  | 'reviewer'
  | 'optimizer'
  | 'fixer'

// ─── Task Complexity ───────────────────────────────────────────
export type TaskComplexity = 'simple' | 'moderate' | 'complex' | 'enterprise'

// ─── Agent Task ────────────────────────────────────────────────
export interface AgentTask {
  role: AgentRole
  description: string
  priority: number
  dependencies: AgentRole[]
  context: string
  output?: string
}

// ─── Agent Result ──────────────────────────────────────────────
export interface AgentResult {
  role: AgentRole
  success: boolean
  output: string
  fragment?: DeepPartial<FragmentSchema>
  errors?: string[]
  duration?: number
}

// ─── Agent Execution Plan ──────────────────────────────────────
export interface ExecutionPlan {
  complexity: TaskComplexity
  tasks: AgentTask[]
  parallelGroups: AgentRole[][]
  estimatedAgents: number
}

// ─── Orchestrator Config ───────────────────────────────────────
export interface OrchestratorConfig {
  model: LLMModel
  config: LLMModelConfig
  messages: ModelMessage[]
  userID?: string
  teamID?: string
  projectID?: string
  template: Record<string, any>
  supabase?: {
    connected: boolean
    projectRef?: string
    source?: string
    projectsMode?: string
  }
}

// ─── Agent Input ───────────────────────────────────────────────
export interface AgentInput {
  role: AgentRole
  systemPrompt: string
  messages: ModelMessage[]
  config: OrchestratorConfig
  context: Record<string, any>
  fallbackChain: LLMModel[]
}

// ─── Agent Status (for streaming to UI) ────────────────────────
export interface AgentStatus {
  role: AgentRole
  phase: 'starting' | 'thinking' | 'generating' | 'reviewing' | 'completed' | 'error'
  message: string
  progress?: number
}

// ─── Agentic Fragment (enhanced with agent metadata) ───────────
export interface AgenticFragment extends FragmentSchema {
  agent_metadata?: {
    agents_used: AgentRole[]
    complexity: TaskComplexity
    total_duration: number
    agent_durations: Record<AgentRole, number>
    review_score?: number
    optimization_notes?: string[]
  }
}

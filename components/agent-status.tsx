'use client'

import { AgentRole } from '@/lib/agents/types'
import { AGENT_DISPLAY_NAMES } from '@/lib/agents/prompts'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle2, XCircle, Circle } from 'lucide-react'

interface AgentStatusData {
  role: AgentRole
  phase: 'starting' | 'thinking' | 'generating' | 'reviewing' | 'completed' | 'error'
  message: string
}

interface AgentStatusTrackerProps {
  agents: AgentStatusData[]
  isAgenticMode: boolean
}

const AGENT_ORDER: AgentRole[] = [
  'orchestrator',
  'planner',
  'architect',
  'frontend',
  'backend',
  'reviewer',
  'optimizer',
  'fixer',
]

function getAgentIcon(phase: AgentStatusData['phase']) {
  switch (phase) {
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
    case 'error':
      return <XCircle className="h-3.5 w-3.5 text-red-400" />
    case 'starting':
    case 'thinking':
    case 'generating':
    case 'reviewing':
      return <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
    default:
      return <Circle className="h-3.5 w-3.5 text-white/30" />
  }
}

function getAgentColor(phase: AgentStatusData['phase']) {
  switch (phase) {
    case 'completed':
      return 'border-emerald-500/20 bg-emerald-500/5'
    case 'error':
      return 'border-red-500/20 bg-red-500/5'
    case 'starting':
    case 'thinking':
    case 'generating':
    case 'reviewing':
      return 'border-blue-500/20 bg-blue-500/5'
    default:
      return 'border-white/10 bg-white/[0.02]'
  }
}

export function AgentStatusTracker({ agents, isAgenticMode }: AgentStatusTrackerProps) {
  if (!isAgenticMode || agents.length === 0) {
    return null
  }

  // Get unique agents by role, keeping the latest status for each
  const agentMap = new Map<AgentRole, AgentStatusData>()
  for (const agent of agents) {
    agentMap.set(agent.role, agent)
  }

  const activeAgents = AGENT_ORDER.filter(role => agentMap.has(role))
    .map(role => agentMap.get(role)!)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="w-full max-w-[36rem] rounded-xl border border-blue-500/20 bg-blue-500/5 p-3"
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-blue-300">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20">
          🤖
        </span>
        Agentic Pipeline
        <span className="ml-auto text-[10px] text-blue-400/60">
          {activeAgents.filter(a => a.phase === 'completed').length}/{activeAgents.length} agents
        </span>
      </div>

      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout">
          {activeAgents.map((agent) => (
            <motion.div
              key={agent.role}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${getAgentColor(agent.phase)}`}
            >
              {getAgentIcon(agent.phase)}
              <span className="font-medium text-white/80">
                {AGENT_DISPLAY_NAMES[agent.role] || agent.role}
              </span>
              <span className="ml-auto truncate text-[11px] text-white/50">
                {agent.message}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Agent Metadata Display ─────────────────────────────────────
interface AgentMetadata {
  agents_used: AgentRole[]
  complexity: string
  total_duration: number
  agent_durations: Record<string, number>
  review_score?: number
}

interface AgentMetadataDisplayProps {
  metadata?: AgentMetadata
}

export function AgentMetadataDisplay({ metadata }: AgentMetadataDisplayProps) {
  if (!metadata) return null

  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.035] p-2.5 text-xs">
      <div className="mb-1.5 flex items-center gap-2 text-white/60">
        <span>🤖</span>
        <span className="font-medium">Agentic Generation Info</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
        <div className="text-white/45">Complexity:</div>
        <div className="text-white/70 capitalize">{metadata.complexity}</div>
        <div className="text-white/45">Agents used:</div>
        <div className="text-white/70">{metadata.agents_used.length}</div>
        <div className="text-white/45">Total time:</div>
        <div className="text-white/70">{(metadata.total_duration / 1000).toFixed(1)}s</div>
        {metadata.review_score !== undefined && (
          <>
            <div className="text-white/45">Review score:</div>
            <div className={`font-medium ${metadata.review_score >= 80 ? 'text-emerald-400' : metadata.review_score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
              {metadata.review_score}/100
            </div>
          </>
        )}
      </div>
    </div>
  )
}

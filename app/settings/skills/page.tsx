'use client'

import { useState } from 'react'
import { Plus, Code, Globe, Database, Shield, Puzzle, Sparkles, Cpu, FileCode, Layers } from 'lucide-react'

interface Skill {
  id: string
  name: string
  description: string
  enabled: boolean
  icon: React.ElementType
}

const defaultSkills: Skill[] = [
  { id: 'code-gen', name: 'Code Generation', description: 'Generate production-ready code from natural language prompts', enabled: true, icon: Code },
  { id: 'web-search', name: 'Web Search', description: 'Search the web for up-to-date information and documentation', enabled: true, icon: Globe },
  { id: 'db-query', name: 'Database Queries', description: 'Generate, optimize, and debug SQL and NoSQL queries', enabled: true, icon: Database },
  { id: 'api-design', name: 'API Design', description: 'Design RESTful and GraphQL APIs with best practices', enabled: true, icon: Puzzle },
  { id: 'security-audit', name: 'Security Audit', description: 'Scan code for vulnerabilities and suggest fixes', enabled: true, icon: Shield },
  { id: 'ai-assist', name: 'AI Assistant', description: 'General-purpose AI assistant for questions and explanations', enabled: true, icon: Sparkles },
  { id: 'infra-gen', name: 'Infrastructure', description: 'Generate Docker, CI/CD, and cloud deployment configs', enabled: true, icon: Cpu },
  { id: 'doc-gen', name: 'Documentation', description: 'Auto-generate README, API docs, and code comments', enabled: true, icon: FileCode },
  { id: 'ui-gen', name: 'UI Generation', description: 'Create responsive UI components from descriptions or images', enabled: true, icon: Layers },
]

export default function SkillsPage() {
  const [skills, setSkills] = useState(defaultSkills)

  const toggleSkill = (id: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Skills</h1>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#ea580c]"
        >
          <Plus className="h-4 w-4" />
          Add skill
        </button>
      </div>
      <p className="mb-6 text-sm text-white/50">
        Enable and configure AI skills for your workspace.
      </p>

      <div className="space-y-2">
        {skills.map((skill) => (
          <div
            key={skill.id}
            className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:bg-white/[0.05]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
              <skill.icon className="h-5 w-5 text-white/60" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-white">{skill.name}</span>
              <p className="text-xs text-white/40">{skill.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={skill.enabled}
              onClick={() => toggleSkill(skill.id)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:ring-offset-2 focus:ring-offset-[#0b0d0b] ${
                skill.enabled ? 'bg-[#f97316]' : 'bg-white/20'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  skill.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

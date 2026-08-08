'use client'

import { useState } from 'react'
import { Plus, Code, Globe, Database, Shield, Puzzle } from 'lucide-react'

interface Skill {
  id: string
  name: string
  description: string
  enabled: boolean
  icon: React.ElementType
  category: string
}

const defaultSkills: Skill[] = [
  { id: 'code-gen', name: 'Code Generation', description: 'Generate code from natural language', enabled: true, icon: Code, category: 'Core' },
  { id: 'web-search', name: 'Web Search', description: 'Search the web for information', enabled: true, icon: Globe, category: 'Core' },
  { id: 'db-query', name: 'Database Queries', description: 'Generate and optimize SQL queries', enabled: true, icon: Database, category: 'Core' },
  { id: 'security-audit', name: 'Security Audit', description: 'Scan code for security vulnerabilities', enabled: false, icon: Shield, category: 'Advanced' },
  { id: 'api-design', name: 'API Design', description: 'Design RESTful and GraphQL APIs', enabled: true, icon: Puzzle, category: 'Advanced' },
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
          className="inline-flex items-center gap-2 rounded-lg bg-[#1EAEDB] px-4 py-2 text-sm font-medium text-black transition hover:bg-[#1EAEDB]/90"
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
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{skill.name}</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/40">
                  {skill.category}
                </span>
              </div>
              <p className="text-xs text-white/40">{skill.description}</p>
            </div>
            <button
              type="button"
              onClick={() => toggleSkill(skill.id)}
              className={`relative h-5 w-9 rounded-full transition ${
                skill.enabled ? 'bg-[#1EAEDB]' : 'bg-white/20'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  skill.enabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

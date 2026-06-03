import fs from 'fs'
import path from 'path'

export function getLLMGuide(): string {
  try {
    const llmGuidePath = path.join(process.cwd(), 'LLM.txt')
    return fs.readFileSync(llmGuidePath, 'utf-8')
  } catch (error) {
    console.error('Failed to read LLM.txt:', error)
    return `You are Magical AI, a highly skilled software engineer developed by priyx with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.`
  }
}

export function getLLMSection(content: string, sectionName: string): string {
  const sections = content.split('====')
  const section = sections.find(s =>
    s.trim().startsWith(sectionName) ||
    s.includes(sectionName)
  )
  return section ? section.trim() : ''
}

export function getTemplateInstructions(templateId: string): string {
  const guide = getLLMGuide()

  const sections = guide.split('====')
  const templateSection = sections.find(s =>
    s.trim().includes('TEMPLATE-SPECIFIC INSTRUCTIONS')
  )

  if (!templateSection) return ''

  const templateName = templateId.replace('-', ' ').toLowerCase()
  const lines = templateSection.split('\n')
  const startIndex = lines.findIndex(line =>
    line.toLowerCase().includes(templateName) ||
    line.toLowerCase().includes(templateId)
  )

  if (startIndex === -1) return ''

  // Get instructions until next template or section
  let endIndex = lines.findIndex((line, index) =>
    index > startIndex &&
    (line.startsWith('##') || line.startsWith('===='))
  )

  if (endIndex === -1) endIndex = lines.length

  return lines.slice(startIndex, endIndex).join('\n').trim()
}

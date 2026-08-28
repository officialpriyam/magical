import templates from './templates.json'

export default templates
export type Templates = typeof templates
export type TemplateId = keyof typeof templates
export type TemplateConfig = typeof templates[TemplateId]

export function templatesToPrompt(templates: Templates) {
  return `${Object.entries(templates).map(([id, t], index) => {
    const starterRepository = 'starterRepository' in t ? t.starterRepository : undefined
    const cliInit = 'cliInit' in t ? t.cliInit : undefined
    const starter = starterRepository
      ? ` Starter repository: ${starterRepository}. CLI init: ${cliInit || 'none'}. Treat this as the base starter; edit/create/delete files on top of it instead of generating an unrelated file layout.`
      : ''

    return `${index + 1}. ${id}: "${t.instructions}". File: ${t.file || 'none'}. Dependencies installed: ${t.lib ? t.lib.join(', ') : 'none'}. Port: ${t.port || 'none'}.${starter}`
  }).join('\n')}`
}

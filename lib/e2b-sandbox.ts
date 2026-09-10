import 'server-only'

import { Sandbox, type SandboxOpts } from '@e2b/code-interpreter'

export function isSecuredAccessCompatibilityError(error: unknown) {
  const message = error instanceof Error
    ? `${error.name} ${error.message}`
    : String(error)

  return /template is not compatible with secured access|secured access/i.test(message)
}

// Detects E2B's "404: template '<name>' not found" error — happens when a
// custom template alias (e.g. "vite-developer") was never built in the
// E2B account via `e2b template build`.
export function isTemplateNotFoundError(error: unknown) {
  const message = error instanceof Error
    ? `${error.name} ${error.message}`
    : String(error)

  return (
    /\btemplate\b.*\bnot found\b/i.test(message) ||
    (message.includes('404') && /\btemplate\b/i.test(message))
  )
}

const warnedMissingTemplates = new Set<string>()

export async function createE2BSandbox(
  template: string | undefined,
  opts: SandboxOpts = {},
): Promise<Sandbox> {
  const create = (sandboxOpts: SandboxOpts, templateId?: string) =>
    templateId
      ? Sandbox.create(templateId, sandboxOpts)
      : Sandbox.create(sandboxOpts)

  const resolveSecure = () => {
    if (process.env.E2B_SECURE_ACCESS === 'false') return false
    if (process.env.E2B_SECURE_ACCESS === 'true') return true
    // Default: skip secured access to avoid compatibility errors
    // Most templates don't support it yet — use secure:false by default
    return false
  }

  if (!template) {
    return create({ ...opts, secure: resolveSecure() })
  }

  try {
    return await create({ ...opts, secure: resolveSecure() }, template)
  } catch (error) {
    if (!isTemplateNotFoundError(error)) {
      throw error
    }

    // The custom template isn't built in this E2B account. Fall back to the
    // default E2B template (always available) so the sandbox still starts —
    // project files are written into it after creation regardless.
    if (!warnedMissingTemplates.has(template)) {
      warnedMissingTemplates.add(template)
      console.warn(
        `[E2B] Template "${template}" not found in this E2B account — using the default template instead. ` +
        `To use a dedicated template, run \`e2b template build\` with an e2b.template.toml defining "${template}".`,
      )
    }

    return create({ ...opts, secure: false })
  }
}

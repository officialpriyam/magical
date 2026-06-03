import 'server-only'

import { Sandbox, type SandboxOpts } from '@e2b/code-interpreter'

export function isSecuredAccessCompatibilityError(error: unknown) {
  const message = error instanceof Error
    ? `${error.name} ${error.message}`
    : String(error)

  return /template is not compatible with secured access|secured access/i.test(message)
}

export async function createE2BSandbox(
  template: string | undefined,
  opts: SandboxOpts = {},
): Promise<Sandbox> {
  const create = (sandboxOpts: SandboxOpts) =>
    template
      ? Sandbox.create(template, sandboxOpts)
      : Sandbox.create(sandboxOpts)

  if (process.env.E2B_SECURE_ACCESS === 'false') {
    return create({ ...opts, secure: false })
  }

  try {
    return await create(opts)
  } catch (error) {
    if (
      process.env.E2B_SECURE_ACCESS !== 'true' &&
      isSecuredAccessCompatibilityError(error)
    ) {
      console.warn('Retrying E2B sandbox creation with secure access disabled for an incompatible template.')
      return create({ ...opts, secure: false })
    }

    throw error
  }
}

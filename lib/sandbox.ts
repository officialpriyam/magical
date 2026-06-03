import { Sandbox } from '@e2b/code-interpreter'
import { createE2BSandbox } from './e2b-sandbox'

const E2B_API_KEY = process.env.E2B_API_KEY
const sandboxTimeout = 10 * 60 * 1000

const sandboxes = new Map<string, Sandbox>()

export async function getSandbox(sessionID: string, template?: string): Promise<Sandbox> {
  if (!E2B_API_KEY) {
    throw new Error('E2B_API_KEY environment variable not found')
  }

  if (sandboxes.has(sessionID)) {
    return sandboxes.get(sessionID)!
  }

  const sandbox = await createE2BSandbox(template || 'code-interpreter-v1', {
    apiKey: E2B_API_KEY,
    metadata: {
      sessionID,
      template: template || 'code-interpreter-v1',
    },
    timeoutMs: sandboxTimeout,
  })

  sandboxes.set(sessionID, sandbox)
  return sandbox
}

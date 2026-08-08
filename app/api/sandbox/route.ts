import { FragmentSchema } from '@/lib/schema'
import { ExecutionResultInterpreter, ExecutionResultWeb } from '@/lib/types'
import { createE2BSandbox } from '@/lib/e2b-sandbox'
import { getFragmentFiles, getTemplateFiles } from '@/lib/fragment-files'
import { getSupabaseProjectRuntimeEnv } from '@/lib/supabase-integration'
import { saveProjectFilesToR2 } from '@/lib/r2-workspace'
import { saveProjectFilesToSandboxStorage } from '@/lib/sandbox-storage'
import { createServerClient } from '@/lib/supabase-server'
import {
  chooseSandboxProvider,
  decodeSandboxId,
  encodeSandboxId,
  normalizeSandboxProviderMode,
  type SandboxProvider,
  type SandboxProviderMode,
} from '@/lib/sandbox-provider'
import {
  createVercelSandbox,
  getVercelSandbox,
  getVercelSandboxUrl,
  hasVercelSandboxConfig,
  installAndStartVercelProject,
  listVercelSandboxFiles,
  writeVercelProjectFiles,
} from '@/lib/vercel-sandbox'
import {
  createModalSandbox,
  getModalSandbox,
  getModalSandboxUrl,
  hasModalSandboxConfig,
  installAndStartModalProject,
  listModalSandboxFiles,
  writeModalProjectFiles,
} from '@/lib/modal-sandbox'
import { Sandbox } from '@e2b/code-interpreter'
import type { Sandbox as ModalSandbox } from 'modal'
import { FileSystemNode } from '@/components/file-tree'
import type { TemplateId } from '@/lib/templates'

const sandboxTimeout = 10 * 60 * 1000
type VercelSandboxInstance =
  | Awaited<ReturnType<typeof createVercelSandbox>>
  | Awaited<ReturnType<typeof getVercelSandbox>>

async function fetchSandboxFiles(sbx: Sandbox): Promise<FileSystemNode[]> {
  try {
    // Use E2B SDK's files.list() method for robust file listing
    const filesList = await sbx.files.list('/home/user')
    return convertE2BFilesToTree(filesList)
  } catch (error) {
    console.error('Error fetching sandbox files:', error)
    return []
  }
}

function convertE2BFilesToTree(e2bFiles: any[]): FileSystemNode[] {
  return e2bFiles
    .filter(file => !file.name.includes('node_modules')) // Filter out node_modules
    .map(file => {
      const node: FileSystemNode = {
        name: file.name,
        isDirectory: file.isDir,
        path: `/${file.path}`,
      }

      // Recursively convert children if it's a directory
      if (file.isDir && file.children) {
        node.children = convertE2BFilesToTree(file.children)
      }

      return node
    })
}

export const maxDuration = 120
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const {
      fragment,
      userID,
      teamID,
      accessToken,
      projectID,
      sandboxProvider,
      existingSandboxId,
    }: {
      fragment: FragmentSchema
      userID: string | undefined
      teamID: string | undefined
      accessToken: string | undefined
      projectID: string | undefined
      sandboxProvider?: SandboxProviderMode
      existingSandboxId?: string
    } = await req.json()

    if (!fragment) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing fragment data', 
          type: 'validation_error' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const providerMode = normalizeSandboxProviderMode(sandboxProvider)
    let selectedProvider = resolveSandboxProviderForFragment(providerMode, fragment)
    const reusableSandboxRef = getReusableSandboxRef(existingSandboxId)

    if (
      reusableSandboxRef &&
      (providerMode === 'auto' || providerMode === reusableSandboxRef.provider) &&
      isProviderAvailableForFragment(reusableSandboxRef.provider, fragment)
    ) {
      selectedProvider = reusableSandboxRef.provider
    }

    if (!selectedProvider) {
      console.error('No configured sandbox provider is available for this template.')
      return new Response(
        JSON.stringify({ 
          error: getNoSandboxProviderMessage(providerMode, fragment),
          type: 'config_error'
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabaseRuntimeEnv = await getSupabaseProjectRuntimeEnv(userID, projectID)
    const generatedFiles = getFragmentFiles(fragment)

    if (generatedFiles.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Missing code data',
          type: 'validation_error'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    let sbx: Sandbox | VercelSandboxInstance | ModalSandbox | null = null
    let createdSandbox = false
    try {
      sbx = await connectReusableSandbox(existingSandboxId, selectedProvider)

      if (!sbx) {
        createdSandbox = true
        if (selectedProvider === 'vercel') {
          sbx = await createVercelSandbox({
            template: fragment.template as TemplateId,
            userId: userID,
            teamId: teamID,
            projectId: projectID,
            port: fragment.port,
            env: supabaseRuntimeEnv,
            timeoutMs: sandboxTimeout,
          })
        } else if (selectedProvider === 'modal') {
          sbx = await createModalSandbox({
            template: fragment.template as TemplateId,
            userId: userID,
            teamId: teamID,
            projectId: projectID,
            port: fragment.port,
            env: supabaseRuntimeEnv,
            timeoutMs: sandboxTimeout,
          })
        } else {
          sbx = await createE2BSandbox(fragment.template, {
            metadata: {
              template: fragment.template,
              userID: userID ?? '',
              teamID: teamID ?? '',
            },
            timeoutMs: sandboxTimeout,
            ...(teamID && accessToken
              ? {
                  headers: {
                    'X-Supabase-Team': teamID,
                    'X-Supabase-Token': accessToken,
                  },
                }
              : {}),
          })
        }
      }
    } catch (sandboxError: any) {
      console.error(`${selectedProvider} sandbox creation failed:`, sandboxError)
      return new Response(
        JSON.stringify({ 
          error: `Failed to create ${selectedProvider} sandbox environment. Please try again later.`,
          type: 'sandbox_creation_error',
          details: sandboxError.message
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    try {
      const storageSave = saveGeneratedFilesToSandboxStorage({
        userID,
        projectID,
        files: generatedFiles,
        template: fragment.template as string,
      })

      if (selectedProvider === 'vercel') {
        await Promise.all([
          writeVercelProjectFiles(sbx as Awaited<ReturnType<typeof createVercelSandbox>>, generatedFiles, fragment.template as TemplateId),
          storageSave,
        ])
      } else if (selectedProvider === 'modal') {
        await Promise.all([
          writeModalProjectFiles(sbx as ModalSandbox, generatedFiles, fragment.template as TemplateId),
          storageSave,
        ])
      } else {
        await Promise.all([
          Promise.all(
            generatedFiles.map(async (file) => {
              await (sbx as Sandbox).files.write(file.path, file.content)
            }),
          ),
          storageSave,
        ])
      }

      if (fragment.template === 'code-interpreter-v1') {
        if (fragment.has_additional_dependencies && cleanCommand(fragment.install_dependencies_command)) {
          await (sbx as Sandbox).commands.run(fragment.install_dependencies_command)
        }

        const interpreterCode = fragment.code || generatedFiles[0]?.content || ''
        const { logs, error, results } = await (sbx as Sandbox).runCode(interpreterCode)

        // Fetch file tree after execution
        const files = await fetchSandboxFiles(sbx as Sandbox)

        return new Response(
          JSON.stringify({
            sbxId: encodeSandboxId('e2b', (sbx as Sandbox).sandboxId),
            sandboxProvider: selectedProvider,
            template: fragment.template,
            stdout: logs.stdout,
            stderr: logs.stderr,
            runtimeError: error,
            cellResults: results,
            files,
          } as ExecutionResultInterpreter),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (selectedProvider === 'vercel') {
        const vercelSandbox = sbx as Awaited<ReturnType<typeof createVercelSandbox>>

        await installAndStartVercelProject({
          sandbox: vercelSandbox,
          fragment,
          env: supabaseRuntimeEnv,
        })

        const files = await listVercelSandboxFiles(vercelSandbox)

        return new Response(
          JSON.stringify({
            sbxId: encodeSandboxId('vercel', vercelSandbox.name),
            sandboxProvider: selectedProvider,
            template: fragment.template,
            url: getVercelSandboxUrl(vercelSandbox, fragment.port || 3000),
            files,
          } as ExecutionResultWeb),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (selectedProvider === 'modal') {
        const modalSandbox = sbx as ModalSandbox

        await installAndStartModalProject({
          sandbox: modalSandbox,
          fragment,
          env: supabaseRuntimeEnv,
        })

        // Wait for server to start before getting tunnel URL
        await new Promise(resolve => setTimeout(resolve, 3000))

        const files = await listModalSandboxFiles(modalSandbox)
        const url = await getModalSandboxUrl(modalSandbox, fragment.port || 3000)

        return new Response(
          JSON.stringify({
            sbxId: encodeSandboxId('modal', modalSandbox.sandboxId),
            sandboxProvider: selectedProvider,
            template: fragment.template,
            url,
            files,
          } as ExecutionResultWeb),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }

      const installCommand = cleanCommand(fragment.install_dependencies_command)

      if (installCommand) {
        await (sbx as Sandbox).commands.run(installCommand, {
          envs: {
            PORT: (fragment.port || 80).toString(),
            ...supabaseRuntimeEnv,
          },
        })
      }

      // Fetch file tree after project setup
      const files = await fetchSandboxFiles(sbx as Sandbox)

      return new Response(
        JSON.stringify({
          sbxId: encodeSandboxId('e2b', (sbx as Sandbox).sandboxId),
          sandboxProvider: selectedProvider,
          template: fragment.template,
          url: `https://${(sbx as Sandbox).getHost(fragment.port || 80)}`,
          files,
        } as ExecutionResultWeb),
        { headers: { 'Content-Type': 'application/json' } }
      )
    } catch (executionError: any) {
      console.error('Sandbox execution error:', executionError)
      
      // Clean up sandbox on execution error
      try {
        if (createdSandbox) {
          if (selectedProvider === 'vercel') {
            await (sbx as Awaited<ReturnType<typeof createVercelSandbox>> | null)?.stop()
          } else if (selectedProvider === 'modal') {
            await (sbx as ModalSandbox | null)?.terminate()
          } else {
            await (sbx as Sandbox | null)?.kill()
          }
        }
      } catch {}

      return new Response(
        JSON.stringify({ 
          error: 'Code execution failed. There may be an error in your code or dependencies.',
          type: 'execution_error',
          details: executionError.message
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

  } catch (error: any) {
    console.error('Sandbox API Error:', error)
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred while setting up the sandbox.',
        type: 'unknown_error',
        details: error?.message || 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

function getReusableSandboxRef(encodedSandboxId: unknown) {
  if (typeof encodedSandboxId !== 'string' || !encodedSandboxId.trim()) {
    return null
  }

  return decodeSandboxId(encodedSandboxId)
}

async function connectReusableSandbox(
  encodedSandboxId: unknown,
  selectedProvider: SandboxProvider,
) {
  const sandboxRef = getReusableSandboxRef(encodedSandboxId)

  if (!sandboxRef) {
    return null
  }

  if (sandboxRef.provider !== selectedProvider) {
    return null
  }

  try {
    if (sandboxRef.provider === 'vercel') {
      return await getVercelSandbox(sandboxRef.id)
    }
    if (sandboxRef.provider === 'modal') {
      return await getModalSandbox(sandboxRef.id)
    }
    return await Sandbox.connect(sandboxRef.id)
  } catch (error) {
    console.warn('Could not reuse warm sandbox; creating a new one:', error)
    return null
  }
}

function resolveSandboxProviderForFragment(
  mode: SandboxProviderMode,
  fragment: FragmentSchema,
): SandboxProvider | null {
  const available: SandboxProvider[] = []

  if (isProviderAvailableForFragment('e2b', fragment)) {
    available.push('e2b')
  }

  if (isProviderAvailableForFragment('modal', fragment)) {
    available.push('modal')
  }

  if (isProviderAvailableForFragment('vercel', fragment)) {
    available.push('vercel')
  }

  return chooseSandboxProvider({ mode, available })
}

function isProviderAvailableForFragment(provider: SandboxProvider, fragment: FragmentSchema) {
  if (provider === 'e2b') {
    return Boolean(process.env.E2B_API_KEY)
  }

  if (provider === 'modal') {
    return hasModalSandboxConfig()
  }

  return fragment.template !== 'code-interpreter-v1' && hasVercelSandboxConfig()
}

function getNoSandboxProviderMessage(
  mode: SandboxProviderMode,
  fragment: FragmentSchema,
) {
  if (mode === 'vercel' && fragment.template === 'code-interpreter-v1') {
    return 'Vercel Sandbox is only available for app previews. Python code interpreter requires E2B_API_KEY or Modal Sandbox.'
  }

  if (mode === 'modal') {
    return 'Modal Sandbox is not configured. Set MODAL_TOKEN_ID and MODAL_TOKEN_SECRET.'
  }

  if (mode === 'vercel') {
    return 'Vercel Sandbox is not configured. Set VERCEL_OIDC_TOKEN or VERCEL_TEAM_ID, VERCEL_PROJECT_ID, and VERCEL_TOKEN.'
  }

  if (mode === 'e2b') {
    return 'E2B is not configured. Set E2B_API_KEY or choose Modal or Vercel Sandbox.'
  }

  return 'No sandbox provider is configured. Set E2B_API_KEY, MODAL_TOKEN_ID/SECRET, or configure Vercel Sandbox.'
}

function cleanCommand(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

async function saveGeneratedFilesToR2({
  userID,
  projectID,
  files,
}: {
  userID?: string
  projectID?: string
  files: ReturnType<typeof getFragmentFiles>
}) {
  if (!projectID || files.length === 0) {
    return
  }

  const authenticatedUserId = await getAuthenticatedUserId()

  if (!authenticatedUserId || (userID && userID !== authenticatedUserId)) {
    return
  }

  try {
    await saveProjectFilesToR2({
      userId: authenticatedUserId,
      projectId: projectID,
      files,
    })
  } catch (error) {
    console.warn('Cloudflare R2 workspace backup failed:', error)
  }
}

async function saveGeneratedFilesToSandboxStorage({
  userID,
  projectID,
  files,
  template,
}: {
  userID?: string
  projectID?: string
  files: ReturnType<typeof getFragmentFiles>
  template?: string
}) {
  if (!projectID || files.length === 0) {
    return
  }

  const authenticatedUserId = await getAuthenticatedUserId()

  if (!authenticatedUserId || (userID && userID !== authenticatedUserId)) {
    return
  }

  const templateFiles = getTemplateFiles(template)
  const allFiles = [...templateFiles, ...files]

  try {
    const result = await saveProjectFilesToSandboxStorage({
      userId: authenticatedUserId,
      projectId: projectID,
      files: allFiles,
    })

    if (!result.saved && result.reason === 'not_configured') {
      await saveGeneratedFilesToR2({ userID, projectID, files: allFiles })
    }
  } catch (error) {
    console.warn('External sandbox storage backup failed:', error)
    await saveGeneratedFilesToR2({ userID, projectID, files: allFiles })
  }
}

async function getAuthenticatedUserId() {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    return user?.id || ''
  } catch {
    return ''
  }
}

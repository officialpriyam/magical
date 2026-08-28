import 'server-only'

import { Daytona, type Sandbox as DaytonaSandbox } from '@daytona/sdk'
import type { FragmentSchema } from '@/lib/schema'
import { getTemplateFiles, type GeneratedFile } from '@/lib/fragment-files'
import type { TemplateId } from '@/lib/templates'
import type { FileSystemNode } from '@/components/file-tree'

const SKIP_PATH_RE = /(^|\/)(\.git|node_modules|\.next|\.nuxt|dist|build|coverage|__pycache__|\.cache)(\/|$)/

export function hasDaytonaSandboxConfig() {
  return Boolean(process.env.DAYTONA_API_KEY?.trim())
}

function getDaytonaClient() {
  return new Daytona({
    apiKey: process.env.DAYTONA_API_KEY!.trim(),
    apiUrl: process.env.DAYTONA_API_URL?.trim() || undefined,
    target: process.env.DAYTONA_TARGET?.trim() || undefined,
  })
}

export async function createDaytonaSandbox({
  template,
  userId,
  teamId,
  projectId,
  port,
  env,
  timeoutMs,
}: {
  template: TemplateId
  userId?: string
  teamId?: string
  projectId?: string
  port?: number | null
  env?: Record<string, string>
  timeoutMs: number
}): Promise<DaytonaSandbox> {
  const daytona = getDaytonaClient()

  const sandbox = await daytona.create({
    snapshot: 'daytona-medium',
    language: isPythonTemplate(template) ? 'python' : 'typescript',
  })

  return sandbox
}

export async function getDaytonaSandbox(sandboxId: string): Promise<DaytonaSandbox> {
  const daytona = getDaytonaClient()
  const sandboxes = await daytona.list()
  for await (const sbx of sandboxes) {
    if (sbx.id === sandboxId) {
      return sbx
    }
  }
  throw new Error(`Daytona sandbox ${sandboxId} not found`)
}

export async function writeDaytonaProjectFiles(
  sandbox: DaytonaSandbox,
  files: GeneratedFile[],
  template: TemplateId,
) {
  const workdir = '/workspace'
  const mergedFiles = new Map<string, GeneratedFile>()

  for (const file of getTemplateFiles(template)) {
    mergedFiles.set(file.path, file)
  }

  for (const file of files) {
    mergedFiles.set(file.path, file)
  }

  // Ensure workspace directory exists
  await sandbox.process.executeCommand(`mkdir -p ${workdir}`)

  for (const file of mergedFiles.values()) {
    if (SKIP_PATH_RE.test(file.path)) continue
    const fullPath = `${workdir}/${file.path}`
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'))
    if (dir) {
      await sandbox.process.executeCommand(`mkdir -p ${dir}`)
    }
    await sandbox.fs.uploadFile(Buffer.from(file.content), fullPath)
  }
}

export async function installAndStartDaytonaProject({
  sandbox,
  fragment,
  env,
}: {
  sandbox: DaytonaSandbox
  fragment: FragmentSchema
  env?: Record<string, string>
}) {
  const workdir = '/workspace'
  const installCmd = fragment.install_dependencies_command?.trim()
  const template = fragment.template

  if (installCmd) {
    await sandbox.process.executeCommand(`cd ${workdir} && ${installCmd}`)
  }

  // Start the dev server
  const startCmd = getStartCommand(template)
  if (startCmd) {
    await sandbox.process.executeCommand(`cd ${workdir} && ${startCmd}`)
  }
}

export async function listDaytonaSandboxFiles(
  sandbox: DaytonaSandbox,
): Promise<FileSystemNode[]> {
  try {
    const workdir = '/workspace'
    const result = await sandbox.process.executeCommand(
      `find ${workdir} -maxdepth 5 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/.next/*' | head -200`
    )
    const lines = result.result.split('\n').filter(Boolean)
    return lines.map((line: string) => ({
      name: line.split('/').pop() || line,
      path: line,
      isDirectory: !line.includes('.'),
    }))
  } catch (error) {
    console.error('Error listing Daytona sandbox files:', error)
    return []
  }
}

export async function runDaytonaShellCommand(
  sandbox: DaytonaSandbox,
  cmd: string,
  opts?: { timeoutMs?: number },
): Promise<any> {
  return sandbox.process.executeCommand(cmd)
}

export function getDaytonaSandboxUrl(
  sandbox: DaytonaSandbox,
  port: number,
): string {
  // Daytona provides tunnel URLs for exposed ports
  return `https://${sandbox.id}-${port}.daytona.app`
}

function isPythonTemplate(template: string) {
  return template === 'code-interpreter-v1' || template === 'streamlit-developer' || template === 'gradio-developer'
}

function getStartCommand(template: string): string | null {
  if (template === 'nextjs-developer' || template === 'remix-developer') {
    return 'npm run dev'
  }
  if (
    template === 'react-developer' ||
    template === 'vite-developer' ||
    template === 'vue-developer' ||
    template === 'svelte-developer' ||
    template === 'pwa-mobile' ||
    template === 'vite-react-developer' ||
    template === 'vite-vue-developer'
  ) {
    return 'npm run dev'
  }
  if (template === 'streamlit-developer') {
    return 'streamlit run app.py --server.port 8501 --server.headless true'
  }
  if (template === 'gradio-developer') {
    return 'python app.py'
  }
  if (template === 'code-interpreter-v1') {
    return null
  }
  return 'npm run dev'
}

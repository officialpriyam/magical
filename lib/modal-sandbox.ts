import 'server-only'

import path from 'node:path'
import { ModalClient, type Sandbox, type Image } from 'modal'
import type { FragmentSchema } from '@/lib/schema'
import type { GeneratedFile } from '@/lib/fragment-files'
import type { TemplateId } from '@/lib/templates'
import type { FileSystemNode } from '@/components/file-tree'

export const MODAL_WORKDIR = '/workspace'

const DEFAULT_NODE_IMAGE = 'node:20-slim'
const DEFAULT_PYTHON_IMAGE = 'python:3.11-slim'
const SKIP_PATH_RE = /(^|\/)(\.git|node_modules|\.next|\.nuxt|dist|build|coverage|__pycache__|\.cache)(\/|$)/

export function hasModalSandboxConfig() {
  return Boolean(
    (process.env.MODAL_TOKEN_ID?.trim() && process.env.MODAL_TOKEN_SECRET?.trim()) ||
      process.env.MODAL_API_KEY?.trim(),
  )
}

function getModalClient() {
  const tokenId = process.env.MODAL_TOKEN_ID?.trim()
  const tokenSecret = process.env.MODAL_TOKEN_SECRET?.trim()

  if (tokenId && tokenSecret) {
    return new ModalClient({ tokenId, tokenSecret })
  }

  return new ModalClient()
}

export async function createModalSandbox({
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
}): Promise<Sandbox> {
  const modal = getModalClient()
  const appName = process.env.MODAL_APP_NAME || 'magical-ai'
  const app = await modal.apps.fromName(appName, { createIfMissing: true })
  const image = getModalImage(modal, template)

  const ports = typeof port === 'number' ? [port] : []

  const sandbox = await modal.sandboxes.create(app, image, {
    workdir: MODAL_WORKDIR,
    timeoutMs,
    unencryptedPorts: ports,
    env,
  })

  // Ensure workspace directory exists
  await sandbox.exec(['mkdir', '-p', MODAL_WORKDIR])

  return sandbox
}

export async function getModalSandbox(sandboxId: string): Promise<Sandbox> {
  const modal = getModalClient()
  return modal.sandboxes.fromId(sandboxId)
}

export async function writeModalProjectFiles(
  sandbox: Sandbox,
  files: GeneratedFile[],
  template: TemplateId,
) {
  const baseFiles = getModalTemplateFiles(template)
  const mergedFiles = new Map<string, string | Uint8Array>()

  for (const file of baseFiles) {
    mergedFiles.set(file.path, file.content)
  }

  for (const file of files) {
    const relativePath = toModalRelativePath(file.path)
    if (relativePath) {
      mergedFiles.set(relativePath, file.content)
    }
  }

  for (const [filePath, content] of mergedFiles) {
    await writeSingleFileToModal(sandbox, filePath, content)
  }
}

export async function installAndStartModalProject({
  sandbox,
  fragment,
  env,
}: {
  sandbox: Sandbox
  fragment: FragmentSchema
  env?: Record<string, string>
}) {
  const template = fragment.template as TemplateId
  const port = fragment.port || getDefaultPort(template)
  const baseInstallCommand = getModalBaseInstallCommand(template)
  const extraInstallCommand = cleanCommand(fragment.install_dependencies_command)
  const commandEnv = {
    PORT: String(port),
    ...env,
  }

  if (baseInstallCommand) {
    await runCheckedModalCommand(sandbox, baseInstallCommand, {
      env: commandEnv,
      timeoutMs: 120_000,
      label: 'Modal sandbox dependency install failed',
    })
  }

  if (fragment.has_additional_dependencies && extraInstallCommand) {
    await runCheckedModalCommand(sandbox, extraInstallCommand, {
      env: commandEnv,
      timeoutMs: 120_000,
      label: 'Modal sandbox additional dependency install failed',
    })
  }

  const startCommand = getModalStartCommand(template, port)

  if (startCommand) {
    // Launch start command in background inside container using nohup
    await sandbox.exec(
      ['bash', '-c', `nohup ${startCommand} > /workspace/server.log 2>&1 &`],
      {
        workdir: MODAL_WORKDIR,
        env: commandEnv,
      },
    )
  }
}

export async function runModalShellCommand(
  sandbox: Sandbox,
  command: string,
  {
    env,
    timeoutMs,
    cwd = MODAL_WORKDIR,
  }: {
    env?: Record<string, string>
    timeoutMs?: number
    cwd?: string
  } = {},
) {
  return sandbox.exec(['bash', '-lc', command], {
    workdir: cwd,
    env,
    timeoutMs,
  })
}

export async function runCheckedModalCommand(
  sandbox: Sandbox,
  command: string,
  {
    env,
    timeoutMs = 60_000,
    label = 'Modal sandbox command failed',
  }: {
    env?: Record<string, string>
    timeoutMs?: number
    label?: string
  } = {},
) {
  const proc = await runModalShellCommand(sandbox, command, {
    env,
    timeoutMs,
  })

  const exitCode = await proc.wait()

  if (exitCode !== 0) {
    const stdout = await proc.stdout.readText().catch(() => '')
    const stderr = await proc.stderr.readText().catch(() => '')
    throw new Error(
      `${label} with exit code ${exitCode}.\n${[stdout, stderr].filter(Boolean).join('\n')}`,
    )
  }

  return proc
}

export async function listModalSandboxFiles(sandbox: Sandbox): Promise<FileSystemNode[]> {
  try {
    const proc = await sandbox.exec(
      ['find', '.', '-mindepth', '1', '-maxdepth', '5', '-not', '-path', '*/.*'],
      { workdir: MODAL_WORKDIR },
    )
    await proc.wait()
    const rawOutput = await proc.stdout.readText().catch(() => '')
    const paths = rawOutput.split('\n').filter(Boolean)

    return buildFileTreeFromPaths(paths)
  } catch (error) {
    console.error('Error listing Modal sandbox files:', error)
    return []
  }
}

export async function readModalSandboxFile(sandbox: Sandbox, filePath: string) {
  const absolutePath = toModalAbsolutePath(filePath)
  const proc = await sandbox.exec(['cat', absolutePath])
  const exitCode = await proc.wait()
  if (exitCode !== 0) {
    return ''
  }
  return proc.stdout.readText().catch(() => '')
}

export async function writeModalSandboxFile(
  sandbox: Sandbox,
  filePath: string,
  content: string,
) {
  await writeSingleFileToModal(sandbox, filePath, content)
}

export async function renameModalSandboxFile(
  sandbox: Sandbox,
  oldPath: string,
  newPath: string,
) {
  const oldAbs = toModalAbsolutePath(oldPath)
  const newAbs = toModalAbsolutePath(newPath)
  const newDir = path.posix.dirname(newAbs)

  await sandbox.exec(['mkdir', '-p', newDir])
  await sandbox.exec(['mv', oldAbs, newAbs])
}

export async function deleteModalSandboxFile(sandbox: Sandbox, filePath: string) {
  const abs = toModalAbsolutePath(filePath)
  await sandbox.exec(['rm', '-rf', abs])
}

export async function getModalSandboxUrl(sandbox: Sandbox, port?: number | null) {
  if (!port) {
    return ''
  }

  try {
    const tunnels = await sandbox.tunnels(10_000)
    const tunnel = tunnels[port]
    return tunnel?.url || ''
  } catch (error) {
    console.warn(`Could not resolve Modal sandbox tunnel for port ${port}:`, error)
    return ''
  }
}

function getModalImage(modal: ModalClient, template: TemplateId): Image {
  if (template === 'streamlit-developer' || template === 'gradio-developer' || template === 'code-interpreter-v1') {
    return modal.images.fromRegistry(
      process.env.MODAL_SANDBOX_PYTHON_IMAGE || DEFAULT_PYTHON_IMAGE,
    )
  }

  return modal.images.fromRegistry(
    process.env.MODAL_SANDBOX_NODE_IMAGE || DEFAULT_NODE_IMAGE,
  )
}

async function writeSingleFileToModal(
  sandbox: Sandbox,
  filePath: string,
  content: string | Uint8Array,
) {
  const absolutePath = toModalAbsolutePath(filePath)
  const dir = path.posix.dirname(absolutePath)

  await sandbox.exec(['mkdir', '-p', dir])

  const base64Content = typeof content === 'string'
    ? Buffer.from(content, 'utf8').toString('base64')
    : Buffer.from(content).toString('base64')

  const proc = await sandbox.exec([
    'bash',
    '-c',
    `echo "${base64Content}" | base64 -d > "${absolutePath}"`,
  ])
  await proc.wait()
}

function getModalTemplateFiles(template: TemplateId): GeneratedFile[] {
  if (template === 'nextjs-developer') {
    return [
      {
        path: 'package.json',
        content: JSON.stringify(
          {
            scripts: {
              dev: 'next dev',
              build: 'next build',
              start: 'next start',
            },
            dependencies: {
              '@types/node': 'latest',
              '@types/react': 'latest',
              '@types/react-dom': 'latest',
              autoprefixer: 'latest',
              next: '^14.2.20',
              postcss: 'latest',
              react: '^18.3.1',
              'react-dom': '^18.3.1',
              tailwindcss: '^3.4.17',
              typescript: 'latest',
            },
            devDependencies: {},
          },
          null,
          2,
        ),
      },
      {
        path: 'pages/_app.tsx',
        content:
          'import "@/styles/globals.css";\nimport type { AppProps } from "next/app";\n\nexport default function App({ Component, pageProps }: AppProps) {\n  return <Component {...pageProps} />;\n}\n',
      },
      {
        path: 'styles/globals.css',
        content:
          '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nhtml, body, #__next {\n  min-height: 100%;\n}\nbody {\n  margin: 0;\n}\n',
      },
      {
        path: 'tailwind.config.ts',
        content:
          'import type { Config } from "tailwindcss";\n\nconst config: Config = {\n  content: ["./pages/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./app/**/*.{js,ts,jsx,tsx}"],\n  theme: { extend: {} },\n  plugins: [],\n};\n\nexport default config;\n',
      },
      {
        path: 'postcss.config.js',
        content:
          'module.exports = {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n',
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify(
          {
            compilerOptions: {
              target: 'es5',
              lib: ['dom', 'dom.iterable', 'esnext'],
              allowJs: true,
              skipLibCheck: true,
              strict: false,
              noEmit: true,
              esModuleInterop: true,
              module: 'esnext',
              moduleResolution: 'bundler',
              resolveJsonModule: true,
              isolatedModules: true,
              jsx: 'preserve',
              incremental: true,
              baseUrl: '.',
              paths: {
                '@/*': ['./*'],
              },
            },
            include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
            exclude: ['node_modules'],
          },
          null,
          2,
        ),
      },
    ]
  }

  if (template === 'vue-developer') {
    return [
      {
        path: 'package.json',
        content: JSON.stringify(
          {
            scripts: {
              dev: 'nuxt dev',
              build: 'nuxt build',
              start: 'nuxt start',
            },
            dependencies: {
              '@nuxtjs/tailwindcss': 'latest',
              nuxt: '^3.13.0',
              vue: 'latest',
            },
            devDependencies: {},
          },
          null,
          2,
        ),
      },
      {
        path: 'nuxt.config.ts',
        content:
          'export default defineNuxtConfig({\n  compatibilityDate: "2024-04-03",\n  devtools: { enabled: false },\n  modules: ["@nuxtjs/tailwindcss"],\n  vite: { server: { hmr: { protocol: "wss" } } },\n});\n',
      },
      {
        path: 'tailwind.config.ts',
        content:
          'export default {\n  content: ["./app.vue", "./components/**/*.{vue,js,ts}"],\n  theme: { extend: {} },\n  plugins: [],\n};\n',
      },
    ]
  }

  if (template === 'streamlit-developer') {
    return [
      {
        path: 'requirements.txt',
        content:
          'streamlit\npandas\nnumpy\nmatplotlib\nrequests\nseaborn\nplotly\n',
      },
    ]
  }

  if (template === 'gradio-developer') {
    return [
      {
        path: 'requirements.txt',
        content:
          'gradio\npandas\nnumpy\nmatplotlib\nrequests\nseaborn\nplotly\n',
      },
    ]
  }

  return []
}

function getModalBaseInstallCommand(template: TemplateId) {
  if (template === 'streamlit-developer' || template === 'gradio-developer' || template === 'code-interpreter-v1') {
    return 'python -m pip install --upgrade pip && python -m pip install -r requirements.txt'
  }

  if (template === 'nextjs-developer' || template === 'vue-developer') {
    return 'npm install --no-audit --no-fund'
  }

  return ''
}

function getModalStartCommand(template: TemplateId, port: number) {
  if (template === 'nextjs-developer') {
    return `npm run dev -- --hostname 0.0.0.0 --port ${port}`
  }

  if (template === 'vue-developer') {
    return `npm run dev -- --host 0.0.0.0 --port ${port}`
  }

  if (template === 'streamlit-developer') {
    return `python -m streamlit run app.py --server.address 0.0.0.0 --server.port ${port} --server.headless true --browser.gatherUsageStats false`
  }

  if (template === 'gradio-developer') {
    return `GRADIO_SERVER_NAME=0.0.0.0 GRADIO_SERVER_PORT=${port} python app.py`
  }

  return ''
}

function getDefaultPort(template: TemplateId) {
  if (template === 'streamlit-developer') return 8501
  if (template === 'gradio-developer') return 7860
  return 3000
}

function toModalRelativePath(filePath: string) {
  const normalized = filePath
    .replace(/\\/g, '/')
    .replace(/^\/workspace\/?/, '')
    .replace(/^\/home\/user\/?/, '')
    .replace(/^\/+/, '')
    .trim()

  if (!normalized) {
    return ''
  }

  const safePath = path.posix.normalize(`/${normalized}`).slice(1)

  if (!safePath || safePath === '..' || safePath.startsWith('../')) {
    throw new Error('Access denied: Invalid path')
  }

  return safePath
}

function toModalAbsolutePath(filePath: string) {
  const relativePath = toModalRelativePath(filePath)
  return path.posix.join(MODAL_WORKDIR, relativePath)
}

function cleanCommand(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function buildFileTreeFromPaths(paths: string[]): FileSystemNode[] {
  const rootNodes: FileSystemNode[] = []

  for (const rawPath of paths) {
    const cleanPath = rawPath.replace(/^\.\//, '').trim()
    if (!cleanPath || SKIP_PATH_RE.test(cleanPath)) continue

    const parts = cleanPath.split('/')
    let currentLevel = rootNodes

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const isDir = !isLast
      const pathSoFar = `/${parts.slice(0, i + 1).join('/')}`

      let existing = currentLevel.find((node) => node.name === part)

      if (!existing) {
        existing = {
          name: part,
          isDirectory: isDir,
          path: pathSoFar,
          ...(isDir ? { children: [] } : {}),
        }
        currentLevel.push(existing)
      }

      if (existing.isDirectory && existing.children) {
        currentLevel = existing.children
      }
    }
  }

  return rootNodes
}

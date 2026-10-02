import 'server-only'

import crypto from 'node:crypto'
import path from 'node:path'
import type { FragmentSchema } from '@/lib/schema'
import { getTemplateFiles, type GeneratedFile } from '@/lib/fragment-files'
import type { TemplateId } from '@/lib/templates'
import type { FileSystemNode } from '@/components/file-tree'
import { Sandbox } from '@vercel/sandbox'

export const VERCEL_WORKDIR = '/vercel/sandbox'
export const VERCEL_DEV_LOG_PATH = '/tmp/magical-dev.log'

type VercelSandbox = Sandbox

type CommandResult = {
  exitCode: number
  stdout(opts?: { signal?: AbortSignal }): Promise<string>
  stderr(opts?: { signal?: AbortSignal }): Promise<string>
}

const DEFAULT_NODE_RUNTIME = 'node24'
const DEFAULT_PYTHON_RUNTIME = 'python3.13'
const MAX_VERCEL_TIMEOUT_MS = 24 * 60 * 60 * 1000
const INSTALL_STAMP_PATH = '/tmp/magical-install.stamp'
const INSTALL_LOCK_PATH = '/tmp/magical-install.lock'
const DEPENDENCY_FINGERPRINT_COMMAND = `sha1sum package.json requirements.txt 2>/dev/null | sha1sum | cut -d' ' -f1`
const SKIP_PATH_RE = /(^|\/)(\.git|node_modules|\.next|\.nuxt|dist|build|coverage|__pycache__|\.cache)(\/|$)/

export function hasVercelSandboxConfig() {
  // Only report Vercel Sandbox as available when real credentials exist.
  // `VERCEL` / `VERCEL_URL` are set automatically on every Vercel deployment
  // and do NOT grant Sandbox API access, so checking them caused the provider
  // to be selected without credentials and fail with "Failed to start a project sandbox."
  return Boolean(
    process.env.VERCEL_OIDC_TOKEN?.trim() ||
      (
        process.env.VERCEL_TEAM_ID?.trim() &&
        process.env.VERCEL_PROJECT_ID?.trim() &&
        process.env.VERCEL_TOKEN?.trim()
      ),
  )
}

export async function createVercelSandbox({
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
}) {
  const runtime = getVercelRuntime(template)
  const credentials = getVercelCredentialParams()

  return Sandbox.create({
    ...credentials,
    name: buildVercelSandboxName(projectId),
    runtime,
    ports: typeof port === 'number' ? [port] : [],
    timeout: getConfiguredVercelTimeout(timeoutMs),
    resources: {
      vcpus: getVercelVcpus(),
    },
    env,
    tags: {
      app: 'magical-ai',
      template: template.slice(0, 63),
      ...(userId ? { user: userId.slice(0, 63) } : {}),
      ...(teamId ? { team: teamId.slice(0, 63) } : {}),
    },
  })
}

export async function getVercelSandbox(name: string) {
  return Sandbox.get({
    ...getVercelCredentialParams(),
    name,
  })
}

export async function writeVercelProjectFiles(
  sandbox: VercelSandbox,
  files: GeneratedFile[],
  template: TemplateId,
) {
  const baseFiles = getVercelTemplateFiles(template)
  const mergedFiles = new Map<string, string | Uint8Array>()

  for (const file of baseFiles) {
    mergedFiles.set(file.path, file.content)
  }

  for (const file of files) {
    const relativePath = toVercelRelativePath(file.path)

    if (relativePath) {
      mergedFiles.set(relativePath, file.content)
    }
  }

  await sandbox.writeFiles(
    Array.from(mergedFiles, ([filePath, content]) => ({
      path: filePath,
      content,
    })),
  )
}

export async function installAndStartVercelProject({
  sandbox,
  fragment,
  env,
}: {
  sandbox: VercelSandbox
  fragment: FragmentSchema
  env?: Record<string, string>
}) {
  const template = fragment.template as TemplateId
  const port = fragment.port || getDefaultPort(template)
  const extraInstallCommand = cleanCommand(fragment.install_dependencies_command)
  const commandEnv = {
    PORT: String(port),
    ...env,
  }

  await installVercelProjectDependencies(sandbox, template, commandEnv)

  if (fragment.has_additional_dependencies && extraInstallCommand) {
    await runCheckedVercelCommand(sandbox, extraInstallCommand, {
      env: commandEnv,
      timeoutMs: 120_000,
      label: 'Vercel sandbox additional dependency install failed',
    })

    await refreshVercelInstallStamp(sandbox)
  }

  const startCommand = getVercelStartCommand(template, port)

  if (startCommand) {
    await runVercelShellCommand(sandbox, `${startCommand} > ${VERCEL_DEV_LOG_PATH} 2>&1`, {
      env: commandEnv,
      detached: true,
    })
  }
}

export async function installVercelProjectDependencies(
  sandbox: VercelSandbox,
  template: TemplateId,
  env?: Record<string, string>,
) {
  const baseInstallCommand = getVercelBaseInstallCommand(template)

  if (!baseInstallCommand) {
    return
  }

  await runCheckedVercelCommand(sandbox, buildCachedInstallCommand(baseInstallCommand), {
    env,
    timeoutMs: 300_000,
    label: 'Vercel sandbox dependency install failed',
  })
}

function buildCachedInstallCommand(installCommand: string) {
  // Skip the install when the dependency manifests are unchanged since the last
  // successful run; the lock keeps warm-start and generation installs from
  // racing on the same node_modules.
  return [
    `i=0; while [ -f ${INSTALL_LOCK_PATH} ] && [ $i -lt 90 ]; do sleep 2; i=$((i+1)); done`,
    `touch ${INSTALL_LOCK_PATH}`,
    `FP=$(${DEPENDENCY_FINGERPRINT_COMMAND})`,
    `if { [ -f package.json ] || [ -f requirements.txt ]; } && [ -n "$FP" ] && [ -f ${INSTALL_STAMP_PATH} ] && [ "$(cat ${INSTALL_STAMP_PATH})" = "$FP" ]; then rm -f ${INSTALL_LOCK_PATH}; echo "Dependencies already installed - skipping install"; else ${installCommand}; STATUS=$?; if [ $STATUS -eq 0 ]; then echo "$FP" > ${INSTALL_STAMP_PATH}; fi; rm -f ${INSTALL_LOCK_PATH}; exit $STATUS; fi`,
  ].join('; ')
}

async function refreshVercelInstallStamp(sandbox: VercelSandbox) {
  await runVercelShellCommand(
    sandbox,
    `FP=$(${DEPENDENCY_FINGERPRINT_COMMAND}); if [ -n "$FP" ]; then echo "$FP" > ${INSTALL_STAMP_PATH}; fi`,
  ).catch(() => {})
}

export async function runVercelShellCommand(
  sandbox: VercelSandbox,
  command: string,
  {
    env,
    detached = false,
    timeoutMs,
    cwd = VERCEL_WORKDIR,
  }: {
    env?: Record<string, string>
    detached?: boolean
    timeoutMs?: number
    cwd?: string
  } = {},
) {
  return sandbox.runCommand({
    cmd: 'sh',
    args: ['-lc', command],
    cwd,
    env,
    detached,
    timeoutMs,
  })
}

export async function runCheckedVercelCommand(
  sandbox: VercelSandbox,
  command: string,
  {
    env,
    timeoutMs = 30_000,
    label = 'Vercel sandbox command failed',
  }: {
    env?: Record<string, string>
    timeoutMs?: number
    label?: string
  } = {},
) {
  const result = await runVercelShellCommand(sandbox, command, {
    env,
    timeoutMs,
  }) as CommandResult

  if (result.exitCode !== 0) {
    const [stdout, stderr] = await Promise.all([
      result.stdout().catch(() => ''),
      result.stderr().catch(() => ''),
    ])

    throw new Error(
      `${label} with exit code ${result.exitCode}.\n${[stdout, stderr].filter(Boolean).join('\n')}`,
    )
  }

  return result
}

export async function listVercelSandboxFiles(sandbox: VercelSandbox) {
  return listVercelDirectory(sandbox, VERCEL_WORKDIR)
}

export async function readVercelSandboxFile(sandbox: VercelSandbox, filePath: string) {
  const absolutePath = toVercelAbsolutePath(filePath)
  const buffer = await sandbox.readFileToBuffer({ path: absolutePath })

  return buffer?.toString('utf8') || ''
}

export async function writeVercelSandboxFile(
  sandbox: VercelSandbox,
  filePath: string,
  content: string,
) {
  const absolutePath = toVercelAbsolutePath(filePath)
  await sandbox.fs.mkdir(path.posix.dirname(absolutePath), { recursive: true })
  await sandbox.fs.writeFile(absolutePath, content, 'utf8')
}

export async function renameVercelSandboxFile(
  sandbox: VercelSandbox,
  oldPath: string,
  newPath: string,
) {
  const oldAbsolutePath = toVercelAbsolutePath(oldPath)
  const newAbsolutePath = toVercelAbsolutePath(newPath)

  await sandbox.fs.mkdir(path.posix.dirname(newAbsolutePath), { recursive: true })
  await sandbox.fs.rename(oldAbsolutePath, newAbsolutePath)
}

export async function deleteVercelSandboxFile(
  sandbox: VercelSandbox,
  filePath: string,
) {
  await sandbox.fs.rm(toVercelAbsolutePath(filePath), {
    recursive: true,
    force: true,
  })
}

export function getVercelSandboxUrl(sandbox: VercelSandbox, port?: number | null) {
  if (!port) {
    return ''
  }

  return sandbox.domain(port)
}

function getVercelCredentialParams() {
  const token = process.env.VERCEL_TOKEN?.trim()
  const teamId = process.env.VERCEL_TEAM_ID?.trim()
  const projectId = process.env.VERCEL_PROJECT_ID?.trim()

  if (!token || !teamId || !projectId) {
    return {}
  }

  return {
    token,
    teamId,
    projectId,
  }
}

function getVercelRuntime(template: TemplateId) {
  if (template === 'streamlit-developer' || template === 'gradio-developer') {
    return process.env.VERCEL_SANDBOX_PYTHON_RUNTIME || DEFAULT_PYTHON_RUNTIME
  }

  return process.env.VERCEL_SANDBOX_NODE_RUNTIME || DEFAULT_NODE_RUNTIME
}

function getConfiguredVercelTimeout(fallbackMs: number) {
  const override = Number(process.env.VERCEL_SANDBOX_TIMEOUT_MS)

  return Number.isFinite(override) && override > 0
    ? Math.min(override, MAX_VERCEL_TIMEOUT_MS)
    : fallbackMs
}

function getVercelVcpus() {
  const value = Number(process.env.VERCEL_SANDBOX_VCPUS)
  const isValid =
    value === 1 ||
    (Number.isInteger(value) && value >= 2 && value <= 8 && value % 2 === 0)

  return isValid ? value : 4
}

function buildVercelSandboxName(projectId?: string) {
  const suffix = crypto.randomUUID().slice(0, 8)
  const projectPart = projectId
    ? projectId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 28)
    : ''

  return ['magical', projectPart, suffix].filter(Boolean).join('-').toLowerCase()
}

async function listVercelDirectory(
  sandbox: VercelSandbox,
  absoluteDir: string,
  relativeDir = '',
): Promise<FileSystemNode[]> {
  const entries = await sandbox.fs
    .readdir(absoluteDir, { withFileTypes: true })
    .catch(() => [])

  const nodes: FileSystemNode[] = []

  for (const entry of entries) {
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name

    if (shouldSkipPath(relativePath)) {
      continue
    }

    const node: FileSystemNode = {
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: `/${relativePath}`,
    }

    if (node.isDirectory) {
      node.children = await listVercelDirectory(
        sandbox,
        path.posix.join(absoluteDir, entry.name),
        relativePath,
      )
    }

    nodes.push(node)
  }

  return nodes.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1
    }

    return a.name.localeCompare(b.name)
  })
}

function getVercelTemplateFiles(template: TemplateId): GeneratedFile[] {
  const centralizedFiles = getTemplateFiles(template)
  if (centralizedFiles.length > 0) {
    return centralizedFiles
  }

  if (template === 'nextjs-developer') {
    return [
      {
        path: 'package.json',
        content: JSON.stringify({
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
        }, null, 2),
      },
      {
        path: 'pages/_app.tsx',
        content: 'import "@/styles/globals.css";\nimport type { AppProps } from "next/app";\n\nexport default function App({ Component, pageProps }: AppProps) {\n  return <Component {...pageProps} />;\n}\n',
      },
      {
        path: 'styles/globals.css',
        content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nhtml, body, #__next {\n  min-height: 100%;\n}\nbody {\n  margin: 0;\n}\n',
      },
      {
        path: 'tailwind.config.ts',
        content: 'import type { Config } from "tailwindcss";\n\nconst config: Config = {\n  content: ["./pages/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./app/**/*.{js,ts,jsx,tsx}"],\n  theme: { extend: {} },\n  plugins: [],\n};\n\nexport default config;\n',
      },
      {
        path: 'postcss.config.js',
        content: 'module.exports = {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n',
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify({
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
        }, null, 2),
      },
    ]
  }

  if (template === 'vue-developer') {
    return [
      {
        path: 'package.json',
        content: JSON.stringify({
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
        }, null, 2),
      },
      {
        path: 'nuxt.config.ts',
        content: 'export default defineNuxtConfig({\n  compatibilityDate: "2024-04-03",\n  devtools: { enabled: false },\n  modules: ["@nuxtjs/tailwindcss"],\n  vite: { server: { hmr: { protocol: "wss" } } },\n});\n',
      },
      {
        path: 'tailwind.config.ts',
        content: 'export default {\n  content: ["./app.vue", "./components/**/*.{vue,js,ts}"],\n  theme: { extend: {} },\n  plugins: [],\n};\n',
      },
    ]
  }

  if (template === 'streamlit-developer') {
    return [
      {
        path: 'requirements.txt',
        content: 'streamlit\npandas\nnumpy\nmatplotlib\nrequests\nseaborn\nplotly\n',
      },
    ]
  }

  if (template === 'gradio-developer') {
    return [
      {
        path: 'requirements.txt',
        content: 'gradio\npandas\nnumpy\nmatplotlib\nrequests\nseaborn\nplotly\n',
      },
    ]
  }

  return []
}

function getVercelBaseInstallCommand(template: TemplateId) {
  if (template === 'streamlit-developer' || template === 'gradio-developer') {
    return 'python -m pip install --upgrade pip && python -m pip install -r requirements.txt'
  }

  if (
    template === 'nextjs-developer' ||
    template === 'react-developer' ||
    template === 'vite-developer' ||
    template === 'vue-developer' ||
    template === 'svelte-developer' ||
    template === 'pwa-mobile'
  ) {
    return 'npm install --no-audit --no-fund --prefer-offline'
  }

  return ''
}

function getVercelStartCommand(template: TemplateId, port: number) {
  if (template === 'nextjs-developer') {
    return `npm run dev -- --hostname 0.0.0.0 --port ${port}`
  }

  if (template === 'vue-developer') {
    return `npm run dev -- --host 0.0.0.0 --port ${port}`
  }

  if (
    template === 'react-developer' ||
    template === 'vite-developer' ||
    template === 'svelte-developer' ||
    template === 'pwa-mobile'
  ) {
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
  if (
    template === 'react-developer' ||
    template === 'vite-developer' ||
    template === 'vue-developer' ||
    template === 'svelte-developer' ||
    template === 'pwa-mobile'
  ) return 5173

  return 3000
}

function toVercelRelativePath(filePath: string) {
  const normalized = filePath
    .replace(/\\/g, '/')
    .replace(/^\/vercel\/sandbox\/?/, '')
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

function toVercelAbsolutePath(filePath: string) {
  const relativePath = toVercelRelativePath(filePath)

  return path.posix.join(VERCEL_WORKDIR, relativePath)
}

function cleanCommand(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function shouldSkipPath(value: string) {
  return SKIP_PATH_RE.test(value)
}

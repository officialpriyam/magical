import 'server-only'

import type { FragmentSchema } from '@/lib/schema'
import type { GeneratedFile } from '@/lib/fragment-files'
import type { TemplateId } from '@/lib/templates'
import type { FileSystemNode } from '@/components/file-tree'

const SKIP_PATH_RE = /(^|\/)(\.git|node_modules|\.next|\.nuxt|dist|build|coverage|__pycache__|\.cache)(\/|$)/

export function hasCloudflareSandboxConfig() {
  return Boolean(
    process.env.CLOUDFLARE_API_TOKEN?.trim() &&
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
  )
}

function getCloudflareHeaders() {
  return {
    'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN!.trim()}`,
    'Content-Type': 'application/json',
  }
}

function getAccountId() {
  return process.env.CLOUDFLARE_ACCOUNT_ID!.trim()
}

type CloudflareSandbox = {
  workerName: string
  workerUrl: string
  created: boolean
}

export async function createCloudflareSandbox({
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
}): Promise<CloudflareSandbox> {
  const workerName = `magical-${projectId || 'sandbox'}-${Date.now()}`
  const accountId = getAccountId()

  // Create a Worker script that serves the generated code
  const workerScript = generateWorkerScript(template, port || 3000)

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`,
    {
      method: 'PUT',
      headers: {
        ...getCloudflareHeaders(),
        'Content-Type': 'application/javascript',
      },
      body: workerScript,
    },
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Cloudflare Worker creation failed: ${error}`)
  }

  const workerUrl = `https://${workerName}.${getAccountId()}.workers.dev`

  return {
    workerName,
    workerUrl,
    created: true,
  }
}

export async function getCloudflareSandbox(workerName: string): Promise<CloudflareSandbox> {
  const accountId = getAccountId()

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`,
    {
      headers: getCloudflareHeaders(),
    },
  )

  if (!response.ok) {
    throw new Error(`Cloudflare Worker ${workerName} not found`)
  }

  return {
    workerName,
    workerUrl: `https://${workerName}.${accountId}.workers.dev`,
    created: false,
  }
}

export async function writeCloudflareProjectFiles(
  sandbox: CloudflareSandbox,
  files: GeneratedFile[],
  template: TemplateId,
) {
  // For Cloudflare Workers, we store files as KV or use the Workers API
  // For now, we'll update the worker script with the generated code
  const accountId = getAccountId()
  const filteredFiles = files.filter(f => !SKIP_PATH_RE.test(f.path))

  // Create a new worker script with all the files embedded
  const workerScript = generateWorkerScriptWithFiles(template, filteredFiles, 3000)

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${sandbox.workerName}`,
    {
      method: 'PUT',
      headers: {
        ...getCloudflareHeaders(),
        'Content-Type': 'application/javascript',
      },
      body: workerScript,
    },
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Cloudflare Worker update failed: ${error}`)
  }
}

export async function installAndStartCloudflareProject({
  sandbox,
  fragment,
  env,
}: {
  sandbox: CloudflareSandbox
  fragment: FragmentSchema
  env?: Record<string, string>
}) {
  // Cloudflare Workers don't need install/start — they're deployed as-is
  // The worker script already contains the generated code
}

export async function listCloudflareSandboxFiles(
  sandbox: CloudflareSandbox,
): Promise<FileSystemNode[]> {
  // Cloudflare Workers don't have a traditional filesystem
  // Return an empty array — the files are embedded in the worker script
  return []
}

export async function runCloudflareShellCommand(
  sandbox: CloudflareSandbox,
  cmd: string,
  opts?: { timeoutMs?: number },
): Promise<any> {
  // Cloudflare Workers don't support shell commands
  throw new Error('Shell commands are not supported on Cloudflare Workers')
}

export function getCloudflareSandboxUrl(
  sandbox: CloudflareSandbox,
  port: number,
): string {
  return sandbox.workerUrl
}

export async function deleteCloudflareWorker(workerName: string) {
  const accountId = getAccountId()
  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`,
    {
      method: 'DELETE',
      headers: getCloudflareHeaders(),
    },
  )
}

function generateWorkerScript(template: string, port: number): string {
  return `
export default {
  async fetch(request, env) {
    return new Response('Worker deployed. Upload files to start.', {
      headers: { 'Content-Type': 'text/plain' },
    });
  },
};`
}

function generateWorkerScriptWithFiles(
  template: string,
  files: GeneratedFile[],
  port: number,
): string {
  // For web templates, serve the main HTML/JS file
  const mainFile = files.find(f =>
    f.path.endsWith('.html') ||
    f.path.endsWith('.tsx') ||
    f.path.endsWith('.jsx') ||
    f.path.endsWith('.vue')
  )

  const htmlFile = files.find(f => f.path.endsWith('.html'))
  const cssFile = files.find(f => f.path.endsWith('.css'))
  const jsFile = files.find(f => f.path.endsWith('.js') && f.path.includes('main'))

  if (htmlFile) {
    return `
const HTML_CONTENT = ${JSON.stringify(htmlFile.content)};
const CSS_CONTENT = ${cssFile ? JSON.stringify(cssFile.content) : '""'};
const JS_CONTENT = ${jsFile ? JSON.stringify(jsFile.content) : '""'};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/styles.css') {
      return new Response(CSS_CONTENT, {
        headers: { 'Content-Type': 'text/css' },
      });
    }

    if (url.pathname === '/script.js') {
      return new Response(JS_CONTENT, {
        headers: { 'Content-Type': 'application/javascript' },
      });
    }

    return new Response(HTML_CONTENT, {
      headers: { 'Content-Type': 'text/html' },
    });
  },
};`
  }

  // For non-HTML templates, serve as a basic worker
  return `
const FILES = ${JSON.stringify(Object.fromEntries(files.map(f => [f.path, f.content])))};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.slice(1) || 'index.html';

    const content = FILES[path];
    if (content) {
      const ext = path.split('.').pop();
      const mimeTypes = {
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'json': 'application/json',
        'svg': 'image/svg+xml',
        'png': 'image/png',
      };
      return new Response(content, {
        headers: { 'Content-Type': mimeTypes[ext] || 'text/plain' },
      });
    }

    return new Response('Not found', { status: 404 });
  },
};`
}

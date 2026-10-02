import 'server-only'

export type SandboxCommandRunner = (
  command: string,
  timeoutMs: number,
) => Promise<{ stdout: string; exitCode: number }>

export type AppVerificationResult =
  | { ok: true; status: number | null; skipped?: false }
  | { ok: true; status: null; skipped: true }
  | { ok: false; status: number | null; reason: string; logs?: string }

export const DEFAULT_VERIFY_DEADLINE_MS = 40_000

const CHECK_INTERVAL_MS = 2_000
const CHECK_COMMAND_TIMEOUT_MS = 20_000
const LOG_TAIL_LINES = 120
const LOG_TAIL_LIMIT_CHARS = 6_000

export async function verifySandboxApp({
  runCommand,
  port,
  logPath,
  deadlineMs = DEFAULT_VERIFY_DEADLINE_MS,
}: {
  runCommand: SandboxCommandRunner
  port: number
  logPath?: string
  deadlineMs?: number
}): Promise<AppVerificationResult> {
  const script = buildHttpStatusScript(port)
  const startedAt = Date.now()
  let lastStatus: number | null = null

  while (true) {
    let raw = ''
    try {
      const result = await runCommand(script, CHECK_COMMAND_TIMEOUT_MS)
      raw = result.stdout || ''
    } catch {
      raw = ''
    }

    const parsed = parseHttpCode(raw)

    if (parsed === 'no-tool') {
      return { ok: true, status: null, skipped: true }
    }

    if (typeof parsed === 'number' && parsed >= 100 && parsed < 500) {
      return { ok: true, status: parsed }
    }

    if (typeof parsed === 'number') {
      lastStatus = parsed
    }

    if (Date.now() - startedAt >= deadlineMs) {
      break
    }

    await sleep(CHECK_INTERVAL_MS)
  }

  const logs = logPath ? await readLogTail(runCommand, logPath) : undefined
  const seconds = Math.round(deadlineMs / 1000)
  const reason =
    lastStatus !== null && lastStatus >= 500
      ? `The app responded with HTTP ${lastStatus} after starting, so the preview is not running properly.`
      : `The app did not respond on port ${port} within ${seconds}s of starting.`

  return { ok: false, status: lastStatus, reason, logs }
}

export function buildHttpStatusScript(port: number) {
  const url = `http://127.0.0.1:${port}/`

  return `CODE="NO_TOOL"
if command -v curl >/dev/null 2>&1; then
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 ${url} 2>/dev/null || true)
elif command -v wget >/dev/null 2>&1; then
  if wget -q -O /dev/null -T 12 ${url} >/dev/null 2>&1; then CODE="200"; else CODE="000"; fi
elif command -v node >/dev/null 2>&1; then
  CODE=$(node -e 'fetch("${url}", { signal: (typeof AbortSignal !== "undefined" && AbortSignal.timeout) ? AbortSignal.timeout(12000) : undefined }).then(function (response) { console.log(response.status) }).catch(function () { console.log("000") })' 2>/dev/null || true)
elif command -v python3 >/dev/null 2>&1; then
  CODE=$(python3 -c 'import urllib.request
try:
    response = urllib.request.urlopen("${url}", timeout=12)
    print(getattr(response, "status", response.getcode()))
except Exception:
    print("000")' 2>/dev/null || true)
fi
echo "MAGICAL_HTTP_CODE=$CODE"`
}

async function readLogTail(runCommand: SandboxCommandRunner, logPath: string) {
  try {
    const { stdout } = await runCommand(
      `tail -n ${LOG_TAIL_LINES} ${shellQuote(logPath)} 2>/dev/null || true`,
      15_000,
    )
    const trimmed = (stdout || '').trim()
    return trimmed ? trimmed.slice(-LOG_TAIL_LIMIT_CHARS) : undefined
  } catch {
    return undefined
  }
}

function parseHttpCode(raw: string): number | 'no-tool' | null {
  const match = raw.match(/MAGICAL_HTTP_CODE=(\S+)/)
  if (!match) {
    return null
  }

  const value = match[1].trim()
  if (value === 'NO_TOOL') {
    return 'no-tool'
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

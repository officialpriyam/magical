# Update Log: 2026-08-25 — AI File Generation Fixes

## Changes Made

### 1. Fallback generation when agents fail to produce files
**File:** `app/api/chat/agentic/route.ts` — pipeline step 3

**Problem:** When agents ran but none produced files (model returned empty, non-JSON, or error), the pipeline just emitted an empty fragment. No code was generated, no error was shown.

**Fix:** After all agents complete, check if any files were generated. If not, run `generateFallback()` which tries every model in the fallback chain to produce files directly. This is a safety net — even if the agent pipeline fails, the user still gets code.

### 2. Improved fallback generation with timeouts and logging
**File:** `app/api/chat/agentic/route.ts` — `generateFallback()`

- Added 60s timeout per fallback model (was no timeout)
- Added verbose logging: which model is being tried, whether it succeeded, how many files
- Added empty response detection — skip models that return nothing
- Added timeout to AbortSignal so hangs don't block forever
- Better error messages when all models fail

### 3. Agent-runner: detect empty responses and skip
**File:** `lib/agents/agent-runner.ts`

- When model returns <20 chars, it's treated as empty → skip to next model
- Added logging: `[Agent] frontend from deepseek-chat: success (1234 chars, fragment: yes)`
- Agent marked as failed if response is too short (prevents silent success with no code)

### 4. Show agentic errors to user
**File:** `app/page.tsx`

- Added useEffect to sync `agenticStream.error` to `errorMessage` state
- User now sees errors in the error banner (red box at top)

## Error Flow (before → after):
```
BEFORE: Model returns empty → agent marked "success" → no files → no error shown
AFTER:  Model returns empty → skipped with warning → next model tried → 
        if all fail → fallback generation → files generated OR error shown to user
```

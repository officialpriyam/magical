# Update Log: 2026-08-25 — AI Generation Stalling Fix

## Root Cause
The AI stopped generating after "Analyzing your request to determine the best approach..." because:

**OpenRouter models were NOT in `STREAM_TEXT_PROVIDER_IDS`** — the agent-runner tried to use `streamObject` (structured JSON output via the `ai` SDK's `streamObject()` function) which requires the model to produce schema-validated JSON. OpenRouter models (and most non-OpenAI/Anthropic providers) can't reliably do this — they either hang, return empty, or produce non-JSON output. The pipeline then silently failed without errors.

## Changes Made

### 1. Add all providers to streamText fallback set
**Files:** `lib/agents/agent-runner.ts`, `app/api/chat/agentic/route.ts`

Added `openrouter`, `google`, `vertex`, `mistral`, `groq`, `fireworks`, `togetherai`, `xai`, `ollama` to `STREAM_TEXT_PROVIDER_IDS`. Only `openai` and `anthropic` use `streamObject` (structured output) — everything else uses `streamText` with JSON parsing.

### 2. Add timeouts to prevent silent hangs
- **Complexity analysis:** 20s timeout (was no timeout)
- **Todo generation:** 30s timeout (was no timeout)
- **Agent execution:** 120s timeout per agent (was no timeout)

If a model hangs, the timeout will fire an AbortError, the pipeline catches it, and moves to the next fallback model.

### 3. Better error visibility
- Agent failures now emit `commentary` with the error message (not just a status line)
- Added `console.error` with the model name when an agent fails after all fallbacks
- Pipeline continues even if individual agents fail (instead of stopping)

## What changed technically:
```
Before: streamObject() for ALL models → OpenRouter hangs → silent failure
After:  streamText() for OpenRouter/Google/etc → streamObject() only for OpenAI/Anthropic
```

## Test: Send any prompt. AI should now generate code instead of stalling after "Analyzing..."

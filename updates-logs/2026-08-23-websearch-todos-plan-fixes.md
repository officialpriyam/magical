# Update Log — August 23, 2026

## Web Search, Todos & Plan Mode Fixes

### 1. Fixed Web Search Not Triggering
- **Problem**: `shouldAutoSearch()` was too conservative — most prompts like "make a web app" or "create a landing page" didn't trigger search
- **Fix**: Expanded keywords to include `web app`, `app`, `build`, `create`, `make`, `generate`, `write`, `page`, `site` — any request that could benefit from seeing real examples now triggers search
- **File**: `app/api/chat/agentic/route.ts`

### 2. Fixed DuckDuckGo Search Parsing
- **Problem**: DuckDuckGo HTML parsing was brittle — `result__url` class didn't always contain the real URL
- **Fix**: Now extracts URLs from `uddg=` parameter (DDG's redirect URL), falls back to `result__url` class, and includes snippets from `result__snippet` class. Added fallback regex for direct link extraction
- **File**: `app/api/chat/agentic/route.ts`

### 3. Fixed Todos Being Hardcoded
- **Problem**: `generateTodosFromPrompt()` was calling `streamText` but failing silently — returning empty array, so the pipeline fell back to static agent names
- **Fix**: 
  - Added comprehensive debug logging (`[Todos]`) so failures are visible in server logs
  - Added `generateFallbackTodos()` — when LLM fails, generates task-appropriate todos from prompt keywords (landing page → page sections, app → architecture, fix → root cause, etc.)
  - Improved `extractTodosFromPlan()` to handle both JSON and plain text planner output
- **File**: `app/api/chat/agentic/route.ts`

### 4. Fixed Todo Completion Tracking
- **Problem**: Todo completion tried to match agent role names to todo text (`AGENT_DISPLAY_NAMES[role].toLowerCase()`) which was fragile — todos like "Analyze requirements" didn't contain agent names
- **Fix**: Changed to sequential completion — each agent marks the next incomplete todo as done, which works correctly since agents run in order
- **File**: `app/api/chat/agentic/route.ts`

### 5. Added Plan Mode Debug Logging
- **Problem**: Plan mode could fail silently — no way to tell which model succeeded or failed
- **Fix**: Added `console.log` calls in plan route for: model count, each model tried, response length, and final failure
- **File**: `app/api/chat/plan/route.ts`

### 6. Plan Mode Flow (already working)
- Plan mode defaults to active via `useLocalStorage<ChatMode>('chatMode', 'plan')`
- Flow: User sends message → hits `/api/chat/plan` → plan card shown → user accepts → switches to build mode → agentic stream runs
- Added logging to diagnose any failures in this flow

---

## Files Modified
- `app/api/chat/agentic/route.ts` — Web search detection, DuckDuckGo parsing, todo generation, fallback todos, todo completion
- `app/api/chat/plan/route.ts` — Debug logging for plan generation

## How to Verify
1. **Web search**: Send any prompt — web search should appear with clickable result links
2. **Todos**: Todos should be task-specific (not generic "Plan approach, Design architecture") and tick off one by one
3. **Plan mode**: Send a message in plan mode — should get a plan card with options; accept should trigger build

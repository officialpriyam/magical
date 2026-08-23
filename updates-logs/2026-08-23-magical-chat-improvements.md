# Magical AI Chat Improvements — August 23, 2026

## 15+ Major Updates Applied

### 1. Fixed Magical Message Persistence Across Refresh
- **Problem**: Messages disappeared when refreshing the page because `storageKey` changed from `undefined` to project ID after mount, and `useState` initializer only runs once
- **Fix**: Added `useEffect` that reloads persisted state from localStorage when `storageKey` changes. Unmount cleanup now flushes pending state to localStorage before clearing timeouts
- **Files**: `lib/hooks/use-agentic-stream.ts`

### 2. Fixed Magical Message Disappearing on Completion (Race Condition)
- **Problem**: When streaming ends, `agenticStreaming` goes false but the persistence effect hasn't run yet, creating a frame where neither live nor persisted state renders
- **Fix**: Added fallback rendering — shows live agentic actions even after streaming ends if no persisted state exists yet. Also improved persistence to always create an assistant message when agentic actions exist, even without fragment data
- **Files**: `components/chat.tsx`, `app/page.tsx`

### 3. Fixed Magical Message Disappearing When New Message Sent
- **Problem**: `agenticStream.reset()` cleared all actions when a new message was sent, losing the old Magical message
- **Fix**: Added `agenticActions`, `agenticTodos`, and `agenticElapsed` fields to the `Message` type. When streaming completes, actions/todos are persisted into the assistant message. Chat component uses persisted state for past messages, live state only during active streaming
- **Files**: `lib/messages.ts`, `app/page.tsx`, `components/chat.tsx`

### 4. Fixed Stop Button Not Working in Agentic Mode
- **Problem**: `handleStopGeneration` only called `stop()` (non-agentic) but not `agenticStream.stop()`
- **Fix**: `handleStopGeneration` now calls both `stop()` and `agenticStream.stop()` to properly abort the SSE connection
- **Files**: `app/page.tsx`

### 5. Removed Hardcoded Thinking Text — Real AI Reasoning Only
- **Problem**: Thinking section showed hardcoded strings like "Planner is analyzing the request and planning the approach..."
- **Fix**: Removed the hardcoded `emitAction('thinking', '${agentName} is analyzing...')` emission. Thinking now only shows real AI reasoning extracted from the LLM's actual output via `extractThinking()` and `readStreamWithEvents()` in the agent runner
- **Files**: `app/api/chat/agentic/route.ts`, `lib/agents/agent-runner.ts`

### 6. Fixed Thinking Spamming and Code/JSON in Thinking
- **Problem**: Thinking emitted every 250ms with JSON, code, imports, and syntax instead of natural language
- **Fix**: Thinking now emits at most once per agent run. Added checks to skip JSON (starts with `{`), code blocks, imports, exports, const declarations. Extracts only first meaningful paragraph of natural language reasoning (30-500 chars)
- **Files**: `lib/agents/agent-runner.ts`

### 7. Added File Edit vs Write Distinction
- **Problem**: All file actions showed as "Written" — no way to tell if a file was edited vs newly created
- **Fix**: Backend now checks `existingFiles.has(file.path)` before emitting — emits `file_edit` for existing files and `file_write` for new ones. Frontend shows "Editing" → "Edited" for edits, "Writing" → "Written" for new files
- **Files**: `app/api/chat/agentic/route.ts`, `components/chat.tsx`

### 8. Fixed and Expanded Web Search Auto-Detection
- **Problem**: `shouldAutoSearch()` was too restrictive — only triggered for time-sensitive questions. Exa integration existed but rarely activated
- **Fix**: Expanded auto-detection to trigger for `search`, `find`, `look up`, `research`, `compare`, `alternative`, `vs`, `versus`, `review`, `landing page`, `website`, `blog`, `portfolio`, `design`, `UI`, `UX`, `brand`, `logo`, `template`, `guide`, `tutorial`, `documentation` keywords. Web search action always emits to frontend even with zero results
- **Files**: `app/api/chat/agentic/route.ts`, `app/api/chat/route.ts`

### 9. Fixed DuckDuckGo Web Search
- **Problem**: HTML parsing with regex was fragile and returned no results
- **Fix**: Rewrote to use POST to `html.duckduckgo.com/html/` with proper HTML parsing — extracts from `result__body` blocks (title, URL, snippet), falls back to `uddg` parameter URLs, then generic external links
- **Files**: `app/api/web-search/route.ts`

### 10. Added Exa Web Search/Fetch Integration
- **Problem**: No neural search provider — only Brave (API key required) and DuckDuckGo (unreliable)
- **Fix**: Added Exa neural search API integration with automatic fallback chain: Exa → Brave → DuckDuckGo. Web fetch also uses Exa for better content extraction. Added `EXA_API_KEY` environment variable support
- **Files**: `app/api/web-search/route.ts`, `app/api/web-fetch/route.ts`

### 11. Added Default Project Templates (React, Vite, HTML, Svelte)
- **Problem**: Only had Next.js and Jupyter templates — no lightweight options
- **Fix**: Added React (Vite + React + TypeScript + Tailwind), Vite React, HTML/CSS/JS, and Svelte templates. Renamed existing templates to shorter names
- **Files**: `lib/templates.json`

### 12. Fixed Style Prompt Showing Raw Metadata
- **Problem**: User messages showed `[Style: Modern] Modern SaaS design with clean sans-serif typography...` instead of just the prompt
- **Fix**: Chat component strips `[Style: ...]` and `[Custom Style] ...` metadata from user message display before rendering
- **Files**: `components/chat.tsx`

### 13. Added Agent Skills as Slash Commands with Auto-Detect
- **Problem**: No way to select specific agent skills or auto-detect them from prompts
- **Fix**: Added 10 agent skill commands (`/generate`, `/plan`, `/build`, `/frontend`, `/backend`, `/review`, `/optimize`, `/fix`, `/search`, `/think`) to slash menu. Auto-detect agent from prompt keywords (e.g. "fix bug" → /fix, "build a landing page" → /build). Backend routes to appropriate agent based on detected/selected skill
- **Files**: `lib/slash-commands.ts`, `components/slash-command-menu.tsx`, `components/ui/ai-prompt-box.tsx`, `app/api/chat/agentic/route.ts`

### 14. Integrated Skills.sh Registry
- **Problem**: No integration with external skill registries
- **Fix**: Created curated skills registry with 10 popular skills from skills.sh (frontend-design, brainstorming, agent-browser, ui-ux-pro-max, etc.). Auto-detect skills from prompt keywords and inject into agent system prompts. Added 10 new slash commands for skill selection
- **Files**: `lib/skills/registry.ts`, `app/api/chat/agentic/route.ts`, `lib/agents/prompts.ts`, `lib/slash-commands.ts`

### 15. Improved Todo Generation and Auto-Completion
- **Problem**: Todos were only extracted from planner JSON output — often empty or incomplete
- **Fix**: Initial todos now generated from execution plan (e.g. "Plan the approach", "Design the architecture", "Build frontend"). Todos auto-complete as each agent finishes. Planner-extracted todos override if available
- **Files**: `app/api/chat/agentic/route.ts`

### 16. Added Message Queue System
- **Problem**: Sending a message while streaming was either ignored or stopped the current generation
- **Fix**: Messages sent while streaming are queued and automatically sent after the current response completes. Visual indicator shows "N messages queued — will send after current response" with a Clear button
- **Files**: `app/page.tsx`

### 17. Added Message History Navigation
- **Problem**: No way to quickly re-send a previous message
- **Fix**: Press ArrowUp in empty input to cycle through previous user messages. ArrowDown to go forward. History index resets when a message is sent
- **Files**: `components/ui/ai-prompt-box.tsx`, `app/page.tsx`

### 18. Timeline Visible After Streaming — Auto-Expand on Completion
- **Problem**: Thinking, file reads/writes disappeared after streaming ended
- **Fix**: Removed `{isStreaming && (...)}` guard from timeline container. Timeline now flows with page scroll (no independent scroll). Added auto-expand effect that opens all thinking sections, file read/write collapsibles when streaming completes
- **Files**: `components/chat.tsx`

### 19. Improved Error Display and Auto-Fix Feedback
- **Problem**: Error messages were truncated and auto-fix showed no progress
- **Fix**: Error banner now shows full error message with "Generation failed" header. Auto-fix shows detailed status with spinning loader ("Auto-fixing code (1/2) — analyzing the error and regenerating...")
- **Files**: `app/page.tsx`

### 20. Increased Text Sizes and Whiter Colors
- **Problem**: Timeline text was too small and dim
- **Fix**: Thinking text: white/70-80 at 15px. Timeline labels: white/70 at 14px. Todos: white/80 at 14px. File read/write: white/60 at 13px. All status labels made whiter and slightly larger. Added green checkmark icon when thinking is complete
- **Files**: `components/chat.tsx`

## Files Modified
- `app/page.tsx` — Stop button fix, queue system, history, persistence, error display
- `app/api/chat/agentic/route.ts` — Hardcoded thinking removal, todo generation, edit detection, web search expansion, skills integration
- `app/api/chat/route.ts` — Web search auto-detection expansion
- `app/api/web-search/route.ts` — Exa integration, DuckDuckGo rewrite
- `app/api/web-fetch/route.ts` — Exa content extraction
- `components/chat.tsx` — Magical message persistence, timeline visibility, text sizes, file edit labels, thinking checkmarks
- `components/ui/ai-prompt-box.tsx` — History navigation, agent command handling
- `components/slash-command-menu.tsx` — Agent skill commands, categories
- `lib/hooks/use-agentic-stream.ts` — Persistence fix, storage key reload
- `lib/messages.ts` — Agentic state fields in Message type
- `lib/agents/agent-runner.ts` — Thinking emission fix, fake data removal
- `lib/agents/prompts.ts` — Skills prompt injection
- `lib/slash-commands.ts` — Agent skill commands, auto-detect function
- `lib/skills/registry.ts` — New file: skills.sh registry integration
- `lib/templates.json` — New templates (React, Vite, HTML, Svelte)

## Environment Variables
- `EXA_API_KEY` — Required for Exa neural search (optional — falls back to Brave/DuckDuckGo)
- `BRAVE_SEARCH_API_KEY` — Required for Brave search (optional — falls back to DuckDuckGo)

## Commit Message
```
feat: major Magical AI chat improvements — 20 updates

- Fix Magical message persistence across refresh, completion, and new messages
- Fix stop button, remove hardcoded thinking, add real AI reasoning display
- Add Exa web search/fetch, fix DuckDuckGo, expand auto-detection
- Add agent skills slash commands with auto-detect and skills.sh registry
- Add message queue, history navigation, and file edit/write distinction
- Improve todo generation, error display, text sizing, and timeline visibility
```

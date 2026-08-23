# Todo Fixes and Supabase Storage — August 23, 2026

## Updates

### 1. Removed Duplicate TodoBar Above Chatbox
- **Problem**: Todo list appeared twice — once inside the Magical message (LiveStreamingMessage) and once above the prompt input. The screenshot showed "To-dos 0/6" appearing in both places
- **Fix**: Removed the standalone `<TodoBar>` component render at line 2618 in `app/page.tsx`. The todo list now only appears inside the LiveStreamingMessage component where it belongs
- **Files**: `app/page.tsx`

### 2. Fixed User Message Prefix Display — Agent Icon, Hidden Metadata
- **Problem**: User messages showed raw `[Agent: search]`, `[Style: Modern] Modern SaaS design...`, `[Custom Style] ...` prefixes
- **Fix**: Comprehensive stripping removes ALL injection metadata:
  - `[Agent: ...]` — stripped, replaced with purple agent badge icon (Cpu)
  - `[Style: ...]` + following prompt text — completely hidden using `[\s\S]*$` regex
  - `[Custom Style]` + following prompt text — completely hidden
  - `[Search: ...]`, `[Think: ...]`, `[Canvas: ...]` — stripped, shown as badges
- **Files**: `components/chat.tsx`

### 3. Agent Badge Icon in User Messages
- **Problem**: No visual indication of which agent skill was used
- **Fix**: Purple badge with Cpu icon and agent name (e.g. "search", "build", "frontend") shown above user message when agent was selected
- **Files**: `components/chat.tsx`

### 4. Default Mode Always Plan
- **Problem**: User wanted plan mode as default
- **Fix**: Already configured — `useLocalStorage<ChatMode>('chatMode', 'plan')` defaults to 'plan'. No change needed
- **Files**: `app/page.tsx`

### 5. Connected Sandbox Storage with Supabase — No Go Binary Needed
- **Problem**: sandbox-storage was a separate Go binary that needed to run on port 8787. It was slow and required separate deployment
- **Fix**: Added Supabase Storage fallback in `sandbox-storage.ts`:
  - When `SANDBOX_STORAGE_URL` is not configured, automatically uses Supabase Storage
  - Stores workspace files as a single JSON manifest in a `workspaces` bucket
  - Supports all operations: create workspace, list files, batch write, single write, delete, rename
  - Uses the same KV cache for performance
  - No external process needed — runs inside Next.js serverless
  - Creates the `workspaces` bucket automatically on first use
- **Files**: `lib/sandbox-storage.ts`

### 6. Improved Todo Items — AI-Generated from Execution Plan
- **Problem**: Todos were hardcoded generic agent names. Should be task-specific
- **Fix**: Initial todos are generated from the execution plan with meaningful descriptions:
  - "Plan the approach" (planner agent)
  - "Design the architecture" (architect agent)
  - "Build the frontend" (frontend agent)
  - "Build the backend" (backend agent)
  - "Review code quality" (reviewer agent)
  - "Optimize performance" (optimizer agent)
- **Files**: `app/api/chat/agentic/route.ts`

## Files Modified
- `components/chat.tsx` — Agent badge, prefix stripping, display cleanup
- `app/page.tsx` — Removed duplicate TodoBar
- `lib/sandbox-storage.ts` — Added Supabase Storage fallback (no Go binary needed)

## Architecture Change
**Before**: Files stored in a separate Go binary process on port 8787 with Redis caching
**After**: Files stored directly in Supabase Storage bucket, accessible from Next.js serverless functions with no external dependency

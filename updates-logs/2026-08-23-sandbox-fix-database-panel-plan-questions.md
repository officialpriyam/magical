# Update Log — August 23, 2026

## Sandbox IDE Fix, Database Panel, Plan Questions, Auto-Deploy

### 1. Fixed sandbox-storage IDE — load files from fragment
- **Problem**: IDE showed "Storage Unavailable" when sandbox-storage Go binary wasn't running, no files visible
- **Fix**: Added `fragmentFiles` prop to IDE — when sandbox-storage returns error and no files loaded, falls back to loading files from the generated fragment (the AI's output). IDE now always shows files even without sandbox-storage
- **Files**: `components/ide.tsx`, `components/preview.tsx`

### 2. Fixed sandbox preview auto-deploy
- **Problem**: When agentic stream finished generating code, the sandbox/preview never deployed — user had to manually trigger it
- **Fix**: Added auto-deploy effect that triggers when agentic stream ends with a fragment containing code or files. Automatically creates sandbox, sets result, and opens preview panel
- **Files**: `app/page.tsx`

### 3. Added Database tab/button
- **Problem**: No way to manage database from the IDE — user wanted Bolt.new-style database panel
- **Fix**: 
  - Added "Database" button in the /chat header next to the IDE button
  - Created `DatabasePanel` component with 8 tabs: Tables, Authentication, User Management, Server Functions, File Storage, Secrets, Logs, Advanced
  - Each tab shows appropriate content — connected state with table management, auth settings, secrets editor, etc.
  - Shows "Connect Supabase" CTA when not connected
- **Files**: `components/database-panel.tsx`, `components/preview.tsx`, `app/page.tsx`

### 4. Fixed plan mode — dynamic questions (not hardcoded)
- **Problem**: Plan mode only asked 1 question with 2-4 options, hardcoded limit
- **Fix**:
  - Updated plan system prompt to ask 0-N questions dynamically: 0 if clear, 1-2 for moderate ambiguity, 3-5 for complex requests
  - Each question has its own options and allowCustomInput flag
  - Updated `PlanPayload` type with `questions?: PlanQuestion[]` array
  - Updated `normalizePlanPayload` to parse questions array
  - Updated `PlanActionCard` to render multiple questions with individual answer tracking
  - Shows "Answer N questions to continue" when multiple questions present
- **Files**: `app/api/chat/plan/route.ts`, `lib/messages.ts`, `components/chat.tsx`

---

## Files Modified
- `components/ide.tsx` — fragmentFiles fallback, remove duplicate fragmentFiles
- `components/preview.tsx` — pass fragmentFiles to IDE, add Database tab
- `app/page.tsx` — auto-deploy sandbox, Database button, url type fix
- `components/database-panel.tsx` — NEW: Supabase database management panel
- `app/api/chat/plan/route.ts` — dynamic questions in plan prompt
- `lib/messages.ts` — PlanQuestionItem type
- `components/chat.tsx` — PlanActionCard with multiple questions

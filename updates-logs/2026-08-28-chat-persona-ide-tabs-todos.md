# Chat Persona, IDE Tabs, and Todo Placement - August 28, 2026

## Updates

### 1. Persisted Selected Chat Persona
- **Problem**: The selected persona could visually reset to `Auto` when the chat page opened.
- **Fix**: Moved `selectedTemplate` to local storage and made the persona select controlled with `value={selectedTemplate}`.
- **Result**: The selected persona stays selected across page opens/reloads unless the stored template ID is invalid.
- **Files**: `app/page.tsx`, `components/chat-picker.tsx`

### 2. Added IDE Open File Tabs
- **Problem**: The IDE only showed the currently selected file name and did not keep opened files available as tabs.
- **Fix**: Added `openFiles` state, tab activation, tab close behavior, and sync between editor edits/save/delete/rename and open tabs.
- **Result**: Files opened from the tree now appear as editor tabs and can be switched or closed.
- **Files**: `components/ide.tsx`

### 3. Moved Todos Out of Chat Messages
- **Problem**: Agent todos were rendered inside Magical/chat activity messages and also near the chat input.
- **Fix**: Removed todo rendering from inline `ActivityFeed` usage inside chat messages.
- **Result**: Todos now display only in the dedicated todo bar above the chatbox.
- **Files**: `components/chat.tsx`, `app/page.tsx`

## Verification
- `node --max-old-space-size=4096 .\node_modules\typescript\bin\tsc --noEmit --pretty false` passes.
- `git diff --check` passes with only Windows CRLF warnings.

# Update Log — 2026-08-23 Critical Bugfixes

## Changes Made

### 1. Fix: Old Magical messages disappearing when new message is sent
- **File**: `components/chat.tsx`
- **Root cause**: The persisted agentic timeline had `!agenticStreaming` condition which hid ALL old messages' timelines when a new message started streaming
- **Fix**: Removed the `!agenticStreaming` condition from the persisted timeline rendering — now always renders inline with each assistant message regardless of current streaming state

### 2. Fix: Agentic state not persisting to database
- **File**: `app/page.tsx`
- **Root cause**: The `saveSignature` didn't include agentic state, so when agenticActions/todos were added to a message after streaming completed, the DB save was skipped
- **Fix**: Added `agenticActions.length` and `agenticTodos.length` to the save signature so changes to agentic state trigger a re-save

### 3. Fix: Database panel — detect actual Supabase connection
- **File**: `components/preview.tsx`, `app/page.tsx`, `components/database-panel.tsx`
- **Root cause**: Database panel received `isSupabaseConnected={!!projectId}` which is always true since any project has an ID
- **Fix**: Now passes `!!(currentProject?.metadata as any)?.supabaseProject` which checks if the project actually has Supabase credentials stored in metadata
- Also hides the database tabs (Tables, Auth, Users, etc.) when not connected — only shows "No Supabase connected" prompt with an example AI prompt

### 4. Fix: IDE loads files faster with fragment fallback
- **File**: `components/ide.tsx`
- **Root cause**: Fragment files only loaded after 12-second sandbox-storage timeout
- **Fix**: Added immediate fragment file loading as fast path when `storageStatus === 'idle'` and `files.length === 0`. Fragment files display instantly while sandbox-storage loads in the background. If sandbox-storage succeeds, it overwrites with more complete data.

### 5. Fix: Sandbox deploy errors now visible
- **File**: `app/page.tsx`
- **Root cause**: Sandbox deploy errors were silently logged to console with `console.warn`
- **Fix**: Failed sandbox deploys now show error messages to the user via `setErrorMessage()`, and the response body is parsed for specific error details

## Commit Message
```
fix: message persistence, database panel, IDE fast load, sandbox errors

- Fix old Magical messages disappearing when new message is sent:
  remove !agenticStreaming guard from persisted timeline rendering
- Fix agentic state not saved to DB: include action/todo counts in
  save signature so post-stream updates trigger re-save
- Fix database panel: detect actual Supabase connection from project
  metadata instead of assuming projectId means connected; hide tabs
  when not connected
- Fix IDE slow file loading: load fragment files immediately as fast
  path while sandbox-storage loads in background
- Fix silent sandbox deploy failures: surface error messages to user
```

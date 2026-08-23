# Update Log — August 23, 2026 (IDE + Messages + Database Fixes)

## Changes

### 1. Reverted IDE fast-path change
**Files:** `components/ide.tsx`
- Reverted the "immediately load fragment files" change that broke the IDE
- Now waits for sandbox-storage to fail (`storageStatus === 'error'`) before falling back to fragment files
- This ensures the IDE properly connects to sandbox-storage when it's running

### 2. Fixed old messages disappearing when new message sent
**Files:** `components/chat.tsx`
- **Root cause:** `LiveStreamingMessage` was only rendered for the **last** assistant message. When a new message was sent, old messages lost their Magical timeline.
- **Fix:** Now renders `LiveStreamingMessage` **inline** with each assistant message that has `agenticActions`. Each old message retains its thinking/file/write timeline permanently.
- During streaming: still uses the live `agenticActions` from the stream
- After streaming: each assistant message renders its own persisted timeline

### 3. Fixed sandbox not running / preview not working
**Files:** `components/ide.tsx`
- The IDE revert (#1) fixes the sandbox connection — it now properly waits for sandbox-storage before falling back

### 4. Fixed database section — proper connect prompt
**Files:** `components/database-panel.tsx`
- Changed from hardcoded "Connect Supabase" button to a contextual message
- Shows "No Supabase connected" with explanation that the user should tell the AI to integrate Supabase
- Includes example prompt: "Connect Supabase to this project and add a users table"
- No more hardcoded buttons or fake status

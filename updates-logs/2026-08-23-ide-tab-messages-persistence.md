# Update Log — 2026-08-23: IDE Tab Fix + Message Persistence Fix

## Changes

### 1. Fix IDE opening then switching to Code tab automatically
- **File**: `app/page.tsx`
- **Root cause**: The `loadProjectMessages` useEffect had `useAgentic` and `agenticStream` in its dependency array. During streaming, these change frequently, causing the effect to re-run and call `setCurrentTab('code')` every time. So when the user clicked IDE, it opened briefly then got pushed back to Code.
- **Fix**: Added `initialTabSetRef` ref that tracks whether the initial tab set has happened. The `setCurrentTab('code')` in `loadProjectMessages` only fires on the first load, not on re-runs. The ref is reset when switching projects or resetting chat state.

### 2. Fix Magical messages disappearing when new message sent
- **File**: `app/page.tsx`
- **Root cause**: `withLatestAssistantFragment` didn't preserve `agenticActions`, `agenticTodos`, `agenticElapsed` when merging fragment data into the last assistant message. When the `object` useEffect fired and called `withLatestAssistantFragment`, it overwrote the message and dropped the agentic state.
- **Fix**: `withLatestAssistantFragment` now preserves existing agentic state when merging. Only overwrites agentic if the new message explicitly has agentic data.

### 3. Fix agentic data lost on DB fallback save
- **File**: `lib/database.ts`
- **Root cause**: When the `save_message_and_update_project` RPC failed, the fallback used `message.object` instead of `objectWithAgentic`, losing all agentic state (actions, todos, elapsed time).
- **Fix**: Fallback now uses `objectWithAgentic` to preserve agentic data.

### 4. Revert IDE to 2-day old working version
- **File**: `components/ide.tsx`
- **Action**: Restored `ide.tsx` to commit `98d0f23` (2 days old working version). Added `fragmentFiles` prop as optional (ignored) to maintain TypeScript compatibility with preview.tsx.

## Commit Message
```
fix: IDE tab persistence, magical message persistence, revert IDE to working version

- Fix IDE tab switching back to Code: add initialTabSetRef to prevent
  loadProjectMessages from forcing setCurrentTab('code') on every re-run
- Fix magical messages disappearing: withLatestAssistantFragment now
  preserves existing agenticActions/todos/elapsed when merging fragments
- Fix agentic data lost on DB fallback: use objectWithAgentic instead of
  message.object in direct upsert path
- Revert components/ide.tsx to 2-day old working version from commit 98d0f23
```

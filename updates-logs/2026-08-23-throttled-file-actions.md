# Update Log — 2026-08-23: Throttled File Actions

## Changes

### Throttled file read/write actions in agentic pipeline
- **File**: `app/api/chat/agentic/route.ts`
- **Problem**: When agents read existing files from context, all file_read actions were emitted in a tight `for` loop with no delay. This caused the Magical timeline to show 5-8 file reads all at once, flooding the UI.
- **Fix**:
  - Added `emitActionThrottled()` — emits an SSE action then waits a configurable delay (default 200ms)
  - File reads from context now use `await emitActionThrottled('file_read', ...)` with 200ms delay between each
  - File writes from agents are throttled to max 2 per second using `lastFileWriteTime` + `pendingFileWrites` queue
  - A `setInterval` flushes pending file writes every 200ms
  - All pending writes are flushed at pipeline completion or on error

## Commit Message
```
fix: throttle file read/write actions in agentic pipeline

- File reads now emit one by one with 200ms delay instead of all at once
- File writes throttled to max 2/sec with pending queue
- Pending writes flushed at pipeline completion and on error
```

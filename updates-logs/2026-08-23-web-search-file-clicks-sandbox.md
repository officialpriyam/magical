# Web Search Fix, File Clicks, and Sandbox Changes — August 23, 2026

## Updates

### 1. Fixed Web Search Not Showing in Chat
- **Problem**: Web search never triggered because `detectAutoSearchQuery` returned `null` when `shouldAutoSearch(cleaned)` was false, which happened for most code generation prompts
- **Fix**: Rewrote `detectAutoSearchQuery` to:
  - Trigger search when agent is 'search' (always)
  - Trigger search for other agents when the prompt benefits from it (not just returning null)
  - Changed `return null` to `continue` so it tries the next message instead of giving up
  - Search results are now properly emitted with JSON detail containing title, URL, snippet
- **Files**: `app/api/chat/agentic/route.ts`

### 2. Made File Names Clickable in Chat
- **Problem**: File paths like `pages/index.tsx` in the Magical message timeline were static text — clicking did nothing
- **Fix**: 
  - Added `onFileClick` prop to Chat and LiveStreamingMessage components
  - File actions (file_read, file_write, file_edit) in the timeline are now clickable with hover effects
  - File paths in the collapsible File Reads and File Writes sections are also clickable
  - Clicking a file path dispatches a `open-file` custom event that switches to code tab
  - Added visual feedback: hover background, pointer cursor, brighter text on hover
- **Files**: `components/chat.tsx`, `app/page.tsx`

### 3. Removed Supabase Storage Fallback from Sandbox
- **Problem**: Previously added Supabase Storage fallback for sandbox-storage was not what user wanted
- **Fix**: Removed the `supabaseStorageFallback` function and restored `hasSandboxStorageConfig()` to only check for Go binary URL. Sandbox-storage now uses Go binary only as designed.
- **Files**: `lib/sandbox-storage.ts`

### 4. Web Search Architecture Notes
The user requested the following improvements for sandbox-storage performance (to be implemented):

1. **Checkpoint-based batch sync**: Don't sync on every file write — batch changes and sync after each generation turn, on explicit save, or debounced every 2-3 seconds
2. **Tarball/zip sync**: Instead of N HTTP calls for N files, tar/zip the working directory and upload as one blob
3. **Content-addressed diffs**: Store blobs by hash, only new/changed content gets written (like Git)
4. **Metadata-only Next.js**: Next.js asks Go service "what files exist / give me file X" — Go service handles actual storage
5. **SSE/WebSocket for live preview**: Stream file content from sandbox → Go service → Next.js via persistent connection
6. **Aggressive sandbox cleanup**: Hard TTL and teardown once sync-to-storage is confirmed

## Files Modified
- `app/api/chat/agentic/route.ts` — Fixed web search detection
- `components/chat.tsx` — Added onFileClick, clickable file paths
- `app/page.tsx` — Wired up onFileClick handler
- `lib/sandbox-storage.ts` — Removed Supabase fallback

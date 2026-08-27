# RustFS Sandbox Storage - August 27, 2026

## Updates

### 1. Replaced Go Sandbox Storage with RustFS
- **Problem**: Project persistence depended on the custom Go `apps/sandbox-storage` service and `SANDBOX_STORAGE_*` configuration.
- **Fix**: Reworked `lib/sandbox-storage.ts` to use RustFS through the S3 API with `@aws-sdk/client-s3`.
- **Result**: RustFS is now the permanent source of truth for saved project files, while live sandboxes remain disposable runtime environments.
- **Files**: `lib/sandbox-storage.ts`, `.env.example`, `README.md`

### 2. Removed the Retired Go Service
- **Problem**: The old Go service, Dockerfile, docs, package metadata, module files, and compiled executable were still present in the repo.
- **Fix**: Deleted the complete `apps/sandbox-storage` app and removed its workspace importer from `pnpm-lock.yaml`.
- **Files**: `apps/sandbox-storage/*`, `pnpm-lock.yaml`

### 3. Preserved Existing Storage API Compatibility
- **Problem**: Several app routes and UI callers already depend on the existing sandbox-storage helper names and API route paths.
- **Fix**: Kept compatibility names such as `/api/projects/[projectId]/sandbox-storage-files`, but backed them only by RustFS.
- **Files**: `app/api/projects/[projectId]/sandbox-storage-files/route.ts`, `app/page.tsx`, `app/api/projects/[projectId]/restore-sandbox/route.ts`

### 4. Added RustFS Cleanup on Project Deletion
- **Problem**: Project deletion needed to remove permanent RustFS objects, not just database metadata.
- **Fix**: Added a project storage delete route and wired project deletion to call it before deleting the project record.
- **Files**: `app/api/projects/[projectId]/storage/route.ts`, `lib/database.ts`

### 5. Updated Restore and Persistence Behavior
- **Problem**: Generated project files could silently fall back to older backup paths when persistence failed.
- **Fix**: Saving generated files now requires RustFS persistence to succeed, and restore messages/source labels now refer to RustFS.
- **Files**: `app/api/sandbox/route.ts`, `app/api/projects/[projectId]/restore-sandbox/route.ts`, `lib/fragment-files.ts`

### 6. Added DB and RustFS `.project.json` Manifests
- **Problem**: The IDE needed a durable project manifest like the old Go sandbox-storage layout so reopening a project can load the correct files directly from storage.
- **Fix**: RustFS now stores metadata in `workspaces/{storageId}/.project.json`, project files in `workspaces/{storageId}/files/*`, and the same manifest snapshot in `metadata.sandboxStorage.manifest` in the database.
- **Result**: The backend validates the authenticated Supabase project owner, DB manifest snapshot, and RustFS `.project.json` before reading, writing, or deleting RustFS files.
- **Files**: `lib/sandbox-storage.ts`, `components/ide.tsx`, `app/api/projects/[projectId]/sandbox-storage-files/route.ts`

### 7. Fixed Agentic Todo Completion
- **Problem**: The AI could emit generated todos but not carry that same list through the agent pipeline, leaving visible todos incomplete.
- **Fix**: The generated todo list is now the canonical active list, agents receive unchecked todos in their prompt context, and successful runs mark remaining todos complete only after files or code exist.
- **Files**: `app/api/chat/agentic/route.ts`, `lib/agents/prompts.ts`

### 8. Let Agentic AI Run Commands in Sandboxes
- **Problem**: Agent tool calls for `run_command` only appeared in the timeline and did not execute inside the active sandbox.
- **Fix**: Added a shared sandbox command runner and passed the current sandbox ID into the agentic stream. The backend validates project ownership before executing AI-requested or terminal commands.
- **Files**: `lib/sandbox-command.ts`, `app/api/chat/agentic/route.ts`, `app/api/terminal/route.ts`, `app/page.tsx`, `components/fragment-terminal.tsx`, `components/preview.tsx`

### 9. Made IDE File Operations RustFS-First
- **Problem**: The IDE loaded project file trees from RustFS, but create/delete/rename paths still preferred live sandbox routes in sandbox mode, and file saves only mirrored to one sandbox result ID.
- **Fix**: IDE create, save, delete, and rename operations now persist through `/api/projects/[projectId]/sandbox-storage-files` first, then best-effort mirror changes into the live E2B/Vercel/Modal sandbox when one is active.
- **Result**: Reopened projects load from the DB-authorized RustFS manifest and live sandboxes stay synchronized with the same permanent RustFS workspace instead of becoming the source of truth.
- **Files**: `components/ide.tsx`, `app/page.tsx`, `app/api/projects/[projectId]/sandbox-storage-files/route.ts`

## Files Modified
- `.env.example` - Added RustFS configuration and removed old sandbox-storage service configuration.
- `README.md` - Added RustFS setup documentation.
- `lib/sandbox-storage.ts` - Replaced service-backed storage with RustFS S3 operations, DB manifest snapshots, and `.project.json` manifests.
- `app/api/projects/[projectId]/sandbox-storage-files/route.ts` - Kept compatibility API route and loads, saves, deletes, and renames RustFS files for authenticated projects.
- `components/ide.tsx` - Loads project file trees and file contents from RustFS whenever a project ID is available, and makes IDE file mutations RustFS-first.
- `app/api/chat/agentic/route.ts` - Keeps generated todos active through the agent pipeline.
- `lib/agents/prompts.ts` - Sends required unchecked todos to each agent as implementation scope.
- `lib/sandbox-command.ts` - Runs shell commands inside E2B, Vercel, or Modal sandboxes.
- `app/api/terminal/route.ts` - Uses the shared sandbox command runner and validates project ownership.
- `components/fragment-terminal.tsx` - Sends project ID with terminal commands for backend ownership checks.
- `components/preview.tsx` - Passes project ID into the terminal panel.
- `app/api/projects/[projectId]/storage/route.ts` - Added RustFS cleanup endpoint.
- `lib/database.ts` - Calls RustFS cleanup before project deletion.
- `app/api/sandbox/route.ts` - Requires RustFS persistence for generated files.
- `app/api/projects/[projectId]/restore-sandbox/route.ts` - Restores from RustFS first and updates source labeling.
- `app/page.tsx` - Recognizes RustFS-backed saved workspace metadata and mirrors saves into the current or warmed sandbox after RustFS persistence.
- `lib/fragment-files.ts` - Updated persistence comment wording.
- `pnpm-lock.yaml` - Removed deleted Go service workspace importer.
- `apps/sandbox-storage/*` - Removed the old Go service completely.

## Architecture Change
**Before**: Permanent project files were served by a separate Go sandbox-storage process using `SANDBOX_STORAGE_*` configuration.

**After**: Permanent project files are stored directly in RustFS through S3-compatible APIs using server-only `RUSTFS_*` environment variables. Each workspace uses `workspaces/{storageId}/.project.json` plus `workspaces/{storageId}/files/*`, with the same manifest mirrored into database metadata.

## Verification
- Old Go service env/path scan is clean for live code and docs.
- `git diff --check` passes with only existing CRLF warnings.
- `node --max-old-space-size=4096 .\node_modules\typescript\bin\tsc --noEmit --pretty false` passes.

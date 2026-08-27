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

## Files Modified
- `.env.example` - Added RustFS configuration and removed old sandbox-storage service configuration.
- `README.md` - Added RustFS setup documentation.
- `lib/sandbox-storage.ts` - Replaced service-backed storage with RustFS S3 operations.
- `app/api/projects/[projectId]/sandbox-storage-files/route.ts` - Kept compatibility API route and updated it for RustFS.
- `app/api/projects/[projectId]/storage/route.ts` - Added RustFS cleanup endpoint.
- `lib/database.ts` - Calls RustFS cleanup before project deletion.
- `app/api/sandbox/route.ts` - Requires RustFS persistence for generated files.
- `app/api/projects/[projectId]/restore-sandbox/route.ts` - Restores from RustFS first and updates source labeling.
- `app/page.tsx` - Recognizes RustFS-backed saved workspace metadata.
- `lib/fragment-files.ts` - Updated persistence comment wording.
- `pnpm-lock.yaml` - Removed deleted Go service workspace importer.
- `apps/sandbox-storage/*` - Removed the old Go service completely.

## Architecture Change
**Before**: Permanent project files were served by a separate Go sandbox-storage process using `SANDBOX_STORAGE_*` configuration.

**After**: Permanent project files are stored directly in RustFS through S3-compatible APIs using server-only `RUSTFS_*` environment variables.

## Verification
- Old Go service env/path scan is clean for live code and docs.
- `git diff --check` passes with only existing CRLF warnings.
- `pnpm exec tsc --noEmit --pretty false` still reports an unrelated existing error in `backup/chat/agentic/route.ts` about missing `emitCommand` in `AgentEventEmitter`.

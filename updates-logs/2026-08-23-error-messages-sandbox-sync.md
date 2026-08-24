# Update Log — 2026-08-23: Error Messages + Sandbox-Storage Sync

## Changes

### 1. Fix sandbox-storage restore blocked by client-side guard
- **File**: `app/page.tsx`
- **Root cause**: `restoreProjectWorkspace` had a guard `if (!workspace && !r2Workspace) return` that prevented sandbox-storage restore from being attempted, even though the server-side route supports it
- **Fix**: Changed guard to `if (!workspace && !r2Workspace && !sandboxStorageWorkspace) return` — now sandbox-storage is a valid restore source

### 2. Add error display in preview panel
- **File**: `components/preview.tsx`
- **Change**: Added `errorMessage` and `onDismissError` props. Preview now shows:
  - Red error banner with dismiss button when `errorMessage` is set
  - Blue loading banner with spinner when `isPreviewLoading && !result`
  - Existing amber GitHub save banner preserved

### 3. Pass error message to preview from page
- **File**: `app/page.tsx`
- **Change**: Added `errorMessage` and `onDismissError` props to `<Preview>` component

### 4. Show sandbox errors to user
- **File**: `app/page.tsx`
- **Changes**:
  - `warmProjectSandbox` — Now calls `setErrorMessage()` on failure instead of just `console.warn()`
  - `restoreProjectWorkspace` — Both the non-OK response and catch block now call `setErrorMessage()` with the actual error message

## Commit Message
```
fix: error display in preview panel, sandbox-storage restore, user-visible errors

- Fix sandbox-storage restore blocked by client guard: allow sandbox-storage
  as valid restore source alongside GitHub and R2
- Add error banner to preview panel (red) and loading banner (blue)
- Pass errorMessage from page.tsx to Preview component
- Show sandbox creation/restore errors to user via setErrorMessage
- warmProjectSandbox now shows errors instead of silently logging
- restoreProjectWorkspace shows errors on both HTTP failure and exception
```

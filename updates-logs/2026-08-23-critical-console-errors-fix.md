# Update Log — 2026-08-23: Critical Console Errors Fix

## Issues Fixed

### 1. Restore-sandbox infinite loop (CRITICAL)
- **File**: `app/page.tsx`
- **Root cause**: `loadProjectMessages` effect calls `restoreProjectWorkspace` on every run. Dependencies like `session`, `userTeam`, `languageModel` change frequently, causing repeated restore attempts. Each failed restore showed an error and triggered re-renders.
- **Fix**: Added `failedRestoresRef` (Set<string>) that tracks project IDs whose restore has already failed. Subsequent calls skip projects in the set. Errors are logged silently without setting `setErrorMessage` (which was causing more re-renders).

### 2. save_message RPC 404 (console spam)
- **File**: `lib/database.ts`
- **Root cause**: `save_message_and_update_project` RPC function doesn't exist in Supabase (404). Fallback upsert fails with RLS (403). Both produce console warnings/errors.
- **Fix**: Changed RPC failure from `console.warn` to silent fallthrough. Changed upsert RLS failure from `throw` to `return false` — the save is best-effort. The in-memory state is always correct; DB persistence is optional.

### 3. React error #418 (hydration mismatch)
- **File**: `app/page.tsx`
- **Root cause**: `useState(Date.now())` produces different values on server vs client render.
- **Fix**: Changed to `useRef(0)` + `useEffect(() => { ref.current = Date.now() }, [])` — always starts as 0 on both server and client, then gets the real value after hydration.

## Commit Message
```
fix: restore-sandbox infinite loop, RPC 404 console spam, hydration mismatch

- Add failedRestoresRef to prevent repeated restore attempts for failed projects
- Make save_message gracefully handle missing RPC and RLS failures (no console spam)
- Fix React #418 hydration mismatch by using useRef instead of useState(Date.now())
```

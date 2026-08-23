# Update Log — 2026-08-23 Nav Links + E2B Fix

## Changes Made

### 1. Fix: Nav links not working on click
- **File**: `app/page.tsx`
- **Root cause**: `<Link>` from `next/link` was not triggering client-side navigation — the links rendered visually but clicks did nothing (only right-click > open in new tab worked)
- **Fix**: Replaced all `<Link href="...">` nav elements with `<button onClick={() => router.push('...')}>` for both signed-out and signed-in navbars. This guarantees navigation works on click.

### 2. Fix: E2B sandbox "incompatible template" error on every deploy
- **File**: `lib/e2b-sandbox.ts`
- **Root cause**: E2B defaults to `secure: true`, which most templates don't support. Every deploy would fail once, log "Retrying with secure access disabled", then succeed — causing a wasted API call and concerning log message every time
- **Fix**: Default to `secure: false` when `E2B_SECURE_ACCESS` env is not set. Only use `secure: true` when explicitly enabled via env var. Eliminates the retry on every sandbox creation.

## Commit Message
```
fix: nav links click navigation and E2B secure access defaults

- Replace next/link with router.push() buttons for Docs, Community,
  Templates, Sign In, Start for Free nav links — fixes click
  navigation that only worked via right-click > open in new tab
- Default E2B secure access to false to prevent "incompatible
  template" retry error on every sandbox creation
```

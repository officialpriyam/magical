# Update Log — August 23, 2026

## Bug Fixes

### 1. Fix thinking/timeline disappearing on refresh or new message
**Files:** `lib/database.ts`
- **Root cause:** `agenticActions`, `agenticTodos`, and `agenticElapsed` were never saved to the database. Only `content`, `object_data`, and `result_data` were persisted.
- **Fix:** Merges agentic state into `object_data` with `_agenticActions`, `_agenticTodos`, `_agenticElapsed` keys before saving. On load, strips these underscore-prefixed keys from the fragment object and restores them as Message fields.
- **Result:** Thinking timeline, todos, and elapsed time now persist across page refreshes and when loading old messages.

### 2. Fix old messages disappearing when new message is sent
**Files:** `lib/database.ts`
- Same root cause as #1 — agentic actions were lost on reload.
- Now properly restored from `_agenticActions` in the persisted `object_data`.

### 3. Fix IDE not opening (crash when sandbox-storage unavailable)
**Files:** `components/ide.tsx`
- **Root cause:** IDE waited for sandbox-storage fetch to fail before loading fragment files from the AI. The 12s timeout + error state meant the IDE was blank/unusable.
- **Fix:** Changed fragment files loading to trigger immediately on mount (`storageStatus !== 'ok'`) instead of only after `storageStatus === 'error'`. Fragment files are now the fast path — no network needed.

### 4. Fix database tab showing hardcoded "connected"
**Files:** `components/preview.tsx`
- **Root cause:** `isSupabaseConnected={true}` was hardcoded.
- **Fix:** Changed to `isSupabaseConnected={!!projectId}` — shows "Connect Supabase" prompt when no project is linked.

## New Features

### 5. Landing page redesign for signed-out users
**Files:** `app/page.tsx`
- When not signed in, shows a Meku-style landing page with:
  - Animated gradient background (purple/blue/pink blurs)
  - "Thousands of builders..." avatar stack
  - "Build Full-Stack Web Apps & Sites with Simple AI Prompts" headline
  - "Start for Free" and "Sign In" CTA buttons
- Signed-in users see the original dashboard with personalized greeting.

### 6. Full-page login/register pages (not popup)
**Files:** `app/auth/login/page.tsx`, `app/auth/register/page.tsx`
- Full-page split-screen layout (like Meku) instead of popup dialog
- Left side: Logo, OAuth buttons (Google + GitHub), email/password form
- Right side: Decorative animated gradient background with grid pattern
- Login: Email + password with show/hide toggle, "Forgot password?" link
- Register: Name + email + password with TOS/Privacy checkbox
- Redirect to `/` on successful auth

### 7. Community page with public projects by category
**Files:** `app/community/page.tsx`
- Fetches public projects from Supabase `projects` table
- Category tabs: Discover, Landing Page, Dashboard, Website, Prototype, Mobile App, Internal Tool, Personal
- Search bar for filtering by title/description
- Grid cards with template badge, title, description, date
- Click to open project in chat view
- Empty state with CTA to build and share

### 8. Missing persona/framework icons fixed
**Files:** `public/thirdparty/templates/*.svg`, `components/chat-picker.tsx`
- Created SVG icons for: React, Vite, HTML/CSS/JS, Svelte, Expo, PWA
- Switched from `next/image` to `<img>` for SVGs (next/image breaks SVG rendering)
- Added onError fallback showing first letter of template name

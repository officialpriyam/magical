# Update Log — August 23, 2026 (open-webSearch + Landing Redesign)

## Changes

### 1. Self-hosted open-webSearch integration
**Files:** `app/api/chat/agentic/route.ts`, `.env.example`
- Added `OPEN_WEBSEARCH_URL` env var for self-hosted search instance
- New `searchOpenWebSearch()` function — POSTs to `/search` with multi-engine support (bing, duckduckgo, startpage)
- New `fetchOpenWebSearchUrl()` function — POSTs to `/fetch-web` for URL content extraction
- open-webSearch is now the **primary** search provider (tried before Exa, Brave, DuckDuckGo)
- URL auto-fetch also uses open-webSearch first via `fetchSingleUrl()`
- If `OPEN_WEBSEARCH_URL` is not set, gracefully falls back to other providers

### 2. Landing page navbar (Meku-style)
**Files:** `app/page.tsx`
- Added persistent top navbar with:
  - Magical AI logo + text
  - Navigation links: Community, Templates, Docs
  - Sign In text link + "Start for Free" pill button
- Same navbar shown for signed-in users (with Community link)
- Smooth fade-in animation on load

### 3. Meku-style mesh gradient background
**Files:** `app/page.tsx`
- Three animated gradient orbs (blue, purple/pink, cyan) with blur
- Subtle dot grid pattern overlay
- Bottom glow bar gradient line
- All elements animate in with scale + opacity transitions (2-2.5s duration)

### 4. Smooth page load animation
**Files:** `app/page.tsx`
- Navbar: `y: -10 → 0` with 0.5s ease-out
- Hero text: `y: 20 → 0` with 0.8s ease-out, 0.2s delay
- Prompt box: `y: 15 → 0` with 0.8s ease-out, 0.4s delay
- Background orbs: `scale: 0.8 → 1` with 2-2.5s ease-out, staggered delays
- All using framer-motion for GPU-accelerated transitions

### 5. Updated env.example
**Files:** `.env.example`
- Added `OPEN_WEBSEARCH_URL` as the primary web search provider
- Reorganized to show self-hosted first, then fallback providers

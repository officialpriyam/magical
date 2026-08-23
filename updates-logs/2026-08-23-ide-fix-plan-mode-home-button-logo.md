# Update Log — August 23, 2026

## IDE Fix, Plan Mode, Home Button, Logo

### 1. Fixed IDE Closing Automatically (sandbox-storage)
- **Problem**: IDE crashed/closed when sandbox-storage returned 503 (Go binary not running)
- **Fix**: Changed error message from "Storage Unavailable" to "Sandbox storage is not configured. Files will appear once code is generated." — non-blocking, IDE stays open
- Changed color from red to amber (less alarming)
- **Files**: `components/ide.tsx`

### 2. Fixed Plan Mode Showing as Build Mode
- **Problem**: No visible mode indicator in the chat header — user couldn't tell if Plan or Build was active
- **Fix**: Added mode indicator pill in the header showing:
  - Purple dot + "PLAN" when in plan mode
  - Green dot + "BUILD" when in build mode  
  - Pulsing animation dot when streaming
  - Only visible on sm+ screens (hidden on mobile)
- **Files**: `app/page.tsx`

### 3. Added Home Button in /chat Header
- **Problem**: No way to go back to dashboard from /chat without sidebar
- **Fix**: Added home icon button (house SVG) at the left of the header, next to the project dropdown
- **Files**: `app/page.tsx`

### 4. Fixed Missing Logo on Sidebar
- **Problem**: Expanded sidebar didn't show the Magical AI logo — only WorkspaceDropdown was visible
- **Fix**: Added logo image (`/icon.png`) + "Magical AI" text above the WorkspaceDropdown in the expanded sidebar
- **Files**: `components/sidebar.tsx`

### 5. Improved Mode Indicator Animation
- Added pulsing dot when streaming is active
- Added mode dot color animation (purple for plan, green for build)
- **Files**: `app/page.tsx`

---

## Files Modified
- `components/ide.tsx` — Non-blocking sandbox-storage error
- `app/page.tsx` — Home button, mode indicator pill, streaming animation
- `components/sidebar.tsx` — Logo in expanded sidebar

# Update Log — August 23, 2026

## Major UI Overhaul

### 1. Sidebar → Project Dropdown (Lovable-style)
- **Problem**: Full sidebar on /chat pages was too heavy and not like Lovable
- **Fix**: Sidebar only shows on dashboard/home page. On /chat pages, replaced with a compact project dropdown (like Lovable's "Sample Showcase App ▾") showing project name, with menu items: New Chat, Dashboard, Star, Make public/private, Settings
- **Files**: `app/page.tsx`

### 2. Preview Ratio Toggle + Open in New Tab
- **Problem**: No way to preview in different device sizes, no way to open preview in new tab
- **Fix**: Added cycling button (Desktop → Tablet → Mobile) in the preview bottom bar. Also added ExternalLink icon to open preview URL in new tab. Tablet = 768px, Mobile = 375px with centered viewport and smooth transitions
- **Files**: `components/fragment-web.tsx`

### 3. Removed Todo Inside Magical Message
- **Problem**: Todo list appeared both inside the Magical message AND above the chatbox (duplicate)
- **Fix**: Removed the todo rendering from inside LiveStreamingMessage component. TodoBar above chatbox is the single source of truth
- **Files**: `components/chat.tsx`

### 4. Fixed "Restoring files from sandbox storage" Glitch
- **Problem**: Restore triggered when sandbox-storage metadata existed but Go binary wasn't running, showing a never-ending message
- **Fix**: Changed restore logic to only trigger when GitHub or R2 storage is connected. Skip sandbox-storage since the Go binary may not be running
- **Files**: `app/page.tsx`

### 5. Made Timeline Items More Professional
- **Problem**: Text was too small, items felt cramped
- **Fix**: Increased all text sizes (status: 14px, thinking: 13px, commentary: 13px, headers: 15px). Added padding to all sections (px-5 py-3). Thinking items now show in bordered cards with bg-white/[0.03]. Added "thoughts" / "files" / "searches" count labels
- **Files**: `components/chat.tsx`

### 6. Planner Now Generates Real Task-Specific Todos
- **Problem**: Todos were always generic "Plan the approach, Build the frontend"
- **Fix**: Added `todos` field to planner system prompt with CRITICAL instruction to generate specific tasks. Updated `extractTodosFromPlan()` to parse the `todos` array first (fallback to steps → architecture). Todos are now task-specific like "Create the main player UI with playback controls"
- **Files**: `lib/agents/prompts.ts`, `app/api/chat/agentic/route.ts`

### 7. Private/Public Toggle Moved to Dropdown
- **Problem**: Toggle was a small button in the header that was easy to miss
- **Fix**: Moved to the project dropdown menu as a menu item. Button still works via `handleToggleProjectVisibility`
- **Files**: `app/page.tsx`

---

## Files Modified
- `app/page.tsx` — Sidebar conditional rendering, ProjectDropdownMenu component, sandbox restore fix
- `components/chat.tsx` — Removed todo from LiveStreamingMessage, bigger timeline items
- `components/fragment-web.tsx` — Viewport toggle, open-in-new-tab button
- `lib/agents/prompts.ts` — Added todos to planner output format
- `app/api/chat/agentic/route.ts` — Updated extractTodosFromPlan for todos field

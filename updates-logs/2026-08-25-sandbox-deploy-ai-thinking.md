# Update Log: 2026-08-25 — Sandbox Deploy Fix + AI Thinking Improvements

## Changes Made

### 1. Fix sandbox deploy (restore-sandbox using fragment files as fallback)
**File:** `app/api/projects/[projectId]/restore-sandbox/route.ts`

**Problem:** The restore-sandbox route only checked GitHub/R2/sandbox-storage for files. When none of those had files (common for new projects), it returned a 400 error. But the AI-generated fragment HAS all the files — they just weren't being used as a fallback.

**Fix:** Added `getFragmentFiles(fragment)` as a fallback when no storage source has files. Now the restore flow is:
1. Try sandbox-storage
2. Try GitHub workspace
3. Try R2 workspace
4. **NEW:** Try fragment files (from the AI-generated code)
5. Only fail if none have files

This means sandbox deploy ALWAYS works when there's a valid fragment with files.

### 2. Fix auto-deploy condition
**File:** `app/page.tsx`

**Problem:** The auto-deploy condition `!result && !warmSandboxResult` prevented deploying when there was already a previous result. On second+ messages, the auto-deploy would skip even if the fragment was new.

**Fix:** Removed the `!result && !warmSandboxResult` check. Now auto-deploy always triggers when the agentic stream ends with a valid fragment.

### 3. Rich AI thinking/commentary (like Replit's agent)
**Files:** `lib/agents/prompts.ts`, `lib/agents/agent-runner.ts`, `app/api/chat/agentic/route.ts`

**Problem:** The AI's commentary was too brief — just 1-2 sentences. The user wanted to see detailed reasoning like Replit's "Considering backend options" blocks.

**Fix:** 
- **Prompts** now instruct the AI to write multi-paragraph reasoning with specific sections:
  - "Analyzing the request" — overall approach and technology choices
  - "Considering architecture" — component structure, state management
  - "Considering edge cases" — error handling, responsiveness
  - "Plan summary" — implementation order
- **Agent-runner** now emits up to 6 thinking blocks per agent (was 3), splitting commentary into paragraphs
- **Pipeline** now extracts thinking from commentary paragraphs, not just output text
- **Commentary limit** increased from 300 to 600 chars

### What the user will see:
Instead of:
```
Running Planner...
Planning completed in 3.2s
```

They'll see:
```
Considering your request...
I'm analyzing what you need for a Spotify clone landing page. Looking at the
requirements, I see we need a hero section, music player UI, playlist sidebar,
and responsive design. I'm thinking Next.js with Tailwind for the frontend
stack...

Analyzing architecture...
For the component structure, I'll create a modular layout with separate
components for Navbar, Hero, PlayerControls, and PlaylistTrack. State will
live in React hooks since this is a landing page...

Created pages/index.tsx
Created components/Hero.tsx
...
```

### 4. Typecheck: ✅ All clean

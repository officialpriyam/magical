# Update Log — 2026-08-23 IDE Fix, Templates, Sandbox Sync

## Changes Made

### 1. Fix: IDE tab click no longer resets to Code
- **File**: `app/page.tsx`
- **Root cause**: `handleSendPrompt` always called `setCurrentTab('code')`, overriding the user's selected tab. Also `onFileClick` in the chat timeline switched to Code tab instead of IDE.
- **Fix**: Removed forced `setCurrentTab('code')` from `handleSendPrompt` — preserves user's current tab. Changed `onFileClick` to set tab to `'ide'` instead of `'code'` so clicking a file in the timeline opens it in the IDE.

### 2. Fix: IDE missing most files — fragment files now always load as baseline
- **File**: `components/ide.tsx`
- **Root cause**: Fragment files only loaded when `storageStatus === 'idle'`, but `fetchFiles()` immediately set it to `'loading'`, so the fast path never triggered. When sandbox-storage returned empty (degraded), the fallback also didn't trigger.
- **Fix**: Changed fast path condition from `storageStatus === 'idle'` to `storageStatus !== 'ok'` — now loads fragment files immediately even while sandbox-storage is loading. Added `degraded` status to the fallback condition. When sandbox-storage succeeds, files are MERGED with fragment files so nothing is lost.

### 3. Fix: Sandbox-storage files merged with fragment files
- **File**: `components/ide.tsx`
- **Root cause**: When sandbox-storage returned files, it overwrote the fragment files entirely. If sandbox-storage was missing some files that the AI generated, they'd disappear from the IDE.
- **Fix**: Now merges sandbox-storage files with fragment files. Fragment files are the baseline, sandbox-storage files are added on top. No content is ever lost.

### 4. Added complete template scaffold files for ALL personas
- **File**: `lib/fragment-files.ts`
- **Root cause**: Only 4 templates (nextjs, vue, streamlit, gradio) had scaffold files. React, Vite, HTML, Svelte, Expo, and PWA templates had zero scaffolding — IDE only showed the AI-generated file with no supporting config.
- **Fix**: Added complete scaffold file sets for all 6 missing templates:
  - `react-developer`: Vite + React + TypeScript + Tailwind (8 files)
  - `vite-developer`: Vite + React + TypeScript + Tailwind (8 files)
  - `html-developer`: Simple HTML with live-server (2 files)
  - `svelte-developer`: Vite + Svelte + TypeScript + Tailwind (7 files)
  - `expo-mobile`: Expo Router + React Native (5 files)
  - `pwa-mobile`: Next.js + PWA manifest + service worker config (9 files)
  - `code-interpreter-v1`: Empty (intentional — no scaffolding needed)

## Commit Message
```
fix: IDE tab persistence, fragment file loading, template scaffolds

- Fix IDE tab: remove forced setCurrentTab('code') from handleSendPrompt
  and change onFileClick to switch to IDE tab instead of Code
- Fix IDE missing files: load fragment files immediately as baseline,
  merge with sandbox-storage when available — never lose content
- Add complete scaffold files for all 6 missing templates (react,
  vite, html, svelte, expo, pwa) so IDE shows full project structure
- Sandbox-storage and fragment files are merged: fragment = baseline,
  sandbox-storage = additional files on top
```

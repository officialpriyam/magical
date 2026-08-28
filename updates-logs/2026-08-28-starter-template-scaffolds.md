# Starter Template Scaffolds - August 28, 2026

## Updates

### 1. Added Official Starter Template Metadata
- **Problem**: Template personas described framework stacks but did not record the starter repository or CLI initialization source the AI should treat as the base project.
- **Fix**: Added starter repository and CLI metadata for Next.js App Router, Vite React, Vue/create-vue, and SvelteKit/create-svelte templates.
- **Result**: Prompt context now tells the AI which starter shape it is working from and instructs it to edit, create, delete, and rename files on top of that scaffold.
- **Files**: `lib/templates.json`, `lib/templates.ts`

### 2. Centralized Starter Scaffold Files
- **Problem**: RustFS persistence and sandbox provider startup could disagree on the base files because starter scaffolds were hand-rolled in multiple places.
- **Fix**: Added a shared `lib/starter-templates.ts` module and made `getTemplateFiles()` use it for supported web templates.
- **Result**: Next.js, React/Vite, Vue, and Svelte projects now start from a consistent base file tree before AI-generated files are applied.
- **Files**: `lib/starter-templates.ts`, `lib/fragment-files.ts`

### 3. Synced Sandbox Providers With Starter Files
- **Problem**: Some providers wrote only generated files or used older duplicated scaffold definitions.
- **Fix**: Vercel, Modal, Daytona, and E2B deployment paths now merge starter scaffold files with AI-generated files before running the project.
- **Result**: Live sandboxes match the RustFS project workspace more closely and start from the same template base the AI is instructed to edit.
- **Files**: `app/api/sandbox/route.ts`, `lib/vercel-sandbox.ts`, `lib/modal-sandbox.ts`, `lib/daytona-sandbox.ts`, `lib/sandbox-provider.ts`

### 4. Updated Generation Rules for App Router and Modern Starters
- **Problem**: The generation guide still hardcoded older Next.js Pages Router expectations.
- **Fix**: Updated the guide to use the selected template's main entry file and added stack-specific starter structure rules.
- **Result**: Next.js uses `app/page.tsx`; React/Vite uses `src/App.tsx`; Vue uses `src/App.vue`; SvelteKit uses `src/routes/+page.svelte`.
- **Files**: `lib/ai-generation-guide.ts`

## Verification
- `node --max-old-space-size=4096 .\node_modules\typescript\bin\tsc --noEmit --pretty false` passes.
- `git diff --check` passes with only Windows CRLF warnings.

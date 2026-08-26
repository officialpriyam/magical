# Cursor-Style Activity Feed + AI SDK Tool Definitions

## Date: 2026-08-25

## What Changed

### 1. ActivityFeed Component (`components/activity-feed.tsx`)
New Cursor/OpenCode-style activity feed replacing the old `LiveStreamingMessage`:
- **ThinkingBlock**: Collapsible reasoning blocks (collapsed by default, expandable) with duration display
- **FileReadRow**: Compact row with eye icon + "Read path"
- **FileWriteRow**: Row with file-plus icon + "Created path" or pencil icon + "Edited path"
- **FileEditRow**: Expandable row with inline diff view (green/red lines)
- **CommandRow**: Expandable command row with terminal output preview
- **WebSearchRow**: Search results with clickable links
- **CommentaryBubble**: Streaming commentary text with cursor animation
- **TodoList**: Checkbox-style todo items with completion tracking

### 2. InlineDiff Component (`components/inline-diff.tsx`)
Uses the `diff` npm package to render line-level diffs:
- Green background for added lines, red for removed
- Line count summary header (+N added, -N removed)
- Scrollable container with max-height

### 3. AI SDK Tool Definitions (`lib/agents/tools.ts`)
Four tools matching the app's file/command logic:
- `read_file(path)` — Read a file
- `create_file(path, content)` — Create a new file
- `edit_file(path, oldContent, newContent)` — Edit an existing file
- `run_command(command)` — Run a shell command

Uses `zodSchema` for type-safe input validation (AI SDK v7).

### 4. Agent-Runner Enhancement (`lib/agents/agent-runner.ts`)
- Added `emitCommand` to `AgentEventEmitter` type
- Added tool definitions to `streamText` calls with `stopWhen: isStepCount(10)` (multi-step)
- After stream completion, processes tool invocations and emits corresponding actions
- Provider-agnostic: works with OpenRouter, DeepSeek, etc.

### 5. Agentic Route Updates (`app/api/chat/agentic/route.ts`)
- Added `emitCommand` to agent emitter
- Added `run_command` action emission when fragment has `install_dependencies_command`

### 6. Chat Integration (`components/chat.tsx`)
- Replaced `LiveStreamingMessage` with `ActivityFeed` component
- Both persisted and live streaming states use the new component

## Architecture

```
User Prompt → Agentic Pipeline → Agent (streamText + tools) → 
  → SSE events (action/thinking/file_write/run_command/fragment) →
  → useAgenticStream hook → ActivityFeed component →
  → Cursor-style rows (thinking, file ops, diffs, commands)
```

## Dependencies Added
- `@assistant-ui/react` (v0.15.16) — UI framework (available for future use)
- `@assistant-ui/react-markdown` (v0.14.12) — Markdown rendering
- `diff` (v9.0.0) — Inline diff computation

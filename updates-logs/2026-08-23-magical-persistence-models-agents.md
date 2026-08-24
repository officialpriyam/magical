# Update Log — 2026-08-23: Magical Persistence, Models, Agent Prompts

## Changes

### 1. Fix Magical messages disappearing after generation completes
- **File**: `app/page.tsx`
- **Root cause**: The `loadProjectMessages` useEffect had `useAgentic`, `agenticStream`, `agenticStream.isStreaming`, and `agenticActions` in its dependency array. Every time the agentic stream state changed (which happens frequently during/after streaming), the effect re-ran and reloaded messages from the database. This overwrote in-memory agentic state (actions, todos, elapsed) that hadn't been saved to DB yet.
- **Fix**: Removed `useAgentic` and `agenticStream` from the `loadProjectMessages` effect dependencies. These should not trigger a full message reload from DB — they change during streaming but the messages array itself doesn't change during that time.

### 2. Updated OpenRouter models (11 new models)
- **File**: `lib/models.json`
- **Added models**:
  - `deepseek/deepseek-r1` — DeepSeek R1 reasoning model
  - `deepseek/deepseek-v4` — DeepSeek V4 latest
  - `deepseek/deepseek-v4-flash` — DeepSeek V4 Flash (fast)
  - `deepseek/deepseek-v3.1` — DeepSeek V3.1
  - `google/gemini-3.0-flash` — Gemini 3.0 Flash
  - `google/gemini-3.5-pro` — Gemini 3.5 Pro
  - `google/gemini-3.7-flash` — Gemini 3.7 Flash (latest)
  - `google/gemini-3.5-flash-lite` — Gemini 3.5 Flash Lite
  - `mimo/mimo-v2.5` — Mimo V2.5
  - `xiaomi/mimo-v2` — Xiaomi MiMo V2
  - `mistralai/mistral-medium-4` — Mistral Medium 4

### 3. Improved agent system prompts for real thinking/commentary
- **File**: `lib/agents/prompts.ts`
- **Planner Agent**: Added instructions to write natural conversation-style commentary ("Let me analyze...", "Based on your request...", "I'm going to break this down...")
- **Architect Agent**: Added instructions for commentary about architecture decisions in real-time
- **Frontend Agent**: Added instructions to be descriptive about component building ("I'm creating a responsive navigation...", "Building the hero section...")
- **Reviewer Agent**: Added instructions for professional code review conversation style

### 4. Auto-generate README.md, .gitignore in generation
- **File**: `lib/agents/prompts.ts`
- **Frontend Agent guidelines**: Added rules to ALWAYS include README.md with project description, setup instructions, tech stack; ALWAYS include .gitignore appropriate for the template; make README professional with badges and screenshots section

## Commit Message
```
fix: magical message persistence, add OpenRouter models, improve agent commentary

- Fix magical messages disappearing: remove useAgentic/agenticStream from
  loadProjectMessages dependencies — these trigger DB reload on every
  stream state change, overwriting in-memory agentic state
- Add 11 new OpenRouter models: DeepSeek R1/V4/V4 Flash/V3.1,
  Gemini 3.0/3.5 Pro/3.7 Flash/3.5 Flash Lite, MiMo V2.5/V2,
  Mistral Medium 4
- Improve agent prompts: planner/architect/frontend/reviewer now write
  natural conversation-style commentary explaining their thinking
- Frontend agent now auto-generates README.md and .gitignore
```

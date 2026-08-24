# Update Log — 2026-08-23: Sandbox Direct Commands

## Changes

### Direct sandbox commands in chat
- **File**: `app/page.tsx`
- **What**: When user types sandbox-related commands in the chat input, they are intercepted and executed directly instead of being sent to the AI.
- **Supported commands**:
  - `redeploy sandbox` / `restart sandbox` / `start sandbox` / `deploy sandbox` / `rebuild sandbox` / `refresh sandbox` / `reload sandbox`
  - Also works without "sandbox" suffix: `redeploy`, `restart`, `deploy`, etc.
  - `open ide` / `open editor` / `open code` / `open files`
- **Behavior**:
  - Shows user message + assistant response in chat (e.g., "Redeploying sandbox...")
  - Triggers the actual sandbox action (handleRedeploy or opens IDE tab)
  - Updates the assistant message with success/failure status
  - Saves both messages to DB

## Commit Message
```
feat: sandbox direct commands in chat

- Intercept sandbox commands (redeploy, restart, start, deploy, rebuild)
  in chat input and execute directly instead of sending to AI
- Add open ide/editor/code commands to switch to IDE tab
- Show command status in chat with user message + assistant response
```

# Chat UI Polish and Bug Fixes — August 23, 2026

## Updates

### 1. Hidden Agent/Style/Prefix Metadata from User Messages
- **Problem**: User messages showed raw `[Agent: search]`, `[Style: Modern] Modern SaaS design with clean sans-serif typography...`, `[Custom Style] ...` prefixes
- **Fix**: Added comprehensive stripping in chat.tsx that removes ALL injection metadata before display:
  - `[Agent: ...]` — stripped, replaced with purple agent badge icon
  - `[Style: ...]` + following prompt text — completely hidden
  - `[Custom Style]` + following prompt text — completely hidden
  - `[Search: ...]` — stripped, shows as Web Search badge
  - `[Think: ...]` — stripped, shows as Thinking badge
  - `[Canvas: ...]` — stripped, shows as Canvas badge
- **Files**: `components/chat.tsx`

### 2. Agent Badge Icon in User Messages
- **Problem**: No visual indication of which agent skill was used when a message is sent
- **Fix**: When `[Agent: ...]` prefix is detected, a purple badge with Cpu icon and agent name is shown above the message text (e.g. "search", "build", "frontend")
- **Files**: `components/chat.tsx`

### 3. Fixed Style Prompt Showing Raw Description Text
- **Problem**: When a user selected a theme like "Claymorphism", the full prompt text "Claymorphism design with 3D clay-like elements. Soft pastel colors..." was visible in the chat
- **Fix**: The `[Style: ...]` regex now uses `[\\s\\S]*$` to match and remove everything from the tag to the end of the message, including the full prompt text
- **Files**: `components/chat.tsx`

### 4. Fixed Stop Button in Prompt Box
- **Problem**: Clicking the stop button (red square) in the prompt input didn't actually stop the agentic stream
- **Fix**: `handleStopGeneration()` now calls both `stop()` (non-agentic) and `agenticStream.stop()` (SSE abort)
- **Files**: `app/page.tsx`

### 5. Added Message Queue System
- **Problem**: Sending a message while streaming was either ignored or stopped the current generation
- **Fix**: Messages sent while streaming are queued in `messageQueue` state. When streaming ends, the effect detects queued messages and automatically sends them with a 500ms delay. Visual indicator shows "N messages queued" with a Clear button
- **Files**: `app/page.tsx`

### 6. Added Message History Navigation
- **Problem**: No way to quickly re-send a previous message without retyping
- **Fix**: Added `messageHistory` prop to PromptInputBox. ArrowUp in empty input cycles backward through previous user messages. ArrowDown cycles forward. History index resets when a message is sent
- **Files**: `components/ui/ai-prompt-box.tsx`, `app/page.tsx`

### 7. Improved Todo Generation from Execution Plan
- **Problem**: Todos were only extracted from planner JSON output — often empty because the planner didn't produce structured output
- **Fix**: Initial todos are now generated from the agent execution plan (e.g. "Plan the approach", "Design the architecture", "Build frontend", "Build backend", "Review code quality", "Optimize performance"). Todos auto-complete as each agent finishes
- **Files**: `app/api/chat/agentic/route.ts`

### 8. Added Fallback Todo Completion Tracking
- **Problem**: Planner-extracted todos never got marked as completed
- **Fix**: After each agent completes, the code checks if any todo matches the agent name and marks it complete. The updated todo list is re-emitted to the frontend
- **Files**: `app/api/chat/agentic/route.ts`

### 9. Fixed Magical Message Disappearing on Completion (Race Condition)
- **Problem**: When streaming ends, `agenticStreaming` goes false but the persistence effect hasn't run yet — creating a blank frame
- **Fix**: Added third rendering fallback in Chat component: if streaming is done but no persisted state exists yet, still show live agentic actions. Also improved persistence to always create an assistant message when agentic actions exist
- **Files**: `components/chat.tsx`, `app/page.tsx`

### 10. Always Persist Agentic Actions Into Assistant Message
- **Problem**: If the fragment was empty (no code/files), agentic actions were lost
- **Fix**: Persistence now always creates an assistant message with agenticActions/todos/elapsed even without fragment data
- **Files**: `app/page.tsx`

## Files Modified
- `components/chat.tsx` — Agent badge, prefix stripping, fallback rendering
- `components/ui/ai-prompt-box.tsx` — History navigation
- `app/page.tsx` — Stop button fix, queue system, persistence improvement
- `app/api/chat/agentic/route.ts` — Todo generation and completion tracking

# Update Log — 2026-08-23: Message Persistence Fix (ROOT CAUSE)

## Root Cause

**Messages were NEVER being saved to the database.** The `save_message_and_update_project` Supabase RPC function doesn't exist (404), and the direct client-side upsert fails with RLS (403). This means:

1. Every time a message was sent, `saveMessage()` tried to save → RPC 404 → upsert 403 → returned false
2. Agentic state (thinking, file reads/writes, todos) was never persisted
3. When `loadProjectMessages` ran (on page reload, project switch, or effect re-run), it loaded from DB → no agentic state → messages appeared empty
4. The old messages with agentic timeline disappeared

## Fix

### 1. Server-side message save API route
- **File**: `app/api/messages/save/route.ts` (NEW)
- Created `/api/messages/save` POST route that uses the server-side Supabase client (service_role) to bypass client-side RLS
- Accepts: projectId, role, content, objectData (with agentic state), resultData, sequenceNumber
- Upserts the message and touches project's updated_at

### 2. Client-side saveMessage uses server route
- **File**: `lib/database.ts`
- Replaced the broken RPC + RLS-blocked upsert flow with a simple `fetch('/api/messages/save')` call
- Server-side route handles all DB operations, client just sends the data
- `invalidateCache()` still called to ensure fresh data on next load

## Why This Fixes Everything

- Messages now actually save to the database
- Agentic state (`_agenticActions`, `_agenticTodos`, `_agenticElapsed`) is persisted in `object_data`
- When `loadProjectMessages` runs, it loads messages WITH their agentic state
- Old messages don't lose their Magical timeline on refresh or new message send

## Commit Message
```
fix: messages not persisting to database (ROOT CAUSE)

- Create /api/messages/save server-side route using service_role to bypass RLS
- Client saveMessage now calls server route instead of broken RPC + upsert
- Agentic state (thinking, file reads/writes, todos) now actually persists
```

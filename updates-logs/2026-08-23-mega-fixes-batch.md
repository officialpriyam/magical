# Update Log — August 23, 2026 (Batch 2)

## Fixes Applied

### 1. Chat input always typeable during AI generation
**Files:** `components/ui/ai-prompt-box.tsx`
- Removed `disabled={isLoading}` from textarea — users can now type while AI is working
- Messages sent during streaming are queued (existing queue system)

### 2. Message queue with edit/delete
**Files:** `app/page.tsx`
- Queue indicator now shows each queued message as a list item
- Each queued message has an × button to remove it
- "Clear all" button to clear the entire queue

### 3. Remove Cloudflare sandbox (paid)
**Files:** `lib/sandbox-provider.ts`
- Removed `cloudflare` from `SandboxProvider` type and options
- Removed from provider detection and validation functions
- Remaining free options: E2B, Vercel, Modal, Daytona

### 4. Login page — dynamic OAuth providers
**Files:** `app/auth/login/page.tsx`
- Fetches enabled providers from `/api/auth/providers` endpoint
- Only shows OAuth buttons for providers enabled in Supabase
- Includes icons for Google, GitHub, Discord

### 5. Complete env.example
**Files:** `.env.example`
- Added all Vercel env vars: Supabase, AI providers (OpenAI, Anthropic, Google, OpenRouter, DeepSeek, Mistral, Groq, xAI), Morph, web search (Exa, Brave), sandbox providers (E2B, Vercel, Modal), PostHog analytics, rate limiting, email validation, UI config

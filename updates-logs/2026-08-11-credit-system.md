# Credit System & Sidebar Fixes - August 11, 2026

## Changes Made

### Credit System
- **500 credits on signup**: New users automatically receive 500 credits when their profile is created
- **50 daily credits**: Users receive 50 credits every 24 hours when they have depleted credits
- **1 credit per chat message**: Each chat/morph request deducts 1 credit
- **402 status on depletion**: Users see "Insufficient credits" when out of credits

### Database Changes (`supabase/migrations/20260811_credit_system.sql`)
- Added `last_daily_credit_at` column to `profiles` table
- Updated `handle_new_user()` trigger to set initial 500 credits on signup
- Created `grant_daily_credits()` function that checks 24h interval and adds 50 credits
- Backfilled 500 credits to all existing users with 0 credits

### New Files
- `lib/credits.ts` - Credit utility functions:
  - `getCredits(userId)` - Get current credit balance
  - `grantDailyCredits(userId)` - Check and grant daily credits
  - `deductCredits(userId, amount)` - Deduct credits
  - `ensureCredits(userId)` - Grant daily + deduct 1 credit, returns `{ok, credits}`

### API Changes
- `app/api/chat/route.ts` - Added credit check before model fallback chain
- `app/api/chat/morph-chat/route.ts` - Added credit check before model fallback chain
- Both return 402 status when credits are insufficient

### Sidebar Fixes
- **Dropdown z-index**: Added `z-[100]` to `DropdownMenuContent` to fix overlay issues
- **Logo replaced with icon**: Replaced `/icon.png` with `Sparkles` icon from lucide-react
- **Dynamic credits display**: Credits section now shows real credit count from user profile
- **Progress bar**: Credit bar dynamically reflects percentage of 500 max credits

## Migration Required
Run the migration in Supabase SQL editor:
```sql
-- From supabase/migrations/20260811_credit_system.sql
```

## Testing
- TypeScript: `npx tsc --noEmit` passes clean
- Lint: No new warnings introduced

# Daily Credit Claim System - August 11, 2026

## Changes Made

### New Database Tables (`supabase/migrations/20260811_daily_claims.sql`)
- **daily_claims** table: Tracks individual credit claim history
  - `user_id` - Reference to auth.users
  - `claim_date` - The date being claimed
  - `status` - 'claimed', 'skipped', or 'missed'
  - Unique constraint on (user_id, claim_date)

- **claim_daily_credit()** function: Manual credit claiming
  - Checks if already claimed today
  - Inserts claim record
  - Adds 50 credits to user profile
  - Returns success/message/credits

- **get_claim_status()** function: Get claim history for date range

### New Files
- `app/credits/page.tsx` - Credits page with calendar UI
- `app/api/credits/claim/route.ts` - POST endpoint to claim daily credit
- `app/api/credits/status/route.ts` - GET endpoint to fetch credit status

### Updated Files
- `lib/credits.ts` - Rewritten for manual claiming:
  - `claimDailyCredit(userId)` - Manual claim function
  - `getClaimStatus(userId, start, end)` - Get claim history
  - `checkCredits(userId)` - Check balance before API call
  - Removed auto-grant `ensureCredits()`

- `app/api/chat/route.ts` - Uses `checkCredits()` instead of `ensureCredits()`
- `app/api/chat/morph-chat/route.ts` - Uses `checkCredits()` instead of `ensureCredits()`
- `components/sidebar.tsx` - Credits section now links to `/credits` page

### Credits Page Features
- **Calendar view**: Shows claim status for each day
  - Green: Claimed
  - Yellow: Skipped
  - Gray/Locked: Future dates
- **Claim button**: Manual button to claim today's 50 credits
- **Balance display**: Shows current credit count
- **Monthly navigation**: Browse previous/next months

### Migration Required
Run both migrations in Supabase SQL editor:
1. `supabase/migrations/20260811_credit_system.sql` (from previous)
2. `supabase/migrations/20260811_daily_claims.sql` (new)

## Testing
- TypeScript: `npx tsc --noEmit` passes clean
- Lint: No new warnings introduced

-- Credit system migration
-- Adds 500 credits on signup, 50 daily credits when depleted
-- Safe to re-run

-- 1. Add last_daily_credit_at column to track daily credit grants
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_daily_credit_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Update handle_new_user trigger to grant 500 credits on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, credits, last_daily_credit_at)
  VALUES (new.id, 500, now())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill: give 500 credits to any existing users with 0 credits
UPDATE profiles SET credits = 500 WHERE credits = 0 OR credits IS NULL;

-- 4. Create function to grant daily credits if 24h have passed
CREATE OR REPLACE FUNCTION grant_daily_credits(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  v_last_grant timestamptz;
  v_credits integer;
BEGIN
  SELECT last_daily_credit_at, credits INTO v_last_grant, v_credits
  FROM profiles WHERE user_id = p_user_id;

  -- If never granted or 24h+ since last grant, add 50 credits
  IF v_last_grant IS NULL OR (now() - v_last_grant) >= interval '24 hours' THEN
    UPDATE profiles
    SET credits = COALESCE(credits, 0) + 50,
        last_daily_credit_at = now()
    WHERE user_id = p_user_id
    RETURNING credits INTO v_credits;
  END IF;

  RETURN v_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

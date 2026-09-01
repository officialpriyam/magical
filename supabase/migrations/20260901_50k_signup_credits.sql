-- Update signup credits to 50,000
-- Safe to re-run

-- 1. Update handle_new_user trigger to grant 50000 credits on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, credits, last_daily_credit_at)
  VALUES (new.id, 50000, now())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Backfill: set all existing users to 50000 credits (minimum)
UPDATE profiles SET credits = 50000 WHERE credits < 50000 OR credits IS NULL;

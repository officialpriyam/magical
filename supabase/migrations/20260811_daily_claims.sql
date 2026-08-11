-- Daily claims table for manual credit claiming
-- Safe to re-run

-- 1. Create daily_claims table
CREATE TABLE IF NOT EXISTS daily_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_date date NOT NULL,
  status text DEFAULT 'claimed' CHECK (status IN ('claimed', 'skipped', 'missed')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, claim_date)
);

-- 2. RLS policies
ALTER TABLE daily_claims ENABLE ROW LEVEL SECURITY;

-- Users can view own claims
DROP POLICY IF EXISTS "Users can view own daily claims" ON daily_claims;
CREATE POLICY "Users can view own daily claims" ON daily_claims
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert own claims
DROP POLICY IF EXISTS "Users can insert own daily claims" ON daily_claims;
CREATE POLICY "Users can insert own daily claims" ON daily_claims
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Function to claim daily credit
CREATE OR REPLACE FUNCTION claim_daily_credit(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_today date := current_date;
  v_claimed boolean;
  v_credits integer;
BEGIN
  -- Check if already claimed today
  SELECT EXISTS(
    SELECT 1 FROM daily_claims
    WHERE user_id = p_user_id AND claim_date = v_today AND status = 'claimed'
  ) INTO v_claimed;

  IF v_claimed THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Already claimed today',
      'credits', (SELECT credits FROM profiles WHERE user_id = p_user_id)
    );
  END IF;

  -- Insert or update claim record
  INSERT INTO daily_claims (user_id, claim_date, status)
  VALUES (p_user_id, v_today, 'claimed')
  ON CONFLICT (user_id, claim_date)
  DO UPDATE SET status = 'claimed', created_at = now();

  -- Add 50 credits
  UPDATE profiles
  SET credits = COALESCE(credits, 0) + 50
  WHERE user_id = p_user_id
  RETURNING credits INTO v_credits;

  RETURN json_build_object(
    'success', true,
    'message', 'Daily credit claimed!',
    'credits', v_credits
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to get claim status for a date range
CREATE OR REPLACE FUNCTION get_claim_status(p_user_id uuid, p_start_date date, p_end_date date)
RETURNS TABLE(claim_date date, status text) AS $$
BEGIN
  RETURN QUERY
  SELECT dc.claim_date, dc.status
  FROM daily_claims dc
  WHERE dc.user_id = p_user_id
    AND dc.claim_date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

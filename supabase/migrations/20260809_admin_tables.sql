-- Admin tables migration
-- Run this in your Supabase SQL editor

-- 1. Add admin columns to users table (if not exists)
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS banned boolean DEFAULT false;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS credits integer DEFAULT 0;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens_used integer DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Create site_settings table
CREATE TABLE IF NOT EXISTS site_settings (
  id integer PRIMARY KEY DEFAULT 1,
  discord_link text DEFAULT '',
  support_email text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

-- 3. Create token_usage table
CREATE TABLE IF NOT EXISTS token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  tokens integer DEFAULT 0,
  credits_used integer DEFAULT 0,
  model text,
  created_at timestamptz DEFAULT now()
);

-- 4. RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

-- Users: anyone can read, only admins can update
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update users" ON users
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Site settings: anyone can read, only admins can update
CREATE POLICY "Anyone can view site settings" ON site_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can update site settings" ON site_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Token usage: users can view own, admins can view all
CREATE POLICY "Users can view own token usage" ON token_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all token usage" ON token_usage
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "System can insert token usage" ON token_usage
  FOR INSERT WITH CHECK (true);

-- 5. Create credit functions
CREATE OR REPLACE FUNCTION add_credits(p_user_id uuid, p_amount integer)
RETURNS void AS $$
BEGIN
  UPDATE users SET credits = COALESCE(credits, 0) + p_amount WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION deduct_credits(p_user_id uuid, p_amount integer)
RETURNS void AS $$
BEGIN
  UPDATE users SET credits = GREATEST(0, COALESCE(credits, 0) - p_amount) WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin tables migration (v2)
-- Run this in your Supabase SQL editor
-- Safe to re-run: uses IF NOT EXISTS / IF NOT EXISTS everywhere

-- 1. Create profiles table (did not exist previously)
CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'user',
  banned boolean DEFAULT false,
  credits integer DEFAULT 0,
  tokens_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- In case profiles already existed without these columns, this is a no-op otherwise
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned boolean DEFAULT false;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits integer DEFAULT 0;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tokens_used integer DEFAULT 0;
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
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens integer DEFAULT 0,
  credits_used integer DEFAULT 0,
  model text,
  created_at timestamptz DEFAULT now()
);

-- 4. Helper function to check admin status without recursive RLS lookups.
-- SECURITY DEFINER lets it bypass RLS on profiles internally, so policies
-- that call this function don't trigger infinite recursion.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5. RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

-- Profiles: users can view/update their own row, admins can view/update all
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (is_admin());

-- Site settings: anyone can read, only admins can update
DROP POLICY IF EXISTS "Anyone can view site settings" ON site_settings;
CREATE POLICY "Anyone can view site settings" ON site_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update site settings" ON site_settings;
CREATE POLICY "Admins can update site settings" ON site_settings
  FOR ALL USING (is_admin());

-- Token usage: users can view own, admins can view all
DROP POLICY IF EXISTS "Users can view own token usage" ON token_usage;
CREATE POLICY "Users can view own token usage" ON token_usage
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all token usage" ON token_usage;
CREATE POLICY "Admins can view all token usage" ON token_usage
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "System can insert token usage" ON token_usage;
CREATE POLICY "System can insert token usage" ON token_usage
  FOR INSERT WITH CHECK (true);

-- 6. Create credit functions
CREATE OR REPLACE FUNCTION add_credits(p_user_id uuid, p_amount integer)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET credits = COALESCE(credits, 0) + p_amount WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION deduct_credits(p_user_id uuid, p_amount integer)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET credits = GREATEST(0, COALESCE(credits, 0) - p_amount) WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Auto-create a profile row whenever a new auth user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 8. Backfill profiles for any existing auth users who don't have one yet
INSERT INTO public.profiles (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
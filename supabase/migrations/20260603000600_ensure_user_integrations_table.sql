-- Ensure integrations storage exists for GitHub OAuth and settings pages.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.user_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_name text NOT NULL,
  is_connected boolean DEFAULT false,
  connection_data jsonb,
  last_sync_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_integrations_pkey PRIMARY KEY (id),
  CONSTRAINT user_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_integrations_unique UNIQUE (user_id, service_name)
);

ALTER TABLE public.user_integrations
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS service_name text,
  ADD COLUMN IF NOT EXISTS is_connected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS connection_data jsonb,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

ALTER TABLE public.user_integrations
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN service_name SET NOT NULL,
  ALTER COLUMN is_connected SET DEFAULT false,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_integrations_pkey'
      AND conrelid = 'public.user_integrations'::regclass
  ) THEN
    ALTER TABLE public.user_integrations
      ADD CONSTRAINT user_integrations_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_integrations_user_id_fkey'
      AND conrelid = 'public.user_integrations'::regclass
  ) THEN
    ALTER TABLE public.user_integrations
      ADD CONSTRAINT user_integrations_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_integrations_unique'
      AND conrelid = 'public.user_integrations'::regclass
  ) THEN
    ALTER TABLE public.user_integrations
      ADD CONSTRAINT user_integrations_unique UNIQUE (user_id, service_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_integrations_service_name_check'
      AND conrelid = 'public.user_integrations'::regclass
  ) THEN
    ALTER TABLE public.user_integrations
      ADD CONSTRAINT user_integrations_service_name_check
      CHECK (
        service_name = ANY (
          ARRAY[
            'github'::text,
            'google_drive'::text,
            'gmail'::text,
            'google_calendar'::text,
            'artifacts'::text
          ]
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id
  ON public.user_integrations (user_id);

CREATE INDEX IF NOT EXISTS idx_user_integrations_service_name
  ON public.user_integrations (service_name);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_integrations'
      AND policyname = 'Users can view their own integrations'
  ) THEN
    CREATE POLICY "Users can view their own integrations" ON public.user_integrations
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_integrations'
      AND policyname = 'Users can insert their own integrations'
  ) THEN
    CREATE POLICY "Users can insert their own integrations" ON public.user_integrations
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_integrations'
      AND policyname = 'Users can update their own integrations'
  ) THEN
    CREATE POLICY "Users can update their own integrations" ON public.user_integrations
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_integrations'
      AND policyname = 'Users can delete their own integrations'
  ) THEN
    CREATE POLICY "Users can delete their own integrations" ON public.user_integrations
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_user_integrations_updated_at ON public.user_integrations;
CREATE TRIGGER update_user_integrations_updated_at BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_integrations TO authenticated;

NOTIFY pgrst, 'reload schema';

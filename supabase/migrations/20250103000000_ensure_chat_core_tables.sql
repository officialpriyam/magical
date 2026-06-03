-- Ensure the core chat tables exist before later migrations reference them.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE public.project_status_enum AS ENUM ('active', 'archived', 'deleted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.message_role_enum AS ENUM ('user', 'assistant');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_id uuid,
  title text NOT NULL,
  description text,
  template_id text,
  status public.project_status_enum DEFAULT 'active',
  is_public boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT projects_title_check CHECK (char_length(title) >= 1)
);

DO $$
BEGIN
  IF to_regclass('public.teams') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'projects_team_id_fkey'
        AND conrelid = 'public.projects'::regclass
    )
  THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_team_id_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  role public.message_role_enum NOT NULL,
  content jsonb NOT NULL,
  object_data jsonb,
  result_data jsonb,
  sequence_number integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT messages_sequence_positive CHECK (sequence_number >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_project_sequence_unique
  ON public.messages (project_id, sequence_number);

CREATE TABLE IF NOT EXISTS public.fragments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid,
  title text NOT NULL,
  description text,
  template text NOT NULL,
  code text NOT NULL,
  file_path text NOT NULL,
  additional_dependencies text[],
  has_additional_dependencies boolean DEFAULT false,
  install_dependencies_command text,
  port integer,
  is_public boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fragments_pkey PRIMARY KEY (id),
  CONSTRAINT fragments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fragments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT fragments_title_check CHECK (char_length(title) >= 1),
  CONSTRAINT fragments_port_check CHECK (port IS NULL OR (port > 0 AND port <= 65535))
);

CREATE TABLE IF NOT EXISTS public.file_uploads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  bucket_name text NOT NULL,
  is_public boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT file_uploads_pkey PRIMARY KEY (id),
  CONSTRAINT file_uploads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT file_uploads_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT file_uploads_size_check CHECK (file_size IS NULL OR file_size >= 0),
  CONSTRAINT file_uploads_name_check CHECK (char_length(file_name) >= 1)
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects (user_id);
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON public.projects (team_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_project_id ON public.messages (project_id);
CREATE INDEX IF NOT EXISTS idx_messages_sequence ON public.messages (project_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fragments_user_id ON public.fragments (user_id);
CREATE INDEX IF NOT EXISTS idx_fragments_project_id ON public.fragments (project_id);
CREATE INDEX IF NOT EXISTS idx_fragments_template ON public.fragments (template);

CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON public.file_uploads (user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_project_id ON public.file_uploads (project_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_created_at ON public.file_uploads (created_at DESC);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fragments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'projects'
      AND policyname = 'Users can view their own projects'
  ) THEN
    CREATE POLICY "Users can view their own projects" ON public.projects
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'projects'
      AND policyname = 'Users can insert their own projects'
  ) THEN
    CREATE POLICY "Users can insert their own projects" ON public.projects
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'projects'
      AND policyname = 'Users can update their own projects'
  ) THEN
    CREATE POLICY "Users can update their own projects" ON public.projects
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'projects'
      AND policyname = 'Users can delete their own projects'
  ) THEN
    CREATE POLICY "Users can delete their own projects" ON public.projects
      FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND policyname = 'Users can view messages from their projects'
  ) THEN
    CREATE POLICY "Users can view messages from their projects" ON public.messages
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.projects
          WHERE projects.id = messages.project_id
            AND projects.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND policyname = 'Users can insert messages to their projects'
  ) THEN
    CREATE POLICY "Users can insert messages to their projects" ON public.messages
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.projects
          WHERE projects.id = messages.project_id
            AND projects.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fragments'
      AND policyname = 'Users can view their own fragments'
  ) THEN
    CREATE POLICY "Users can view their own fragments" ON public.fragments
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fragments'
      AND policyname = 'Users can manage their own fragments'
  ) THEN
    CREATE POLICY "Users can manage their own fragments" ON public.fragments
      FOR ALL USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'file_uploads'
      AND policyname = 'Users can manage their own file uploads'
  ) THEN
    CREATE POLICY "Users can manage their own file uploads" ON public.file_uploads
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_fragments_updated_at ON public.fragments;
CREATE TRIGGER update_fragments_updated_at BEFORE UPDATE ON public.fragments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_file_uploads_updated_at ON public.file_uploads;
CREATE TRIGGER update_file_uploads_updated_at BEFORE UPDATE ON public.file_uploads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fragments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_uploads TO authenticated;

NOTIFY pgrst, 'reload schema';

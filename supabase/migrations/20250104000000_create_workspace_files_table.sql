-- =============================================================================
-- Create workspace_files table for IDE file management
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid,
  path text NOT NULL,
  name text NOT NULL,
  content text NOT NULL DEFAULT '',
  is_directory boolean DEFAULT false,
  parent_path text,
  mime_type text,
  size_bytes bigint DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workspace_files_pkey PRIMARY KEY (id),
  CONSTRAINT workspace_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT workspace_files_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT workspace_files_unique_path UNIQUE (user_id, path),
  CONSTRAINT workspace_files_path_check CHECK (char_length(path) >= 1),
  CONSTRAINT workspace_files_name_check CHECK (char_length(name) >= 1),
  CONSTRAINT workspace_files_size_check CHECK (size_bytes >= 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_files_user_id ON public.workspace_files (user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_files_project_id ON public.workspace_files (project_id);
CREATE INDEX IF NOT EXISTS idx_workspace_files_path ON public.workspace_files (user_id, path);
CREATE INDEX IF NOT EXISTS idx_workspace_files_parent_path ON public.workspace_files (user_id, parent_path);
CREATE INDEX IF NOT EXISTS idx_workspace_files_created_at ON public.workspace_files (created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.workspace_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own workspace files" ON public.workspace_files
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workspace files" ON public.workspace_files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workspace files" ON public.workspace_files
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workspace files" ON public.workspace_files
  FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_workspace_files_updated_at BEFORE UPDATE ON public.workspace_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.workspace_files TO authenticated;

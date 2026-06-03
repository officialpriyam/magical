-- Restrict project/chat data so only the owning user can access it.

DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
CREATE POLICY "Users can view their own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view messages from their projects" ON public.messages;
CREATE POLICY "Users can view messages from their projects" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = messages.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view their own fragments or public ones" ON public.fragments;
DROP POLICY IF EXISTS "Users can view their own fragments" ON public.fragments;
CREATE POLICY "Users can view their own fragments" ON public.fragments
  FOR SELECT USING (auth.uid() = user_id);

REVOKE SELECT ON public.projects FROM anon;

CREATE OR REPLACE FUNCTION public.save_message_and_update_project(
  project_id_param UUID,
  role_param TEXT,
  content_param JSONB,
  object_data_param JSONB DEFAULT NULL,
  result_data_param JSONB DEFAULT NULL,
  sequence_number_param INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.projects
    WHERE id = project_id_param
      AND user_id = auth.uid()
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Project not found or access denied'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.messages (
    project_id,
    role,
    content,
    object_data,
    result_data,
    sequence_number
  ) VALUES (
    project_id_param,
    role_param::public.message_role_enum,
    content_param,
    object_data_param,
    result_data_param,
    sequence_number_param
  )
  ON CONFLICT (project_id, sequence_number)
  DO UPDATE SET
    role = EXCLUDED.role,
    content = EXCLUDED.content,
    object_data = EXCLUDED.object_data,
    result_data = EXCLUDED.result_data;

  UPDATE public.projects
  SET updated_at = NOW()
  WHERE id = project_id_param
    AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_message_and_update_project TO authenticated;

NOTIFY pgrst, 'reload schema';

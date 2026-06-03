-- Function to save message and update project timestamp
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
AS $$
BEGIN
  -- Insert or update the message (upsert to handle duplicates)
  INSERT INTO public.messages (
    project_id,
    role,
    content,
    object_data,
    result_data,
    sequence_number
  ) VALUES (
    project_id_param,
    role_param,
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

  -- Update the project's updated_at timestamp
  UPDATE public.projects
  SET updated_at = NOW()
  WHERE id = project_id_param;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.save_message_and_update_project TO authenticated;
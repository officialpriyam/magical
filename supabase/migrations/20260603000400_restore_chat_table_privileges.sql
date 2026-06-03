-- Ensure authenticated users can create and read their own chat data after
-- owner-only RLS policies are applied.

GRANT USAGE ON SCHEMA public TO authenticated;

DO $$
BEGIN
  IF to_regclass('public.projects') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
  END IF;

  IF to_regclass('public.messages') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
  END IF;

  IF to_regclass('public.fragments') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.fragments TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

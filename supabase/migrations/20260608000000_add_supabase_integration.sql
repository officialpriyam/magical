-- Allow users to connect their own Supabase projects for AI-generated migrations.

ALTER TABLE public.user_integrations
  DROP CONSTRAINT IF EXISTS user_integrations_service_name_check;

ALTER TABLE public.user_integrations
  ADD CONSTRAINT user_integrations_service_name_check
  CHECK (
    service_name = ANY (
      ARRAY[
        'github'::text,
        'google_drive'::text,
        'gmail'::text,
        'google_calendar'::text,
        'artifacts'::text,
        'supabase'::text
      ]
    )
  );

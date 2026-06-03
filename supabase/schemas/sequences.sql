-- =============================================================================
-- Magical AI Sequences Schema - Database Sequences
-- =============================================================================
-- This file contains all database sequences used across all schemas
-- These sequences are used for auto-incrementing IDs and other sequential data
-- =============================================================================

-- =============================================================================
-- PUBLIC SCHEMA SEQUENCES
-- =============================================================================

-- Sequence for code embeddings table
CREATE SEQUENCE IF NOT EXISTS public.code_embeddings_id_seq
    INCREMENT BY 1
    MINVALUE 1
    MAXVALUE 9223372036854775807
    START WITH 1
    CACHE 1
    NO CYCLE;

-- Sequence for profiles table (legacy compatibility)
CREATE SEQUENCE IF NOT EXISTS public.profiles_id_seq
    INCREMENT BY 1
    MINVALUE 1
    MAXVALUE 9223372036854775807
    START WITH 1
    CACHE 1
    NO CYCLE;

-- Sequence for tasks table
CREATE SEQUENCE IF NOT EXISTS public.tasks_id_seq
    INCREMENT BY 1
    MINVALUE 1
    MAXVALUE 9223372036854775807
    START WITH 1
    CACHE 1
    NO CYCLE;

-- =============================================================================
-- AUTH SCHEMA SEQUENCES
-- =============================================================================

-- Sequence for refresh tokens
CREATE SEQUENCE IF NOT EXISTS auth.refresh_tokens_id_seq
    INCREMENT BY 1
    MINVALUE 1
    MAXVALUE 9223372036854775807
    START WITH 1
    CACHE 1
    NO CYCLE;

-- =============================================================================
-- STORAGE SCHEMA SEQUENCES
-- =============================================================================

-- Sequence for storage migrations
CREATE SEQUENCE IF NOT EXISTS storage.migrations_id_seq
    INCREMENT BY 1
    MINVALUE 1
    MAXVALUE 2147483647
    START WITH 1
    CACHE 1
    NO CYCLE;

-- =============================================================================
-- SEQUENCE OWNERSHIP AND DEFAULTS
-- =============================================================================

-- Set sequence ownership and default values
ALTER SEQUENCE public.code_embeddings_id_seq OWNED BY public.code_embeddings.id;
ALTER TABLE public.code_embeddings ALTER COLUMN id SET DEFAULT nextval('public.code_embeddings_id_seq');

-- Note: profiles table uses GENERATED ALWAYS AS IDENTITY, so no manual sequence assignment needed

-- Set sequence ownership for tasks
ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;
-- Note: tasks table uses GENERATED ALWAYS AS IDENTITY, so no manual sequence assignment needed

-- Set sequence ownership for auth refresh tokens
ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;
ALTER TABLE auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq');

-- Set sequence ownership for storage migrations
ALTER SEQUENCE storage.migrations_id_seq OWNED BY storage.migrations.id;
-- Note: migrations table should use manual ID assignment for proper migration tracking

-- =============================================================================
-- SEQUENCE PERMISSIONS
-- =============================================================================

-- Grant usage permissions to authenticated users for sequences they need
GRANT USAGE ON SEQUENCE public.code_embeddings_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.profiles_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.tasks_id_seq TO authenticated;

-- Grant all permissions to service role for administrative tasks
GRANT ALL ON SEQUENCE public.code_embeddings_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.profiles_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.tasks_id_seq TO service_role;
GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO service_role;
GRANT ALL ON SEQUENCE storage.migrations_id_seq TO service_role;

-- =============================================================================
-- SEQUENCE MAINTENANCE FUNCTIONS
-- =============================================================================

-- Function to reset sequence to match max ID in table
CREATE OR REPLACE FUNCTION public.reset_sequence_to_max(
  sequence_name text,
  table_name text,
  column_name text DEFAULT 'id'
)
RETURNS void AS $$
DECLARE
  max_id bigint;
  sql_text text;
BEGIN
  -- Get the maximum ID from the table
  sql_text := format('SELECT COALESCE(MAX(%I), 0) FROM %I', column_name, table_name);
  EXECUTE sql_text INTO max_id;

  -- Reset the sequence to max_id + 1
  sql_text := format('SELECT setval(%L, %s)', sequence_name, max_id + 1);
  EXECUTE sql_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current sequence value without advancing it
CREATE OR REPLACE FUNCTION public.get_sequence_value(sequence_name text)
RETURNS bigint AS $$
DECLARE
  current_value bigint;
BEGIN
  EXECUTE format('SELECT last_value FROM %I', sequence_name) INTO current_value;
  RETURN current_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- SEQUENCE MONITORING
-- =============================================================================

-- View to monitor sequence usage and remaining capacity
CREATE OR REPLACE VIEW public.sequence_status AS
SELECT
  schemaname,
  sequencename,
  last_value,
  max_value,
  increment_by,
  ROUND((last_value::numeric / max_value::numeric) * 100, 2) as usage_percentage,
  CASE
    WHEN (last_value::numeric / max_value::numeric) > 0.8 THEN 'WARNING'
    WHEN (last_value::numeric / max_value::numeric) > 0.95 THEN 'CRITICAL'
    ELSE 'OK'
  END as status
FROM pg_sequences
WHERE schemaname IN ('public', 'auth', 'storage')
ORDER BY usage_percentage DESC;

-- Grant access to the monitoring view
GRANT SELECT ON public.sequence_status TO authenticated;
GRANT SELECT ON public.sequence_status TO service_role;

-- =============================================================================
-- SEQUENCE CLEANUP AND MAINTENANCE
-- =============================================================================

-- Function to clean up unused sequences
CREATE OR REPLACE FUNCTION public.cleanup_unused_sequences()
RETURNS void AS $$
DECLARE
  seq_record record;
  table_exists boolean;
BEGIN
  FOR seq_record IN
    SELECT schemaname, sequencename
    FROM pg_sequences
    WHERE schemaname IN ('public', 'auth', 'storage')
  LOOP
    -- Check if the corresponding table exists
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = seq_record.schemaname
      AND table_name = replace(seq_record.sequencename, '_id_seq', '')
    ) INTO table_exists;

    -- Log sequences without corresponding tables
    IF NOT table_exists THEN
      RAISE NOTICE 'Orphaned sequence found: %.%', seq_record.schemaname, seq_record.sequencename;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- GRANTS FOR UTILITY FUNCTIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.reset_sequence_to_max TO service_role;
GRANT EXECUTE ON FUNCTION public.get_sequence_value TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_unused_sequences TO service_role;

-- =============================================================================
-- END OF SEQUENCES SCHEMA
-- =============================================================================

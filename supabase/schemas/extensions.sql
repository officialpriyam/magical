-- =============================================================================
-- Magical AI Extensions Schema - PostgreSQL Extensions Setup
-- =============================================================================
-- This file contains all the PostgreSQL extensions required for Magical AI
-- These should be installed first before creating tables
-- =============================================================================

-- =============================================================================
-- CORE EXTENSIONS
-- =============================================================================

-- UUID generation functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Vector support for embeddings and AI features
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA extensions;

-- Text search and similarity functions
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA pg_catalog;

-- Additional text search features
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA public;

-- HTTP client for external API calls
CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA extensions;

-- Cryptographic functions for enhanced security
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- =============================================================================
-- SUPABASE SPECIFIC EXTENSIONS
-- =============================================================================

-- Supabase Auth helpers
CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA extensions;

-- Row Level Security helpers
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA vault;

-- =============================================================================
-- ANALYTICS AND PERFORMANCE EXTENSIONS
-- =============================================================================

-- Statistics and analytics functions
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA public;

-- JSON operations and functions
CREATE EXTENSION IF NOT EXISTS "jsonb_plperl" WITH SCHEMA public;

-- =============================================================================
-- WRAPPERS AND FOREIGN DATA
-- =============================================================================

-- Create the extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Foreign data wrapper stats table (from existing extensions.sql)
CREATE TABLE IF NOT EXISTS extensions.wrappers_fdw_stats (
  fdw_name text NOT NULL,
  create_times bigint,
  rows_in bigint,
  rows_out bigint,
  bytes_in bigint,
  bytes_out bigint,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT wrappers_fdw_stats_pkey PRIMARY KEY (fdw_name)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_wrappers_fdw_stats_created_at ON extensions.wrappers_fdw_stats (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wrappers_fdw_stats_updated_at ON extensions.wrappers_fdw_stats (updated_at DESC);

-- =============================================================================
-- GRANTS AND PERMISSIONS
-- =============================================================================

-- Grant usage on extensions schema
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;

-- Grant access to specific tables
GRANT SELECT, INSERT, UPDATE, DELETE ON extensions.wrappers_fdw_stats TO service_role;

-- =============================================================================
-- CONFIGURATION COMMENTS
-- =============================================================================

-- Note: Some extensions may require superuser privileges to install
-- These should be enabled through the Supabase dashboard or by a superuser:
--
-- For development/testing, you may also want:
-- CREATE EXTENSION IF NOT EXISTS "plpgsql_check";
-- CREATE EXTENSION IF NOT EXISTS "pg_cron";
--
-- For production monitoring:
-- CREATE EXTENSION IF NOT EXISTS "pg_buffercache";
-- CREATE EXTENSION IF NOT EXISTS "pg_walinspect";

-- =============================================================================
-- END OF EXTENSIONS SCHEMA
-- =============================================================================

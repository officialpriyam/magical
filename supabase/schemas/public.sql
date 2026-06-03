-- =============================================================================
-- Magical AI Public Schema - Complete Database Schema
-- =============================================================================
-- This file contains the complete public schema for Magical AI including:
-- - All tables with proper constraints and indexes
-- - Row Level Security (RLS) policies
-- - Default values and triggers
-- - Optimized for production use
-- =============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- SEQUENCES
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS code_embeddings_id_seq;

-- =============================================================================
-- ENUMS AND CUSTOM TYPES
-- =============================================================================

-- Create custom types for better type safety
DO $$ BEGIN
    CREATE TYPE subscription_status_enum AS ENUM ('active', 'canceled', 'past_due', 'unpaid', 'incomplete');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE project_status_enum AS ENUM ('active', 'archived', 'deleted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_role_enum AS ENUM ('user', 'assistant');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status_enum AS ENUM ('pending', 'processing', 'completed', 'error');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- TEAMS AND ORGANIZATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tier text DEFAULT 'free'::text,
  email text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  subscription_status subscription_status_enum DEFAULT 'active',
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean DEFAULT false,
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_name_check CHECK (char_length(name) >= 1),
  CONSTRAINT teams_tier_check CHECK (tier IN ('free', 'pro', 'enterprise'))
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_members_pkey PRIMARY KEY (id),
  CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
  CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT team_members_unique UNIQUE (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.users_teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_id uuid NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_teams_pkey PRIMARY KEY (id),
  CONSTRAINT users_teams_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT users_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
  CONSTRAINT users_teams_unique UNIQUE (user_id, team_id)
);

-- =============================================================================
-- USER MANAGEMENT AND PROFILES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  full_name text,
  display_name text,
  first_name text,
  last_name text,
  work_description text,
  avatar_url text,
  onboarding_completed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  ai_assistance boolean DEFAULT true,
  smart_suggestions boolean DEFAULT false,
  theme text DEFAULT 'system'::text CHECK (theme = ANY (ARRAY['light'::text, 'dark'::text, 'system'::text])),
  font_family text DEFAULT 'inter'::text CHECK (font_family = ANY (ARRAY['inter'::text, 'jetbrains-mono'::text, 'cal-sans'::text])),
  email_notifications boolean DEFAULT true,
  marketing_emails boolean DEFAULT false,
  security_alerts boolean DEFAULT true,
  analytics_enabled boolean DEFAULT true,
  data_sharing_enabled boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.user_security_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  two_factor_enabled boolean DEFAULT false,
  backup_codes text[],
  last_password_change timestamp with time zone,
  login_notifications boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_security_settings_pkey PRIMARY KEY (id),
  CONSTRAINT user_security_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.user_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_name text NOT NULL CHECK (service_name = ANY (ARRAY['github'::text, 'google_drive'::text, 'gmail'::text, 'google_calendar'::text, 'artifacts'::text])),
  is_connected boolean DEFAULT false,
  connection_data jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_integrations_pkey PRIMARY KEY (id),
  CONSTRAINT user_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_integrations_unique UNIQUE (user_id, service_name)
);

-- Legacy profiles table for backward compatibility
CREATE TABLE IF NOT EXISTS public.profiles (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid,
  first_name text,
  last_name text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- =============================================================================
-- PROJECTS AND FRAGMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_id uuid,
  title text NOT NULL,
  description text,
  template_id text,
  status project_status_enum DEFAULT 'active',
  is_public boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT projects_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL,
  CONSTRAINT projects_title_check CHECK (char_length(title) >= 1)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  role message_role_enum NOT NULL,
  content jsonb NOT NULL,
  object_data jsonb,
  result_data jsonb,
  sequence_number integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT messages_sequence_positive CHECK (sequence_number >= 0)
);

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

CREATE TABLE IF NOT EXISTS public.fragment_executions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fragment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  sandbox_id text,
  template text NOT NULL,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'timeout'::text])),
  execution_url text,
  stdout text,
  stderr text,
  runtime_error text,
  cell_results jsonb,
  execution_time_ms integer,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT fragment_executions_pkey PRIMARY KEY (id),
  CONSTRAINT fragment_executions_fragment_id_fkey FOREIGN KEY (fragment_id) REFERENCES public.fragments(id) ON DELETE CASCADE,
  CONSTRAINT fragment_executions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fragment_executions_time_check CHECK (execution_time_ms IS NULL OR execution_time_ms >= 0)
);

-- =============================================================================
-- FILE UPLOADS AND STORAGE
-- =============================================================================

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

-- =============================================================================
-- CHAT AND MESSAGING SYSTEM
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id character varying NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  team_id uuid,
  title text,
  status character varying DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'archived'::character varying, 'deleted'::character varying]::text[])),
  message_count integer DEFAULT 0,
  model character varying,
  template character varying,
  s3_metadata_key text,
  s3_messages_key text,
  total_tokens integer DEFAULT 0,
  estimated_cost numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_activity timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_sessions_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL,
  CONSTRAINT chat_sessions_count_check CHECK (message_count >= 0),
  CONSTRAINT chat_sessions_tokens_check CHECK (total_tokens >= 0),
  CONSTRAINT chat_sessions_cost_check CHECK (estimated_cost >= 0)
);

CREATE TABLE IF NOT EXISTS public.chat_message_cache (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL,
  message_id character varying NOT NULL,
  role character varying NOT NULL CHECK (role::text = ANY (ARRAY['user'::character varying, 'assistant'::character varying, 'system'::character varying]::text[])),
  content text NOT NULL,
  content_hash character varying,
  model character varying,
  template character varying,
  token_count integer,
  execution_time_ms integer,
  created_at timestamp with time zone DEFAULT now(),
  content_vector tsvector DEFAULT to_tsvector('english'::regconfig, content),
  CONSTRAINT chat_message_cache_pkey PRIMARY KEY (id),
  CONSTRAINT chat_message_cache_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  CONSTRAINT chat_message_cache_token_check CHECK (token_count IS NULL OR token_count >= 0),
  CONSTRAINT chat_message_cache_time_check CHECK (execution_time_ms IS NULL OR execution_time_ms >= 0)
);

CREATE TABLE IF NOT EXISTS public.chat_session_tags (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL,
  tag character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_session_tags_pkey PRIMARY KEY (id),
  CONSTRAINT chat_session_tags_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  CONSTRAINT chat_session_tags_unique UNIQUE (session_id, tag),
  CONSTRAINT chat_session_tags_tag_check CHECK (char_length(tag) >= 1)
);

CREATE TABLE IF NOT EXISTS public.chat_export_requests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  export_type character varying NOT NULL CHECK (export_type::text = ANY (ARRAY['json'::character varying, 'csv'::character varying]::text[])),
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying]::text[])),
  date_from timestamp with time zone,
  date_to timestamp with time zone,
  session_ids uuid[],
  s3_export_key text,
  file_size_bytes bigint,
  record_count integer,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT chat_export_requests_pkey PRIMARY KEY (id),
  CONSTRAINT chat_export_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT chat_export_requests_size_check CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  CONSTRAINT chat_export_requests_count_check CHECK (record_count IS NULL OR record_count >= 0)
);

-- =============================================================================
-- CONVERSATION THREADS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.conversation_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_archived boolean DEFAULT false,
  CONSTRAINT conversation_threads_pkey PRIMARY KEY (id),
  CONSTRAINT conversation_threads_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT conversation_threads_name_check CHECK (char_length(name) >= 1)
);

CREATE TABLE IF NOT EXISTS public.thread_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_deleted boolean DEFAULT false,
  CONSTRAINT thread_messages_pkey PRIMARY KEY (id),
  CONSTRAINT thread_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
  CONSTRAINT thread_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT thread_messages_content_check CHECK (char_length(content) >= 1)
);

CREATE TABLE IF NOT EXISTS public.thread_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  summary text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  message_count integer NOT NULL,
  last_message_id uuid,
  CONSTRAINT thread_summaries_pkey PRIMARY KEY (id),
  CONSTRAINT thread_summaries_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
  CONSTRAINT thread_summaries_last_message_id_fkey FOREIGN KEY (last_message_id) REFERENCES public.thread_messages(id) ON DELETE SET NULL,
  CONSTRAINT thread_summaries_count_check CHECK (message_count >= 0)
);

-- =============================================================================
-- USAGE TRACKING AND ANALYTICS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_id uuid,
  usage_type text NOT NULL CHECK (usage_type = ANY (ARRAY['fragment_execution'::text, 'api_call'::text, 'storage_used'::text, 'project_created'::text, 'github_import'::text])),
  usage_date date DEFAULT CURRENT_DATE,
  usage_count integer DEFAULT 1,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_usage_pkey PRIMARY KEY (id),
  CONSTRAINT user_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_usage_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
  CONSTRAINT user_usage_count_check CHECK (usage_count >= 0)
);

CREATE TABLE IF NOT EXISTS public.team_usage_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  usage_type text NOT NULL CHECK (usage_type = ANY (ARRAY['github_imports'::text, 'storage_mb'::text, 'execution_time_seconds'::text, 'api_calls'::text])),
  limit_value integer NOT NULL DEFAULT 0,
  current_usage integer NOT NULL DEFAULT 0,
  period_start timestamp with time zone DEFAULT now(),
  period_end timestamp with time zone DEFAULT (now() + '1 mon'::interval),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_usage_limits_pkey PRIMARY KEY (id),
  CONSTRAINT team_usage_limits_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
  CONSTRAINT team_usage_limits_unique UNIQUE (team_id, usage_type),
  CONSTRAINT team_usage_limits_limit_check CHECK (limit_value >= 0),
  CONSTRAINT team_usage_limits_current_check CHECK (current_usage >= 0)
);

CREATE TABLE IF NOT EXISTS public.user_chat_analytics (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  total_sessions integer DEFAULT 0,
  total_messages integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  total_cost numeric DEFAULT 0,
  model_usage jsonb DEFAULT '{}'::jsonb,
  template_usage jsonb DEFAULT '{}'::jsonb,
  last_activity timestamp with time zone,
  most_active_hour integer,
  most_active_day integer,
  favorite_models text[],
  favorite_templates text[],
  s3_objects_count integer DEFAULT 0,
  estimated_storage_size_bytes bigint DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_chat_analytics_pkey PRIMARY KEY (id),
  CONSTRAINT user_chat_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_chat_analytics_sessions_check CHECK (total_sessions >= 0),
  CONSTRAINT user_chat_analytics_messages_check CHECK (total_messages >= 0),
  CONSTRAINT user_chat_analytics_tokens_check CHECK (total_tokens >= 0),
  CONSTRAINT user_chat_analytics_cost_check CHECK (total_cost >= 0),
  CONSTRAINT user_chat_analytics_hour_check CHECK (most_active_hour IS NULL OR (most_active_hour >= 0 AND most_active_hour <= 23)),
  CONSTRAINT user_chat_analytics_day_check CHECK (most_active_day IS NULL OR (most_active_day >= 0 AND most_active_day <= 6))
);

-- =============================================================================
-- API KEYS AND SECURITY
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  permissions jsonb DEFAULT '{}'::jsonb,
  last_used_at timestamp with time zone,
  expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT api_keys_pkey PRIMARY KEY (id),
  CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT api_keys_name_check CHECK (char_length(name) >= 1),
  CONSTRAINT api_keys_prefix_check CHECK (char_length(key_prefix) >= 1)
);

-- =============================================================================
-- BILLING AND SUBSCRIPTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.billing_info (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL UNIQUE,
  company_name text NOT NULL,
  company_email text NOT NULL,
  tax_id text,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  postal_code text NOT NULL,
  country text NOT NULL DEFAULT 'US'::text,
  payment_method text NOT NULL DEFAULT 'card'::text CHECK (payment_method = ANY (ARRAY['card'::text, 'bank_transfer'::text, 'invoice'::text])),
  billing_cycle text NOT NULL DEFAULT 'monthly'::text CHECK (billing_cycle = ANY (ARRAY['monthly'::text, 'annual'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT billing_info_pkey PRIMARY KEY (id),
  CONSTRAINT billing_info_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
  CONSTRAINT billing_info_email_check CHECK (company_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  stripe_event_id text UNIQUE,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subscription_events_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_events_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
  CONSTRAINT subscription_events_type_check CHECK (char_length(event_type) >= 1)
);

-- =============================================================================
-- TASKS AND WORKFLOWS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  status task_status_enum NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  prompt text NOT NULL,
  repo_url text,
  selected_agent text DEFAULT 'claude'::text,
  selected_model text,
  sandbox_url text,
  branch_name text,
  logs jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT tasks_prompt_check CHECK (char_length(prompt) >= 1)
);

CREATE TABLE IF NOT EXISTS public.workflows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  schema jsonb NOT NULL,
  is_active boolean DEFAULT true,
  version integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workflows_pkey PRIMARY KEY (id),
  CONSTRAINT workflows_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
  CONSTRAINT workflows_name_check CHECK (char_length(name) >= 1),
  CONSTRAINT workflows_version_check CHECK (version >= 1)
);

CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL,
  schema jsonb NOT NULL,
  is_public boolean DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  usage_count integer DEFAULT 0,
  rating numeric DEFAULT 0.0,
  CONSTRAINT workflow_templates_pkey PRIMARY KEY (id),
  CONSTRAINT workflow_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT workflow_templates_name_check CHECK (char_length(name) >= 1),
  CONSTRAINT workflow_templates_category_check CHECK (char_length(category) >= 1),
  CONSTRAINT workflow_templates_usage_check CHECK (usage_count >= 0),
  CONSTRAINT workflow_templates_rating_check CHECK (rating >= 0.0 AND rating <= 5.0)
);

CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])),
  input_data jsonb DEFAULT '{}'::jsonb,
  output_data jsonb,
  execution_log jsonb[] DEFAULT '{}'::jsonb[],
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  error text,
  created_by uuid NOT NULL,
  CONSTRAINT workflow_executions_pkey PRIMARY KEY (id),
  CONSTRAINT workflow_executions_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE,
  CONSTRAINT workflow_executions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- =============================================================================
-- CODE EMBEDDINGS AND SEARCH
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.code_embeddings (
  id bigint NOT NULL DEFAULT nextval('code_embeddings_id_seq'::regclass),
  content text NOT NULL,
  embedding vector(1536),
  user_id uuid NOT NULL,
  CONSTRAINT code_embeddings_pkey PRIMARY KEY (id),
  CONSTRAINT code_embeddings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT code_embeddings_content_check CHECK (char_length(content) >= 1)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =============================================================================

-- Project indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects (user_id);
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON public.projects (team_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects (updated_at DESC);

-- Message indexes
CREATE INDEX IF NOT EXISTS idx_messages_project_id ON public.messages (project_id);
CREATE INDEX IF NOT EXISTS idx_messages_sequence ON public.messages (project_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages (created_at DESC);

-- Fragment indexes
CREATE INDEX IF NOT EXISTS idx_fragments_user_id ON public.fragments (user_id);
CREATE INDEX IF NOT EXISTS idx_fragments_project_id ON public.fragments (project_id);
CREATE INDEX IF NOT EXISTS idx_fragments_template ON public.fragments (template);
CREATE INDEX IF NOT EXISTS idx_fragments_public ON public.fragments (is_public) WHERE is_public = true;

-- Chat session indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_team_id ON public.chat_sessions (team_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON public.chat_sessions (status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_activity ON public.chat_sessions (last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON public.chat_sessions (session_id);

-- Chat message cache indexes
CREATE INDEX IF NOT EXISTS idx_chat_message_cache_session_id ON public.chat_message_cache (session_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_cache_created_at ON public.chat_message_cache (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_message_cache_content_vector ON public.chat_message_cache USING GIN (content_vector);
CREATE INDEX IF NOT EXISTS idx_chat_message_cache_model ON public.chat_message_cache (model);

-- User profile indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences (user_id);

-- Team indexes
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members (user_id);
CREATE INDEX IF NOT EXISTS idx_teams_stripe_customer_id ON public.teams (stripe_customer_id);

-- Usage tracking indexes
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON public.user_usage (user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_date ON public.user_usage (usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_usage_type ON public.user_usage (usage_type);
CREATE INDEX IF NOT EXISTS idx_team_usage_limits_team_id ON public.team_usage_limits (team_id);

-- API key indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON public.api_keys (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys (key_hash);

-- File upload indexes
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON public.file_uploads (user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_project_id ON public.file_uploads (project_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_created_at ON public.file_uploads (created_at DESC);

-- Task indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks (created_at DESC);

-- Code embeddings indexes
CREATE INDEX IF NOT EXISTS idx_code_embeddings_user_id ON public.code_embeddings (user_id);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_embedding ON public.code_embeddings USING ivfflat (embedding vector_cosine_ops);

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fragments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fragment_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_session_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_chat_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_summaries ENABLE ROW LEVEL SECURITY;

-- User profile policies
CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- User preferences policies
CREATE POLICY "Users can manage their own preferences" ON public.user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Project policies
CREATE POLICY "Users can view their own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- Message policies
CREATE POLICY "Users can view messages from their projects" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = messages.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to their projects" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = messages.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Fragment policies
CREATE POLICY "Users can view their own fragments" ON public.fragments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own fragments" ON public.fragments
  FOR ALL USING (auth.uid() = user_id);

-- Chat session policies
CREATE POLICY "Users can manage their own chat sessions" ON public.chat_sessions
  FOR ALL USING (auth.uid() = user_id);

-- API key policies
CREATE POLICY "Users can manage their own API keys" ON public.api_keys
  FOR ALL USING (auth.uid() = user_id);

-- Task policies
CREATE POLICY "Users can manage their own tasks" ON public.tasks
  FOR ALL USING (auth.uid() = user_id);

-- File upload policies
CREATE POLICY "Users can manage their own file uploads" ON public.file_uploads
  FOR ALL USING (auth.uid() = user_id);

-- Team policies
CREATE POLICY "Team members can view their teams" ON public.teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
    )
  );

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- =============================================================================

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to relevant tables
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fragments_updated_at BEFORE UPDATE ON public.fragments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- GRANTS AND PERMISSIONS
-- =============================================================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant read access to anonymous users for public content
GRANT SELECT ON public.fragments TO anon;
GRANT SELECT ON public.projects TO anon;
GRANT SELECT ON public.workflow_templates TO anon;

-- =============================================================================
-- ADDITIONAL BUSINESS LOGIC FUNCTIONS
-- =============================================================================

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

  -- Insert the message
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
  );

  -- Update the project's updated_at timestamp
  UPDATE public.projects
  SET updated_at = NOW()
  WHERE id = project_id_param;
END;
$$;

-- Function to check if a user can use a feature (for subscription limits)
CREATE OR REPLACE FUNCTION public.can_use_feature(
  feature_name TEXT,
  team_id_param UUID,
  user_id_param UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  usage_limit INTEGER;
  current_usage INTEGER;
BEGIN
  -- Get the usage limit for this feature and team
  SELECT limit_value INTO usage_limit
  FROM public.team_usage_limits
  WHERE team_id = team_id_param
    AND usage_type = feature_name;

  -- If no limit is set, allow usage
  IF usage_limit IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Get current usage
  SELECT current_usage INTO current_usage
  FROM public.team_usage_limits
  WHERE team_id = team_id_param
    AND usage_type = feature_name;

  -- If current usage is null, treat as 0
  IF current_usage IS NULL THEN
    current_usage := 0;
  END IF;

  -- Return whether user can use the feature
  RETURN current_usage < usage_limit;
END;
$$;

-- Function to increment usage for a feature
CREATE OR REPLACE FUNCTION public.increment_usage(
  feature_name TEXT,
  team_id_param UUID,
  user_id_param UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update current usage
  UPDATE public.team_usage_limits
  SET current_usage = current_usage + 1,
      updated_at = NOW()
  WHERE team_id = team_id_param
    AND usage_type = feature_name;

  -- If no row was updated, insert a new one
  IF NOT FOUND THEN
    INSERT INTO public.team_usage_limits (
      team_id,
      usage_type,
      current_usage,
      limit_value
    ) VALUES (
      team_id_param,
      feature_name,
      1,
      1000 -- Default limit
    );
  END IF;

  -- Also track individual user usage
  INSERT INTO public.user_usage (
    user_id,
    team_id,
    usage_type,
    usage_count,
    metadata
  ) VALUES (
    user_id_param,
    team_id_param,
    feature_name,
    1,
    '{}'::jsonb
  );

  RETURN TRUE;
END;
$$;

-- Function to initialize team usage limits
CREATE OR REPLACE FUNCTION public.initialize_team_usage_limits(
  team_id_param UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert default usage limits for new teams
  INSERT INTO public.team_usage_limits (team_id, usage_type, limit_value, current_usage)
  VALUES
    (team_id_param, 'github_imports', 100, 0),
    (team_id_param, 'storage_mb', 1000, 0),
    (team_id_param, 'execution_time_seconds', 3600, 0),
    (team_id_param, 'api_calls', 10000, 0)
  ON CONFLICT (team_id, usage_type) DO NOTHING;
END;
$$;

-- Function to soft delete a project
CREATE OR REPLACE FUNCTION public.soft_delete_project(
  project_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.projects
  SET deleted_at = NOW(),
      status = 'deleted',
      updated_at = NOW()
  WHERE id = project_id;
END;
$$;

-- Function to search user messages with full-text search
CREATE OR REPLACE FUNCTION public.search_user_messages(
  query_text TEXT,
  user_id_param UUID
)
RETURNS TABLE(
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  session_id TEXT,
  similarity_score REAL,
  title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cmc.content::TEXT,
    cmc.created_at,
    cs.session_id,
    ts_rank(cmc.content_vector, plainto_tsquery('english', query_text)) as similarity_score,
    COALESCE(cs.title, 'Untitled Session') as title
  FROM public.chat_message_cache cmc
  JOIN public.chat_sessions cs ON cmc.session_id = cs.id
  WHERE cs.user_id = user_id_param
    AND cmc.content_vector @@ plainto_tsquery('english', query_text)
  ORDER BY similarity_score DESC
  LIMIT 50;
END;
$$;

-- Function to get user chat summary analytics
CREATE OR REPLACE FUNCTION public.get_user_chat_summary(
  user_id_param UUID
)
RETURNS TABLE(
  total_sessions INTEGER,
  total_messages INTEGER,
  total_tokens INTEGER,
  total_cost NUMERIC,
  avg_session_length_minutes NUMERIC,
  avg_daily_sessions NUMERIC,
  most_active_hour INTEGER,
  most_active_day INTEGER,
  favorite_models JSON,
  favorite_templates JSON,
  model_usage_breakdown JSON,
  template_usage_breakdown JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    uca.total_sessions,
    uca.total_messages,
    uca.total_tokens,
    uca.total_cost,
    COALESCE(
      EXTRACT(EPOCH FROM (
        SELECT AVG(last_activity - created_at)
        FROM public.chat_sessions
        WHERE user_id = user_id_param
      )) / 60, 0
    ) as avg_session_length_minutes,
    COALESCE(uca.total_sessions::NUMERIC / NULLIF(
      EXTRACT(DAYS FROM (NOW() - (
        SELECT MIN(created_at)
        FROM public.chat_sessions
        WHERE user_id = user_id_param
      ))), 0
    ), 0) as avg_daily_sessions,
    uca.most_active_hour,
    uca.most_active_day,
    uca.model_usage::JSON,
    uca.template_usage::JSON,
    uca.model_usage::JSON as model_usage_breakdown,
    uca.template_usage::JSON as template_usage_breakdown
  FROM public.user_chat_analytics uca
  WHERE uca.user_id = user_id_param;
END;
$$;

-- Grant execute permissions to authenticated users for business logic functions
GRANT EXECUTE ON FUNCTION public.save_message_and_update_project TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_use_feature TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_team_usage_limits TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_project TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_user_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_chat_summary TO authenticated;

-- =============================================================================
-- END OF PUBLIC SCHEMA
-- =============================================================================

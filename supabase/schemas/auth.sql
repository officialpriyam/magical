-- =============================================================================
-- Magical AI Auth Schema - Complete Authentication System
-- =============================================================================
-- This file contains the complete auth schema for Supabase authentication
-- including all tables, indexes, and security policies for user management
-- =============================================================================

-- =============================================================================
-- AUTH SCHEMA TABLES
-- =============================================================================

-- Audit log for tracking authentication events
CREATE TABLE IF NOT EXISTS auth.audit_log_entries (
  instance_id uuid,
  id uuid NOT NULL,
  payload json,
  created_at timestamp with time zone,
  ip_address character varying NOT NULL DEFAULT ''::character varying,
  CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id)
);

-- OAuth flow state management
CREATE TABLE IF NOT EXISTS auth.flow_state (
  id uuid NOT NULL,
  user_id uuid,
  auth_code text NOT NULL,
  code_challenge_method text NOT NULL,
  code_challenge text NOT NULL,
  provider_type text NOT NULL,
  provider_access_token text,
  provider_refresh_token text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  authentication_method text NOT NULL,
  auth_code_issued_at timestamp with time zone,
  CONSTRAINT flow_state_pkey PRIMARY KEY (id)
);

-- User identities from OAuth providers
CREATE TABLE IF NOT EXISTS auth.identities (
  provider_id text NOT NULL,
  user_id uuid NOT NULL,
  identity_data jsonb NOT NULL,
  provider text NOT NULL,
  last_sign_in_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  email text DEFAULT lower((identity_data ->> 'email'::text)),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT identities_pkey PRIMARY KEY (id),
  CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT identities_email_check CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Supabase instances configuration
CREATE TABLE IF NOT EXISTS auth.instances (
  id uuid NOT NULL,
  uuid uuid,
  raw_base_config text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  CONSTRAINT instances_pkey PRIMARY KEY (id)
);

-- Multi-factor authentication AMR claims
CREATE TABLE IF NOT EXISTS auth.mfa_amr_claims (
  session_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  authentication_method text NOT NULL,
  id uuid NOT NULL,
  CONSTRAINT mfa_amr_claims_pkey PRIMARY KEY (id),
  CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE
);

-- MFA challenges for verification
CREATE TABLE IF NOT EXISTS auth.mfa_challenges (
  id uuid NOT NULL,
  factor_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL,
  verified_at timestamp with time zone,
  ip_address inet NOT NULL,
  otp_code text,
  web_authn_session_data jsonb,
  CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id),
  CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE
);

-- MFA factors (TOTP, WebAuthn, etc.)
CREATE TABLE IF NOT EXISTS auth.mfa_factors (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  friendly_name text,
  factor_type text NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  secret text,
  phone text,
  last_challenged_at timestamp with time zone UNIQUE,
  web_authn_credential jsonb,
  web_authn_aaguid uuid,
  CONSTRAINT mfa_factors_pkey PRIMARY KEY (id),
  CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT mfa_factors_type_check CHECK (factor_type IN ('totp', 'webauthn', 'phone')),
  CONSTRAINT mfa_factors_status_check CHECK (status IN ('unverified', 'verified'))
);

-- One-time tokens for email verification, password reset, etc.
CREATE TABLE IF NOT EXISTS auth.one_time_tokens (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  token_type text NOT NULL,
  token_hash text NOT NULL CHECK (char_length(token_hash) > 0),
  relates_to text NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT one_time_tokens_type_check CHECK (token_type IN ('confirmation_token', 'reauthentication_token', 'recovery_token', 'email_change_token_new', 'email_change_token_current', 'phone_change_token'))
);

-- Refresh tokens for JWT renewal
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  instance_id uuid,
  id bigint NOT NULL,
  token character varying UNIQUE,
  user_id character varying,
  revoked boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  parent character varying,
  session_id uuid,
  CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE
);

-- SAML providers configuration
CREATE TABLE IF NOT EXISTS auth.saml_providers (
  id uuid NOT NULL,
  sso_provider_id uuid NOT NULL,
  entity_id text NOT NULL UNIQUE CHECK (char_length(entity_id) > 0),
  metadata_xml text NOT NULL CHECK (char_length(metadata_xml) > 0),
  metadata_url text CHECK (metadata_url IS NULL OR char_length(metadata_url) > 0),
  attribute_mapping jsonb,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  name_id_format text,
  CONSTRAINT saml_providers_pkey PRIMARY KEY (id),
  CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE
);

-- SAML relay states for SSO flow
CREATE TABLE IF NOT EXISTS auth.saml_relay_states (
  id uuid NOT NULL,
  sso_provider_id uuid NOT NULL,
  request_id text NOT NULL CHECK (char_length(request_id) > 0),
  for_email text,
  redirect_to text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  flow_state_id uuid,
  CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id),
  CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE,
  CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE
);

-- Schema migrations tracking
CREATE TABLE IF NOT EXISTS auth.schema_migrations (
  version character varying NOT NULL,
  CONSTRAINT schema_migrations_pkey PRIMARY KEY (version)
);

-- User sessions with authentication level
CREATE TABLE IF NOT EXISTS auth.sessions (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  factor_id uuid,
  aal text,
  not_after timestamp with time zone,
  refreshed_at timestamp without time zone,
  user_agent text,
  ip inet,
  tag text,
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT sessions_aal_check CHECK (aal IN ('aal1', 'aal2'))
);

-- SSO domains for enterprise authentication
CREATE TABLE IF NOT EXISTS auth.sso_domains (
  id uuid NOT NULL,
  sso_provider_id uuid NOT NULL,
  domain text NOT NULL CHECK (char_length(domain) > 0),
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  CONSTRAINT sso_domains_pkey PRIMARY KEY (id),
  CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE
);

-- SSO providers configuration
CREATE TABLE IF NOT EXISTS auth.sso_providers (
  id uuid NOT NULL,
  resource_id text CHECK (resource_id IS NULL OR char_length(resource_id) > 0),
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  CONSTRAINT sso_providers_pkey PRIMARY KEY (id)
);

-- Core users table
CREATE TABLE IF NOT EXISTS auth.users (
  instance_id uuid,
  id uuid NOT NULL,
  aud character varying,
  role character varying,
  email character varying,
  encrypted_password character varying,
  email_confirmed_at timestamp with time zone,
  invited_at timestamp with time zone,
  confirmation_token character varying,
  confirmation_sent_at timestamp with time zone,
  recovery_token character varying,
  recovery_sent_at timestamp with time zone,
  email_change_token_new character varying,
  email_change character varying,
  email_change_sent_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  phone text DEFAULT NULL::character varying UNIQUE,
  phone_confirmed_at timestamp with time zone,
  phone_change text DEFAULT ''::character varying,
  phone_change_token character varying DEFAULT ''::character varying,
  phone_change_sent_at timestamp with time zone,
  confirmed_at timestamp with time zone DEFAULT LEAST(email_confirmed_at, phone_confirmed_at),
  email_change_token_current character varying DEFAULT ''::character varying,
  email_change_confirm_status smallint DEFAULT 0 CHECK (email_change_confirm_status >= 0 AND email_change_confirm_status <= 2),
  banned_until timestamp with time zone,
  reauthentication_token character varying DEFAULT ''::character varying,
  reauthentication_sent_at timestamp with time zone,
  is_sso_user boolean NOT NULL DEFAULT false,
  deleted_at timestamp with time zone,
  is_anonymous boolean NOT NULL DEFAULT false,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_check CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT users_phone_check CHECK (phone IS NULL OR phone ~ '^\+[1-9]\d{1,14}$')
);

-- =============================================================================
-- SEQUENCES
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS auth.refresh_tokens_id_seq;
ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;
ALTER TABLE auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq');

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_instance_id ON auth.users (instance_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON auth.users (email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON auth.users (phone);
CREATE INDEX IF NOT EXISTS idx_users_confirmed_at ON auth.users (confirmed_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON auth.users (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_is_anonymous ON auth.users (is_anonymous);

-- Sessions table indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON auth.sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_not_after ON auth.sessions (not_after DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON auth.sessions (updated_at DESC);

-- Identities table indexes
CREATE INDEX IF NOT EXISTS idx_identities_user_id ON auth.identities (user_id);
CREATE INDEX IF NOT EXISTS idx_identities_email ON auth.identities (email);
CREATE INDEX IF NOT EXISTS idx_identities_provider ON auth.identities (provider);

-- Refresh tokens indexes
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_instance_id ON auth.refresh_tokens (instance_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON auth.refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session_id ON auth.refresh_tokens (session_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_updated_at ON auth.refresh_tokens (updated_at DESC);

-- MFA factors indexes
CREATE INDEX IF NOT EXISTS idx_mfa_factors_user_id ON auth.mfa_factors (user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_factors_user_id_created_at ON auth.mfa_factors (user_id, created_at);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_entries_instance_id ON auth.audit_log_entries (instance_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entries_created_at ON auth.audit_log_entries (created_at DESC);

-- One-time tokens indexes
CREATE INDEX IF NOT EXISTS idx_one_time_tokens_user_id ON auth.one_time_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_one_time_tokens_token_hash ON auth.one_time_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_one_time_tokens_relates_to ON auth.one_time_tokens (relates_to);

-- Flow state indexes
CREATE INDEX IF NOT EXISTS idx_flow_state_created_at ON auth.flow_state (created_at DESC);

-- SSO indexes
CREATE INDEX IF NOT EXISTS idx_sso_domains_sso_provider_id ON auth.sso_domains (sso_provider_id);
CREATE INDEX IF NOT EXISTS idx_saml_providers_sso_provider_id ON auth.saml_providers (sso_provider_id);
CREATE INDEX IF NOT EXISTS idx_saml_relay_states_sso_provider_id ON auth.saml_relay_states (sso_provider_id);

-- =============================================================================
-- FUNCTIONS FOR AUTH OPERATIONS
-- =============================================================================

-- Function to handle user creation with profile setup
CREATE OR REPLACE FUNCTION auth.on_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile
  INSERT INTO public.user_profiles (user_id, created_at, updated_at)
  VALUES (NEW.id, NOW(), NOW());

  -- Create user preferences with defaults
  INSERT INTO public.user_preferences (user_id, created_at, updated_at)
  VALUES (NEW.id, NOW(), NOW());

  -- Create user security settings
  INSERT INTO public.user_security_settings (user_id, created_at, updated_at)
  VALUES (NEW.id, NOW(), NOW());

  -- Create user analytics record
  INSERT INTO public.user_chat_analytics (user_id, created_at, updated_at)
  VALUES (NEW.id, NOW(), NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION auth.cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM auth.sessions
  WHERE not_after < NOW();

  DELETE FROM auth.refresh_tokens
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND revoked = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke all user sessions
CREATE OR REPLACE FUNCTION auth.revoke_user_sessions(user_uuid uuid)
RETURNS void AS $$
BEGIN
  UPDATE auth.refresh_tokens
  SET revoked = true
  WHERE user_id::uuid = user_uuid;

  DELETE FROM auth.sessions
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Trigger to create user profile on new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auth.on_auth_user_created();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on auth tables where appropriate
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own user data" ON auth.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own user data" ON auth.users
  FOR UPDATE USING (auth.uid() = id);

-- Sessions policies
CREATE POLICY "Users can view own sessions" ON auth.sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Identities policies
CREATE POLICY "Users can view own identities" ON auth.identities
  FOR SELECT USING (auth.uid() = user_id);

-- MFA policies
CREATE POLICY "Users can manage own MFA factors" ON auth.mfa_factors
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own MFA challenges" ON auth.mfa_challenges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.mfa_factors
      WHERE mfa_factors.id = mfa_challenges.factor_id
      AND mfa_factors.user_id = auth.uid()
    )
  );

-- One-time tokens policies
CREATE POLICY "Users can view own tokens" ON auth.one_time_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- =============================================================================
-- GRANTS AND PERMISSIONS
-- =============================================================================

-- Grant necessary permissions to service role
GRANT ALL ON SCHEMA auth TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO service_role;

-- Grant read permissions to authenticated users for their own data
GRANT SELECT ON auth.users TO authenticated;
GRANT SELECT ON auth.sessions TO authenticated;
GRANT SELECT ON auth.identities TO authenticated;
GRANT SELECT ON auth.mfa_factors TO authenticated;

-- =============================================================================
-- END OF AUTH SCHEMA
-- =============================================================================

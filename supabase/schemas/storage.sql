-- =============================================================================
-- Magical AI Storage Schema - Complete File Storage System
-- =============================================================================
-- This file contains the complete storage schema for Supabase storage
-- including buckets, objects, and file management system
-- =============================================================================

-- =============================================================================
-- ENUMS AND CUSTOM TYPES
-- =============================================================================

-- Bucket type enum for different storage categories
DO $$ BEGIN
    CREATE TYPE storage.buckettype AS ENUM ('STANDARD', 'ANALYTICS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- STORAGE SCHEMA TABLES
-- =============================================================================

-- Storage buckets for organizing files
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text NOT NULL,
  name text NOT NULL,
  owner uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  public boolean DEFAULT false,
  avif_autodetection boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text,
  type storage.buckettype NOT NULL DEFAULT 'STANDARD'::storage.buckettype,
  CONSTRAINT buckets_pkey PRIMARY KEY (id),
  CONSTRAINT buckets_name_check CHECK (char_length(name) >= 1),
  CONSTRAINT buckets_id_check CHECK (char_length(id) >= 1),
  CONSTRAINT buckets_file_size_limit_check CHECK (file_size_limit IS NULL OR file_size_limit > 0)
);

-- Analytics buckets for data analysis
CREATE TABLE IF NOT EXISTS storage.buckets_analytics (
  id text NOT NULL,
  type storage.buckettype NOT NULL DEFAULT 'ANALYTICS'::storage.buckettype,
  format text NOT NULL DEFAULT 'ICEBERG'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id),
  CONSTRAINT buckets_analytics_id_check CHECK (char_length(id) >= 1),
  CONSTRAINT buckets_analytics_format_check CHECK (format IN ('ICEBERG', 'PARQUET', 'DELTA'))
);

-- Storage migrations tracking
CREATE TABLE IF NOT EXISTS storage.migrations (
  id integer NOT NULL,
  name character varying NOT NULL UNIQUE,
  hash character varying NOT NULL,
  executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT migrations_pkey PRIMARY KEY (id),
  CONSTRAINT migrations_name_check CHECK (char_length(name) >= 1),
  CONSTRAINT migrations_hash_check CHECK (char_length(hash) >= 1)
);

-- File objects stored in buckets
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_accessed_at timestamp with time zone DEFAULT now(),
  metadata jsonb,
  path_tokens text[] DEFAULT string_to_array(name, '/'::text),
  version text,
  owner_id text,
  user_metadata jsonb,
  level integer,
  CONSTRAINT objects_pkey PRIMARY KEY (id),
  CONSTRAINT objects_bucketId_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id) ON DELETE CASCADE,
  CONSTRAINT objects_name_check CHECK (name IS NULL OR char_length(name) >= 1),
  CONSTRAINT objects_level_check CHECK (level IS NULL OR level >= 0)
);

-- Storage prefixes for hierarchical organization
CREATE TABLE IF NOT EXISTS storage.prefixes (
  bucket_id text NOT NULL,
  name text NOT NULL,
  level integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT prefixes_pkey PRIMARY KEY (bucket_id, name, level),
  CONSTRAINT prefixes_bucketId_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id) ON DELETE CASCADE,
  CONSTRAINT prefixes_name_check CHECK (char_length(name) >= 1),
  CONSTRAINT prefixes_level_check CHECK (level >= 0)
);

-- S3 multipart uploads for large files
CREATE TABLE IF NOT EXISTS storage.s3_multipart_uploads (
  id text NOT NULL,
  in_progress_size bigint NOT NULL DEFAULT 0,
  upload_signature text NOT NULL,
  bucket_id text NOT NULL,
  key text NOT NULL,
  version text NOT NULL,
  owner_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_metadata jsonb,
  CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id),
  CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id) ON DELETE CASCADE,
  CONSTRAINT s3_multipart_uploads_id_check CHECK (char_length(id) >= 1),
  CONSTRAINT s3_multipart_uploads_key_check CHECK (char_length(key) >= 1),
  CONSTRAINT s3_multipart_uploads_size_check CHECK (in_progress_size >= 0)
);

-- S3 multipart upload parts
CREATE TABLE IF NOT EXISTS storage.s3_multipart_uploads_parts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  upload_id text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  part_number integer NOT NULL,
  bucket_id text NOT NULL,
  key text NOT NULL,
  etag text NOT NULL,
  owner_id text,
  version text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id),
  CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE,
  CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id) ON DELETE CASCADE,
  CONSTRAINT s3_multipart_uploads_parts_size_check CHECK (size >= 0),
  CONSTRAINT s3_multipart_uploads_parts_part_number_check CHECK (part_number >= 1),
  CONSTRAINT s3_multipart_uploads_parts_etag_check CHECK (char_length(etag) >= 1)
);

-- =============================================================================
-- FUNCTIONS FOR STORAGE OPERATIONS
-- =============================================================================

-- Function to get file level in hierarchy
CREATE OR REPLACE FUNCTION storage.get_level(file_path text)
RETURNS integer AS $$
BEGIN
  RETURN array_length(string_to_array(file_path, '/'), 1) - 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate total bucket size
CREATE OR REPLACE FUNCTION storage.get_bucket_size(bucket_name text)
RETURNS bigint AS $$
DECLARE
  total_size bigint := 0;
BEGIN
  SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)
  INTO total_size
  FROM storage.objects
  WHERE bucket_id = bucket_name
  AND metadata->>'size' IS NOT NULL;

  RETURN total_size;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old multipart uploads
CREATE OR REPLACE FUNCTION storage.cleanup_old_multipart_uploads()
RETURNS void AS $$
BEGIN
  -- Delete uploads older than 7 days that were never completed
  DELETE FROM storage.s3_multipart_uploads
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create default buckets for new users
CREATE OR REPLACE FUNCTION storage.create_user_buckets(user_id uuid)
RETURNS void AS $$
BEGIN
  -- Create user's private bucket
  INSERT INTO storage.buckets (id, name, owner, public, file_size_limit)
  VALUES (
    'user-' || user_id::text,
    'User Files',
    user_id,
    false,
    100 * 1024 * 1024 -- 100MB limit
  ) ON CONFLICT (id) DO NOTHING;

  -- Create user's public bucket for shared files
  INSERT INTO storage.buckets (id, name, owner, public, file_size_limit)
  VALUES (
    'public-' || user_id::text,
    'Public Files',
    user_id,
    true,
    50 * 1024 * 1024 -- 50MB limit
  ) ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Buckets table indexes
CREATE INDEX IF NOT EXISTS idx_buckets_owner ON storage.buckets (owner);
CREATE INDEX IF NOT EXISTS idx_buckets_public ON storage.buckets (public) WHERE public = true;
CREATE INDEX IF NOT EXISTS idx_buckets_created_at ON storage.buckets (created_at DESC);

-- Objects table indexes
CREATE INDEX IF NOT EXISTS idx_objects_bucket_id ON storage.objects (bucket_id);
CREATE INDEX IF NOT EXISTS idx_objects_owner ON storage.objects (owner);
CREATE INDEX IF NOT EXISTS idx_objects_name ON storage.objects (name);
CREATE INDEX IF NOT EXISTS idx_objects_created_at ON storage.objects (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_objects_updated_at ON storage.objects (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_objects_last_accessed_at ON storage.objects (last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_objects_path_tokens ON storage.objects USING GIN (path_tokens);
CREATE INDEX IF NOT EXISTS idx_objects_metadata ON storage.objects USING GIN (metadata);

-- Prefixes table indexes
CREATE INDEX IF NOT EXISTS idx_prefixes_bucket_id ON storage.prefixes (bucket_id);
CREATE INDEX IF NOT EXISTS idx_prefixes_level ON storage.prefixes (level);

-- Multipart uploads indexes
CREATE INDEX IF NOT EXISTS idx_s3_multipart_uploads_bucket_id ON storage.s3_multipart_uploads (bucket_id);
CREATE INDEX IF NOT EXISTS idx_s3_multipart_uploads_created_at ON storage.s3_multipart_uploads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_s3_multipart_uploads_owner_id ON storage.s3_multipart_uploads (owner_id);

-- Multipart upload parts indexes
CREATE INDEX IF NOT EXISTS idx_s3_multipart_uploads_parts_upload_id ON storage.s3_multipart_uploads_parts (upload_id);
CREATE INDEX IF NOT EXISTS idx_s3_multipart_uploads_parts_bucket_id ON storage.s3_multipart_uploads_parts (bucket_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on storage tables
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Bucket policies
CREATE POLICY "Users can view their own buckets" ON storage.buckets
  FOR SELECT USING (auth.uid() = owner OR public = true);

CREATE POLICY "Users can create their own buckets" ON storage.buckets
  FOR INSERT WITH CHECK (auth.uid() = owner);

CREATE POLICY "Users can update their own buckets" ON storage.buckets
  FOR UPDATE USING (auth.uid() = owner);

CREATE POLICY "Users can delete their own buckets" ON storage.buckets
  FOR DELETE USING (auth.uid() = owner);

-- Object policies
CREATE POLICY "Users can view objects in accessible buckets" ON storage.objects
  FOR SELECT USING (
    auth.uid() = owner OR
    EXISTS (
      SELECT 1 FROM storage.buckets
      WHERE buckets.id = objects.bucket_id
      AND (buckets.owner = auth.uid() OR buckets.public = true)
    )
  );

CREATE POLICY "Users can insert objects in their buckets" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.uid() = owner OR
    EXISTS (
      SELECT 1 FROM storage.buckets
      WHERE buckets.id = objects.bucket_id
      AND buckets.owner = auth.uid()
    )
  );

CREATE POLICY "Users can update their own objects" ON storage.objects
  FOR UPDATE USING (auth.uid() = owner);

CREATE POLICY "Users can delete their own objects" ON storage.objects
  FOR DELETE USING (auth.uid() = owner);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Trigger to update bucket updated_at timestamp
CREATE OR REPLACE FUNCTION storage.update_bucket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_buckets_updated_at
  BEFORE UPDATE ON storage.buckets
  FOR EACH ROW EXECUTE FUNCTION storage.update_bucket_updated_at();

-- Trigger to update object updated_at timestamp
CREATE OR REPLACE FUNCTION storage.update_object_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_objects_updated_at
  BEFORE UPDATE ON storage.objects
  FOR EACH ROW EXECUTE FUNCTION storage.update_object_updated_at();

-- Trigger to update object path_tokens when name changes
CREATE OR REPLACE FUNCTION storage.update_object_path_tokens()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    NEW.path_tokens = string_to_array(NEW.name, '/');
    NEW.level = storage.get_level(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_objects_path_tokens
  BEFORE UPDATE ON storage.objects
  FOR EACH ROW EXECUTE FUNCTION storage.update_object_path_tokens();

-- =============================================================================
-- GRANTS AND PERMISSIONS
-- =============================================================================

-- Grant necessary permissions to service role
GRANT ALL ON SCHEMA storage TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO service_role;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.buckets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.prefixes TO authenticated;

-- Grant read access to anonymous users for public buckets
GRANT SELECT ON storage.buckets TO anon;
GRANT SELECT ON storage.objects TO anon;

-- =============================================================================
-- DEFAULT BUCKET SETUP
-- =============================================================================

-- Create default system buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'User Avatars', true, 5 * 1024 * 1024, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('project-files', 'Project Files', false, 100 * 1024 * 1024, NULL),
  ('exports', 'Data Exports', false, 500 * 1024 * 1024, ARRAY['application/json', 'text/csv', 'application/zip']),
  ('fragments', 'Code Fragments', false, 50 * 1024 * 1024, NULL)
ON CONFLICT (id) DO NOTHING;

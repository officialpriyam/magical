# Magical AI Supabase Database Schema

This directory contains the complete database schema for Magical AI, organized into logical files without duplicates.

## Schema Organization

### Main Schema Files (`/schemas/`)

1. **`extensions.sql`** - PostgreSQL extensions and system setup
   - Core extensions (uuid-ossp, vector, pg_trgm)
   - Supabase-specific extensions (pgjwt, supabase_vault)
   - Foreign data wrapper statistics table
   - **Load first** before any other schema files

2. **`sequences.sql`** - Database sequences and auto-increment management
   - All sequences used across schemas
   - Sequence utility functions and monitoring
   - **Load second** after extensions

3. **`auth.sql`** - Complete Supabase authentication schema
   - User management tables (users, sessions, identities)
   - Multi-factor authentication (MFA) support
   - SSO and SAML provider configurations
   - Row Level Security policies for auth tables
   - **Load third** after sequences

4. **`storage.sql`** - Complete Supabase storage schema
   - Bucket and object management
   - Multipart upload support
   - File organization and metadata
   - Storage policies and permissions
   - **Load fourth** after auth

5. **`public.sql`** - Main application schema
   - All application tables (projects, messages, fragments, etc.)
   - User profiles and preferences
   - Teams and organization management
   - Chat and messaging system
   - Usage tracking and analytics
   - Complete business logic functions
   - Comprehensive RLS policies
   - **Load last** after all other schemas

### Migration Files (`/migrations/`)

1. **`20250929060300_create_tasks_table.sql`** - Historical tasks table creation
2. **`20250929163414_create_save_message_function.sql`** - Message handling function
3. **`20260603000000_ensure_workspace_files_table.sql`** - Workspace file storage for IDE and GitHub import

## Loading Order

For a fresh database setup, load files in this order:

```sql
-- 1. Load extensions first
\i schemas/extensions.sql

-- 2. Load sequences
\i schemas/sequences.sql

-- 3. Load auth schema
\i schemas/auth.sql

-- 4. Load storage schema
\i schemas/storage.sql

-- 5. Load public schema (includes all business logic)
\i schemas/public.sql

-- 6. Apply any additional migrations
\i migrations/20250929060300_create_tasks_table.sql
\i migrations/20250929163414_create_save_message_function.sql
\i migrations/20260603000000_ensure_workspace_files_table.sql
```

## Key Features

### Security
- Row Level Security (RLS) enabled on all user-facing tables
- Comprehensive security policies
- Multi-factor authentication support
- API key management with permissions

### Performance
- Optimized indexes for all major query patterns
- Vector indexes for AI embeddings
- Full-text search capabilities
- Efficient foreign key relationships

### Scalability
- Team-based multi-tenancy
- Usage limits and tracking
- Analytics and monitoring
- Horizontal scaling considerations

### Business Logic
- Complete user management workflow
- Project and fragment organization
- Chat message caching and search
- File upload and storage management
- Subscription and billing support

## Schema Statistics

- **Total Tables**: 40+ across all schemas
- **Total Functions**: 15+ business logic functions
- **Total Indexes**: 50+ performance-optimized indexes
- **Total Policies**: 25+ RLS security policies

## Maintenance

### Duplicate Removal
All duplicate schema files have been removed:
- ✅ Removed: `auth.sql`, `public.sql`, `storage.sql`, `projects.sql`
- ✅ Consolidated: Functions moved from `complete_database_functions.sql` to `public.sql`
- ✅ Renamed: `*_complete.sql` files renamed to clean names

### Schema Validation
All schemas include:
- Proper constraints and checks
- Comprehensive indexes
- Security policies
- Performance optimizations
- Documentation and comments

## Development Notes

- Use `IF NOT EXISTS` clauses for safe re-running
- All tables include proper audit timestamps
- Foreign key constraints maintain referential integrity
- Enum types used for better type safety
- Vector support for AI/ML features included

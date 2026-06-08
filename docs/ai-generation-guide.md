# Magical AI Generation Guide

This guide is used by Magical AI to produce better artifacts.

## Multi-File Output

- Generate complete projects, not a single oversized file.
- Always fill `files[]` for app templates.
- Keep `file_path` and `code` as the primary runnable entry file for compatibility.
- Split reusable UI into components, shared data into small modules, and helpers into utility files.
- In chat commentary, name the files being created so the user can see what is being coded.

## Visual Quality

- Build the actual first-screen experience.
- Use relevant visual assets for websites, products, portfolios, games, and visual tools.
- Full-bleed image-led heroes are preferred when the request is landing-page-like.
- Motion-inspired composition is fine, but do not copy third-party websites verbatim.
- Keep mobile layouts readable and avoid overlapping text, controls, and images.

## Supabase

- Ask about Supabase in Plan mode when the requested app needs auth, persistence, relational data, bookings, dashboards, uploads metadata, or user accounts.
- If Supabase is connected and schema changes are needed, include `supabase_migrations[]`.
- Migrations should be additive by default and include RLS, policies, indexes, and triggers when needed.
- Never invent secrets. Generated code should read Supabase URL and anon key from environment variables.
- Avoid destructive SQL unless the user explicitly asks for it.

## Verification

- Generated apps should include sensible empty states, loading states, and error states.
- Database-backed apps should still render a useful shell if Supabase credentials are missing.
- Prefer simple, dependable code over fragile animation or unnecessary dependency sprawl.

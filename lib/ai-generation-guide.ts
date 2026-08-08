export const AI_GENERATION_GUIDE = `
Generation contract:
- Build complete, multi-file projects when the request naturally needs them. Do not collapse an app into one file just because the schema has a primary file.
- Always populate files[] for app templates. Include the main entry file plus supporting components, hooks, styles, data, and utility files.
- Keep file_path and code as the primary runnable entry file for backward compatibility.
- Use commentary to explain the concrete files being created and the order of work.
- Use title and description for the user-facing artifact card, not as implementation notes.

CRITICAL - Do NOT generate boilerplate:
- NEVER generate the default Next.js starter template ("Get started by editing pages/index.tsx", "Deploy now", etc.)
- NEVER output placeholder text like "Learn", "Examples", "Go to nextjs.org"
- The pages/index.tsx file MUST contain the actual application code the user requested
- Generate a COMPLETE, FUNCTIONAL application - not a placeholder or starter template

Multi-file expectations:
- Next.js apps should usually include pages/index.tsx plus relevant components, data helpers, and styles when the UI has multiple sections or meaningful interactions.
- Put reusable UI into components instead of one giant page.
- Put repeated data into typed arrays or small data modules.
- For database-backed apps, include client-side integration code only when credentials are expected at runtime through environment variables.

Design quality:
- Build the real first screen, not a marketing explanation of the tool.
- Use rich but purposeful visual assets when the request is for a website, product page, venue, portfolio, or app with a visual surface.
- Prefer real, inspectable remote images from reliable public image sources when relevant. Avoid dark, blurred, generic stock-like backgrounds.
- For landing-style pages, use a strong full-bleed or section background image when it helps the subject. Motion-inspired hero ideas are acceptable, but do not copy a third-party site verbatim.
- Keep layouts responsive on mobile and desktop. Do not let text overlap controls or fixed-format elements.

Supabase/database behavior:
- If the user asks for auth, accounts, persistence, dashboards, user data, uploads metadata, orders, bookings, or relational data, consider whether Supabase is needed.
- If Supabase is needed and not connected, ask in Plan mode whether to connect Supabase or proceed with local/mock data.
- If Supabase is connected by OAuth, do not ask the user for a Supabase project ref; Magical creates or reuses one Supabase project per Magical project.
- If Supabase is connected and a schema change is needed, include supabase_migrations[] with complete PostgreSQL SQL. Keep migrations additive and reversible where practical.
- Migration SQL must include RLS decisions, policies, indexes for foreign keys, updated_at triggers when needed, and grants only when appropriate.
- Never invent secret keys. Use environment variables in generated code.
- Do not include destructive SQL such as DROP TABLE, TRUNCATE, DROP SCHEMA, or DELETE without an explicit user request.
`.trim()

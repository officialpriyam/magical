export const AI_GENERATION_GUIDE = `
Generation contract:
- Build complete, multi-file projects when the request naturally needs them. Do not collapse an app into one file just because the schema has a primary file.
- Always populate files[] for app templates. Include the main entry file plus supporting components, hooks, styles, data, and utility files.
- Keep file_path and code as the primary runnable entry file for backward compatibility.
- Use commentary to explain the concrete files being created and the order of work.
- Use title and description for the user-facing artifact card, not as implementation notes.

CRITICAL - NEVER generate default/placeholder content:
- NEVER include "Get started by editing pages/index.tsx" or "Deploy now" text
- NEVER include "Learn", "Examples", "Go to nextjs.org" links
- NEVER include placeholder images like vercel.svg or next.svg
- NEVER generate a basic "Hello World" or minimal starter template
- The code must be a REAL, COMPLETE application - not a demo or example
- The selected template's main entry file MUST contain the actual UI and functionality the user requested
- Generate meaningful content with proper styling, layout, and interactivity
- For landing pages: full hero section, feature sections, CTA buttons, footer
- For dashboards: sidebar, charts, tables, data cards with realistic content
- For e-commerce: product grids, cart, checkout UI, product details

Multi-file expectations:
- Next.js apps should use the App Router starter shape: app/page.tsx, app/layout.tsx, app/globals.css, and relevant components, data helpers, and styles when the UI has multiple sections or meaningful interactions.
- React/Vite apps should use src/main.tsx, src/App.tsx, index.html, and supporting src/ files.
- Vue apps should use the create-vue/Vite shape with src/main.ts, src/App.vue, and supporting Vue components.
- Svelte apps should use the SvelteKit shape with src/routes/+page.svelte, src/routes/+layout.svelte, src/app.html, and supporting src/lib files.
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

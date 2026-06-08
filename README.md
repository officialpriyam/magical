# Magical AI

Magical AI is an AI app builder and coding workspace developed by priyx.

It uses Next.js 16, shadcn/ui, Tailwind CSS, the Vercel AI SDK, Supabase, and E2B or Vercel sandboxes to generate and execute code from chat.

## Features

- AI chat for generating runnable apps and code artifacts.
- Secure code execution with selectable E2B or Vercel sandboxes.
- Support for npm and pip package installation inside generated projects.
- Built-in templates for Python data analysis, Next.js, Vue.js, Streamlit, and Gradio.
- Multiple AI providers, including OpenAI, Anthropic, Google, Groq, Fireworks, Together AI, OpenRouter, Mistral, xAI, DeepSeek, and Ollama.
- Optional Supabase authentication, GitHub sync, and private Cloudflare R2 workspace backup.

## Setup

Install dependencies:

```sh
pnpm install
```

Create a `.env.local` file in the project root from the example file:

```sh
cp .env.example .env.local
```

Fill in the keys you need. Never commit real secrets.

Configure at least one sandbox provider. E2B is still required for the Python code-interpreter template:

```sh
E2B_API_KEY=
```

Vercel Sandbox is optional and works for app preview templates. On Vercel, OIDC is preferred. Locally, run `vercel link` and `vercel env pull`, or use access-token auth:

```sh
VERCEL_OIDC_TOKEN=
VERCEL_TEAM_ID=
VERCEL_PROJECT_ID=
VERCEL_TOKEN=
```

The prompt box lets users choose `Let AI choose`, `Vercel`, or `E2B`. If the user skips this or chooses `Let AI choose`, the server randomly selects one configured provider that supports the generated template.

At least one hosted AI provider key is recommended:

```sh
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=
MISTRAL_API_KEY=
GROQ_API_KEY=
FIREWORKS_API_KEY=
TOGETHER_API_KEY=
OPENROUTER_API_KEY=
XAI_API_KEY=
DEEPSEEK_API_KEY=
```

Supabase is needed for auth and saved workspace data:

```sh
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Optional Supabase OAuth connector for AI database migrations in users' Supabase accounts:

```sh
SUPABASE_OAUTH_CLIENT_ID=
SUPABASE_OAUTH_CLIENT_SECRET=
# optional; blank means retry client_secret_basic then client_secret_post
SUPABASE_OAUTH_TOKEN_AUTH_METHOD=
```

Create the OAuth app in the Supabase Dashboard and set this callback URL:

```txt
https://your-domain.com/api/supabase/callback
```

Configure the OAuth app with Management API scopes for `organizations:read`, `projects:read`, `projects:write`, `database:write`, and `secrets:read`. Magical uses OAuth to connect a user's Supabase account, automatically creates or reuses one Supabase project per Magical project, applies generated migrations there, and injects the project's public Supabase env values into the preview sandbox.

For server-owned fallback deployments, `SUPABASE_MANAGEMENT_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` are still supported.

### Supabase OAuth Client ID and Secret

To get `SUPABASE_OAUTH_CLIENT_ID` and `SUPABASE_OAUTH_CLIENT_SECRET`:

1. Sign in to the Supabase Dashboard.
2. Open your organization settings.
3. Go to **OAuth Apps**.
4. Click **Add application**.
5. Add the callback URL for each environment:

```txt
http://localhost:3000/api/supabase/callback
https://your-domain.com/api/supabase/callback
```

6. Select the required Management API scopes: `organizations:read`, `projects:read`, `projects:write`, `database:write`, and `secrets:read`.
7. Save the app, then copy the generated client ID and client secret into `.env.local` or Vercel environment variables.

Supabase documents this as an OAuth integration created from organization settings. Their docs also note that scopes are configured on the OAuth app, and existing users must re-authorize if scopes change.

Run the bundled Supabase schema or at least `supabase/migrations/20260603000600_ensure_user_integrations_table.sql` before using OAuth integrations. If `user_integrations` is not present, GitHub and Supabase OAuth can temporarily fall back to Vercel KV when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are configured.

### Cloudflare R2 Workspace Backup

Cloudflare R2 is optional private object storage for generated project files when a signed-in user has not connected that project to GitHub. If these variables are blank, the app still runs; projects without GitHub just will not have the R2 restore fallback. The app stores files under an owner-scoped key prefix, checks Supabase project ownership before saving or restoring, and does not expose public R2 URLs.

Set these variables:

```sh
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_BUCKET=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
```

To get them:

1. In Cloudflare Dashboard, open **Storage & databases > R2**.
2. Create a private bucket for Magical workspace backups.
3. Open **R2 > Overview > Manage API Tokens**.
4. Create an account or user API token with **Object Read & Write** permission scoped to that bucket.
5. Copy the Access Key ID and Secret Access Key into your environment variables.
6. Copy the Account ID from the R2 overview page into `CLOUDFLARE_R2_ACCOUNT_ID`.

R2 backups are a fallback source. Once a project is connected to GitHub, GitHub is treated as the primary workspace and R2 writes are skipped for that project.

Start the app only when you are ready:

```sh
pnpm dev
```

Build for production:

```sh
pnpm build
```

## Deploy to Vercel

This project includes `vercel.json` for Vercel deployment.

Use these project settings on Vercel:

- Framework preset: Next.js
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Output directory: `.next`

Add the runtime environment variables from `.env.local` in Vercel Project Settings. At minimum, set one sandbox provider (`E2B_API_KEY` or Vercel Sandbox OIDC/access-token envs), one AI provider key, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SITE_URL=https://magicalai.iampriyam.me`. For user-owned private repository import and saving generated code to GitHub, create a GitHub OAuth App and set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. For non-GitHub workspace recovery, optionally set the `CLOUDFLARE_R2_*` variables.

Use this GitHub OAuth callback URL:

```txt
https://magicalai.iampriyam.me/api/github/callback
```

## Environment

The generated `.env.local` contains placeholders for all runtime keys referenced by the app:

- AI providers and E2B
- Supabase
- Vercel KV rate limiting and short URLs
- GitHub OAuth connection settings
- Cloudflare R2 private workspace backup
- Morph apply mode
- PostHog analytics toggle
- Optional ZeroBounce email validation

Chat rate limiting is disabled by default. To enable it, set `RATE_LIMIT_ENABLED=true`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW`, `KV_REST_API_URL`, and `KV_REST_API_TOKEN` in Vercel. To force it off, set `RATE_LIMIT_ENABLED=false`.

## Developer

Developed by priyx.

## License

Proprietary. All rights reserved. See `LICENSE`.

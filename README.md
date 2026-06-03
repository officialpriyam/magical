# Magical AI

Magical AI is an AI app builder and coding workspace developed by priyx.

It uses Next.js 16, shadcn/ui, Tailwind CSS, the Vercel AI SDK, Supabase, and E2B sandboxes to generate and execute code from chat.

## Features

- AI chat for generating runnable apps and code artifacts.
- Secure code execution with E2B sandboxes.
- Support for npm and pip package installation inside generated projects.
- Built-in templates for Python data analysis, Next.js, Vue.js, Streamlit, and Gradio.
- Multiple AI providers, including OpenAI, Anthropic, Google, Groq, Fireworks, Together AI, OpenRouter, Mistral, xAI, DeepSeek, and Ollama.
- Optional Supabase authentication and workspace persistence.

## Setup

Install dependencies:

```sh
pnpm install
```

Create a `.env.local` file in the project root. This repository includes a placeholder `.env.local`; fill in the keys you need.

Required for sandbox execution:

```sh
E2B_API_KEY=
```

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

Add the runtime environment variables from `.env.local` in Vercel Project Settings. At minimum, set `E2B_API_KEY`, one AI provider key, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. `GITHUB_TOKEN` is optional for public repository URL imports, but required for private repositories and account/org listing.

## Environment

The generated `.env.local` contains placeholders for all runtime keys referenced by the app:

- AI providers and E2B
- Supabase
- Vercel KV rate limiting and short URLs
- GitHub import token
- Morph apply mode
- PostHog analytics toggle
- Optional ZeroBounce email validation

## Developer

Developed by priyx.

## License

Proprietary. All rights reserved. See `LICENSE`.

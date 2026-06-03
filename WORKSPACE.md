# Magical AI Workspace Guide

Magical AI is the Next.js web app in this repository. It is developed by priyx.

## Package

| Package | Path | Stack | Default Port |
| --- | --- | --- | --- |
| `@priyx/magical-ai` | `/` | Next.js 14, TypeScript, Tailwind CSS | 3000 |

## Common Commands

Install dependencies:

```sh
pnpm install
```

Start development server:

```sh
pnpm dev
```

Build:

```sh
pnpm build
```

Lint:

```sh
pnpm lint
```

## Environment

Use `.env.local` for local configuration. It is intentionally ignored by Git and contains placeholders for the app's required services:

- E2B sandbox execution
- AI provider keys
- Supabase auth and persistence
- Vercel/Upstash KV
- GitHub import token
- Optional analytics and email validation

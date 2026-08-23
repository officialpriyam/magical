<p align="center">
  <img src="public/icon.png" alt="Magical AI Logo" width="120" height="120" />
</p>

<h1 align="center">Magical AI</h1>

<p align="center">
  <strong>Build full-stack web apps and mobile apps with simple AI prompts.</strong>
</p>

<p align="center">
  <a href="https://magicalai.iampriyam.me">Live Demo</a> · 
  <a href="https://github.com/officialpriyam/magical/issues">Report Bug</a> · 
  <a href="https://github.com/officialpriyam/magical/issues">Request Feature</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-black?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
</p>

---

## What is Magical AI?

Magical AI is an open-source AI-powered app builder — similar to Bolt.new, Lovable, and v0.dev. Describe what you want to build in natural language, and Magical AI generates, previews, and deploys your full-stack web application in seconds.

### Features

- **Multi-Agent AI Pipeline** — Plans, architects, builds, reviews, and optimizes code using specialized AI agents
- **Live Preview** — See your app running in real-time as the AI generates code
- **Built-in IDE** — Full code editor with file tree, syntax highlighting, and inline editing
- **Web Search** — AI fetches live data from the web (Exa, Brave, DuckDuckGo) when building
- **Multiple Templates** — Next.js, React, Vue, Svelte, Python (Streamlit/Gradio), HTML/CSS/JS, Expo Mobile, PWA
- **Sandbox Providers** — E2B, Vercel, Modal, Daytona — no local setup required
- **Plan Mode** — AI asks clarifying questions before building
- **Style Themes** — Choose from pre-built design themes or create custom styles
- **Supabase Integration** — Connect your project for database, auth, and storage management
- **Community Gallery** — Share public projects and discover what others are building
- **Message Queue** — Send follow-up prompts while the AI is still working
- **Dark Mode** — Beautiful dark UI with claymorphism design

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm/pnpm/yarn
- A [Supabase](https://supabase.com) project (for auth and database)
- At least one AI provider API key (OpenAI, Anthropic, Google, OpenRouter, etc.)

### 1. Clone the repository

```bash
git clone https://github.com/officialpriyam/magical.git
cd magical
```

### 2. Install dependencies

```bash
pnpm install
# or
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your keys:

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=sk-...            # or any other AI provider

# Optional — web search
EXA_API_KEY=...

# Optional — sandbox
E2B_API_KEY=...
```

### 4. Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Architecture

```
magical/
├── app/                    # Next.js App Router pages
│   ├── api/                # API routes (chat, sandbox, search, auth)
│   ├── auth/               # Login & register pages
│   ├── chat/               # Chat view with project ID
│   └── community/          # Public project gallery
├── components/             # React UI components
│   ├── chat.tsx            # Chat message rendering with Magical timeline
│   ├── ide.tsx             # Built-in code editor
│   ├── preview.tsx         # Live preview panel
│   └── database-panel.tsx  # Supabase database manager
├── lib/                    # Core logic
│   ├── agents/             # Multi-agent AI pipeline (planner, architect, frontend, etc.)
│   ├── hooks/              # React hooks (agentic streaming, etc.)
│   ├── templates.json      # Project templates
│   └── models.ts           # AI model configuration
└── public/                 # Static assets
```

### AI Agent Pipeline

1. **Planner** — Analyzes the request and creates a task plan
2. **Architect** — Designs the system architecture and data flow
3. **Frontend** — Generates the UI components and styling
4. **Backend** — Creates API routes and server logic (if needed)
5. **Reviewer** — Reviews code for bugs and improvements
6. **Optimizer** — Optimizes performance and bundle size

---

## Supported AI Providers

| Provider | Models |
|----------|--------|
| OpenAI | GPT-4o, GPT-4.1, o3 |
| Anthropic | Claude 4 Sonnet, Claude 4 Opus |
| Google | Gemini 2.5 Pro, Gemini 2.5 Flash |
| OpenRouter | 200+ models via unified API |
| DeepSeek | DeepSeek V3, DeepSeek R1 |
| Groq | Llama 3.3, Mixtral |
| xAI | Grok 3 |

---

## Templates

| Template | Stack | Port |
|----------|-------|------|
| Next.js | React, TypeScript, Tailwind, Pages Router | 3000 |
| React | React, Vite, TypeScript, Tailwind | 5173 |
| Vue.js | Vue 3, Nuxt, Tailwind | 3000 |
| Svelte | Svelte, Vite, Tailwind | 5173 |
| HTML/CSS/JS | Vanilla HTML, CSS, JavaScript | 3000 |
| Python (Streamlit) | Python, Streamlit, Pandas | 8501 |
| Python (Gradio) | Python, Gradio, Matplotlib | 7860 |
| Mobile (Expo) | React Native, Expo Router | 8081 |
| Mobile (PWA) | React, Vite, PWA Manifest | 5173 |

---

## Deployment

The easiest way to deploy is on [Vercel](https://vercel.com):

```bash
npx vercel
```

Make sure to set all environment variables in the Vercel dashboard.

---

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `OPENAI_API_KEY` | One of | OpenAI API key |
| `ANTHROPIC_API_KEY` | One of | Anthropic API key |
| `EXA_API_KEY` | No | Exa web search (primary) |
| `E2B_API_KEY` | No | E2B sandbox provider |
| `MORPH_API_KEY` | No | Morph code editing |

---

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

```bash
git checkout -b feature/amazing-feature
git commit -m 'feat: add amazing feature'
git push origin feature/amazing-feature
```

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/officialpriyam">priyx</a>
</p>

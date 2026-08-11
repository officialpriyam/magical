# Magical AI

An AI-powered website builder that generates complete, production-ready websites from natural language prompts. Built with Next.js, React, and TypeScript.

## What It Does

Describe what you want in plain English, and Magical AI generates a full website — code, design, animations, and all. No coding required.

**Example prompts:**
- "Build a dark-themed SaaS landing page with pricing table and testimonials"
- "Create a coffee shop website with menu, gallery, and online ordering"
- "Make a portfolio site with 3D card effects and smooth scroll animations"

## Key Features

### AI Code Generation
- Generates complete React + TypeScript + Tailwind CSS components
- Includes Framer Motion animations, responsive design, and accessibility
- Supports multiple AI models with automatic failover

### Auto Model Selection
When you select "Auto" mode, the system tries up to 20 configured AI models in sequence. If one fails, it automatically falls back to the next — no manual intervention needed.

**Fallback chain logic:**
1. If a specific model is selected, try it first
2. Add all configured models (up to 20)
3. If no models are configured, try built-in fallbacks (Gemini, Qwen, Claude, GPT-4o-mini, DeepSeek, Mistral, Groq, etc.)
4. Each model is tried until one succeeds or all fail

### Template Library
- **250+ templates** from websiteprompts.ai and rocket.new
- Categories: Local Business, Health & Fitness, Entertainment, Restaurant, Portfolio, Professional Services, Beauty, Education, Travel, and more
- Copy-paste ready prompts with full design specifications

### Asset Import System
Server-side utilities for fetching assets during code generation:

| Provider | Type | API Key Required |
|----------|------|------------------|
| Pexels | Photos (primary) | Yes |
| Unsplash | Photos (fallback) | Yes |
| Pixabay | Photos | Yes |
| Poly Haven | 3D Models | No |
| Sketchfab | 3D Models | Yes |
| Google Fonts | Fonts | No |
| Iconify | Icons | No |

### Vendored UI Components
Pre-built React components from Aceternity UI and Magic UI:
- 3D cards, spotlight effects, pin containers
- Magnetic buttons, glowing beams, text reveals
- Marquees, animated numbers, docks, particles
- Word rotate, shimmer buttons, CSS grid backgrounds

### Real-time Preview
- Instant preview of generated code
- Live sandbox with hot reload
- Terminal access for debugging

### Project Management
- Save and organize projects
- Chat history with context
- GitHub integration for import/export
- Supabase integration for persistence

## Tech Stack

- **Frontend:** Next.js 14, React 18, TypeScript
- **Styling:** Tailwind CSS, Framer Motion
- **AI:** Vercel AI SDK with multi-provider support
- **Database:** Supabase (PostgreSQL)
- **Deployment:** Vercel

## Environment Variables

See `.env.example` for all required and optional environment variables.

**Required:**
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` or `GOOGLE_AI_API_KEY` (at least one)

**Optional (for asset imports):**
- `PEXELS_API_KEY` - Primary image source
- `UNSPLASH_ACCESS_KEY` - Fallback images
- `PIXABAY_API_KEY` - Additional images
- `SKETCHFAB_API_TOKEN` - 3D model search

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and add your API keys
4. Run the development server: `npm run dev`
5. Open http://localhost:3000

## How Auto Model Works

The "Auto" model selector provides intelligent failover across all configured AI providers:

```
User selects "Auto" → System builds fallback chain →
1. Try Model A → Failed? → 2. Try Model B → Failed? →
3. Try Model C → ... → 20. Try Model T → All failed? → Show error
```

**Each model attempt:**
- Sends the prompt to the AI provider
- Parses the response (handles markdown, trailing commas, etc.)
- Validates against the schema
- Fills in missing fields with defaults if partial response
- Returns success or moves to next model

**Logging:**
- All attempts are logged with model ID and provider
- Errors include specific failure reasons
- Final error shows which models were tried

## License

Private - All rights reserved.

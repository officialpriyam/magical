# Update Log - August 11, 2026

## Summary

Major update adding asset import system, fixing template thumbnails, improving AI model failover, and adding 130+ templates from websiteprompts.ai.

---

## Changes

### 1. Asset Import System (`lib/asset-imports/`)

New server-side utilities for fetching assets during code generation:

- **Pexels** (`pexels.ts`) - Primary image source with higher rate limits
- **Unsplash** (`unsplash.ts`) - Fallback image source
- **Pixabay** (`pixabay.ts`) - Additional image source
- **Poly Haven** (`polyhaven.ts`) - Free 3D models (no API key)
- **Sketchfab** (`sketchfab.ts`) - 3D model search
- **Google Fonts** (`google-fonts.ts`) - 25 common fonts
- **Iconify** (`iconify.ts`) - SVG icons from 8 icon sets

**Unified search function:**
```typescript
import { searchAssets } from '@/lib/asset-imports'

const images = await searchAssets('image', 'coffee shop', { limit: 10 })
const models = await searchAssets('model', 'chair')
const fonts = await searchAssets('font', 'serif')
const icons = await searchAssets('icon', 'home')
const components = await searchAssets('component', '3d card')
```

**Features:**
- Automatic provider fallback (Pexels → Unsplash → Pixabay)
- 30-minute TTL cache for repeated queries
- Error handling with graceful degradation

### 2. Vendored UI Components

**Aceternity UI** (10 components):
- 3D Card Effect
- Spotlight
- Background Gradient
- Pin Container
- Magnetic Button
- Glowing Beam
- Text Reveal
- Parallax Scroll
- Hover Border Gradient
- Floating Navbar

**Magic UI** (7 components):
- Marquee
- Animated Number
- Dock
- Particles
- Word Rotate
- Shimmer Button
- CSS Grid Background

All components are vendored in `lib/component-templates/` with MIT license compliance.

### 3. Template Library Updates

**Added 130 templates from websiteprompts.ai:**
- Self Storage, Bowling Alley, Bookstore, Car Dealership
- Property Management, Music Venue, Social Media Agency
- Solar Company, Personal Stylist, Craft Brewery
- And 120 more across all categories

**Added 120 templates from rocket.new:**
- Technology, Professional Services, Health & Medical
- Food & Beverage, Portfolio & Agency, Construction & Home
- Real Estate, Community & Nonprofit, Blog & Editorial
- Retail & E-Commerce

**Total: 250 templates** with full prompts and preview images.

### 4. Fixed Template Thumbnails

**Issue:** 125 templates had `&amp;` in image URLs instead of `&`, causing images to fail to load.

**Fix:** All URLs now use proper `&` characters. Broken images show gradient placeholders with template names.

### 5. Fixed Template Prompts

**Issue:** 184 templates had short/empty prompts (descriptions only).

**Fix:** All templates now have full prompts including:
- Tech stack (React + Vite + TypeScript + Tailwind + Framer Motion)
- Requirements section
- Sections to include
- Design principles

### 6. Improved AI Model Failover

**Changes to `lib/models.ts`:**
- Expanded hardcoded fallback list from 5 to 10 models
- Added DeepSeek, Mistral, Groq, Together AI, Fireworks
- Removed `break` statement so ALL matching fallbacks are added (not just first)

**Changes to `app/api/chat/route.ts`:**
- Added logging for fallback chain: `Fallback chain: model1 → model2 → ...`
- Added logging for each model attempt: `Trying model: ...`
- Improved JSON extraction to handle markdown code blocks
- Added auto-fix for trailing commas in JSON
- Added schema field auto-fill for partial responses

**Changes to `app/api/chat/morph-chat/route.ts`:**
- Added regex fallback for JSON parsing
- Multiple fallback attempts before throwing error

### 7. Better Error Messages

**Before:** "The AI provider returned an empty or invalid code response. Try again, or choose a different model."

**After:** Specific hints based on error type:
- Empty response → "The model returned no code. This can happen with some models — try again or use a different model."
- Invalid JSON → "The model returned malformed JSON. Try again — this is often a transient issue."
- Schema mismatch → "The model response did not match the expected format. Try again with a simpler request."

### 8. Environment Variables

Created `.env.example` with all required and optional API keys:
- `PEXELS_API_KEY` - Primary image source
- `UNSPLASH_ACCESS_KEY` - Fallback images
- `PIXABAY_API_KEY` - Additional images
- `SKETCHFAB_API_TOKEN` - 3D model search

### 9. Documentation

Created `README.md` with:
- App overview and features
- Auto model failover explanation
- Environment setup guide
- Getting started instructions

---

## Files Changed

### New Files
- `lib/asset-imports/index.ts` - Unified search function
- `lib/asset-imports/types.ts` - Shared types
- `lib/asset-imports/cache.ts` - 30-minute TTL cache
- `lib/asset-imports/pexels.ts` - Pexels provider
- `lib/asset-imports/unsplash.ts` - Unsplash provider
- `lib/asset-imports/pixabay.ts` - Pixabay provider
- `lib/asset-imports/polyhaven.ts` - Poly Haven provider
- `lib/asset-imports/sketchfab.ts` - Sketchfab provider
- `lib/asset-imports/google-fonts.ts` - Google Fonts provider
- `lib/asset-imports/iconify.ts` - Iconify provider
- `lib/component-templates/index.ts` - Component index
- `lib/component-templates/aceternity/index.ts` - Aceternity components
- `lib/component-templates/magicui/index.ts` - Magic UI components
- `lib/component-templates/README.md` - License notes
- `.env.example` - Environment variables
- `README.md` - App documentation
- `updates-logs/2026-08-11-asset-imports-and-fixes.md` - This file

### Modified Files
- `lib/models.ts` - Expanded fallback chain, added logging
- `app/api/chat/route.ts` - Improved JSON parsing, added logging
- `app/api/chat/morph-chat/route.ts` - Improved JSON parsing
- `lib/api-errors.ts` - Better error messages
- `lib/motionsites-templates.ts` - Fixed URLs, added prompts
- `app/templates/page.tsx` - Gradient placeholders for broken images

---

## Testing

- [x] TypeScript compilation: 0 errors
- [x] ESLint: 0 errors (89 pre-existing warnings)
- [x] Template thumbnails: All 250 showing correctly
- [x] Template prompts: All copyable
- [x] Auto model fallback: Logs show all models tried

---

## Commit Message

```
feat: add asset import system, fix templates, improve model failover

- Add unified searchAssets() for images, 3D models, fonts, icons, components
- Add Pexels, Unsplash, Pixabay, Poly Haven, Sketchfab, Google Fonts, Iconify providers
- Vendor 17 Aceternity UI + Magic UI components
- Fix 125 broken template thumbnails (&amp; in URLs)
- Fix 184 templates with short/empty prompts
- Add 250 templates from websiteprompts.ai and rocket.new
- Expand auto model fallback to try ALL configured models (up to 20)
- Add logging for fallback chain and model attempts
- Improve JSON parsing with markdown block handling and auto-fix
- Add specific error hints for empty/invalid responses
- Add .env.example and README.md documentation
```

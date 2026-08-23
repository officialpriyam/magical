# Update Log — August 23, 2026

## Mobile App Generation Support

### 1. Added Mobile App Templates
- **expo-mobile**: React Native Expo app with expo-router, proper navigation, SafeAreaView, StatusBar, StyleSheet.create styling, installable via Expo Go or EAS Build
- **pwa-mobile**: Progressive Web App with installable PWA manifest, service worker, offline support, app-like mobile UI, 44px touch targets, bottom navigation
- **Files**: `lib/templates.json`

### 2. Updated Frontend Agent Prompt for Mobile
- Added **MOBILE APP GENERATION RULES** to the frontend agent system prompt
- Rules: Use React Native components (View, Text, ScrollView, etc.), never HTML tags
- StyleSheet.create for styles, expo-router for navigation
- SafeAreaView, StatusBar, @expo/vector-icons for icons
- Support both iOS and Android, proper mobile UX patterns
- PWA rules: mobile-first, installable manifest, service worker, touch-friendly UI
- **Files**: `lib/agents/prompts.ts`

### 3. Auto-fetch Expo Docs via Web Search
- When a mobile app is detected (keywords: mobile app, react native, expo, ios, android, installable, phone app, pwa, progressive), the system automatically fetches Expo/React Native documentation via web search
- Fetched docs are injected as context for the agents to use as reference
- Web search results are displayed in the timeline for transparency
- **Files**: `app/api/chat/agentic/route.ts`

### 4. Phone Frame Preview
- When previewing a mobile app (detected by URL containing expo/react-native/:8081), the preview shows inside a realistic phone frame with notch, rounded corners, and home indicator
- Regular web apps continue to show in the standard viewport
- **Files**: `components/fragment-web.tsx`

### 5. Mobile App Toggle Button
- Added a green Smartphone icon toggle button in the prompt box (next to Style)
- When active: adds `[Mobile App]` prefix to prompt, switches template to expo-mobile
- Placeholder changes to "Describe your mobile app..."
- **Files**: `components/ui/ai-prompt-box.tsx`

### 6. /mobile Slash Command
- Added `/mobile` command: "Build a mobile app with React Native/Expo (installable on phones)"
- Auto-detects mobile app requests from prompt content (react native, expo, ios, android, installable, phone app)
- **Files**: `lib/slash-commands.ts`

---

## Files Modified
- `lib/templates.json` — Added expo-mobile and pwa-mobile templates
- `lib/agents/prompts.ts` — Added mobile app generation rules to frontend agent
- `app/api/chat/agentic/route.ts` — Auto-fetch Expo docs for mobile requests
- `components/fragment-web.tsx` — Phone frame preview for mobile apps
- `components/ui/ai-prompt-box.tsx` — Mobile toggle button
- `lib/slash-commands.ts` — /mobile command, mobile auto-detect

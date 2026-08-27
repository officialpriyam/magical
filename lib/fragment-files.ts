import { DeepPartial } from 'ai'
import type { FragmentSchema } from '@/lib/schema'

export type GeneratedFile = {
  path: string
  content: string
  purpose?: string
}

export function getFragmentFiles(
  fragment?: DeepPartial<FragmentSchema> | null,
): GeneratedFile[] {
  if (!fragment) return []

  const files: GeneratedFile[] = Array.isArray(fragment.files)
    ? fragment.files
        .map((file) => ({
          path: cleanPath(file?.path),
          content: typeof file?.content === 'string' ? file.content : '',
          purpose: typeof file?.purpose === 'string' ? file.purpose : undefined,
        }))
        .filter((file) => file.path && file.content.length > 0)
    : []

  if (files.length === 0 && typeof fragment.file_path === 'string' && typeof fragment.code === 'string') {
    files.push({
      path: cleanPath(fragment.file_path),
      content: fragment.code,
    })
  }

  const byPath = new Map<string, GeneratedFile>()

  for (const file of files) {
    byPath.set(file.path, file)
  }

  return Array.from(byPath.values())
}

export function getFragmentFileCount(fragment?: DeepPartial<FragmentSchema> | null) {
  return getFragmentFiles(fragment).length
}

/**
 * Returns template base files (package.json, config files, etc.) for a given template.
 * These are the scaffolding files that every project needs but are NOT user-generated.
 * Used to persist full project structure to RustFS.
 */
function getCommonFiles(template: string, readmeContent: string): GeneratedFile[] {
  return [
    {
      path: 'README.md',
      content: readmeContent,
    },
    {
      path: '.gitignore',
      content: getGitignoreContent(template),
    },
  ]
}

function getGitignoreContent(template: string): string {
  const lines = [
    '# dependencies',
    'node_modules/',
    '.pnp',
    '.pnp.js',
    '',
    '# build output',
    'dist/',
    'build/',
    '.next/',
    '',
    '# environment',
    '.env',
    '.env.local',
    '.env.development.local',
    '.env.test.local',
    '.env.production.local',
    '',
    '# misc',
    '.DS_Store',
    '*.tsbuildinfo',
    'next-env.d.ts',
  ]
  if (template === 'python' || template === 'streamlit' || template === 'gradio') {
    return [
      '# Python',
      '__pycache__/',
      '*.py[cod]',
      '*$py.class',
      '*.so',
      '',
      '# Virtual environment',
      'venv/',
      '.venv/',
      'env/',
      '',
      '# Environment',
      '.env',
      '',
      '# IDE',
      '.idea/',
      '.vscode/',
      '*.swp',
      '*.swo',
    ].join('\n')
  }
  return lines.join('\n')
}

export function getTemplateFiles(template?: string): GeneratedFile[] {
  if (template === 'nextjs-developer') {
    return [
      ...getCommonFiles('nextjs', `# ${'{'}APP_NAME{'}'}\n\nA modern web application built with Next.js, React, and Tailwind CSS.\n\n## Tech Stack\n\n- **Framework:** Next.js 14\n- **UI:** React 18 + TypeScript\n- **Styling:** Tailwind CSS\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`
\nOpen [http://localhost:3000](http://localhost:3000) to view the app.\n\n## Available Scripts\n\n| Command | Description |\n|---------|-------------|\n| \`npm run dev\` | Start development server |\n| \`npm run build\` | Build for production |\n| \`npm start\` | Start production server |\n`),
      {
        path: 'package.json',
        content: JSON.stringify({
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
          },
          dependencies: {
            '@types/node': 'latest',
            '@types/react': 'latest',
            '@types/react-dom': 'latest',
            autoprefixer: 'latest',
            next: '^14.2.20',
            postcss: 'latest',
            react: '^18.3.1',
            'react-dom': '^18.3.1',
            tailwindcss: '^3.4.17',
            typescript: 'latest',
          },
          devDependencies: {},
        }, null, 2),
      },
      {
        path: 'pages/_app.tsx',
        content: 'import "@/styles/globals.css";\nimport type { AppProps } from "next/app";\n\nexport default function App({ Component, pageProps }: AppProps) {\n  return <Component {...pageProps} />;\n}\n',
      },
      {
        path: 'styles/globals.css',
        content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nhtml, body, #__next {\n  min-height: 100%;\n}\nbody {\n  margin: 0;\n}\n',
      },
      {
        path: 'tailwind.config.ts',
        content: 'import type { Config } from "tailwindcss";\n\nconst config: Config = {\n  content: ["./pages/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./app/**/*.{js,ts,jsx,tsx}"],\n  theme: { extend: {} },\n  plugins: [],\n};\n\nexport default config;\n',
      },
      {
        path: 'postcss.config.js',
        content: 'module.exports = {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n',
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify({
          compilerOptions: {
            target: 'es5',
            lib: ['dom', 'dom.iterable', 'esnext'],
            allowJs: true,
            skipLibCheck: true,
            strict: false,
            noEmit: true,
            esModuleInterop: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'preserve',
            incremental: true,
            baseUrl: '.',
            paths: {
              '@/*': ['./*'],
            },
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
          exclude: ['node_modules'],
        }, null, 2),
      },
    ]
  }

  if (template === 'vue-developer') {
    return [
      ...getCommonFiles('vue', `# Vue App\n\nA Vue.js application built with Nuxt 3 and Tailwind CSS.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nOpen [http://localhost:3000](http://localhost:3000) to view the app.`),
      {
        path: 'package.json',
        content: JSON.stringify({
          scripts: {
            dev: 'nuxt dev',
            build: 'nuxt build',
            start: 'nuxt start',
          },
          dependencies: {
            '@nuxtjs/tailwindcss': 'latest',
            nuxt: '^3.13.0',
            vue: 'latest',
          },
          devDependencies: {},
        }, null, 2),
      },
      {
        path: 'nuxt.config.ts',
        content: 'export default defineNuxtConfig({\n  compatibilityDate: "2024-04-03",\n  devtools: { enabled: false },\n  modules: ["@nuxtjs/tailwindcss"],\n  vite: { server: { hmr: { protocol: "wss" } } },\n});\n',
      },
      {
        path: 'tailwind.config.ts',
        content: 'export default {\n  content: ["./app.vue", "./components/**/*.{vue,js,ts}"],\n  theme: { extend: {} },\n  plugins: [],\n};\n',
      },
    ]
  }

  if (template === 'streamlit-developer') {
    return [
      {
        path: 'requirements.txt',
        content: 'streamlit\npandas\nnumpy\nmatplotlib\nrequests\nseaborn\nplotly\n',
      },
    ]
  }

  if (template === 'gradio-developer') {
    return [
      {
        path: 'requirements.txt',
        content: 'gradio\npandas\nnumpy\nmatplotlib\nrequests\nseaborn\nplotly\n',
      },
    ]
  }

  if (template === 'react-developer') {
    return [
      ...getCommonFiles('react', `# React App\n\nA React application built with Vite and Tailwind CSS.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nOpen [http://localhost:3000](http://localhost:3000) to view the app.`),
      {
        path: 'package.json',
        content: JSON.stringify({
          scripts: {
            dev: 'vite',
            build: 'vite build',
            preview: 'vite preview',
          },
          dependencies: {
            react: '^18.3.1',
            'react-dom': '^18.3.1',
          },
          devDependencies: {
            '@types/react': 'latest',
            '@types/react-dom': 'latest',
            '@vitejs/plugin-react': 'latest',
            tailwindcss: '^3.4.17',
            postcss: 'latest',
            autoprefixer: 'latest',
            typescript: 'latest',
            vite: 'latest',
          },
        }, null, 2),
      },
      {
        path: 'vite.config.ts',
        content: 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n  server: { host: "0.0.0.0", port: 3000 },\n});\n',
      },
      {
        path: 'index.html',
        content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>React App</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n',
      },
      {
        path: 'src/main.tsx',
        content: 'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\nimport "./index.css";\n\nReactDOM.createRoot(document.getElementById("root")!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n',
      },
      {
        path: 'src/index.css',
        content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody {\n  margin: 0;\n  font-family: system-ui, -apple-system, sans-serif;\n}\n',
      },
      {
        path: 'tailwind.config.ts',
        content: 'import type { Config } from "tailwindcss";\n\nconst config: Config = {\n  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],\n  theme: { extend: {} },\n  plugins: [],\n};\n\nexport default config;\n',
      },
      {
        path: 'postcss.config.js',
        content: 'module.exports = {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n',
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'react-jsx',
            strict: false,
            baseUrl: '.',
            paths: { '@/*': ['./src/*'] },
          },
          include: ['src'],
        }, null, 2),
      },
    ]
  }

  if (template === 'vite-developer') {
    return [
      ...getCommonFiles('vite', `# Vite React App\n\nA React application built with Vite and Tailwind CSS.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nOpen [http://localhost:3000](http://localhost:3000) to view the app.`),
      {
        path: 'package.json',
        content: JSON.stringify({
          scripts: {
            dev: 'vite',
            build: 'vite build',
            preview: 'vite preview',
          },
          dependencies: {
            react: '^18.3.1',
            'react-dom': '^18.3.1',
          },
          devDependencies: {
            '@types/react': 'latest',
            '@types/react-dom': 'latest',
            '@vitejs/plugin-react': 'latest',
            tailwindcss: '^3.4.17',
            postcss: 'latest',
            autoprefixer: 'latest',
            typescript: 'latest',
            vite: 'latest',
          },
        }, null, 2),
      },
      {
        path: 'vite.config.ts',
        content: 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n  server: { host: "0.0.0.0", port: 3000 },\n});\n',
      },
      {
        path: 'index.html',
        content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Vite App</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n',
      },
      {
        path: 'src/main.tsx',
        content: 'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\nimport "./index.css";\n\nReactDOM.createRoot(document.getElementById("root")!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n',
      },
      {
        path: 'src/index.css',
        content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody {\n  margin: 0;\n  font-family: system-ui, -apple-system, sans-serif;\n}\n',
      },
      {
        path: 'tailwind.config.ts',
        content: 'import type { Config } from "tailwindcss";\n\nconst config: Config = {\n  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],\n  theme: { extend: {} },\n  plugins: [],\n};\n\nexport default config;\n',
      },
      {
        path: 'postcss.config.js',
        content: 'module.exports = {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n',
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'react-jsx',
            strict: false,
            baseUrl: '.',
            paths: { '@/*': ['./src/*'] },
          },
          include: ['src'],
        }, null, 2),
      },
    ]
  }

  if (template === 'html-developer') {
    return [
      ...getCommonFiles('html', `# HTML App\n\nA simple HTML application.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nOpen [http://localhost:3000](http://localhost:3000) to view the app.`),
      {
        path: 'package.json',
        content: JSON.stringify({
          scripts: {
            dev: 'live-server --port=3000',
          },
          devDependencies: {
            'live-server': 'latest',
          },
        }, null, 2),
      },
      {
        path: 'index.html',
        content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>HTML App</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>\n',
      },
    ]
  }

  if (template === 'svelte-developer') {
    return [
      ...getCommonFiles('svelte', `# Svelte App\n\nA Svelte application built with Vite and Tailwind CSS.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nOpen [http://localhost:3000](http://localhost:3000) to view the app.`),
      {
        path: 'package.json',
        content: JSON.stringify({
          scripts: {
            dev: 'vite dev --port 3000',
            build: 'vite build',
            preview: 'vite preview',
          },
          dependencies: {},
          devDependencies: {
            '@sveltejs/vite-plugin-svelte': 'latest',
            svelte: 'latest',
            'svelte-check': 'latest',
            tailwindcss: '^3.4.17',
            postcss: 'latest',
            autoprefixer: 'latest',
            typescript: 'latest',
            vite: 'latest',
          },
        }, null, 2),
      },
      {
        path: 'vite.config.ts',
        content: 'import { defineConfig } from "vite";\nimport { svelte } from "@sveltejs/vite-plugin-svelte";\n\nexport default defineConfig({\n  plugins: [svelte()],\n  server: { host: "0.0.0.0", port: 3000 },\n});\n',
      },
      {
        path: 'src/app.html',
        content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Svelte App</title>\n</head>\n<body>\n  <div id="app"></div>\n  <script type="module" src="/src/main.ts"></script>\n</body>\n</html>\n',
      },
      {
        path: 'src/main.ts',
        content: 'import App from "./App.svelte";\n\nconst app = new App({\n  target: document.getElementById("app")!,\n});\n\nexport default app;\n',
      },
      {
        path: 'src/index.css',
        content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody {\n  margin: 0;\n  font-family: system-ui, -apple-system, sans-serif;\n}\n',
      },
      {
        path: 'tailwind.config.ts',
        content: 'import type { Config } from "tailwindcss";\n\nconst config: Config = {\n  content: ["./src/**/*.{html,js,ts,svelte}"],\n  theme: { extend: {} },\n  plugins: [],\n};\n\nexport default config;\n',
      },
      {
        path: 'postcss.config.js',
        content: 'module.exports = {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n',
      },
    ]
  }

  if (template === 'expo-mobile') {
    return [
      ...getCommonFiles('expo', `# Expo Mobile App\n\nA React Native mobile application built with Expo.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm start\n\`\`\`\n\nScan the QR code with Expo Go (iOS/Android) to view the app.`),
      {
        path: 'package.json',
        content: JSON.stringify({
          scripts: {
            start: 'expo start',
            android: 'expo start --android',
            ios: 'expo start --ios',
            web: 'expo start --web',
          },
          dependencies: {
            'expo': '~51.0.0',
            'react': '18.2.0',
            'react-native': '0.74.5',
            'react-dom': '18.2.0',
            'react-native-web': '~0.19.10',
            '@expo/metro-runtime': '~3.2.1',
            'expo-router': '~3.5.0',
            'react-native-safe-area-context': '4.10.5',
            'react-native-screens': '3.31.1',
          },
          devDependencies: {
            '@types/react': 'latest',
            'typescript': 'latest',
          },
        }, null, 2),
      },
      {
        path: 'app.json',
        content: JSON.stringify({
          expo: {
            name: 'Expo App',
            slug: 'expo-app',
            version: '1.0.0',
            orientation: 'portrait',
            icon: './assets/icon.png',
            userInterfaceStyle: 'automatic',
            scheme: 'myapp',
            splash: { backgroundColor: '#ffffff' },
            android: { adaptiveIcon: { backgroundColor: '#ffffff' } },
            plugins: ['expo-router'],
          },
        }, null, 2),
      },
      {
        path: 'app/_layout.tsx',
        content: 'import { Stack } from "expo-router";\n\nexport default function RootLayout() {\n  return <Stack />;\n}\n',
      },
      {
        path: 'app/index.tsx',
        content: 'import { View, Text, StyleSheet } from "react-native";\n\nexport default function Home() {\n  return (\n    <View style={styles.container}>\n      <Text style={styles.text}>Hello Expo!</Text>\n    </View>\n  );\n}\n\nconst styles = StyleSheet.create({\n  container: { flex: 1, justifyContent: "center", alignItems: "center" },\n  text: { fontSize: 24, fontWeight: "bold" },\n});\n',
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify({
          extends: 'expo/tsconfig.base',
          compilerOptions: {
            strict: true,
            baseUrl: '.',
            paths: { '@/*': ['./*'] },
          },
        }, null, 2),
      },
    ]
  }

  if (template === 'pwa-mobile') {
    return [
      ...getCommonFiles('pwa', `# PWA App\n\nA Progressive Web App built with Next.js.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nOpen [http://localhost:3000](http://localhost:3000) to view the app.`),
      {
        path: 'package.json',
        content: JSON.stringify({
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
          },
          dependencies: {
            next: '^14.2.20',
            react: '^18.3.1',
            'react-dom': '^18.3.1',
          },
          devDependencies: {
            '@types/node': 'latest',
            '@types/react': 'latest',
            '@types/react-dom': 'latest',
            autoprefixer: 'latest',
            postcss: 'latest',
            tailwindcss: '^3.4.17',
            typescript: 'latest',
          },
        }, null, 2),
      },
      {
        path: 'next.config.mjs',
        content: '/** @type {import("next").NextConfig} */\nconst nextConfig = {\n  pwa: true,\n  reactStrictMode: true,\n};\nexport default nextConfig;\n',
      },
      {
        path: 'pages/_app.tsx',
        content: 'import "@/styles/globals.css";\nimport type { AppProps } from "next/app";\n\nexport default function App({ Component, pageProps }: AppProps) {\n  return <Component {...pageProps} />;\n}\n',
      },
      {
        path: 'styles/globals.css',
        content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nhtml, body, #__next {\n  min-height: 100%;\n  touch-action: manipulation;\n}\nbody {\n  margin: 0;\n  font-family: system-ui, -apple-system, sans-serif;\n  -webkit-font-smoothing: antialiased;\n  -webkit-tap-highlight-color: transparent;\n}\n',
      },
      {
        path: 'public/manifest.json',
        content: JSON.stringify({
          name: 'PWA App',
          short_name: 'PWA',
          description: 'Progressive Web App',
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#000000',
          icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
        }, null, 2),
      },
      {
        path: 'tailwind.config.ts',
        content: 'import type { Config } from "tailwindcss";\n\nconst config: Config = {\n  content: ["./pages/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],\n  theme: { extend: {} },\n  plugins: [],\n};\n\nexport default config;\n',
      },
      {
        path: 'postcss.config.js',
        content: 'module.exports = {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n',
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify({
          compilerOptions: {
            target: 'es5',
            lib: ['dom', 'dom.iterable', 'esnext'],
            allowJs: true,
            skipLibCheck: true,
            strict: false,
            noEmit: true,
            esModuleInterop: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'preserve',
            incremental: true,
            baseUrl: '.',
            paths: { '@/*': ['./*'] },
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
          exclude: ['node_modules'],
        }, null, 2),
      },
    ]
  }

  if (template === 'code-interpreter-v1') {
    return []
  }

  return []
}

function cleanPath(value: unknown) {
  return typeof value === 'string'
    ? value.replace(/\\/g, '/').replace(/^\/+/, '').trim()
    : ''
}

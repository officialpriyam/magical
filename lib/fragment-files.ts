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
 * Used to persist full project structure to sandbox-storage.
 */
export function getTemplateFiles(template?: string): GeneratedFile[] {
  if (template === 'nextjs-developer') {
    return [
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

  return []
}

function cleanPath(value: unknown) {
  return typeof value === 'string'
    ? value.replace(/\\/g, '/').replace(/^\/+/, '').trim()
    : ''
}

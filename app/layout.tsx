import './globals.css'
import { AuthProvider, PostHogProvider, ThemeProvider } from './providers'
import { Toaster } from '@/components/ui/toaster'
import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { AppStabilityGuard } from '@/components/app-stability-guard'
import { CookieConsent } from '@/components/cookie-consent'
import { StarfieldBackground } from '@/components/starfield-background'
import { PageTransition } from '@/components/page-transition'

export const metadata: Metadata = {
  metadataBase: new URL('https://magical-ai.vercel.app'),
  title: 'Magical AI',
  keywords: [
    'Magical AI',
    'priyx',
    'AI software engineer',
    'open source',
    'live code execution',
    'file uploads',
    'real-time chat',
    'lovable.dev alternative',
    'bolt.new alternative',
    'v0.dev alternative',
  ],
  authors: [{ name: 'priyx' }],
  creator: 'priyx',
  publisher: 'priyx',
  description:
    'Magical AI is an AI software engineer with live code execution, file uploads, and real-time chat. Developed by priyx.',
  icons: {
    icon: [
      { rel: 'icon', type: 'image/png', sizes: '16x16', url: '/favicon-16x16.png' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', url: '/favicon-32x32.png' },
      { rel: 'icon', type: 'image/png', sizes: '192x192', url: '/icon-192.png' },
      { rel: 'icon', type: 'image/png', sizes: '512x512', url: '/icon-512.png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    title: 'Magical AI',
    description:
      'An AI software engineer with live code execution, file uploads, and real-time chat. Developed by priyx.',
    images: ['/opengraph.png'],
    url: 'https://magical-ai.vercel.app',
    siteName: 'Magical AI',
    type: 'website',
    locale: 'en_US',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body>
        <StarfieldBackground />
        <SpeedInsights />
        <Analytics />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <PostHogProvider>
            <AuthProvider>
              <AppStabilityGuard>
                <PageTransition>{children}</PageTransition>
              </AppStabilityGuard>
            </AuthProvider>
          </PostHogProvider>
          <Toaster />
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  )
}

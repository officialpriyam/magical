'use client'

import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0b0a]">
      <header className="border-b border-white/[0.06] bg-[#0a0b0a]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/icon.png" alt="" className="h-7 w-7" />
            <span className="text-lg font-bold text-white">Magical AI</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-sm text-white/50 hover:text-white transition">Home</Link>
            <Link href="/terms" className="text-sm text-white/50 hover:text-white transition">Terms</Link>
            <Link href="/auth/login" className="text-sm text-white/60 hover:text-white transition">Sign In</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-white/40 mb-8">Last updated: August 23, 2026</p>

        <div className="space-y-8 text-sm text-white/65 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Data We Collect</h2>
            <p>We collect minimal data necessary to provide the Service:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li><strong>Account Information:</strong> Email, name, and authentication provider (Google/GitHub) when you sign up</li>
              <li><strong>Project Data:</strong> Code, prompts, and configurations you create within the Service</li>
              <li><strong>Usage Data:</strong> Basic analytics (pages visited, features used) via PostHog</li>
              <li><strong>API Keys:</strong> Third-party API keys you provide (stored encrypted, never shared)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. How We Use Your Data</h2>
            <p>We use your data solely to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>Provide and maintain the Service</li>
              <li>Process your prompts and generate code</li>
              <li>Authenticate and secure your account</li>
              <li>Improve the Service through anonymized usage analytics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Data Sharing</h2>
            <p className="font-medium text-white/80">We do NOT sell, rent, or share your personal data with third parties for marketing purposes.</p>
            <p className="mt-2">Your data is only shared with:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li><strong>Supabase:</strong> Database and authentication (your data stays in your Supabase project)</li>
              <li><strong>AI Providers:</strong> Your prompts are sent to the AI provider you select (OpenAI, Anthropic, etc.) for code generation</li>
              <li><strong>Sandbox Providers:</strong> Generated code is sent to the sandbox you select (E2B, Vercel, etc.) for execution</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Storage &amp; Security</h2>
            <p>Your project data is stored in your own Supabase project. We do not maintain a separate database of user content. API keys are stored encrypted and are never transmitted to our servers unencrypted.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Data Retention</h2>
            <p>We retain your account data for as long as your account is active. You may delete your projects and account at any time. Deleted data is purged within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>Access, modify, or delete your personal data</li>
              <li>Export all your project data</li>
              <li>Request a complete account deletion</li>
              <li>Opt out of analytics tracking</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Cookies</h2>
            <p>We use only essential cookies for authentication. No tracking cookies are set without your consent.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Children&apos;s Privacy</h2>
            <p>The Service is not intended for users under 13. We do not knowingly collect data from children.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Changes to This Policy</h2>
            <p>We may update this Privacy Policy. Continued use of the Service after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Contact</h2>
            <p>For privacy-related questions, contact us at <a href="https://github.com/officialpriyam/magical/issues" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">GitHub Issues</a>.</p>
          </section>
        </div>
      </main>
    </div>
  )
}

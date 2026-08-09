'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, MessageCircle, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SiteSettings {
  discord_link: string
  support_email: string
}

export default function AdminSettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<SiteSettings>({ discord_link: '', support_email: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((res) => {
        if (res.status === 403) {
          router.push('/')
          return
        }
        return res.json()
      })
      .then((data) => {
        if (data) {
          setSettings(data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-white/40 text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Site Settings</h1>

      <div className="space-y-4 max-w-lg">
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] space-y-3">
          <div className="flex items-center gap-2 text-white/70 text-sm font-medium">
            <MessageCircle className="h-4 w-4" />
            Discord Link
          </div>
          <Input
            placeholder="https://discord.gg/..."
            value={settings.discord_link}
            onChange={(e) => setSettings({ ...settings, discord_link: e.target.value })}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
          />
          <p className="text-xs text-white/40">Shown in the footer and help center</p>
        </div>

        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] space-y-3">
          <div className="flex items-center gap-2 text-white/70 text-sm font-medium">
            <Mail className="h-4 w-4" />
            Support Email
          </div>
          <Input
            type="email"
            placeholder="support@example.com"
            value={settings.support_email}
            onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
          />
          <p className="text-xs text-white/40">Contact email for user support</p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="bg-white/10 hover:bg-white/15 text-white">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}

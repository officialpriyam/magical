import Auth, { ViewType } from './auth'
import { validateEmail } from '@/app/actions/validate-email'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Provider, SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

export function AuthDialog({
  open,
  setOpen,
  supabase,
  view,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  supabase: SupabaseClient
  view: ViewType
}) {
  const [providers, setProviders] = useState<Provider[]>([])

  useEffect(() => {
    if (!open) return

    fetch('/api/auth/providers')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.providers)) {
          setProviders(data.providers as Provider[])
        }
      })
      .catch(() => {
        setProviders([])
      })
  }, [open])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <VisuallyHidden>
          <DialogTitle>Sign in</DialogTitle>
          <DialogDescription>
            Sign in or create an account.
          </DialogDescription>
        </VisuallyHidden>
          <h1 className="flex items-center gap-4 text-xl font-bold mb-6 w-full">
            <Image src="/icon.png" alt="Magical AI" width={32} height={32} />
            Sign in to Magical AI
          </h1>
          <div className="w-full">
            <Auth
              supabaseClient={supabase}
              view={view}
              providers={providers}
              socialLayout="horizontal"
              onSignUpValidate={validateEmail}
              metadata={{
                is_fragments_user: true,
              }}
            />
          </div>
      </DialogContent>
    </Dialog>
  )
}

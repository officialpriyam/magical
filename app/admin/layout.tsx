import { notFound, redirect } from 'next/navigation'
import { getAdminStatus } from '@/lib/admin'
import AdminNav from './admin-nav'

export const metadata = {
  title: 'Admin Panel',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const result = await getAdminStatus()

  if (!result.admin) {
    if (result.reason === 'unauthenticated') {
      redirect('/login')
    }
    notFound()
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <AdminNav />

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

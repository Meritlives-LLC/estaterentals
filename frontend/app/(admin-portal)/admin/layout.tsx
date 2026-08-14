'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminTopbar } from '@/components/admin/AdminTopbar'
import { useSwipeGesture } from '@/hooks/useSwipeGesture'

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isLoginPage = pathname === '/admin/login'

  useEffect(() => {
    if (!loading && !isLoginPage) {
      if (!user) {
        router.replace('/admin/login')
      } else if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
        router.replace('/')
      }
    }
  }, [user, loading, router, isLoginPage])

  // Touch gestures (iOS + Android):
  // - Swipe right from left edge → open menu
  // - Swipe left when menu is open → close menu
  useSwipeGesture({
    enabled: !isLoginPage && !loading,
    edgeWidth: 28,
    threshold: 55,
    onSwipe: (dir) => {
      if (dir === 'right') setMobileOpen(true)
      if (dir === 'left') setMobileOpen(false)
    },
  })

  if (isLoginPage) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) return null

  return (
    <div className="flex min-h-[100dvh] h-[100dvh] bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <AdminSidebar
        user={user}
        basePath="/admin/dashboard"
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AdminTopbar
          user={user}
          basePath="/admin"
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-8 safe-bottom">
          {children}
        </main>
      </div>
    </div>
  )
}
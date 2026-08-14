'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Home, MessageSquare, ExternalLink, ShieldCheck, X } from 'lucide-react'
import { useEffect } from 'react'
import { cn, getInitials } from '@/lib/utils'

interface AdminSidebarProps {
  user: { name?: string | null; email?: string | null; role: string }
  basePath?: string
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function AdminSidebar({
  user,
  basePath = '/admin/dashboard',
  mobileOpen = false,
  onMobileClose,
}: AdminSidebarProps) {
  const pathname = usePathname()

  useEffect(() => {
    onMobileClose?.()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const navItems = [
    { href: basePath, icon: LayoutDashboard, label: 'Dashboard' },
    { href: `${basePath}/properties`, icon: Home, label: 'Properties' },
    { href: `${basePath}/messages`, icon: MessageSquare, label: 'Messages' },
  ]

  const sidebarContent = (collapsed: boolean, isMobile = false) => (
    <>
      <div className="flex items-center justify-between px-4 h-16 border-b border-slate-800/50 shrink-0">
        {collapsed && !isMobile ? (
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/30">
            <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <polygon points="24,4 44,22 4,22" fill="white" />
              <rect x="8" y="22" width="32" height="20" rx="1" fill="white" opacity="0.9" />
              <rect x="20" y="30" width="8" height="12" rx="3" fill="#f97316" />
            </svg>
          </div>
        ) : (
          <img src="/logo.svg" alt="JerryHomes" className="h-10 w-auto" />
        )}
        {isMobile && (
          <button
            type="button"
            onClick={onMobileClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors touch-manipulation"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="mx-3 mt-3 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span className="text-orange-400 text-xs font-medium">
            {user.role === 'SUPER_ADMIN' ? 'Super Admin Portal' : 'Admin Portal'}
          </span>
        </div>
      )}

      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto overscroll-contain">
        {!collapsed && (
          <p className="text-slate-600 text-xs font-medium uppercase tracking-wider px-3 mb-3">Main Menu</p>
        )}
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = href === basePath ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={isMobile ? onMobileClose : undefined}
              className={cn('admin-sidebar-link', isActive && 'active')}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}

        <div className="pt-4 mt-4 border-t border-slate-800/50">
          {!collapsed && (
            <p className="text-slate-600 text-xs font-medium uppercase tracking-wider px-3 mb-3">External</p>
          )}
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-sidebar-link"
            title={collapsed ? 'View Site' : undefined}
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            {!collapsed && <span>View Site</span>}
          </Link>
        </div>
      </nav>

      <div className="p-3 border-t border-slate-800/50">
        <div className={cn('flex items-center gap-3 px-2 py-2 rounded-xl', !collapsed && 'bg-slate-900/50')}>
          <div className="w-8 h-8 bg-orange-500/20 border border-orange-500/30 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-orange-400 text-xs font-bold">
              {getInitials(user.name ?? user.email ?? 'A')}
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-medium truncate">{user.name ?? 'Admin'}</p>
              <p className="text-slate-500 text-xs truncate">{user.role}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col bg-slate-950 text-white transition-all duration-300 border-r border-slate-800/50 shrink-0 w-64">
        {sidebarContent(false)}
      </aside>

      {/* Mobile overlay + drawer */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden transition-opacity duration-300',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onMobileClose}
          aria-label="Close menu"
        />
        <aside
          className={cn(
            'absolute top-0 left-0 bottom-0 w-[min(100%,18rem)] max-w-[85vw] bg-slate-950 text-white flex flex-col shadow-2xl transition-transform duration-300 ease-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Admin navigation"
        >
          {sidebarContent(false, true)}
        </aside>
      </div>
    </>
  )
}
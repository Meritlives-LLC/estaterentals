'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Home,
  MessageSquare,
  ExternalLink,
  ShieldCheck,
  X,
  Users,
  Activity,
  KeyRound,
  UserPlus,
  PlusCircle,
} from 'lucide-react'
import { useEffect } from 'react'
import { cn, getInitials } from '@/lib/utils'

interface AdminSidebarProps {
  user: { name?: string | null; email?: string | null; username?: string | null; role: string }
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
  const isStaff = user.role === 'STAFF'
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'

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

  const staffNav = [
    { href: basePath, icon: LayoutDashboard, label: 'Dashboard' },
    { href: `${basePath}/properties`, icon: Home, label: 'Properties' },
    { href: `${basePath}/properties/new`, icon: PlusCircle, label: 'Add Property' },
    { href: `${basePath}/messages`, icon: MessageSquare, label: 'Customer Messages' },
    { href: `${basePath}/change-password`, icon: KeyRound, label: 'Change Password' },
  ]

  const adminNav = [
    { href: basePath, icon: LayoutDashboard, label: 'Dashboard' },
    { href: `${basePath}/properties`, icon: Home, label: 'Properties' },
    { href: `${basePath}/properties/new`, icon: PlusCircle, label: 'Add Property' },
    { href: `${basePath}/staff`, icon: UserPlus, label: 'Staff Management' },
    { href: `${basePath}/messages`, icon: MessageSquare, label: 'Messages' },
    { href: `${basePath}/activity`, icon: Activity, label: 'Activity' },
    { href: `${basePath}/change-password`, icon: KeyRound, label: 'Change Password' },
  ]

  const navItems = isStaff ? staffNav : adminNav

  const roleLabel =
    user.role === 'SUPER_ADMIN'
      ? 'Super Admin Portal'
      : user.role === 'STAFF'
        ? 'Staff Portal'
        : 'Admin Portal'

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
          <span className="text-orange-400 text-xs font-medium">{roleLabel}</span>
        </div>
      )}

      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto overscroll-contain">
        {navItems.map((item) => {
          const active =
            item.href === basePath
              ? pathname === basePath
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                active
                  ? 'bg-orange-500/15 text-orange-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-800/50 shrink-0">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white">
            {getInitials(user.name || user.username || user.email || 'U')}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.name || user.username || 'User'}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {user.username || user.email}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-950 border-r border-slate-800/50 h-screen sticky top-0">
        {sidebarContent(false)}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onMobileClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-slate-950 flex flex-col shadow-2xl">
            {sidebarContent(false, true)}
          </aside>
        </div>
      )}
    </>
  )
}

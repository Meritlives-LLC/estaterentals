'use client'

import { usePathname } from 'next/navigation'
import { LogOut, Moon, Sun, Menu } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import { adminLogout } from '@/lib/auth'

interface AdminTopbarProps {
  user: { name?: string | null; email?: string | null }
  basePath?: string
  onMenuClick?: () => void
}

export function AdminTopbar({ user, basePath = '/admin', onMenuClick }: AdminTopbarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const dashPath = `${basePath}/dashboard`
  const pageTitles: Record<string, string> = {
    [dashPath]: 'Dashboard',
    [`${dashPath}/properties`]: 'Properties',
    [`${dashPath}/properties/new`]: 'Add Property',
    [`${dashPath}/messages`]: 'Messages',
  }

  const title = pageTitles[pathname] ?? (pathname.includes('/edit') ? 'Edit Property' : 'Admin Panel')

  return (
    <header className="h-14 sm:h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/50 shrink-0 safe-top">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2.5 -ml-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors touch-manipulation"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white leading-none truncate">
            {title}
          </h1>
          <p className="text-slate-400 text-xs mt-0.5 hidden sm:block truncate">
            Welcome back, {user.name ?? 'Admin'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {mounted && (
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors touch-manipulation"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={adminLogout}
          className="flex items-center gap-2 px-2.5 sm:px-3 py-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl text-sm font-medium transition-all touch-manipulation"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  )
}
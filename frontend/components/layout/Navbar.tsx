'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X, Moon, Sun, LogOut, User } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { logout } from '@/lib/auth'
import { useSwipeGesture } from '@/hooks/useSwipeGesture'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/properties', label: 'Properties' },
  { href: '/contact', label: 'Contact' },
]

export function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { user } = useAuth()
  const isHome = pathname === '/'

  useEffect(() => {
    setMounted(true)
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useSwipeGesture({
    enabled: mobileOpen,
    threshold: 50,
    onSwipe: (dir) => {
      if (dir === 'left') setMobileOpen(false)
    },
  })

  const solid = scrolled || !isHome

  return (
    <header className={cn(
      'fixed top-0 left-0 right-0 z-50 transition-all duration-300 safe-top',
      solid
        ? 'bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-sm border-b border-slate-200/50 dark:border-slate-800/50'
        : 'bg-transparent'
    )}>
      <div className="container-max section-padding">
        <nav className="flex items-center justify-between h-14 sm:h-16 md:h-20" aria-label="Main navigation">
          <Link href="/" aria-label="JerryHomes — go to homepage" className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="JerryHomes"
              width={154}
              height={118}
              priority
              className="h-10 w-auto transition-all duration-300"
            />
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? 'page' : undefined}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  pathname === link.href
                    ? 'bg-orange-500 text-white shadow-sm'
                    : solid
                      ? 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                      : 'text-white/90 hover:text-white hover:bg-white/10'
                )}
              >{link.label}</Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {mounted && (
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className={cn(
                  'p-2.5 rounded-xl transition-colors touch-manipulation',
                  solid
                    ? 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                )}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                <div className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium',
                  solid ? 'text-slate-700 dark:text-slate-300' : 'text-white/90'
                )}>
                  {user.image ? (
                    <img src={user.image} alt={user.name ?? 'User'} className="w-7 h-7 rounded-full object-cover border-2 border-orange-500/40" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
                      <User className="w-4 h-4 text-orange-500" />
                    </div>
                  )}
                  <span className="max-w-[100px] truncate">{user.name ?? user.email}</span>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className={cn(
                    'p-2 rounded-lg transition-colors touch-manipulation',
                    solid ? 'text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30' : 'text-white/70 hover:text-white hover:bg-white/10'
                  )}
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/signin"
                className={cn(
                  'hidden md:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200',
                  solid
                    ? 'border-orange-500 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950'
                    : 'border-white/40 text-white hover:bg-white/10'
                )}
              >Sign In</Link>
            )}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              className={cn(
                'md:hidden p-2.5 rounded-xl touch-manipulation',
                solid ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800' : 'text-white hover:bg-white/10'
              )}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>
      </div>

      {mobileOpen && (
        <div
          id="mobile-menu"
          className="md:hidden bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 shadow-xl max-h-[min(70vh,28rem)] overflow-y-auto overscroll-contain"
        >
          <div className="container-max section-padding py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                aria-current={pathname === link.href ? 'page' : undefined}
                className={cn(
                  'flex items-center px-4 py-3.5 rounded-xl text-sm font-medium transition-colors touch-manipulation',
                  pathname === link.href
                    ? 'bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                )}
              >{link.label}</Link>
            ))}
            <Link
              href="/signin"
              onClick={() => setMobileOpen(false)}
              className="flex items-center px-4 py-3.5 rounded-xl text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950 transition-colors touch-manipulation"
            >Sign In →</Link>
          </div>
        </div>
      )}
    </header>
  )
}
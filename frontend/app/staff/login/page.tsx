'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, User, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { z } from 'zod'

const StaffLoginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Username is required')
    .max(100, 'Username is too long'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),
})

type StaffLoginFormData = z.infer<typeof StaffLoginSchema>

export default function StaffLoginPage() {
  const router = useRouter()
  const { refetch } = useAuth()

  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StaffLoginFormData>({
    resolver: zodResolver(StaffLoginSchema),
  })

  const onSubmit = async (data: StaffLoginFormData) => {
    setError('')

    try {
      const response = await authApi.staffLogin(
        data.username,
        data.password
      )

      const user = response?.data?.data?.user

      if (!user) {
        throw new Error('Invalid login response')
      }

      if (user.role !== 'STAFF') {
        setError('This login is for staff accounts only.')
        return
      }

      await refetch()

      router.push('/admin/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(
        err?.response?.data?.error ??
        'Invalid username or password.'
      )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-orange-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2 px-4 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-orange-400 text-xs font-medium tracking-wide uppercase">
              Staff Portal
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex flex-col items-center gap-1 mb-6">
              <img
                src="/logo.svg"
                alt="JerryHomes"
                className="h-16 w-auto"
              />

              <span className="font-bold text-xl text-white tracking-tight">
                Jerry<span className="text-orange-500">Homes</span>
              </span>
            </Link>

            <h1 className="font-display text-2xl font-bold text-white mb-2">
              Staff Sign In
            </h1>

            <p className="text-slate-400 text-sm">
              Sign in with your staff username and password
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-6 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Username
              </label>

              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                <input
                  {...register('username')}
                  type="text"
                  autoComplete="username"
                  placeholder="Enter your username"
                  className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50 transition text-sm"
                />
              </div>

              {errors.username && (
                <p className="text-red-400 text-xs mt-1">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50 transition text-sm"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {errors.password && (
                <p className="text-red-400 text-xs mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium rounded-xl transition-all shadow-lg hover:-translate-y-0.5"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/admin/login"
              className="text-orange-400 hover:text-orange-300 text-sm transition-colors"
            >
              Administrator login
            </Link>
          </div>

          <p className="text-center mt-4">
            <Link
              href="/"
              className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              ← Back to website
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
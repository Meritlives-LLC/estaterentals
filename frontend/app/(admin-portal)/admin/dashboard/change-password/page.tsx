'use client'

import { useState } from 'react'
import { authApi } from '@/lib/api'
import { KeyRound, Loader2, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    setLoading(true)
    try {
      await authApi.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      })
      setSuccess('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500'

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-orange-500" /> Change password
        </h1>
        <p className="text-slate-500 text-sm mt-1">Update your account password</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4"
      >
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 text-green-600 text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" /> {success}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Current password</label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              className={inputCls}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              onClick={() => setShow((s) => !s)}
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">New password</label>
          <input
            type={show ? 'text' : 'password'}
            className={inputCls}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Confirm new password</label>
          <input
            type={show ? 'text' : 'password'}
            className={inputCls}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}

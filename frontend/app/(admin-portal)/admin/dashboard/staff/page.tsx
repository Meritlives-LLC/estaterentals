'use client'

import { useEffect, useState } from 'react'
import { staffApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import {
  UserPlus, Loader2, AlertCircle, CheckCircle, Trash2, ShieldOff, Shield,
} from 'lucide-react'

interface StaffRow {
  id: string
  username: string | null
  name: string | null
  role: string
  isActive: boolean
  createdAt: string
}

export default function StaffManagementPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ username: '', name: '', password: '' })

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await staffApi.list({ limit: 50 })
      const data = res?.data?.data
      setStaff(data?.staff ?? data?.users ?? data ?? [])
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to load staff')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!isAdmin) {
      router.replace('/admin/dashboard')
      return
    }
    void load()
  }, [authLoading, isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    setSuccess('')
    try {
      await staffApi.create({
        username: form.username.trim(),
        name: form.name.trim() || undefined,
        password: form.password,
      })
      setForm({ username: '', name: '', password: '' })
      setSuccess('Staff account created')
      await load()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to create staff')
    } finally {
      setCreating(false)
    }
  }

  const toggleStatus = async (id: string, isActive: boolean) => {
    try {
      await staffApi.setStatus(id, !isActive)
      await load()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to update status')
    }
  }

  const onDelete = async (id: string) => {
    if (!confirm('Delete this staff account?')) return
    try {
      await staffApi.delete(id)
      await load()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to delete staff')
    }
  }

  if (authLoading || !isAdmin) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Staff Management</h1>
        <p className="text-slate-500 text-sm mt-1">Create and manage staff accounts</p>
      </div>

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

      <form onSubmit={onCreate} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-orange-500" /> New staff account
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <input
            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            placeholder="Username *"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            required
          />
          <input
            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            placeholder="Display name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            type="password"
            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            placeholder="Password *"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
            minLength={8}
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create staff'}
        </button>
      </form>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : staff.length === 0 ? (
          <p className="text-center text-slate-400 py-12 text-sm">No staff accounts yet</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {staff.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {s.name || s.username}
                  </p>
                  <p className="text-xs text-slate-400">
                    @{s.username} · {s.isActive ? 'Active' : 'Disabled'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleStatus(s.id, s.isActive)}
                    className="p-2 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                    title={s.isActive ? 'Disable' : 'Enable'}
                  >
                    {s.isActive ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(s.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

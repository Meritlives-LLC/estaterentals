'use client'

import { useEffect, useState } from 'react'
import { activityApi } from '@/lib/api'
import { Loader2, AlertCircle, Activity } from 'lucide-react'

interface ActivityRow {
  id: string
  action: string
  description?: string | null
  createdAt: string
  user?: {
    id: string
    name?: string | null
    email?: string | null
    username?: string | null
    role?: string
  } | null
}

export default function ActivityPage() {
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const load = async (p = 1) => {
    setLoading(true)
    setError('')
    try {
      const res = await activityApi.list({ page: p, limit: 30 })
      const data = res?.data?.data
      setRows(data?.activities ?? [])
      setTotalPages(data?.pagination?.totalPages ?? 1)
      setPage(data?.pagination?.page ?? p)
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1)
  }, [])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-orange-500" /> Activity
        </h1>
        <p className="text-slate-500 text-sm mt-1">Recent actions across the portal</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-slate-400 py-12 text-sm">No activity yet</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{r.action}</p>
                    {r.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{r.description}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      {r.user?.name || r.user?.username || r.user?.email || 'System'}
                      {r.user?.role ? ` · ${r.user.role}` : ''}
                    </p>
                  </div>
                  <time className="text-xs text-slate-400 shrink-0">
                    {new Date(r.createdAt).toLocaleString()}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => load(page - 1)}
            className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-3 py-2 text-sm text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => load(page + 1)}
            className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

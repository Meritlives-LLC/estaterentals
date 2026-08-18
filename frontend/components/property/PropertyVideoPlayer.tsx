'use client'

import { useState } from 'react'
import { Play, Film, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PropertyVideo {
  id: string
  videoId: string
  url?: string | null
  thumbnailUrl?: string | null
  title?: string | null
  order?: number
}

interface PropertyVideoPlayerProps {
  videos: PropertyVideo[]
  propertyTitle?: string
}

/**
 * Displays property walkthrough videos via Bunny Stream embed iframe.
 * Lazy-loads player only after user clicks play (saves bandwidth on mobile).
 */
export function PropertyVideoPlayer({ videos, propertyTitle }: PropertyVideoPlayerProps) {
  const list = (videos || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  if (!list.length) return null

  const active = list.find((v) => v.id === activeId) || list[0]
  const embedBase = active?.url?.includes('iframe.mediadelivery.net')
    ? active.url
    : active?.videoId
      ? `https://iframe.mediadelivery.net/embed/${process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID || ''}/${active.videoId}`
      : null

  // Prefer stored url from backend (already includes library id)
  const embedSrc =
    active?.url && active.url.includes('mediadelivery.net')
      ? `${active.url}${active.url.includes('?') ? '&' : '?'}autoplay=true&preload=true`
      : embedBase
        ? `${embedBase}?autoplay=true&preload=true`
        : null

  const startPlay = (video: PropertyVideo) => {
    setError(false)
    setLoading(true)
    setActiveId(video.id)
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <Film className="w-5 h-5 text-orange-500" />
        Property Video{list.length > 1 ? 's' : ''}
      </h2>

      {/* Main player / poster */}
      <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800">
        {activeId && embedSrc ? (
          <>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              </div>
            )}
            {error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <p className="text-sm">Unable to load video</p>
                <button
                  type="button"
                  onClick={() => {
                    setError(false)
                    setLoading(true)
                  }}
                  className="text-xs text-orange-400 hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : (
              <iframe
                key={activeId}
                src={embedSrc}
                title={active?.title || propertyTitle || 'Property video'}
                className="absolute inset-0 w-full h-full border-0"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                loading="lazy"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false)
                  setError(true)
                }}
              />
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => startPlay(list[0])}
            className="absolute inset-0 w-full h-full group"
            aria-label="Play property video"
          >
            {list[0].thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={list[0].thumbnailUrl}
                alt={list[0].title || 'Video thumbnail'}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
            )}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <span className="w-16 h-16 rounded-full bg-orange-500 group-hover:bg-orange-600 shadow-xl shadow-orange-500/30 flex items-center justify-center transition-transform group-hover:scale-110">
                <Play className="w-7 h-7 text-white ml-1" fill="white" />
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Playlist when multiple */}
      {list.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {list.map((v, i) => (
            <button
              key={v.id}
              type="button"
              onClick={() => startPlay(v)}
              className={cn(
                'relative shrink-0 w-36 aspect-video rounded-xl overflow-hidden border-2 transition-all',
                activeId === v.id
                  ? 'border-orange-500 ring-2 ring-orange-500/30'
                  : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              {v.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={v.thumbnailUrl}
                  alt={v.title || `Video ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                  <Film className="w-5 h-5 text-slate-400" />
                </div>
              )}
              <span className="absolute bottom-1 left-1 text-[10px] font-semibold bg-black/60 text-white px-1.5 py-0.5 rounded">
                {v.title || `Video ${i + 1}`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

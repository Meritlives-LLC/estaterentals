'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PropertyGalleryProps {
  images: { url: string; alt?: string | null }[]
  title: string
}

export function PropertyGallery({ images, title }: PropertyGalleryProps) {
  const [current, setCurrent] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  if (!images.length) {
    return (
      <div className="h-80 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center">
        <p className="text-slate-400">No images available</p>
      </div>
    )
  }

  const prev = () => setCurrent((c) => (c - 1 + images.length) % images.length)
  const next = () => setCurrent((c) => (c + 1) % images.length)

  return (
    <>
      <div className="space-y-3">
        <div className="relative h-80 md:h-[480px] rounded-2xl overflow-hidden group bg-slate-100 dark:bg-slate-900">
          <Image
            src={images[current].url}
            alt={images[current].alt ?? title}
            fill
            className="object-cover"
            priority
            fetchPriority="high"
            quality={80}
            sizes="(max-width: 1024px) 100vw, 66vw"
          />
          {images.length > 1 && (
            <>
              <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 hover:bg-black/60 text-white rounded-xl flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 hover:bg-black/60 text-white rounded-xl flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all">
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
          <button onClick={() => setLightbox(true)} className="absolute bottom-3 right-3 w-9 h-9 bg-black/40 hover:bg-black/60 text-white rounded-xl flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all">
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/40 backdrop-blur-sm text-white text-xs rounded-lg">
            {current + 1} / {images.length}
          </div>
        </div>

        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {images.map((img, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={cn('relative h-16 w-24 rounded-xl overflow-hidden shrink-0 border-2 transition-all',
                  current === i ? 'border-orange-500 shadow-lg shadow-orange-500/25' : 'border-transparent opacity-60 hover:opacity-100'
                )}
              >
                <Image
                  src={img.url}
                  alt={img.alt ?? `Image ${i + 1}`}
                  fill
                  className="object-cover"
                  sizes="96px"
                  quality={50}
                  loading="lazy"
                  decoding="async"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
          <button onClick={() => setLightbox(false)} className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
          <div className="relative w-full max-w-5xl max-h-[80vh] rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <Image
              src={images[current].url}
              alt={images[current].alt ?? title}
              width={1200}
              height={800}
              className="w-full h-full object-contain"
              quality={85}
              sizes="(max-width: 1280px) 100vw, 1200px"
            />
          </div>
          {images.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); prev() }} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); next() }} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center">
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
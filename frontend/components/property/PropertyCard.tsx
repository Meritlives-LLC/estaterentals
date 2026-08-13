'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { Bed, Bath, Maximize, MapPin, Heart } from 'lucide-react'
import { formatPrice, getPropertyTypeLabel, truncate, cn } from '@/lib/utils'

interface PropertyCardProps {
  property: {
    id: string; title: string; slug: string; price: any; priceUnit: string
    location: string; city: string; type: string; bedrooms: number; bathrooms: number
    area?: number | null; featured: boolean; images: { url: string; alt?: string | null }[]
  }
  className?: string
}

export function PropertyCard({ property, className }: PropertyCardProps) {
  const [liked, setLiked] = useState(false)
  const image = property.images[0]

  return (
    <article className={cn(
      'group bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200/60 dark:border-slate-800/60 hover:border-orange-200 dark:hover:border-orange-900 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all duration-300 hover:-translate-y-1',
      className
    )}>
      <Link href={`/properties/${property.slug}`} className="block relative h-52 overflow-hidden">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt ?? property.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            quality={70}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
            <span className="text-slate-400 text-sm">No image</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="px-2.5 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg">
            {getPropertyTypeLabel(property.type)}
          </span>
          {property.featured && (
            <span className="px-2.5 py-1 bg-orange-500 text-white text-xs font-semibold rounded-lg">Featured</span>
          )}
        </div>
        <button
          onClick={(e) => { e.preventDefault(); setLiked(!liked) }}
          className="absolute top-3 right-3 w-8 h-8 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg flex items-center justify-center transition-all hover:scale-110"
        >
          <Heart className={cn('w-4 h-4 transition-colors', liked ? 'fill-red-500 text-red-500' : 'text-slate-400')} />
        </button>
      </Link>

      <div className="p-5">
        <p className="font-display font-bold text-orange-500 text-xl mb-3">
          {formatPrice(property.price, property.priceUnit)}
        </p>
        <Link href={`/properties/${property.slug}`}>
          <h3 className="font-display font-semibold text-slate-900 dark:text-white text-base mb-2 hover:text-orange-600 dark:hover:text-orange-400 transition-colors leading-snug">
            {truncate(property.title, 55)}
          </h3>
        </Link>
        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-sm mb-4">
          <MapPin className="w-3.5 h-3.5 shrink-0 text-orange-400" />
          <span className="truncate">{property.location}, {property.city}</span>
        </div>
        <div className="flex items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-sm">
          {property.bedrooms > 0 && (
            <div className="flex items-center gap-1.5">
              <Bed className="w-4 h-4 text-slate-400" />
              <span>{property.bedrooms} Bed{property.bedrooms !== 1 ? 's' : ''}</span>
            </div>
          )}
          {property.bathrooms > 0 && (
            <div className="flex items-center gap-1.5">
              <Bath className="w-4 h-4 text-slate-400" />
              <span>{property.bathrooms} Bath{property.bathrooms !== 1 ? 's' : ''}</span>
            </div>
          )}
          {property.area && (
            <div className="flex items-center gap-1.5 ml-auto">
              <Maximize className="w-4 h-4 text-slate-400" />
              <span>{property.area}m²</span>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
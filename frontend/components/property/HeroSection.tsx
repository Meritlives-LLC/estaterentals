'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Search, MapPin, Home, DollarSign, Tag } from 'lucide-react'
import { buildQueryString } from '@/lib/utils'

const listingTypes = [
  { value: '', label: 'Rent or Buy' },
  { value: 'RENT', label: 'For Rent' },
  { value: 'SALE', label: 'For Sale' },
]

const propertyTypes = [
  { value: '', label: 'All Types' },
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'HOUSE', label: 'House' },
  { value: 'STUDIO', label: 'Studio' },
  { value: 'DUPLEX', label: 'Duplex' },
  { value: 'PENTHOUSE', label: 'Penthouse' },
]

const priceRanges = [
  { value: '', label: 'Any Price' },
  { value: '0-150000', label: 'Under ₦150k/mo' },
  { value: '150000-350000', label: '₦150k–₦350k/mo' },
  { value: '350000-700000', label: '₦350k–₦700k/mo' },
  { value: '700000-99999999', label: 'Above ₦700k/mo' },
]

export function HeroSection() {
  const router = useRouter()
  const [location, setLocation] = useState('')
  const [type, setType] = useState('')
  const [priceRange, setPriceRange] = useState('')
  const [listingType, setListingType] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const [minPrice, maxPrice] = priceRange ? priceRange.split('-') : ['', '']
    router.push(`/properties?${buildQueryString({ search: location, type, minPrice, maxPrice, listingType })}`)
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Image
          src="https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1920&q=80"
          alt=""
          fill
          priority
          fetchPriority="high"
          quality={75}
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/75 via-slate-950/65 to-slate-950/85" />
      </div>

      <div className="relative z-10 container-max section-padding text-center py-32">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-300 text-sm font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          Premium Rentals &amp; Sales · Abuja, Nigeria
        </div>

        <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 leading-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-300 to-orange-500">
            JerryHomes
          </span>
        </h1>
        <h2 className="font-display text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
          Find Your Perfect Home in Abuja
        </h2>

        <p className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto mb-12">
          Discover luxury apartments, houses, duplexes and penthouses for <span className="text-orange-300 font-semibold">rent or sale</span> across Abuja&apos;s most prestigious neighbourhoods.
        </p>

        {/* Search Form */}
        <form onSubmit={handleSearch}
          className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-2 md:p-3 max-w-4xl mx-auto shadow-2xl"
        >
          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-xl px-4 py-3 min-w-[160px]">
              <Tag className="w-5 h-5 text-orange-500 shrink-0" />
              <select value={listingType} onChange={(e) => setListingType(e.target.value)}
                className="w-full bg-transparent text-slate-900 dark:text-white text-sm outline-none cursor-pointer"
              >
                {listingTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="flex-1 flex items-center gap-3 bg-white dark:bg-slate-900 rounded-xl px-4 py-3">
              <MapPin className="w-5 h-5 text-orange-500 shrink-0" />
              <input
                type="text"
                placeholder="Location or neighbourhood..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 text-sm outline-none"
              />
            </div>

            <div className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-xl px-4 py-3 min-w-[160px]">
              <Home className="w-5 h-5 text-orange-500 shrink-0" />
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full bg-transparent text-slate-900 dark:text-white text-sm outline-none cursor-pointer"
              >
                {propertyTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-xl px-4 py-3 min-w-[180px]">
              <DollarSign className="w-5 h-5 text-orange-500 shrink-0" />
              <select value={priceRange} onChange={(e) => setPriceRange(e.target.value)}
                className="w-full bg-transparent text-slate-900 dark:text-white text-sm outline-none cursor-pointer"
              >
                {priceRanges.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            <button type="submit"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-center gap-6 mt-10">
          {[
            { label: 'Properties Listed', value: '50+' },
            { label: 'Happy Clients', value: '200+' },
            { label: 'Areas Covered', value: '15+' },
          ].map((stat, i) => (
            <div key={stat.label} className="flex items-center gap-2 text-white/80 text-sm">
              <span className="font-display font-bold text-white text-base">{stat.value}</span>
              <span>{stat.label}</span>
              {i < 2 && <span className="w-1 h-1 rounded-full bg-white/30" />}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/50 animate-bounce">
        <span className="text-xs">Scroll</span>
        <div className="w-px h-8 bg-gradient-to-b from-white/50 to-transparent" />
      </div>
    </section>
  )
}
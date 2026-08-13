'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PropertySchema, type PropertyFormData } from '@/lib/validations'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { propertyApi, uploadApi } from '@/lib/api'
import {
  Upload, X, Plus, CheckCircle, AlertCircle,
  Loader2, ImagePlus, Copy, ExternalLink, MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const MAX_IMAGES = 5

const PROPERTY_TYPES = ['APARTMENT','HOUSE','STUDIO','DUPLEX','PENTHOUSE','COMMERCIAL','LAND']
const PRICE_UNITS = ['MONTH','YEAR','WEEK','DAY']
const STATUS_OPTIONS = ['ACTIVE','INACTIVE','RENTED']
const AMENITY_PRESETS = [
  'Swimming Pool','24/7 Security','CCTV','Generator','Parking','Gym & Fitness',
  'WiFi/Internet','Air Conditioning','Borehole Water','Boys Quarters',
  'Smart Home System','Private Garden','Concierge Service','Elevator',
  'Rooftop Access','Solar Power',
]

const inputCls =
  'w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm placeholder-slate-400 outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition'

interface UploadedImage {
  url: string
  publicId: string
  alt?: string
}

export function PropertyForm({ property }: { property?: any }) {
  const router = useRouter()
  const isEditing = !!property
  const fileRef = useRef<HTMLInputElement>(null)

  const [images, setImages] = useState<UploadedImage[]>(property?.images ?? [])
  const [amenitiesList, setAmenitiesList] = useState<string[]>(
    property?.amenities?.map((a: any) => a.name) ?? []
  )
  const [newAmenity, setNewAmenity] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string[]>([])
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    property?.latitude && property?.longitude
      ? { lat: property.latitude, lng: property.longitude }
      : null
  )
  const [geocoding, setGeocoding] = useState(false)

  const geocode = useCallback(async (address: string, city: string, state: string) => {
    const query = [address, city, state, 'Nigeria'].filter(Boolean).join(', ')
    if (query.replace(/,/g, '').trim().length < 5) return
    setGeocoding(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data = await res.json()
      if (data[0]) {
        setCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
      }
    } catch (e) {
      console.error('Geocode failed', e)
    } finally {
      setGeocoding(false)
    }
  }, [])

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<PropertyFormData>({
    resolver: zodResolver(PropertySchema),
    defaultValues: property
      ? {
          title: property.title,
          description: property.description,
          price: Number(property.price),
          priceUnit: property.priceUnit,
          location: property.location,
          city: property.city,
          state: property.state,
          address: property.address,
          type: property.type,
          status: property.status,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          area: property.area ?? undefined,
          featured: property.featured,
        }
      : { priceUnit: 'MONTH', status: 'ACTIVE', bedrooms: 1, bathrooms: 1, featured: false },
  })

  const watchedAddress = watch('address')
  const watchedCity = watch('city')
  const watchedState = watch('state')

  useEffect(() => {
    const timer = setTimeout(() => {
      if (watchedAddress && watchedCity && watchedState) {
        geocode(watchedAddress, watchedCity, watchedState)
      }
    }, 1200)
    return () => clearTimeout(timer)
  }, [watchedAddress, watchedCity, watchedState, geocode])

  const uploadImages = async (files: FileList) => {
    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) return
    const toUpload = Array.from(files).slice(0, remaining)
    setUploading(true)
    setUploadProgress(toUpload.map((f) => f.name))

    for (let i = 0; i < toUpload.length; i++) {
      const file = toUpload[i]
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await uploadApi.single(fd)
        setImages((prev) => [
          ...prev,
          { url: res.data.data.url, publicId: res.data.data.publicId, alt: file.name.split('.')[0] },
        ])
      } catch (e) {
        console.error('Upload failed for', file.name, e)
      }
      setUploadProgress((prev) => prev.filter((_, idx) => idx !== 0))
    }

    setUploading(false)
    setUploadProgress([])
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const addAmenity = (name: string) => {
    const trimmed = name.trim()
    if (trimmed && !amenitiesList.includes(trimmed)) {
      setAmenitiesList((prev) => [...prev, trimmed])
    }
    setNewAmenity('')
  }

  const onSubmit = async (data: PropertyFormData) => {
    setSubmitError('')
    const payload = { ...data, images, amenities: amenitiesList, latitude: coords?.lat, longitude: coords?.lng }
    try {
      let res
      if (isEditing) {
        res = await propertyApi.update(property.id, payload)
      } else {
        res = await propertyApi.create(payload)
      }
      setSavedSlug(res.data.data.slug)
      setSubmitted(true)
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error ?? 'Something went wrong. Please try again.')
    }
  }

  // ─── Success Screen ──────────────────────────────────
  if (submitted && savedSlug) {
    const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/properties/${savedSlug}`
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-2">
          {isEditing ? 'Property Updated!' : 'Property Added!'}
        </h3>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          Your listing is live and accessible at the link below.
        </p>
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 mb-6 text-left">
          <ExternalLink className="w-4 h-4 text-orange-500 shrink-0" />
          <span className="flex-1 text-sm font-mono text-slate-600 dark:text-slate-400 truncate">
            {publicUrl}
          </span>
          <button
            onClick={async () => { await navigator.clipboard.writeText(publicUrl) }}
            className="p-1.5 text-slate-400 hover:text-orange-500 rounded-lg transition-colors shrink-0"
            title="Copy link"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-orange-500/25 hover:-translate-y-0.5"
          >
            <ExternalLink className="w-4 h-4" />
            View Listing
          </a>
          <button
            onClick={() => router.push('/admin/dashboard/properties')}
            className="flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Back to Properties
          </button>
        </div>
      </div>
    )
  }

  // ─── Form ────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {submitError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {submitError}
        </div>
      )}

      {/* ── Images ──────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6">
        <h2 className="font-display font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <ImagePlus className="w-5 h-5 text-orange-500" />
          Property Photos
        </h2>
        <p className="text-slate-400 text-xs mb-4">
          Upload up to 5 photos so buyers and renters can view the property from different angles.
        </p>

        {/* Counter */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-slate-400">
            <span className={cn('font-bold text-sm', images.length >= MAX_IMAGES ? 'text-orange-500' : 'text-slate-700 dark:text-slate-200')}>
              {images.length}
            </span>
            {' '}/ {MAX_IMAGES} photos uploaded
          </p>
          {images.length >= MAX_IMAGES && (
            <span className="text-xs font-medium text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-2.5 py-1 rounded-lg">
              Maximum reached
            </span>
          )}
        </div>

        {/* Visual Grid — always show 5 slots */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-5">
          {images.map((img, i) => (
            <div key={img.publicId} className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-transparent hover:border-orange-400 transition-all">
              <Image src={img.url} alt={img.alt ?? `View ${i + 1}`} fill className="object-cover" sizes="160px" quality={60} loading="lazy" decoding="async" />
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 text-[9px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-md">
                  COVER
                </span>
              )}
              <span className="absolute top-1.5 right-1.5 text-[10px] font-semibold bg-black/50 text-white px-1.5 py-0.5 rounded-md">
                View {i + 1}
              </span>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {/* Empty slots */}
          {Array.from({ length: MAX_IMAGES - images.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              onClick={() => !uploading && images.length < MAX_IMAGES && fileRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1 text-slate-300 dark:text-slate-600 cursor-pointer hover:border-orange-400 hover:text-orange-400 transition-all"
            >
              <Plus className="w-5 h-5" />
              <span className="text-[10px] font-medium">Add</span>
            </div>
          ))}
        </div>

        {/* Upload Button */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || images.length >= MAX_IMAGES}
          className={cn(
            'w-full border-2 border-dashed rounded-2xl py-7 flex flex-col items-center gap-3 transition-all',
            uploading || images.length >= MAX_IMAGES
              ? 'opacity-40 cursor-not-allowed border-slate-300 dark:border-slate-700'
              : 'cursor-pointer border-slate-200 dark:border-slate-700 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/10 hover:text-orange-500 text-slate-400'
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
              <span className="text-sm font-medium text-orange-500">
                Uploading {uploadProgress[0] ?? '...'}
              </span>
            </>
          ) : images.length >= MAX_IMAGES ? (
            <>
              <CheckCircle className="w-7 h-7 text-green-500" />
              <p className="text-sm font-medium text-green-600 dark:text-green-400">All 5 views uploaded</p>
            </>
          ) : (
            <>
              <Upload className="w-7 h-7" />
              <div className="text-center">
                <p className="text-sm font-medium">Click to upload property photos</p>
                <p className="text-xs mt-1">
                  JPG, PNG, WebP · max 10MB each · {MAX_IMAGES - images.length} slot{MAX_IMAGES - images.length !== 1 ? 's' : ''} remaining
                </p>
              </div>
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadImages(e.target.files)}
        />
      </div>

      {/* ── Basic Info ──────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6">
        <h2 className="font-display font-semibold text-slate-900 dark:text-white mb-5">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input {...register('title')} placeholder="e.g. Luxury 3-Bedroom Apartment in Maitama" className={inputCls} />
            {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Type <span className="text-red-400">*</span></label>
            <select {...register('type')} className={inputCls + ' cursor-pointer'}>
              <option value="">Select type...</option>
              {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.type && <p className="text-red-400 text-xs mt-1">{errors.type.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Status</label>
            <select {...register('status')} className={inputCls + ' cursor-pointer'}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Price (₦) <span className="text-red-400">*</span></label>
            <input {...register('price')} type="number" placeholder="e.g. 250000" className={inputCls} />
            {errors.price && <p className="text-red-400 text-xs mt-1">{errors.price.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Price Per</label>
            <select {...register('priceUnit')} className={inputCls + ' cursor-pointer'}>
              {PRICE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Bedrooms</label>
            <input {...register('bedrooms')} type="number" min={0} className={inputCls} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Bathrooms</label>
            <input {...register('bathrooms')} type="number" min={0} className={inputCls} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Area (m²)</label>
            <input {...register('area')} type="number" placeholder="e.g. 150" className={inputCls} />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input {...register('featured')} type="checkbox" id="featured" className="w-4 h-4 accent-orange-500 cursor-pointer" />
            <label htmlFor="featured" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              Feature on homepage
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              {...register('description')}
              rows={5}
              placeholder="Describe the property in detail..."
              className={inputCls + ' resize-none'}
            />
            {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description.message}</p>}
          </div>
        </div>
      </div>

      {/* ── Location ────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6">
        <h2 className="font-display font-semibold text-slate-900 dark:text-white mb-5">Location Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { name: 'address', label: 'Full Address', placeholder: '123 Example Street, Abuja', span: true },
            { name: 'location', label: 'Neighbourhood / Area', placeholder: 'e.g. Maitama District' },
            { name: 'city', label: 'City', placeholder: 'e.g. Abuja' },
            { name: 'state', label: 'State', placeholder: 'e.g. FCT' },
          ].map(({ name, label, placeholder, span }) => (
            <div key={name} className={span ? 'md:col-span-2' : ''}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {label} <span className="text-red-400">*</span>
              </label>
              <input {...register(name as any)} placeholder={placeholder} className={inputCls} />
              {(errors as any)[name] && (
                <p className="text-red-400 text-xs mt-1">{(errors as any)[name]?.message}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Map Coordinates (auto-detected) ───────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6">
        <h2 className="font-display font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-orange-500" />
          Map Coordinates
        </h2>
        <p className="text-slate-400 text-xs mb-4">
          Automatically detected from the address. No action needed.
        </p>
        <div className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl text-sm",
          geocoding
            ? "bg-orange-50 dark:bg-orange-950/30 text-orange-600"
            : coords
            ? "bg-green-50 dark:bg-green-950/30 text-green-600"
            : "bg-slate-50 dark:bg-slate-800 text-slate-400"
        )}>
          {geocoding ? (
            <><Loader2 className="w-4 h-4 animate-spin shrink-0" /> Detecting location from address...</>
          ) : coords ? (
            <><CheckCircle className="w-4 h-4 shrink-0" /> Location detected — Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}</>
          ) : (
            <><MapPin className="w-4 h-4 shrink-0" /> Fill in the address above to auto-detect coordinates</>
          )}
        </div>
      </div>

      {/* ── Amenities ───────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6">
        <h2 className="font-display font-semibold text-slate-900 dark:text-white mb-4">Amenities & Features</h2>

        {amenitiesList.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {amenitiesList.map((a) => (
              <span key={a} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-900 text-orange-700 dark:text-orange-400 text-sm rounded-lg">
                {a}
                <button
                  type="button"
                  onClick={() => setAmenitiesList((p) => p.filter((x) => x !== a))}
                  className="text-orange-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {AMENITY_PRESETS.filter((a) => !amenitiesList.includes(a)).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => addAmenity(a)}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs rounded-lg hover:border-orange-300 hover:text-orange-600 transition-all"
            >
              <Plus className="w-3 h-3" />
              {a}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newAmenity}
            onChange={(e) => setNewAmenity(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAmenity(newAmenity) } }}
            placeholder="Add custom amenity..."
            className={inputCls + ' flex-1'}
          />
          <button
            type="button"
            onClick={() => addAmenity(newAmenity)}
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Submit ──────────────────────────────────────── */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isSubmitting || uploading}
          className="flex items-center gap-2 px-8 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-medium transition-all shadow-lg shadow-orange-500/25 hover:-translate-y-0.5 active:translate-y-0"
        >
          {isSubmitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            : <><CheckCircle className="w-4 h-4" /> {isEditing ? 'Update Property' : 'Add Property'}</>
          }
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/dashboard/properties')}
          className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

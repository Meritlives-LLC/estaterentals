// frontend/app/(public)/properties/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { propertyApi } from '@/lib/api'
import { formatPrice, getPropertyTypeLabel } from '@/lib/utils'
import { ContactPropertyForm } from '@/components/property/ContactPropertyForm'
import { PropertyGallery } from '@/components/property/PropertyGallery'
import { PropertyVideoPlayer } from '@/components/property/PropertyVideoPlayer'
import { PropertyMap } from '@/components/property/PropertyMap'
import { Bed, Bath, Maximize, MapPin, CheckCircle, Phone, MessageCircle, Calendar } from 'lucide-react'

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [property, setProperty] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    propertyApi.getBySlug(id)
      .then((res) => setProperty(res.data.data))
      .catch(() => setProperty(null))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen pt-20 bg-white dark:bg-slate-950">
        <div className="container-max section-padding py-10">
          <div className="animate-pulse space-y-6">
            <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
          </div>
        </div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-2">Property Not Found</h1>
          <a href="/properties" className="text-orange-500 hover:text-orange-600">← Browse all properties</a>
        </div>
      </div>
    )
  }

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '2348012345678'
  const whatsappMsg = encodeURIComponent(
    `Hello, I'm interested in: ${property.title} (${formatPrice(property.price, property.priceUnit)}). Please share more details.`
  )

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 pt-16">
      <div className="container-max section-padding py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main */}
          <div className="lg:col-span-2 space-y-8">
            <PropertyGallery images={property.images} title={property.title} />

            {property.videos?.length > 0 && (
              <PropertyVideoPlayer videos={property.videos} propertyTitle={property.title} />
            )}

            <div>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400 text-xs font-semibold rounded-lg">
                      {getPropertyTypeLabel(property.type)}
                    </span>
                    {property.featured && (
                      <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950 text-amber-600 text-xs font-semibold rounded-lg">Featured</span>
                    )}
                    <span className="px-2.5 py-1 bg-green-50 dark:bg-green-950 text-green-600 text-xs font-semibold rounded-lg">Available</span>
                  </div>
                  <h1 className="font-display text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-3">{property.title}</h1>
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <MapPin className="w-4 h-4 text-orange-500" />
                    <span>{property.address}, {property.city}, {property.state}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display font-bold text-3xl text-orange-500">
                    {formatPrice(property.price, property.priceUnit)}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">{property.viewCount} views</p>
                </div>
              </div>
            </div>

            {/* Specs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Bed, label: 'Bedrooms', value: property.bedrooms },
                { icon: Bath, label: 'Bathrooms', value: property.bathrooms },
                ...(property.area ? [{ icon: Maximize, label: 'Area', value: `${property.area}m²` }] : []),
                { icon: Calendar, label: 'Listed', value: new Date(property.createdAt).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' }) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 bg-orange-50 dark:bg-orange-950 rounded-lg flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{value}</p>
                    <p className="text-slate-500 text-xs">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Description */}
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white mb-4">About This Property</h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">{property.description}</p>
            </div>

            {/* Amenities */}
            {property.amenities?.length > 0 && (
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white mb-4">Amenities & Features</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {property.amenities.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                      <CheckCircle className="w-4 h-4 text-orange-500 shrink-0" />
                      <span className="text-slate-700 dark:text-slate-300 text-sm font-medium">{a.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Map */}
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white mb-4">Location</h2>
              {property.latitude && property.longitude ? (
                <PropertyMap
                  latitude={property.latitude}
                  longitude={property.longitude}
                  title={property.title}
                  address={`${property.address}, ${property.city}`}
                />
              ) : (
                <div className="rounded-2xl overflow-hidden h-72 bg-slate-100 dark:bg-slate-900">
                  <iframe
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(`${property.address}, ${property.city}, Nigeria`)}&output=embed`}
                    className="w-full h-full border-0"
                    loading="lazy"
                    title="Property Location"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sticky top-24">
              <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-1">Interested?</h3>
              <p className="text-slate-500 text-sm mb-5">Contact us to schedule a viewing.</p>

              <div className="space-y-3 mb-6">
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${whatsappMsg}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-all shadow-lg hover:-translate-y-0.5"
                >
                  <MessageCircle className="w-5 h-5" />
                  Chat on WhatsApp
                </a>
                <a
                  href={`tel:${whatsappNumber}`}
                  className="flex items-center justify-center gap-3 w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all shadow-lg hover:-translate-y-0.5"
                >
                  <Phone className="w-5 h-5" />
                  Call Now
                </a>
              </div>

              <div className="relative mb-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100 dark:border-slate-800" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 text-xs text-slate-400 bg-white dark:bg-slate-900">or send a message</span>
                </div>
              </div>

              <ContactPropertyForm propertyId={property.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// backend/src/controllers/property.controller.ts
import { Response } from 'express'
import { prisma } from '../lib/prisma'
import { deleteImage } from '../lib/cloudinary'
import { deleteBunnyVideo } from '../lib/bunny'
import {
  PropertySchema,
  PropertyPatchSchema,
  PropertyFilterSchema,
  PropertyLocationSchema,
} from '../utils/validations'
import { slugify, paginate, buildResponse } from '../utils/helpers'
import { logActivity, getRequestMeta } from '../lib/activity'
import { AuthRequest } from '../middleware/auth.middleware'

const GEOCODE_CACHE_TTL_MS = 1000 * 60 * 60 * 24
const GEOCODE_CACHE_MAX_ENTRIES = 500
const geocodeCache = new Map<string, { expiresAt: number; value: { latitude: number; longitude: number; displayName: string } }>()

function normalizeGeocodeQuery(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function purgeExpiredGeocodeCache() {
  const now = Date.now()
  for (const [key, entry] of geocodeCache.entries()) {
    if (entry.expiresAt <= now) geocodeCache.delete(key)
  }
}

function getCachedGeocodeResult(query: string) {
  purgeExpiredGeocodeCache()
  const key = normalizeGeocodeQuery(query)
  const cached = geocodeCache.get(key)
  if (!cached || cached.expiresAt <= Date.now()) {
    geocodeCache.delete(key)
    return null
  }
  return cached.value
}

function setCachedGeocodeResult(query: string, value: { latitude: number; longitude: number; displayName: string }) {
  purgeExpiredGeocodeCache()
  const key = normalizeGeocodeQuery(query)
  if (geocodeCache.size >= GEOCODE_CACHE_MAX_ENTRIES) {
    const oldestKey = geocodeCache.keys().next().value
    if (oldestKey) geocodeCache.delete(oldestKey)
  }
  geocodeCache.set(key, { expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS, value })
}

async function assertPropertyAccess(user: { id: string; role: string }, propertyId: string, res: Response) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId, deletedAt: null },
    select: { id: true, createdById: true },
  })

  if (!property) {
    res.status(404).json({ success: false, error: 'Property not found' })
    return null
  }

  if (user.role === 'STAFF' && property.createdById !== user.id) {
    res.status(403).json({ success: false, error: 'You do not have permission to manage this property' })
    return null
  }

  return property
}

export async function getProperties(req: any, res: Response) {
  const filters = PropertyFilterSchema.parse(req.query)
  const { skip, take, page, limit } = paginate(filters.page, filters.limit)

  const where: any = { deletedAt: null }

  if (filters.status) where.status = filters.status
  else where.status = 'ACTIVE'

  if (filters.listingType) where.listingType = filters.listingType
  if (filters.type) where.type = filters.type
  if (filters.city) where.city = { contains: filters.city, mode: 'insensitive' }
  if (filters.featured !== undefined) where.featured = filters.featured
  if (filters.bedrooms) where.bedrooms = { gte: filters.bedrooms }
  if (filters.minPrice || filters.maxPrice) {
    where.price = {}
    if (filters.minPrice) where.price.gte = filters.minPrice
    if (filters.maxPrice) where.price.lte = filters.maxPrice
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { location: { contains: filters.search, mode: 'insensitive' } },
      { city: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      include: {
        images: { orderBy: { order: 'asc' } },
        videos: { orderBy: { order: 'asc' } },
        amenities: true,
      },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
    }),
    prisma.property.count({ where }),
  ])

  // Serialize BigInt size fields
  const safe = properties.map((p) => ({
    ...p,
    videos: p.videos.map((v) => ({ ...v, size: v.size ? Number(v.size) : null })),
  }))

  return res.status(200).json(
    buildResponse({
      properties: safe,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  )
}

export async function getAdminProperties(req: AuthRequest, res: Response) {
  const filters = PropertyFilterSchema.parse(req.query)
  const { skip, take, page, limit } = paginate(filters.page, filters.limit)

  const where: any = { deletedAt: null }

  if (req.user!.role === 'STAFF') {
    where.createdById = req.user!.id
  }

  if (filters.status) where.status = filters.status
  if (filters.type) where.type = filters.type
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { city: { contains: filters.search, mode: 'insensitive' } },
      { location: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      include: {
        images: { orderBy: { order: 'asc' }, take: 1 },
        videos: { orderBy: { order: 'asc' }, take: 1 },
        createdBy: { select: { id: true, name: true, username: true, role: true } },
        updatedBy: { select: { id: true, name: true, username: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.property.count({ where }),
  ])

  const safe = properties.map((p) => ({
    ...p,
    videos: p.videos.map((v) => ({ ...v, size: v.size ? Number(v.size) : null })),
  }))

  return res.status(200).json(
    buildResponse({
      properties: safe,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  )
}

export async function getPropertyBySlug(req: any, res: Response) {
  const { slug } = req.params

  const property = await prisma.property.findFirst({
    where: { OR: [{ slug }, { id: slug }], deletedAt: null, status: 'ACTIVE' },
    include: {
      images: { orderBy: { order: 'asc' } },
      videos: { orderBy: { order: 'asc' } },
      amenities: true,
    },
  })

  if (!property) {
    return res.status(404).json({ success: false, error: 'Property not found' })
  }

  const viewedCookieName = `viewed_${property.id}`
  const alreadyViewed = req.cookies?.[viewedCookieName]

  if (!alreadyViewed) {
    prisma.property
      .update({
        where: { id: property.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {})

    res.cookie(viewedCookieName, '1', {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    })
  }

  const safe = {
    ...property,
    videos: property.videos.map((v) => ({ ...v, size: v.size ? Number(v.size) : null })),
  }

  return res.status(200).json(buildResponse(safe))
}

export async function getPropertyById(req: AuthRequest, res: Response) {
  const { id } = req.params

  const accessible = await assertPropertyAccess(req.user!, id, res)
  if (!accessible) return

  const property = await prisma.property.findUnique({
    where: { id, deletedAt: null },
    include: {
      images: { orderBy: { order: 'asc' } },
      videos: { orderBy: { order: 'asc' } },
      amenities: true,
      createdBy: { select: { id: true, name: true, username: true, role: true } },
      updatedBy: { select: { id: true, name: true, username: true, role: true } },
    },
  })

  if (!property) {
    return res.status(404).json({ success: false, error: 'Property not found' })
  }

  const safe = {
    ...property,
    videos: property.videos.map((v) => ({ ...v, size: v.size ? Number(v.size) : null })),
  }

  return res.status(200).json(buildResponse(safe))
}

export async function geocodePropertyAddress(req: AuthRequest, res: Response) {
  const query = req.query as Record<string, string | undefined>
  const address = query.address?.trim() || ''
  const city = query.city?.trim() || ''
  const state = query.state?.trim() || ''
  const country = query.country?.trim() || 'Nigeria'
  const combined = [address, city, state, country].filter(Boolean).join(', ')
  const normalizedCombined = combined.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim()

  if (!normalizedCombined || normalizedCombined.replace(/,/g, '').trim().length < 5) {
    return res.status(400).json({ success: false, error: 'A valid address is required to geocode' })
  }

  const cached = getCachedGeocodeResult(normalizedCombined)
  if (cached) {
    return res.status(200).json(buildResponse(cached, 'Location found'))
  }

  const baseUrl = process.env.GEOCODING_BASE_URL ?? 'https://nominatim.openstreetmap.org/search'
  const userAgent = process.env.GEOCODING_USER_AGENT ?? 'JerryHomes/1.0'
  const url = new URL(baseUrl)
  url.searchParams.set('q', `${normalizedCombined}, Nigeria`)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('countrycodes', 'ng')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': userAgent,
      },
      signal: controller.signal,
    })

    if (response.status === 429) {
      return res.status(429).json({ success: false, error: 'Location service temporarily unavailable. Please try again shortly.' })
    }

    if (!response.ok) {
      return res.status(502).json({ success: false, error: 'Unable to find this address right now.' })
    }

    const data = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>
    const match = data[0]

    if (!match?.lat || !match?.lon) {
      return res.status(404).json({ success: false, error: 'Address not found. Please adjust the location manually.' })
    }

    const coordinates = {
      latitude: Number(match.lat),
      longitude: Number(match.lon),
      displayName: match.display_name || normalizedCombined,
    }

    setCachedGeocodeResult(normalizedCombined, coordinates)
    return res.status(200).json(buildResponse(coordinates, 'Location found'))
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      return res.status(504).json({ success: false, error: 'Location service timed out. Please adjust the location manually.' })
    }
    return res.status(502).json({ success: false, error: 'Location service temporarily unavailable.' })
  } finally {
    clearTimeout(timeout)
  }
}

export async function updatePropertyLocation(req: AuthRequest, res: Response) {
  const { id } = req.params
  const data = PropertyLocationSchema.parse(req.body)
  const meta = getRequestMeta(req)
  const actorId = req.user!.id

  const property = await prisma.property.findUnique({
    where: { id, deletedAt: null },
    select: { id: true, title: true, createdById: true, address: true },
  })

  if (!property) {
    return res.status(404).json({ success: false, error: 'Property not found' })
  }

  if (req.user!.role === 'STAFF' && property.createdById !== actorId) {
    return res.status(403).json({ success: false, error: 'You do not have permission to manage this property' })
  }

  const updated = await prisma.property.update({
    where: { id },
    data: {
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address ?? property.address,
      updatedById: actorId,
    },
  })

  await logActivity({
    userId: actorId,
    action: 'PROPERTY_LOCATION_UPDATED',
    description: `Location updated for property ${updated.title}`,
    entityType: 'Property',
    entityId: updated.id,
    ...meta,
    metadata: { propertyId: updated.id, latitude: updated.latitude, longitude: updated.longitude },
  })

  return res.status(200).json(buildResponse(updated, 'Property location updated'))
}

export async function createProperty(req: AuthRequest, res: Response) {
  const data = PropertySchema.parse(req.body)
  const { amenities, images, videos, ...propertyData } = data
  const meta = getRequestMeta(req)
  const actorId = req.user!.id

  let slug = slugify(propertyData.title)
  const existing = await prisma.property.findUnique({ where: { slug } })
  if (existing) slug = `${slug}-${Date.now()}`

  const property = await prisma.property.create({
    data: {
      ...propertyData,
      slug,
      createdById: actorId,
      updatedById: actorId,
      amenities: amenities?.length
        ? { create: amenities.map((name) => ({ name })) }
        : undefined,
      images: images?.length
        ? { create: images.map((img, i) => ({ ...img, order: img.order ?? i })) }
        : undefined,
      videos: videos?.length
        ? {
            create: videos.map((v, i) => ({
              videoId: v.videoId,
              url: v.url ?? null,
              thumbnailUrl: v.thumbnailUrl ?? null,
              title: v.title ?? null,
              duration: v.duration ?? null,
              width: v.width ?? null,
              height: v.height ?? null,
              format: v.format ?? null,
              size: v.size ? BigInt(v.size) : null,
              order: v.order ?? i,
            })),
          }
        : undefined,
    },
    include: { images: true, videos: true, amenities: true },
  })

  await logActivity({
    userId: actorId,
    action: 'PROPERTY_CREATED',
    description: `Property created: ${property.title}`,
    entityType: 'Property',
    entityId: property.id,
    ...meta,
  })

  const safe = {
    ...property,
    videos: property.videos.map((v) => ({ ...v, size: v.size ? Number(v.size) : null })),
  }

  return res.status(201).json(buildResponse(safe, 'Property created successfully'))
}

/**
 * IMPORTANT: Images and videos are managed independently.
 * This update does NOT delete existing videos unless the client
 * explicitly sends a videos array (then it replaces).
 * Prefer using dedicated video endpoints for media changes.
 */
export async function updateProperty(req: AuthRequest, res: Response) {
  const { id } = req.params
  const data = PropertySchema.parse(req.body)
  const { amenities, images, videos, ...propertyData } = data
  const meta = getRequestMeta(req)
  const actorId = req.user!.id

  const existing = await prisma.property.findUnique({
    where: { id },
    include: { images: true, videos: true },
  })
  if (!existing || existing.deletedAt) {
    return res.status(404).json({ success: false, error: 'Property not found' })
  }

  if (req.user!.role === 'STAFF' && existing.createdById !== actorId) {
    return res.status(403).json({ success: false, error: 'You do not have permission to manage this property' })
  }

  let slug = existing.slug
  if (existing.title !== propertyData.title) {
    const newSlug = slugify(propertyData.title)
    const conflict = await prisma.property.findFirst({
      where: { slug: newSlug, id: { not: id } },
    })
    slug = conflict ? `${newSlug}-${Date.now()}` : newSlug
  }

  const property = await prisma.$transaction(async (tx) => {
    // Always replace amenities (simple list)
    await tx.amenity.deleteMany({ where: { propertyId: id } })

    // Images: only replace if client sent images array (preserves previous behavior for forms)
    if (images !== undefined) {
      // Soft approach: delete DB records only; Cloudinary cleanup of removed ones happens client-side or separately
      await tx.propertyImage.deleteMany({ where: { propertyId: id } })
    }

    // Videos: DO NOT touch unless client explicitly sends videos array
    if (videos !== undefined) {
      // Client is sending the full desired video set — replace carefully
      await tx.propertyVideo.deleteMany({ where: { propertyId: id } })
    }

    return tx.property.update({
      where: { id },
      data: {
        ...propertyData,
        slug,
        updatedById: actorId,
        amenities: amenities?.length
          ? { create: amenities.map((name) => ({ name })) }
          : undefined,
        images:
          images !== undefined && images.length
            ? { create: images.map((img, i) => ({ ...img, order: img.order ?? i })) }
            : images !== undefined
              ? undefined
              : undefined,
        videos:
          videos !== undefined && videos.length
            ? {
                create: videos.map((v, i) => ({
                  videoId: v.videoId,
                  url: v.url ?? null,
                  thumbnailUrl: v.thumbnailUrl ?? null,
                  title: v.title ?? null,
                  duration: v.duration ?? null,
                  width: v.width ?? null,
                  height: v.height ?? null,
                  format: v.format ?? null,
                  size: v.size ? BigInt(v.size) : null,
                  order: v.order ?? i,
                })),
              }
            : undefined,
      },
      include: { images: true, videos: true, amenities: true },
    })
  })

  await logActivity({
    userId: actorId,
    action: 'PROPERTY_UPDATED',
    description: `Property updated: ${property.title}`,
    entityType: 'Property',
    entityId: property.id,
    ...meta,
  })

  const safe = {
    ...property,
    videos: property.videos.map((v) => ({ ...v, size: v.size ? Number(v.size) : null })),
  }

  return res.status(200).json(buildResponse(safe, 'Property updated successfully'))
}

export async function patchProperty(req: AuthRequest, res: Response) {
  const { id } = req.params
  const data = PropertyPatchSchema.parse(req.body)
  const meta = getRequestMeta(req)
  const actorId = req.user!.id

  const existing = await prisma.property.findUnique({
    where: { id, deletedAt: null },
    select: { id: true, createdById: true },
  })

  if (!existing) {
    return res.status(404).json({ success: false, error: 'Property not found' })
  }

  if (req.user!.role === 'STAFF' && existing.createdById !== actorId) {
    return res.status(403).json({ success: false, error: 'You do not have permission to manage this property' })
  }

  const property = await prisma.property.update({
    where: { id },
    data: { ...data, updatedById: actorId },
  })

  await logActivity({
    userId: actorId,
    action: 'PROPERTY_UPDATED',
    description: `Property patched: ${property.title}`,
    entityType: 'Property',
    entityId: property.id,
    ...meta,
  })

  return res.status(200).json(buildResponse(property, 'Property updated'))
}

export async function deleteProperty(req: AuthRequest, res: Response) {
  const { id } = req.params
  const meta = getRequestMeta(req)
  const actorId = req.user!.id

  const existing = await prisma.property.findUnique({
    where: { id, deletedAt: null },
    select: { id: true, title: true, createdById: true },
  })

  if (!existing) {
    return res.status(404).json({ success: false, error: 'Property not found' })
  }

  if (req.user!.role === 'STAFF' && existing.createdById !== actorId) {
    return res.status(403).json({ success: false, error: 'You do not have permission to manage this property' })
  }

  const property = await prisma.property.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: actorId },
    include: { images: true, videos: true },
  })

  // Clean up Cloudinary images (background)
  Promise.all(property.images.map((img) => deleteImage(img.publicId).catch(() => {}))).catch(() => {})

  // Clean up Bunny videos (background)
  Promise.all(property.videos.map((v) => deleteBunnyVideo(v.videoId).catch(() => {}))).catch(() => {})

  await logActivity({
    userId: actorId,
    action: 'PROPERTY_DELETED',
    description: `Property soft-deleted: ${property.title}`,
    entityType: 'Property',
    entityId: property.id,
    ...meta,
  })

  return res.status(200).json(buildResponse(null, 'Property deleted successfully'))
}

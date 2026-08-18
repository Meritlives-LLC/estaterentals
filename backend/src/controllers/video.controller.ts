// backend/src/controllers/video.controller.ts
import { Response } from 'express'
import { prisma } from '../lib/prisma'
import {
  createBunnyVideo,
  generateTusSignature,
  deleteBunnyVideo,
  getBunnyVideo,
  getBunnyPlaybackUrl,
  isBunnyConfigured,
} from '../lib/bunny'
import { VideoCompleteSchema } from '../utils/validations'
import { buildResponse } from '../utils/helpers'
import { logActivity, getRequestMeta } from '../lib/activity'
import { AuthRequest } from '../middleware/auth.middleware'

/**
 * Step 1: Create Bunny video object + return TUS upload credentials.
 * Frontend then uploads the file directly to Bunny via TUS.
 */
export async function createVideoUploadAuth(req: AuthRequest, res: Response) {
  if (!isBunnyConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Video uploads are not configured. Contact the administrator.',
    })
  }

  const { title, propertyId, videoId: existingVideoId } = req.body as {
    title?: string
    propertyId?: string
    /** When set, only refresh the TUS signature for this Bunny video (resume / retry). */
    videoId?: string
  }

  if (propertyId) {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: { id: true, createdById: true },
    })
    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' })
    }
    if (req.user!.role === 'STAFF' && property.createdById !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'You do not have permission to manage this property' })
    }
  }

  const videoTitle = title?.trim() || `Property video ${Date.now()}`
  let videoId: string
  let libraryId: string

  if (existingVideoId && typeof existingVideoId === 'string') {
    // Re-sign an existing Bunny video so the client can resume the same TUS upload
    videoId = existingVideoId
    libraryId = process.env.BUNNY_LIBRARY_ID as string
  } else {
    const created = await createBunnyVideo(videoTitle)
    videoId = created.videoId
    libraryId = created.libraryId
  }

  const auth = generateTusSignature(videoId, 7200) // 2 hours

  return res.status(200).json(
    buildResponse(
      {
        videoId,
        libraryId,
        signature: auth.signature,
        expirationTime: auth.expirationTime,
        endpoint: 'https://video.bunnycdn.com/tusupload',
        title: videoTitle,
        resumed: Boolean(existingVideoId),
      },
      existingVideoId ? 'Upload authorization refreshed' : 'Upload authorization created'
    )
  )
}

/**
 * Step 2: After successful TUS upload, register the video against a property.
 */
export async function completeVideoUpload(req: AuthRequest, res: Response) {
  const data = VideoCompleteSchema.parse(req.body)
  const meta = getRequestMeta(req)
  const actorId = req.user!.id

  const property = await prisma.property.findFirst({
    where: { id: data.propertyId, deletedAt: null },
    select: { id: true, title: true, createdById: true },
  })
  if (!property) {
    return res.status(404).json({ success: false, error: 'Property not found' })
  }
  if (req.user!.role === 'STAFF' && property.createdById !== req.user!.id) {
    return res.status(403).json({ success: false, error: 'You do not have permission to manage this property' })
  }

  // Fetch metadata from Bunny if available
  let bunnyMeta: Awaited<ReturnType<typeof getBunnyVideo>> = null
  try {
    bunnyMeta = await getBunnyVideo(data.videoId)
  } catch {
    // Non-fatal — video may still be processing
  }

  const maxOrder = await prisma.propertyVideo.aggregate({
    where: { propertyId: data.propertyId },
    _max: { order: true },
  })

  const playbackUrl = getBunnyPlaybackUrl(data.videoId)

  const video = await prisma.propertyVideo.create({
    data: {
      videoId: data.videoId,
      url: playbackUrl,
      thumbnailUrl: bunnyMeta?.thumbnailUrl ?? null,
      title: data.title ?? bunnyMeta?.title ?? null,
      duration: bunnyMeta?.length ?? null,
      width: bunnyMeta?.width ?? null,
      height: bunnyMeta?.height ?? null,
      size: bunnyMeta?.storageSize ? BigInt(bunnyMeta.storageSize) : null,
      order: data.order ?? (maxOrder._max.order ?? -1) + 1,
      propertyId: data.propertyId,
    },
  })

  await logActivity({
    userId: actorId,
    action: 'PROPERTY_VIDEO_UPLOADED',
    description: `Video uploaded for property ${property.title}`,
    entityType: 'PropertyVideo',
    entityId: video.id,
    ...meta,
    metadata: { propertyId: data.propertyId, bunnyVideoId: data.videoId },
  })

  return res.status(201).json(
    buildResponse(
      {
        ...video,
        size: video.size ? Number(video.size) : null,
      },
      'Video registered successfully'
    )
  )
}

/**
 * Delete a property video: remove from Bunny + DB.
 */
export async function deletePropertyVideo(req: AuthRequest, res: Response) {
  const { id } = req.params
  const meta = getRequestMeta(req)
  const actorId = req.user!.id

  const video = await prisma.propertyVideo.findUnique({
    where: { id },
    include: { property: { select: { id: true, title: true, createdById: true } } },
  })

  if (!video) {
    return res.status(404).json({ success: false, error: 'Video not found' })
  }

  if (req.user!.role === 'STAFF' && video.property.createdById !== req.user!.id) {
    return res.status(403).json({ success: false, error: 'You do not have permission to manage this property' })
  }

  // Delete from Bunny first; do not remove the DB record if Bunny rejects the delete.
  try {
    await deleteBunnyVideo(video.videoId)
  } catch (err) {
    console.error('[Video] Bunny deletion failed; preserving database record for retry:', err)
    return res.status(502).json({
      success: false,
      error: 'Video could not be removed from Bunny Stream. Please try again later.',
    })
  }

  await prisma.propertyVideo.delete({ where: { id } })

  await logActivity({
    userId: actorId,
    action: 'PROPERTY_VIDEO_DELETED',
    description: `Video deleted from property ${video.property.title}`,
    entityType: 'PropertyVideo',
    entityId: id,
    ...meta,
    metadata: { propertyId: video.propertyId, bunnyVideoId: video.videoId },
  })

  return res.status(200).json(buildResponse(null, 'Video deleted successfully'))
}

/**
 * Reorder videos for a property.
 */
export async function reorderVideos(req: AuthRequest, res: Response) {
  const { propertyId } = req.params
  const { videoIds } = req.body as { videoIds: string[] }

  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    return res.status(400).json({ success: false, error: 'videoIds array is required' })
  }

  const property = await prisma.property.findFirst({
    where: { id: propertyId, deletedAt: null },
    select: { id: true, title: true, createdById: true },
  })
  if (!property) {
    return res.status(404).json({ success: false, error: 'Property not found' })
  }
  if (req.user!.role === 'STAFF' && property.createdById !== req.user!.id) {
    return res.status(403).json({ success: false, error: 'You do not have permission to manage this property' })
  }

  await prisma.$transaction(
    videoIds.map((vid, index) =>
      prisma.propertyVideo.updateMany({
        where: { id: vid, propertyId },
        data: { order: index },
      })
    )
  )

  const videos = await prisma.propertyVideo.findMany({
    where: { propertyId },
    orderBy: { order: 'asc' },
  })

  return res.status(200).json(
    buildResponse(
      videos.map((v) => ({ ...v, size: v.size ? Number(v.size) : null })),
      'Videos reordered'
    )
  )
}

/**
 * List videos for a property (admin/staff).
 */
export async function listPropertyVideos(req: AuthRequest, res: Response) {
  const { propertyId } = req.params

  const property = await prisma.property.findFirst({
    where: { id: propertyId, deletedAt: null },
    select: { id: true, createdById: true },
  })

  if (!property) {
    return res.status(404).json({ success: false, error: 'Property not found' })
  }

  if (req.user!.role === 'STAFF' && property.createdById !== req.user!.id) {
    return res.status(403).json({ success: false, error: 'You do not have permission to manage this property' })
  }

  const videos = await prisma.propertyVideo.findMany({
    where: { propertyId },
    orderBy: { order: 'asc' },
  })

  return res.status(200).json(
    buildResponse(videos.map((v) => ({ ...v, size: v.size ? Number(v.size) : null })))
  )
}

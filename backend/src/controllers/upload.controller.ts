// backend/src/controllers/upload.controller.ts
import { Response } from 'express'
import { uploadImage, deleteImage } from '../lib/cloudinary'
import { buildResponse } from '../utils/helpers'
import { logActivity, getRequestMeta } from '../lib/activity'
import { AuthRequest } from '../middleware/auth.middleware'

export async function uploadSingle(req: AuthRequest, res: Response) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file provided' })
  }

  const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
  const result = await uploadImage(base64)

  const meta = getRequestMeta(req)
  await logActivity({
    userId: req.user?.id,
    action: 'PROPERTY_IMAGE_UPLOADED',
    description: 'Property image uploaded',
    entityType: 'PropertyImage',
    ...meta,
    metadata: { publicId: result.publicId },
  })

  return res.status(200).json(buildResponse(result, 'Image uploaded successfully'))
}

export async function uploadMultiple(req: AuthRequest, res: Response) {
  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
    return res.status(400).json({ success: false, error: 'No files provided' })
  }

  const uploads = await Promise.all(
    req.files.map((file) => {
      const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
      return uploadImage(base64)
    })
  )

  const meta = getRequestMeta(req)
  await logActivity({
    userId: req.user?.id,
    action: 'PROPERTY_IMAGE_UPLOADED',
    description: `${uploads.length} property images uploaded`,
    entityType: 'PropertyImage',
    ...meta,
    metadata: { count: uploads.length, publicIds: uploads.map((u) => u.publicId) },
  })

  return res.status(200).json(buildResponse(uploads, 'Images uploaded successfully'))
}

export async function removeImage(req: AuthRequest, res: Response) {
  const { publicId } = req.body

  if (!publicId) {
    return res.status(400).json({ success: false, error: 'publicId is required' })
  }

  await deleteImage(publicId)

  const meta = getRequestMeta(req)
  await logActivity({
    userId: req.user?.id,
    action: 'PROPERTY_IMAGE_DELETED',
    description: 'Property image deleted from Cloudinary',
    entityType: 'PropertyImage',
    ...meta,
    metadata: { publicId },
  })

  return res.status(200).json(buildResponse(null, 'Image deleted successfully'))
}

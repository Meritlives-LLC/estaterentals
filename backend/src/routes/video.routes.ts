// backend/src/routes/video.routes.ts
import { Router } from 'express'
import {
  createVideoUploadAuth,
  completeVideoUpload,
  deletePropertyVideo,
  reorderVideos,
  listPropertyVideos,
} from '../controllers/video.controller'
import { authenticate, requireStaffOrAdmin } from '../middleware/auth.middleware'

const router = Router()

// All video mutation routes require STAFF or ADMIN
router.post('/signature', authenticate, requireStaffOrAdmin, createVideoUploadAuth)
router.post('/complete', authenticate, requireStaffOrAdmin, completeVideoUpload)
router.delete('/:id', authenticate, requireStaffOrAdmin, deletePropertyVideo)
router.patch('/property/:propertyId/reorder', authenticate, requireStaffOrAdmin, reorderVideos)
router.get('/property/:propertyId', authenticate, requireStaffOrAdmin, listPropertyVideos)

export default router

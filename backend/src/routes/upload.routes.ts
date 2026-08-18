// backend/src/routes/upload.routes.ts
import { Router } from 'express'
import { uploadSingle, uploadMultiple, removeImage } from '../controllers/upload.controller'
import { authenticate, requireStaffOrAdmin } from '../middleware/auth.middleware'
import { upload, validateFileMagicBytes } from '../middleware/upload.middleware'

const router = Router()

// Staff + Admin can upload images
router.post(
  '/single',
  authenticate,
  requireStaffOrAdmin,
  upload.single('file'),
  validateFileMagicBytes,
  uploadSingle
)

router.post(
  '/multiple',
  authenticate,
  requireStaffOrAdmin,
  upload.array('files', 10),
  validateFileMagicBytes,
  uploadMultiple
)

router.delete('/', authenticate, requireStaffOrAdmin, removeImage)

export default router

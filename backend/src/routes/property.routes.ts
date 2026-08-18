// backend/src/routes/property.routes.ts
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
  getProperties,
  getAdminProperties,
  getPropertyBySlug,
  getPropertyById,
  createProperty,
  updateProperty,
  patchProperty,
  deleteProperty,
  geocodePropertyAddress,
  updatePropertyLocation,
} from '../controllers/property.controller'
import { authenticate, requireStaffOrAdmin } from '../middleware/auth.middleware'

const router = Router()

const geocodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  keyGenerator: (req) => (req as any).user?.id ?? req.ip ?? 'unknown',
  message: { success: false, error: 'Too many geocoding requests. Please slow down and try again shortly.' },
})

// --- Public Routes ---
router.get('/', getProperties)
router.get('/slug/:slug', getPropertyBySlug)

// --- Staff / Admin Routes ---
router.get('/admin', authenticate, requireStaffOrAdmin, getAdminProperties)
router.get('/geocode', authenticate, geocodeLimiter, requireStaffOrAdmin, geocodePropertyAddress)
router.get('/:id', authenticate, requireStaffOrAdmin, getPropertyById)
router.post('/', authenticate, requireStaffOrAdmin, createProperty)
router.put('/:id', authenticate, requireStaffOrAdmin, updateProperty)
router.patch('/:id/location', authenticate, requireStaffOrAdmin, updatePropertyLocation)
router.patch('/:id', authenticate, requireStaffOrAdmin, patchProperty)
router.delete('/:id', authenticate, requireStaffOrAdmin, deleteProperty)

export default router

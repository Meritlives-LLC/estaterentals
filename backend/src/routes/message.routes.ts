// backend/src/routes/message.routes.ts
import { Router } from 'express'
import {
  getMessages,
  createMessage,
  patchMessage,
  deleteMessage,
} from '../controllers/message.controller'
import { authenticate, requireStaffOrAdmin } from '../middleware/auth.middleware'
import rateLimit from 'express-rate-limit'

const contactFormLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Too many messages sent. Please wait 10 minutes before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

const router = Router()

// Public — rate-limited contact form
router.post('/', contactFormLimiter, createMessage)

// Staff + Admin
router.get('/', authenticate, requireStaffOrAdmin, getMessages)
router.patch('/:id', authenticate, requireStaffOrAdmin, patchMessage)
router.delete('/:id', authenticate, requireStaffOrAdmin, deleteMessage)

export default router

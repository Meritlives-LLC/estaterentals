// backend/src/routes/auth.routes.ts
import { Router } from 'express'
import {
  login,
  refresh,
  me,
  googleAuth,
  visitorRegister,
  visitorLogin,
  staffLogin,
  changePassword,
} from '../controllers/auth.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

// Admin / staff login (email or username)
router.post('/login', login)
router.post('/staff/login', staffLogin)
router.post('/refresh', refresh)
router.get('/me', authenticate, me)
router.post('/change-password', authenticate, changePassword)

// Visitor / Google OAuth routes
router.post('/google', googleAuth)
router.post('/visitor/register', visitorRegister)
router.post('/visitor/login', visitorLogin)

export default router

// backend/src/routes/dashboard.routes.ts
import { Router } from 'express'
import { getDashboardStats } from '../controllers/dashboard.controller'
import { authenticate, requireStaffOrAdmin } from '../middleware/auth.middleware'

const router = Router()

router.get('/stats', authenticate, requireStaffOrAdmin, getDashboardStats)

export default router

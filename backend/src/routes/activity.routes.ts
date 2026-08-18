// backend/src/routes/activity.routes.ts
import { Router } from 'express'
import { listActivity, getStaffActivity } from '../controllers/activity.controller'
import { authenticate, requireAdmin } from '../middleware/auth.middleware'

const router = Router()

// Activity monitoring is ADMIN / SUPER_ADMIN only
router.use(authenticate, requireAdmin)

router.get('/', listActivity)
router.get('/staff/:staffId', getStaffActivity)

export default router

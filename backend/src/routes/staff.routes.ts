// backend/src/routes/staff.routes.ts
import { Router } from 'express'
import {
  createStaff,
  listStaff,
  getStaff,
  updateStaff,
  setStaffStatus,
  deleteStaff,
} from '../controllers/staff.controller'
import { authenticate, requireAdmin } from '../middleware/auth.middleware'

const router = Router()

// All staff management requires ADMIN or SUPER_ADMIN
router.use(authenticate, requireAdmin)

router.post('/', createStaff)
router.get('/', listStaff)
router.get('/:id', getStaff)
router.patch('/:id', updateStaff)
router.patch('/:id/status', setStaffStatus)
router.delete('/:id', deleteStaff)

export default router

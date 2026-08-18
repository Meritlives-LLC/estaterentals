// backend/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/jwt'

export interface AuthRequest extends Request {
  user?: { id: string; email?: string | null; role: string; username?: string | null }
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' })
  }

  try {
    const payload = verifyAccessToken(token)
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }
}

/** ADMIN or SUPER_ADMIN only */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }
  if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, error: 'Admin access required' })
  }
  next()
}

/** SUPER_ADMIN only */
export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, error: 'Super Admin access required' })
  }
  next()
}

/**
 * STAFF, ADMIN, or SUPER_ADMIN — for property ops and messages.
 * Does NOT grant user/staff management rights.
 */
export function requireStaffOrAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }
  const allowed = ['STAFF', 'ADMIN', 'SUPER_ADMIN']
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Staff or Admin access required' })
  }
  next()
}

/** Any authenticated non-visitor role that can manage content */
export function requireContentManager(req: AuthRequest, res: Response, next: NextFunction) {
  return requireStaffOrAdmin(req, res, next)
}

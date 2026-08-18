// backend/src/lib/activity.ts
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { Request } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'

export type ActivityAction =
  | 'LOGIN'
  | 'LOGIN_SUCCESS'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'OTP_SENT'
  | 'OTP_VERIFIED'
  | 'OTP_FAILED'
  | 'PASSWORD_CHANGED'
  | 'ACCOUNT_CREATED'
  | 'PROFILE_UPDATED'
  | 'STAFF_CREATED'
  | 'STAFF_UPDATED'
  | 'STAFF_DISABLED'
  | 'STAFF_ENABLED'
  | 'STAFF_DELETED'
  | 'PROPERTY_CREATED'
  | 'PROPERTY_UPDATED'
  | 'PROPERTY_DELETED'
  | 'PROPERTY_LOCATION_UPDATED'
  | 'PROPERTY_IMAGE_UPLOADED'
  | 'PROPERTY_IMAGE_DELETED'
  | 'PROPERTY_VIDEO_UPLOADED'
  | 'PROPERTY_VIDEO_DELETED'
  | 'MESSAGE_RECEIVED'
  | 'MESSAGE_VIEWED'
  | 'MESSAGE_UPDATED'

interface LogActivityParams {
  userId?: string | null
  action: ActivityAction
  description?: string
  entityType?: string
  entityId?: string
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Prisma.InputJsonValue | null
}

/**
 * Record an activity/audit event.
 * Never store passwords, tokens, or secrets in metadata.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        description: params.description ?? null,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        metadata: params.metadata ?? undefined,
      },
    })
  } catch (err) {
    // Activity logging must never break the main request
    console.error('[ActivityLog] Failed to record activity:', err)
  }
}

export function getRequestMeta(req: Request | AuthRequest) {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  const userAgent = (req.headers['user-agent'] as string) || null
  return { ipAddress: ip, userAgent }
}

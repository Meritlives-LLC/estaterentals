// backend/src/controllers/activity.controller.ts
import { Response } from 'express'
import { prisma } from '../lib/prisma'
import { ActivityFilterSchema } from '../utils/validations'
import { buildResponse, paginate } from '../utils/helpers'
import { AuthRequest } from '../middleware/auth.middleware'

export async function listActivity(req: AuthRequest, res: Response) {
  const filters = ActivityFilterSchema.parse(req.query)
  const { skip, take, page, limit } = paginate(filters.page, filters.limit)

  const where: any = {}

  if (filters.userId) where.userId = filters.userId
  if (filters.action) where.action = filters.action
  if (filters.entityType) where.entityType = filters.entityType

  if (filters.role) {
    where.user = { role: filters.role }
  }

  if (filters.search) {
    where.OR = [
      { description: { contains: filters.search, mode: 'insensitive' } },
      { action: { contains: filters.search, mode: 'insensitive' } },
      { user: { name: { contains: filters.search, mode: 'insensitive' } } },
      { user: { email: { contains: filters.search, mode: 'insensitive' } } },
      { user: { username: { contains: filters.search, mode: 'insensitive' } } },
    ]
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.activityLog.count({ where }),
  ])

  return res.status(200).json(
    buildResponse({
      activities: logs,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  )
}

export async function getStaffActivity(req: AuthRequest, res: Response) {
  const { staffId } = req.params
  const page = Number(req.query.page) || 1
  const limit = Math.min(Number(req.query.limit) || 30, 50)
  const { skip, take } = paginate(page, limit)

  const staff = await prisma.user.findFirst({
    where: { id: staffId, role: 'STAFF' },
    select: { id: true, username: true, name: true },
  })

  if (!staff) {
    return res.status(404).json({ success: false, error: 'Staff member not found' })
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where: { userId: staffId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.activityLog.count({ where: { userId: staffId } }),
  ])

  return res.status(200).json(
    buildResponse({
      staff,
      activities: logs,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  )
}

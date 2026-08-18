// backend/src/controllers/staff.controller.ts
import { Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { CreateStaffSchema, UpdateStaffSchema } from '../utils/validations'
import { buildResponse, paginate } from '../utils/helpers'
import { logActivity, getRequestMeta } from '../lib/activity'
import { AuthRequest } from '../middleware/auth.middleware'
import { z } from 'zod'

const StaffFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'disabled', 'all']).optional().default('all'),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
})

export async function createStaff(req: AuthRequest, res: Response) {
  const data = CreateStaffSchema.parse(req.body)
  const meta = getRequestMeta(req)
  const actorId = req.user!.id

  const username = data.username.toLowerCase().trim()

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    return res.status(409).json({ success: false, error: 'Username already taken' })
  }

  const hashed = await bcrypt.hash(data.password, 12)

  // Internal email placeholder so unique email constraint is satisfied when email is optional
  // Prefer real null email when schema allows; fallback to synthetic unique email if needed
  const staff = await prisma.user.create({
    data: {
      username,
      name: data.name ?? null,
      password: hashed,
      role: 'STAFF',
      provider: 'local',
      isActive: true,
      email: null,
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  })

  await logActivity({
    userId: actorId,
    action: 'STAFF_CREATED',
    description: `Staff account created: ${username}`,
    entityType: 'User',
    entityId: staff.id,
    ...meta,
    metadata: { username, name: data.name },
  })

  return res.status(201).json(buildResponse(staff, 'Staff account created successfully'))
}

export async function listStaff(req: AuthRequest, res: Response) {
  const filters = StaffFilterSchema.parse(req.query)
  const { skip, take, page, limit } = paginate(filters.page, filters.limit)

  const where: any = { role: 'STAFF' }
  if (filters.status === 'active') where.isActive = true
  if (filters.status === 'disabled') where.isActive = false
  if (filters.search) {
    where.OR = [
      { username: { contains: filters.search, mode: 'insensitive' } },
      { name: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  const [staff, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: {
            createdProperties: true,
            updatedProperties: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ])

  return res.status(200).json(
    buildResponse({
      staff,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  )
}

export async function getStaff(req: AuthRequest, res: Response) {
  const { id } = req.params

  const staff = await prisma.user.findFirst({
    where: { id, role: 'STAFF' },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          createdProperties: true,
          updatedProperties: true,
        },
      },
    },
  })

  if (!staff) {
    return res.status(404).json({ success: false, error: 'Staff member not found' })
  }

  // Recent activity for this staff
  const recentActivity = await prisma.activityLog.findMany({
    where: { userId: id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  return res.status(200).json(
    buildResponse({
      ...staff,
      recentActivity,
    })
  )
}

export async function updateStaff(req: AuthRequest, res: Response) {
  const { id } = req.params
  const data = UpdateStaffSchema.parse(req.body)
  const meta = getRequestMeta(req)
  const actorId = req.user!.id

  const existing = await prisma.user.findFirst({ where: { id, role: 'STAFF' } })
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Staff member not found' })
  }

  const staff = await prisma.user.update({
    where: { id },
    data: {
      name: data.name ?? undefined,
      isActive: data.isActive ?? undefined,
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  })

  if (data.isActive === false && existing.isActive) {
    await logActivity({
      userId: actorId,
      action: 'STAFF_DISABLED',
      description: `Staff disabled: ${existing.username}`,
      entityType: 'User',
      entityId: id,
      ...meta,
    })
  } else if (data.isActive === true && !existing.isActive) {
    await logActivity({
      userId: actorId,
      action: 'STAFF_ENABLED',
      description: `Staff enabled: ${existing.username}`,
      entityType: 'User',
      entityId: id,
      ...meta,
    })
  } else {
    await logActivity({
      userId: actorId,
      action: 'STAFF_UPDATED',
      description: `Staff updated: ${existing.username}`,
      entityType: 'User',
      entityId: id,
      ...meta,
    })
  }

  return res.status(200).json(buildResponse(staff, 'Staff updated successfully'))
}

export async function setStaffStatus(req: AuthRequest, res: Response) {
  const { id } = req.params
  const { isActive } = req.body as { isActive: boolean }
  const meta = getRequestMeta(req)
  const actorId = req.user!.id

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, error: 'isActive boolean is required' })
  }

  const existing = await prisma.user.findFirst({ where: { id, role: 'STAFF' } })
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Staff member not found' })
  }

  const staff = await prisma.user.update({
    where: { id },
    data: { isActive },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
    },
  })

  await logActivity({
    userId: actorId,
    action: isActive ? 'STAFF_ENABLED' : 'STAFF_DISABLED',
    description: `Staff ${isActive ? 'enabled' : 'disabled'}: ${existing.username}`,
    entityType: 'User',
    entityId: id,
    ...meta,
  })

  return res.status(200).json(buildResponse(staff, `Staff ${isActive ? 'enabled' : 'disabled'} successfully`))
}

export async function deleteStaff(req: AuthRequest, res: Response) {
  const { id } = req.params
  const meta = getRequestMeta(req)
  const actorId = req.user!.id

  const existing = await prisma.user.findFirst({ where: { id, role: 'STAFF' } })
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Staff member not found' })
  }

  // Soft-disable rather than hard delete to preserve activity history & property ownership
  await prisma.user.update({
    where: { id },
    data: {
      isActive: false,
      // Keep username unique by suffixing on soft-delete
      username: `${existing.username}__deleted__${Date.now()}`,
    },
  })

  await logActivity({
    userId: actorId,
    action: 'STAFF_DELETED',
    description: `Staff soft-deleted: ${existing.username}`,
    entityType: 'User',
    entityId: id,
    ...meta,
  })

  return res.status(200).json(buildResponse(null, 'Staff account deleted successfully'))
}

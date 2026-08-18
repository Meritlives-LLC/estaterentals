// backend/src/controllers/auth.controller.ts
import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt'
import { LoginSchema, ChangePasswordSchema, StaffLoginSchema } from '../utils/validations'
import { buildResponse } from '../utils/helpers'
import { logActivity, getRequestMeta } from '../lib/activity'
import { AuthRequest } from '../middleware/auth.middleware'

// ─── Admin / Staff Login (email or username + password) ──────────────────
export async function login(req: Request, res: Response) {
  const data = LoginSchema.parse(req.body)
  const meta = getRequestMeta(req)

  // Support both email and username for staff/admin
  const identifier = data.email.toLowerCase().trim()

  let user = await prisma.user.findUnique({
    where: { email: identifier },
  })

  if (!user) {
    user = await prisma.user.findUnique({
      where: { username: identifier },
    })
  }

  if (!user || !user.password) {
    await logActivity({
      action: 'LOGIN_FAILED',
      description: `Failed login attempt for identifier: ${identifier}`,
      ...meta,
      metadata: { identifier },
    })
    return res.status(401).json({ success: false, error: 'Invalid credentials' })
  }

  // Only allow STAFF, ADMIN, SUPER_ADMIN on this endpoint
  if (user.role === 'VISITOR') {
    return res.status(403).json({ success: false, error: 'Access denied. Use visitor login.' })
  }

  if (user.isActive === false) {
    return res.status(403).json({ success: false, error: 'Account is disabled. Contact an administrator.' })
  }

  const isValid = await bcrypt.compare(data.password, user.password)
  if (!isValid) {
    await logActivity({
      userId: user.id,
      action: 'LOGIN_FAILED',
      description: `Failed login attempt for ${user.role}`,
      ...meta,
    })
    return res.status(401).json({ success: false, error: 'Invalid credentials' })
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  }
  const accessToken = generateAccessToken(payload)
  const refreshToken = generateRefreshToken(payload)

  await logActivity({
    userId: user.id,
    action: 'LOGIN',
    description: `${user.role} logged in`,
    ...meta,
  })

  return res.status(200).json(
    buildResponse(
      {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          role: user.role,
          image: user.image,
        },
      },
      'Login successful'
    )
  )
}

// ─── Dedicated staff login (username + password) ─────
export async function staffLogin(req: Request, res: Response) {
  const data = StaffLoginSchema.parse(req.body)
  const meta = getRequestMeta(req)

  const user = await prisma.user.findUnique({
    where: { username: data.username.toLowerCase().trim() },
  })

  if (!user || !user.password || user.role !== 'STAFF') {
    await logActivity({
      action: 'LOGIN_FAILED',
      description: `Failed staff login for username: ${data.username}`,
      ...meta,
    })
    return res.status(401).json({ success: false, error: 'Invalid credentials' })
  }

  if (user.isActive === false) {
    return res.status(403).json({ success: false, error: 'Account is disabled. Contact an administrator.' })
  }

  const isValid = await bcrypt.compare(data.password, user.password)
  if (!isValid) {
    await logActivity({
      userId: user.id,
      action: 'LOGIN_FAILED',
      description: 'Failed staff login',
      ...meta,
    })
    return res.status(401).json({ success: false, error: 'Invalid credentials' })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  }
  const accessToken = generateAccessToken(payload)
  const refreshToken = generateRefreshToken(payload)

  await logActivity({
    userId: user.id,
    action: 'LOGIN',
    description: 'Staff logged in',
    ...meta,
  })

  return res.status(200).json(
    buildResponse(
      {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          role: user.role,
        },
      },
      'Login successful'
    )
  )
}

// ─── Google OAuth (visitor sign-in) ──────────────────
export async function googleAuth(req: Request, res: Response) {
  const { idToken } = req.body
  const meta = getRequestMeta(req)

  if (!idToken) {
    return res.status(400).json({ success: false, error: 'Google ID token required' })
  }

  try {
    const googleRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    )

    if (!googleRes.ok) {
      return res.status(401).json({ success: false, error: 'Invalid Google token' })
    }

    const googleData = (await googleRes.json()) as {
      sub: string
      email: string
      name?: string
      picture?: string
      aud: string
      email_verified: string
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    if (clientId && googleData.aud !== clientId) {
      return res.status(401).json({ success: false, error: 'Token audience mismatch' })
    }

    if (googleData.email_verified !== 'true') {
      return res.status(401).json({ success: false, error: 'Google email not verified' })
    }

    const { sub: googleId, email, name, picture } = googleData

    let user = await prisma.user.findUnique({ where: { googleId } })

    if (!user) {
      const existingByEmail = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      })

      if (existingByEmail && existingByEmail.role !== 'VISITOR') {
        return res.status(403).json({
          success: false,
          error: 'Admin accounts cannot use Google sign-in. Use email/password login.',
        })
      }

      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name: name ?? null,
          image: picture ?? null,
          googleId,
          provider: 'google',
          role: 'VISITOR',
        },
      })

      await logActivity({
        userId: user.id,
        action: 'ACCOUNT_CREATED',
        description: 'Visitor account created via Google',
        entityType: 'User',
        entityId: user.id,
        ...meta,
      })
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: name ?? user.name, image: picture ?? user.image, lastLoginAt: new Date() },
      })
    }

    const payload = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    }
    const accessToken = generateAccessToken(payload)
    const refreshToken = generateRefreshToken(payload)

    await logActivity({
      userId: user.id,
      action: 'LOGIN',
      description: 'Visitor Google login',
      ...meta,
    })

    return res.status(200).json(
      buildResponse(
        {
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            image: user.image,
          },
        },
        'Google sign-in successful'
      )
    )
  } catch (err) {
    console.error('Google auth error:', err)
    return res.status(500).json({ success: false, error: 'Google authentication failed' })
  }
}

// ─── Visitor Register ─────────────────────────────────
export async function visitorRegister(req: Request, res: Response) {
  const { name, email, password } = req.body
  const meta = getRequestMeta(req)

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'Name, email, and password are required' })
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' })
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    return res.status(409).json({
      success: false,
      error:
        'Unable to create account with these details. Try signing in instead, or use a different email.',
    })
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'VISITOR',
      provider: 'local',
    },
  })

  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  }
  const accessToken = generateAccessToken(payload)
  const refreshToken = generateRefreshToken(payload)

  await logActivity({
    userId: user.id,
    action: 'ACCOUNT_CREATED',
    description: 'Visitor account created',
    entityType: 'User',
    entityId: user.id,
    ...meta,
  })

  return res.status(201).json(
    buildResponse(
      {
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      },
      'Account created successfully'
    )
  )
}

// ─── Visitor Login ────────────────────────────────────
export async function visitorLogin(req: Request, res: Response) {
  const { email, password } = req.body
  const meta = getRequestMeta(req)

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' })
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })

  if (!user || !user.password || user.role !== 'VISITOR') {
    await logActivity({
      action: 'LOGIN_FAILED',
      description: `Failed visitor login for ${email}`,
      ...meta,
    })
    return res.status(401).json({ success: false, error: 'Invalid credentials' })
  }

  if (user.isActive === false) {
    return res.status(403).json({ success: false, error: 'Account is disabled.' })
  }

  const isValid = await bcrypt.compare(password, user.password)
  if (!isValid) {
    await logActivity({
      userId: user.id,
      action: 'LOGIN_FAILED',
      description: 'Failed visitor login',
      ...meta,
    })
    return res.status(401).json({ success: false, error: 'Invalid credentials' })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  }
  const accessToken = generateAccessToken(payload)
  const refreshToken = generateRefreshToken(payload)

  await logActivity({
    userId: user.id,
    action: 'LOGIN',
    description: 'Visitor logged in',
    ...meta,
  })

  return res.status(200).json(
    buildResponse(
      {
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      },
      'Login successful'
    )
  )
}

// ─── Refresh Token ────────────────────────────────────
export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body

  if (!refreshToken) {
    return res.status(400).json({ success: false, error: 'Refresh token required' })
  }

  try {
    const payload = verifyRefreshToken(refreshToken)
    const user = await prisma.user.findUnique({ where: { id: payload.id } })

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' })
    }

    if (user.isActive === false) {
      return res.status(403).json({ success: false, error: 'Account is disabled' })
    }

    const newPayload = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    }
    const accessToken = generateAccessToken(newPayload)

    return res.status(200).json(buildResponse({ accessToken }, 'Token refreshed'))
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid refresh token' })
  }
}

// ─── Get Current User ─────────────────────────────────
export async function me(req: AuthRequest, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      image: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  })

  if (!user) return res.status(404).json({ success: false, error: 'User not found' })

  return res.status(200).json(buildResponse(user))
}

// ─── Change Own Password ──────────────────────────────
export async function changePassword(req: AuthRequest, res: Response) {
  const data = ChangePasswordSchema.parse(req.body)
  const meta = getRequestMeta(req)
  const userId = req.user!.id

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || !user.password) {
    return res.status(400).json({ success: false, error: 'Password change not available for this account' })
  }

  const isValid = await bcrypt.compare(data.currentPassword, user.password)
  if (!isValid) {
    return res.status(400).json({ success: false, error: 'Current password is incorrect' })
  }

  if (data.newPassword !== data.confirmPassword) {
    return res.status(400).json({ success: false, error: 'New password and confirmation do not match' })
  }

  if (data.newPassword.length < 8) {
    return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' })
  }

  const hashed = await bcrypt.hash(data.newPassword, 12)

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
  })

  await logActivity({
    userId,
    action: 'PASSWORD_CHANGED',
    description: 'User changed their own password',
    entityType: 'User',
    entityId: userId,
    ...meta,
  })

  return res.status(200).json(buildResponse(null, 'Password changed successfully'))
}

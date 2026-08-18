// backend/src/controllers/auth.controller.ts
import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt'
import {
  LoginSchema,
  ChangePasswordSchema,
  StaffLoginSchema,
  AdminOtpVerifySchema,
  AdminOtpResendSchema,
} from '../utils/validations'
import { buildResponse } from '../utils/helpers'
import { logActivity, getRequestMeta } from '../lib/activity'
import { AuthRequest } from '../middleware/auth.middleware'
import {
  generateOtpCode,
  hashOtp,
  verifyOtpHash,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_PURPOSE_ADMIN_LOGIN,
  isOtpExpired,
} from '../lib/otp'
import { sendAdminLoginOtp } from '../lib/email'
import { TokenPayload } from '../utils/jwt'

async function findUserByIdentifier(identifier: string) {
  const normalized = identifier.trim().toLowerCase()

  let user = await prisma.user.findUnique({
    where: { email: normalized },
  })

  if (!user) {
    user = await prisma.user.findUnique({
      where: { username: normalized },
    })
  }

  return user
}

async function issueAdminOtp(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true, role: true },
  })

  if (!user || !user.email) {
    throw new Error('Admin email not available for OTP issuance')
  }

  await prisma.emailOtp.updateMany({
    where: {
      userId,
      purpose: OTP_PURPOSE_ADMIN_LOGIN,
      usedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  })

  const otp = generateOtpCode()
  const otpHash = await hashOtp(otp)
  const expiresAt = new Date(Date.now() + OTP_TTL_MS)

  const otpRecord = await prisma.emailOtp.create({
    data: {
      userId,
      purpose: OTP_PURPOSE_ADMIN_LOGIN,
      codeHash: otpHash,
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt,
    },
  })

  const sent = await sendAdminLoginOtp(user.email, otp)
  if (!sent) {
    await prisma.emailOtp.update({
      where: { id: otpRecord.id },
      data: { revokedAt: new Date() },
    })
    throw new Error('Unable to send admin verification code')
  }

  return { user, otpId: otpRecord.id }
}

// ─── Admin / Staff Login (email or username + password) ──────────────────
export async function login(req: Request, res: Response) {
  const data = LoginSchema.parse(req.body)
  const meta = getRequestMeta(req)
  const identifier = data.email.trim()

  const user = await findUserByIdentifier(identifier)

  if (!user || !user.password) {
    await logActivity({
      action: 'LOGIN_FAILED',
      description: `Failed login attempt for identifier: ${identifier}`,
      ...meta,
      metadata: { identifier },
    })
    return res.status(401).json({ success: false, error: 'Invalid credentials' })
  }

  if (user.role === 'VISITOR') {
    return res.status(403).json({ success: false, error: 'Access denied. Use visitor login.' })
  }

  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, error: 'Admin access required. Use the staff login flow.' })
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

  try {
    const { otpId } = await issueAdminOtp(user.id)
    await logActivity({
      userId: user.id,
      action: 'OTP_SENT',
      description: 'Admin verification code sent',
      ...meta,
    })
    return res.status(200).json(buildResponse({ requiresOtp: true, challengeId: otpId }, 'Verification code sent'))
  } catch (error) {
    console.error('[Auth] Admin OTP issuance failed:', error)
    return res.status(503).json({
      success: false,
      error: 'Unable to send verification code right now. Please try again in a few minutes.',
    })
  }
}

export async function verifyAdminOtp(req: Request, res: Response) {
  const data = AdminOtpVerifySchema.parse(req.body)
  const meta = getRequestMeta(req)

  // Resolve OTP record by server-issued challenge id (emailOtp.id)
  const otpRecord = await prisma.emailOtp.findUnique({ where: { id: data.challengeId } })

  if (!otpRecord || otpRecord.purpose !== OTP_PURPOSE_ADMIN_LOGIN) {
    await logActivity({ action: 'OTP_FAILED', description: 'Invalid admin OTP challenge', ...meta })
    return res.status(401).json({ success: false, error: 'Invalid or expired verification code.' })
  }

  const user = await prisma.user.findUnique({ where: { id: otpRecord.userId } })
  if (!user || !user.password || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    await logActivity({ action: 'OTP_FAILED', description: 'OTP challenge does not map to an admin', ...meta })
    return res.status(401).json({ success: false, error: 'Invalid or expired verification code.' })
  }

  if (user.isActive === false) {
    return res.status(403).json({ success: false, error: 'Account is disabled. Contact an administrator.' })
  }

  if (otpRecord.usedAt || otpRecord.revokedAt) {
    await logActivity({ userId: user.id, action: 'OTP_FAILED', description: 'OTP already used or invalidated', ...meta })
    return res.status(401).json({ success: false, error: 'Verification code has already been used or invalidated.' })
  }

  if (isOtpExpired(otpRecord.expiresAt)) {
    await prisma.emailOtp.update({ where: { id: otpRecord.id }, data: { revokedAt: new Date() } })
    await logActivity({ userId: user.id, action: 'OTP_FAILED', description: 'Expired admin OTP used', ...meta })
    return res.status(410).json({ success: false, error: 'Verification code expired. Request a new one.' })
  }

  if (otpRecord.attempts >= otpRecord.maxAttempts) {
    await prisma.emailOtp.update({ where: { id: otpRecord.id }, data: { revokedAt: new Date() } })
    return res.status(429).json({ success: false, error: 'Too many attempts. Request a new verification code.' })
  }

  const isValidOtp = await verifyOtpHash(data.otp, otpRecord.codeHash)
  if (!isValidOtp) {
    const nextAttempts = otpRecord.attempts + 1
    await prisma.emailOtp.update({
      where: { id: otpRecord.id },
      data: { attempts: nextAttempts, revokedAt: nextAttempts >= otpRecord.maxAttempts ? new Date() : null },
    })

    await logActivity({ userId: user.id, action: 'OTP_FAILED', description: `Invalid admin OTP attempt ${nextAttempts}/${otpRecord.maxAttempts}`, ...meta })

    if (nextAttempts >= otpRecord.maxAttempts) {
      return res.status(429).json({ success: false, error: 'Too many invalid attempts. Request a new verification code.' })
    }

    return res.status(401).json({ success: false, error: 'Invalid verification code.' })
  }

  // Tokens
  const payload: TokenPayload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  }
  const accessToken = generateAccessToken(payload)
  const refreshToken = generateRefreshToken(payload)

  // Persist login and consume OTP
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    prisma.emailOtp.update({ where: { id: otpRecord.id }, data: { usedAt: new Date(), revokedAt: new Date() } }),
  ])

  await logActivity({ userId: user.id, action: 'OTP_VERIFIED', description: 'Admin verification code accepted', ...meta })
  await logActivity({ userId: user.id, action: 'LOGIN_SUCCESS', description: `${user.role} logged in after OTP verification`, ...meta })

  // Set secure HttpOnly cookies
  const isProd = process.env.NODE_ENV === 'production'
  const parseExpiryToMs = (v: string | undefined) => {
    if (!v) return undefined
    const m = v.match(/^(\d+)([smhd])$/)
    if (!m) return undefined
    const n = Number(m[1])
    const unit = m[2]
    switch (unit) {
      case 's':
        return n * 1000
      case 'm':
        return n * 60 * 1000
      case 'h':
        return n * 60 * 60 * 1000
      case 'd':
        return n * 24 * 60 * 60 * 1000
      default:
        return undefined
    }
  }

  const accessMs = parseExpiryToMs(process.env.JWT_EXPIRES_IN as string | undefined) ?? 0
  const refreshMs = parseExpiryToMs(process.env.JWT_REFRESH_EXPIRES_IN as string | undefined) ?? 0

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api',
    maxAge: accessMs,
  })
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: refreshMs,
  })

  return res.status(200).json(
    buildResponse(
      {
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

export async function resendAdminOtp(req: Request, res: Response) {
  const data = AdminOtpResendSchema.parse(req.body)
  const meta = getRequestMeta(req)
  // Expect a server-issued challengeId to identify which OTP to resend
  const challengeId = data.challengeId

  const existing = await prisma.emailOtp.findUnique({ where: { id: challengeId } })
  if (!existing) {
    return res.status(400).json({ success: false, error: 'Invalid challenge' })
  }

  const user = await prisma.user.findUnique({ where: { id: existing.userId } })
  if (!user || !user.password || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' })
  }

  if (user.isActive === false) {
    return res.status(403).json({ success: false, error: 'Account is disabled. Contact an administrator.' })
  }

  const recentOtp = await prisma.emailOtp.findFirst({
    where: { userId: user.id, purpose: OTP_PURPOSE_ADMIN_LOGIN },
    orderBy: { createdAt: 'desc' },
  })

  if (recentOtp && !recentOtp.revokedAt && !recentOtp.usedAt && recentOtp.createdAt.getTime() + OTP_RESEND_COOLDOWN_MS > Date.now()) {
    return res.status(429).json({ success: false, error: 'A new verification code was sent recently. Please wait before requesting another one.' })
  }

  try {
    const { otpId } = await issueAdminOtp(user.id)
    await logActivity({ userId: user.id, action: 'OTP_SENT', description: 'Admin verification code resent', ...meta })
    return res.status(200).json(buildResponse({ requiresOtp: true, challengeId: otpId }, 'A new verification code has been sent.'))
  } catch (error) {
    console.error('[Auth] Admin OTP resend failed:', error)
    return res.status(503).json({ success: false, error: 'Unable to send a new verification code right now. Please try again later.' })
  }
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

  // Set cookies for staff login
  const isProd = process.env.NODE_ENV === 'production'
  const parseExpiryToMs = (v: string | undefined) => {
    if (!v) return undefined
    const m = v.match(/^(\d+)([smhd])$/)
    if (!m) return undefined
    const n = Number(m[1])
    const unit = m[2]
    switch (unit) {
      case 's':
        return n * 1000
      case 'm':
        return n * 60 * 1000
      case 'h':
        return n * 60 * 60 * 1000
      case 'd':
        return n * 24 * 60 * 60 * 1000
      default:
        return undefined
    }
  }

  const accessMs = parseExpiryToMs(process.env.JWT_EXPIRES_IN as string | undefined) ?? 0
  const refreshMs = parseExpiryToMs(process.env.JWT_REFRESH_EXPIRES_IN as string | undefined) ?? 0

  res.cookie('access_token', accessToken, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/api', maxAge: accessMs })
  res.cookie('refresh_token', refreshToken, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/api/auth', maxAge: refreshMs })

  await logActivity({
    userId: user.id,
    action: 'LOGIN_SUCCESS',
    description: 'Staff logged in',
    ...meta,
  })

  return res.status(200).json(
    buildResponse(
      {
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
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`)

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
      action: 'LOGIN_SUCCESS',
      description: 'Visitor Google login',
      ...meta,
    })
    // Set cookies
    const isProd = process.env.NODE_ENV === 'production'
    const parseExpiryToMs = (v: string | undefined) => {
      if (!v) return undefined
      const m = v.match(/^(\d+)([smhd])$/)
      if (!m) return undefined
      const n = Number(m[1])
      const unit = m[2]
      switch (unit) {
        case 's':
          return n * 1000
        case 'm':
          return n * 60 * 1000
        case 'h':
          return n * 60 * 60 * 1000
        case 'd':
          return n * 24 * 60 * 60 * 1000
        default:
          return undefined
      }
    }

    const accessMs = parseExpiryToMs(process.env.JWT_EXPIRES_IN as string | undefined) ?? 0
    const refreshMs = parseExpiryToMs(process.env.JWT_REFRESH_EXPIRES_IN as string | undefined) ?? 0

    res.cookie('access_token', accessToken, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/api', maxAge: accessMs })
    res.cookie('refresh_token', refreshToken, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/api/auth', maxAge: refreshMs })

    return res.status(200).json(buildResponse({ user: { id: user.id, name: user.name, email: user.email, role: user.role, image: user.image } }, 'Google sign-in successful'))
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

  // Set cookies for visitor registration
  const isProd = process.env.NODE_ENV === 'production'
  const parseExpiryToMs = (v: string | undefined) => {
    if (!v) return undefined
    const m = v.match(/^(\d+)([smhd])$/)
    if (!m) return undefined
    const n = Number(m[1])
    const unit = m[2]
    switch (unit) {
      case 's':
        return n * 1000
      case 'm':
        return n * 60 * 1000
      case 'h':
        return n * 60 * 60 * 1000
      case 'd':
        return n * 24 * 60 * 60 * 1000
      default:
        return undefined
    }
  }

  const accessMs = parseExpiryToMs(process.env.JWT_EXPIRES_IN as string | undefined) ?? 0
  const refreshMs = parseExpiryToMs(process.env.JWT_REFRESH_EXPIRES_IN as string | undefined) ?? 0

  res.cookie('access_token', accessToken, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/api', maxAge: accessMs })
  res.cookie('refresh_token', refreshToken, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/api/auth', maxAge: refreshMs })

  return res.status(201).json(buildResponse({ user: { id: user.id, name: user.name, email: user.email, role: user.role } }, 'Account created successfully'))
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
    action: 'LOGIN_SUCCESS',
    description: 'Visitor logged in',
    ...meta,
  })

  // Set cookies for visitor login
  const isProd = process.env.NODE_ENV === 'production'
  const parseExpiryToMs = (v: string | undefined) => {
    if (!v) return undefined
    const m = v.match(/^(\d+)([smhd])$/)
    if (!m) return undefined
    const n = Number(m[1])
    const unit = m[2]
    switch (unit) {
      case 's':
        return n * 1000
      case 'm':
        return n * 60 * 1000
      case 'h':
        return n * 60 * 60 * 1000
      case 'd':
        return n * 24 * 60 * 60 * 1000
      default:
        return undefined
    }
  }

  const accessMs = parseExpiryToMs(process.env.JWT_EXPIRES_IN as string | undefined) ?? 0
  const refreshMs = parseExpiryToMs(process.env.JWT_REFRESH_EXPIRES_IN as string | undefined) ?? 0

  res.cookie('access_token', accessToken, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/api', maxAge: accessMs })
  res.cookie('refresh_token', refreshToken, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/api/auth', maxAge: refreshMs })

  return res.status(200).json(buildResponse({ user: { id: user.id, name: user.name, email: user.email, role: user.role } }, 'Login successful'))
}

// ─── Refresh Token ────────────────────────────────────
export async function refresh(req: Request, res: Response) {
  // Refresh token is expected in a secure HttpOnly cookie
  const refreshToken = req.cookies?.refresh_token

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

    const isProd = process.env.NODE_ENV === 'production'
    const parseExpiryToMs = (v: string | undefined) => {
      if (!v) return undefined
      const m = v.match(/^(\d+)([smhd])$/)
      if (!m) return undefined
      const n = Number(m[1])
      const unit = m[2]
      switch (unit) {
        case 's':
          return n * 1000
        case 'm':
          return n * 60 * 1000
        case 'h':
          return n * 60 * 60 * 1000
        case 'd':
          return n * 24 * 60 * 60 * 1000
        default:
          return undefined
      }
    }

    const accessMs = parseExpiryToMs(process.env.JWT_EXPIRES_IN as string | undefined) ?? 0

    res.cookie('access_token', accessToken, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/api', maxAge: accessMs })

    return res.status(200).json(buildResponse({}, 'Token refreshed'))
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid refresh token' })
  }
}

export async function logout(req: Request, res: Response) {
  const isProd = process.env.NODE_ENV === 'production'
  // Clear cookies using same attributes
  res.clearCookie('access_token', { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/api' })
  res.clearCookie('refresh_token', { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/api/auth' })
  return res.status(200).json(buildResponse(null, 'Logged out'))
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

  if (data.newPassword === data.currentPassword) {
    return res.status(400).json({ success: false, error: 'New password must be different from the current password.' })
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

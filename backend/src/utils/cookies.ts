import { Response } from 'express'

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

// Defaults must match backend/src/utils/jwt.ts when env is unset.
// maxAge: 0 would expire the cookie immediately in Express.
const DEFAULT_ACCESS_MS = 7 * 24 * 60 * 60 * 1000 // 7d (matches jwt.ts default)
const DEFAULT_REFRESH_MS = 30 * 24 * 60 * 60 * 1000 // 30d

/**
 * access_token path MUST be `/` so:
 * - Next.js middleware on /admin/* can read it
 * - API routes under /api/* still receive it
 *
 * refresh_token stays on /api/auth (only used by POST /api/auth/refresh).
 * No Domain attribute — host-only cookies for same-origin Render deploy.
 */
export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const isProd = process.env.NODE_ENV === 'production'
  const accessMs =
    parseExpiryToMs(process.env.JWT_EXPIRES_IN as string | undefined) ?? DEFAULT_ACCESS_MS
  const refreshMs =
    parseExpiryToMs(process.env.JWT_REFRESH_EXPIRES_IN as string | undefined) ?? DEFAULT_REFRESH_MS

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: accessMs,
  })

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: refreshMs,
  })
}

export function setAccessCookie(res: Response, accessToken: string) {
  const isProd = process.env.NODE_ENV === 'production'
  const accessMs =
    parseExpiryToMs(process.env.JWT_EXPIRES_IN as string | undefined) ?? DEFAULT_ACCESS_MS

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: accessMs,
  })
}

export function clearAuthCookies(res: Response) {
  const isProd = process.env.NODE_ENV === 'production'
  const base = { httpOnly: true, secure: isProd, sameSite: 'lax' as const }

  // Current paths
  res.clearCookie('access_token', { ...base, path: '/' })
  res.clearCookie('refresh_token', { ...base, path: '/api/auth' })

  // Clear legacy path=/api access cookies from earlier deploys
  res.clearCookie('access_token', { ...base, path: '/api' })
}

export default { setAuthCookies, setAccessCookie, clearAuthCookies }
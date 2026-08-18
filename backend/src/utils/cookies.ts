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

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const isProd = process.env.NODE_ENV === 'production'
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
}

export function setAccessCookie(res: Response, accessToken: string) {
  const isProd = process.env.NODE_ENV === 'production'
  const accessMs = parseExpiryToMs(process.env.JWT_EXPIRES_IN as string | undefined) ?? 0
  res.cookie('access_token', accessToken, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/api', maxAge: accessMs })
}

export function clearAuthCookies(res: Response) {
  const isProd = process.env.NODE_ENV === 'production'
  res.clearCookie('access_token', { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/api' })
  res.clearCookie('refresh_token', { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/api/auth' })
}

export default { setAuthCookies, setAccessCookie, clearAuthCookies }

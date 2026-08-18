// frontend/lib/auth.ts
import { authApi } from './api'

export interface AuthUser {
  id: string
  name?: string | null
  email: string
  role: string
  image?: string | null
}

// Secure cookie options — httpOnly must be set server-side, but we add
// secure + sameSite here for the js-cookie layer.
// For true httpOnly, tokens should be set via Set-Cookie on the server.
// This is the best we can do from client-side js-cookie.
const COOKIE_OPTIONS: Cookies.CookieAttributes = {
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
}

// Visitor: 7 days access, 30 days refresh
const VISITOR_ACCESS_OPTS: Cookies.CookieAttributes  = { ...COOKIE_OPTIONS, expires: 1 / 24 }
const VISITOR_REFRESH_OPTS: Cookies.CookieAttributes = { ...COOKIE_OPTIONS, expires: 8/ 24 }

// Admin: 1 hour access, 8 hours refresh — shorter window for security
const ADMIN_ACCESS_OPTS: Cookies.CookieAttributes  = { ...COOKIE_OPTIONS, expires: 1 / 24 }
const ADMIN_REFRESH_OPTS: Cookies.CookieAttributes = { ...COOKIE_OPTIONS, expires: 8 / 24 }

// Token storage is handled via secure HttpOnly cookies set by the server.
// Client-side JS must not read or write auth tokens.

// ─── Admin Login ───────────────────────────────────────
export async function login(email: string, password: string): Promise<{ requiresOtp: true; challengeId: string; email: string; message: string }> {
  const res = await authApi.login(email, password)
  return res.data.data
}

export async function verifyAdminOtp(challengeId: string, otp: string): Promise<AuthUser> {
  const res = await authApi.verifyAdminOtp(challengeId, otp)
  const { user } = res.data.data
  return user
}

export async function resendAdminOtp(challengeId: string): Promise<{ requiresOtp: true; challengeId: string }> {
  const res = await authApi.resendAdminOtp(challengeId)
  return res.data.data
}

// ─── Visitor Login ─────────────────────────────────────
export async function visitorLogin(email: string, password: string): Promise<AuthUser> {
  const res = await authApi.visitorLogin(email, password)
  const { user } = res.data.data
  return user
}

// ─── Visitor Register ──────────────────────────────────
export async function visitorRegister(name: string, email: string, password: string): Promise<AuthUser> {
  const res = await authApi.visitorRegister(name, email, password)
  const { user } = res.data.data
  return user
}

// ─── Google Sign-In ────────────────────────────────────
export async function googleSignIn(idToken: string): Promise<AuthUser> {
  const res = await authApi.googleAuth(idToken)
  const { user } = res.data.data
  return user
}

// ─── Logout ────────────────────────────────────────────
export async function logout() {
  try {
    await authApi.refresh() // ensure tokens valid or clearing will still work
  } catch {}
  await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000'}/api/auth/logout`, { method: 'POST', credentials: 'include' })
  window.location.href = '/'
}

export async function adminLogout() {
  try {
    await authApi.refresh()
  } catch {}
  await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000'}/api/auth/logout`, { method: 'POST', credentials: 'include' })
  window.location.href = '/admin/login'
}

export function getAccessToken(): string | undefined {
  // Access token is not exposed to JS when using HttpOnly cookies
  return undefined
}

export function isLoggedIn(): boolean {
  // Prefer calling `getCurrentUser` / `me` to determine auth state
  return false
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await authApi.me()
    return res.data.data
  } catch {
    return null
  }
}
// frontend/lib/auth.ts
import Cookies from 'js-cookie'
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

export function setTokens(accessToken: string, refreshToken: string, isAdmin = false) {
  const accessOpts  = isAdmin ? ADMIN_ACCESS_OPTS  : VISITOR_ACCESS_OPTS
  const refreshOpts = isAdmin ? ADMIN_REFRESH_OPTS : VISITOR_REFRESH_OPTS
  Cookies.set('accessToken', accessToken, accessOpts)
  Cookies.set('refreshToken', refreshToken, refreshOpts)
}

export function clearTokens() {
  Cookies.remove('accessToken')
  Cookies.remove('refreshToken')
}

// ─── Admin Login ───────────────────────────────────────
export async function login(email: string, password: string): Promise<{ requiresOtp: true; email: string; message: string }> {
  const res = await authApi.login(email, password)
  return res.data.data
}

export async function verifyAdminOtp(email: string, otp: string): Promise<AuthUser> {
  const res = await authApi.verifyAdminOtp(email, otp)
  const { accessToken, refreshToken, user } = res.data.data
  setTokens(accessToken, refreshToken, true)
  return user
}

export async function resendAdminOtp(email: string): Promise<{ requiresOtp: true }> {
  const res = await authApi.resendAdminOtp(email)
  return res.data.data
}

// ─── Visitor Login ─────────────────────────────────────
export async function visitorLogin(email: string, password: string): Promise<AuthUser> {
  const res = await authApi.visitorLogin(email, password)
  const { accessToken, refreshToken, user } = res.data.data
  setTokens(accessToken, refreshToken)
  return user
}

// ─── Visitor Register ──────────────────────────────────
export async function visitorRegister(name: string, email: string, password: string): Promise<AuthUser> {
  const res = await authApi.visitorRegister(name, email, password)
  const { accessToken, refreshToken, user } = res.data.data
  setTokens(accessToken, refreshToken)
  return user
}

// ─── Google Sign-In ────────────────────────────────────
export async function googleSignIn(idToken: string): Promise<AuthUser> {
  const res = await authApi.googleAuth(idToken)
  const { accessToken, refreshToken, user } = res.data.data
  setTokens(accessToken, refreshToken)
  return user
}

// ─── Logout ────────────────────────────────────────────
export function logout() {
  clearTokens()
  window.location.href = '/'
}

export function adminLogout() {
  clearTokens()
  window.location.href = '/admin/login'
}

export function getAccessToken(): string | undefined {
  return Cookies.get('accessToken')
}

export function isLoggedIn(): boolean {
  return !!Cookies.get('accessToken')
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await authApi.me()
    return res.data.data
  } catch {
    return null
  }
}
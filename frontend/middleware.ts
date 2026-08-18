// frontend/middleware.ts
// Runs on the Edge — before any page is rendered.
// Protects /admin/* routes server-side so they never flash
// unprotected content to unauthenticated users.

import { NextRequest, NextResponse } from 'next/server'

const ADMIN_PREFIX = '/admin'
const ADMIN_LOGIN  = '/admin/login'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only run on /admin/* routes
  if (!pathname.startsWith(ADMIN_PREFIX)) {
    return NextResponse.next()
  }

  // Always allow the login page through
  if (pathname === ADMIN_LOGIN) {
    return NextResponse.next()
  }

  // Check for access token in cookies (server-side cookie name set by API)
  const token = req.cookies.get('access_token')?.value

  if (!token) {
    // Not logged in — redirect to admin login
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = ADMIN_LOGIN
    loginUrl.searchParams.set('redirect', pathname) // remember where they were going
    return NextResponse.redirect(loginUrl)
  }

  // Token exists — decode payload without verifying signature
  // (full verification happens on the backend for every API call)
  // Here we just check the role claim to block obvious non-admins early
  try {
    const base64Payload = token.split('.')[1]
    const payload = JSON.parse(
      Buffer.from(base64Payload, 'base64url').toString('utf8')
    )

    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = ADMIN_LOGIN
      return NextResponse.redirect(loginUrl)
    }

    // Check role — visitors cannot access admin portal
    if (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
      // Redirect visitors to home, not login
      const homeUrl = req.nextUrl.clone()
      homeUrl.pathname = '/'
      return NextResponse.redirect(homeUrl)
    }
  } catch {
    // Malformed token — redirect to login
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = ADMIN_LOGIN
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Only run middleware on /admin/* — skip static files, API routes, _next
  matcher: ['/admin/:path*'],
}

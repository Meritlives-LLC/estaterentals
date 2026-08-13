/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production'

// ─── Content Security Policy ──────────────────────────
// Next.js injects inline scripts for hydration — 'unsafe-inline' is required
// unless you implement nonce-based CSP (which requires a custom server).
// 'unsafe-inline' is still far better than having no CSP at all, as it
// still blocks scripts from unauthorized external domains.
const cspDirectives = [
  "default-src 'self'",
  // 'unsafe-inline' needed for Next.js hydration scripts + Tailwind inline styles
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  [
    "img-src 'self' data: blob:",
    "https://res.cloudinary.com",
    "https://images.unsplash.com",
    "https://lh3.googleusercontent.com",
  ].join(' '),
  "font-src 'self' data:",
  [
    "connect-src 'self'",
    // Strip /api path — CSP connect-src needs the origin only, not a path prefix
    (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000').replace(/\/api$/, ''),
    "https://accounts.google.com",
    "https://oauth2.googleapis.com",
    "https://www.googleapis.com",
  ].join(' '),
  "frame-src https://maps.google.com https://www.google.com https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join('; ')

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
    // Prefer modern formats; Next serves the best supported by the browser
    formats: ['image/avif', 'image/webp'],
    // Responsive breakpoints used by next/image
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Cache optimized images longer (seconds)
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },
  compress: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy',   value: cspDirectives },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'X-Frame-Options',            value: 'DENY' },
          { key: 'X-XSS-Protection',           value: '1; mode=block' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=()' },
          ...(isProd ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          }] : []),
        ],
      },
    ]
  },
}

module.exports = nextConfig
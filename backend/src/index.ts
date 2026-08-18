// backend/src/index.ts
import 'express-async-errors'
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'

import authRoutes from './routes/auth.routes'
import propertyRoutes from './routes/property.routes'
import messageRoutes from './routes/message.routes'
import uploadRoutes from './routes/upload.routes'
import dashboardRoutes from './routes/dashboard.routes'
import staffRoutes from './routes/staff.routes'
import activityRoutes from './routes/activity.routes'
import videoRoutes from './routes/video.routes'
import { errorHandler, notFound } from './middleware/error.middleware'

const app = express()
const PORT = process.env.PORT ?? 5000

// Allowed origins used for CORS and included in CSP connectSrc
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())

// ─── Security ────────────────────────────────────────
// Trust proxy when explicitly configured (Render / hosting proxies)
if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1)
}

// Configure Helmet with a production-aware CSP and HSTS
const isProd = process.env.NODE_ENV === 'production'
app.use(
  helmet({
    contentSecurityPolicy: isProd
      ? {
          useDefaults: true,
          directives: {
            defaultSrc: ["'self'"],
            // Allow known script hosts (Google OAuth, CDN providers used for widgets)
            scriptSrc: ["'self'", 'https://accounts.google.com', 'https://apis.google.com', 'https://www.gstatic.com', 'https://unpkg.com', 'https://cdn.jsdelivr.net'],
            // Inline styles are required for some third-party widgets and Leaflet styling
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            // Images from cloud providers, Google avatars, and OpenStreetMap tiles
            imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https://images.unsplash.com', 'https://lh3.googleusercontent.com', 'https://*.tile.openstreetmap.org', 'https://unpkg.com', 'https://iframe.mediadelivery.net', 'https://video.bunnycdn.com', 'https://*.b-cdn.net'],
            // Connections allowed for Bunny, Cloudinary, Nominatim and OAuth endpoints
            connectSrc: ["'self'", 'https://video.bunnycdn.com', 'https://*.bunnycdn.com', 'https://api.cloudinary.com', 'https://nominatim.openstreetmap.org', 'https://accounts.google.com', 'https://oauth2.googleapis.com', ...allowedOrigins],
            fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
            frameSrc: ['https://iframe.mediadelivery.net'],
            mediaSrc: ['https://iframe.mediadelivery.net', 'https://video.bunnycdn.com', 'https://*.bunnycdn.com'],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
          },
        }
      : false,
    hsts: isProd
      ? {
          maxAge: 60 * 60 * 24 * 90, // 90 days
          includeSubDomains: false,
          preload: false,
        }
      : false,
  })
)

// ─── CORS ─────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`CORS blocked: ${origin}`))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

// ─── Rate Limiting ────────────────────────────────────
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900000),
  max: Number(process.env.RATE_LIMIT_MAX ?? 100),
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api', limiter)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many login attempts, please try again later.' },
})
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many OTP attempts, please wait before trying again.' },
})
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/login/verify-otp', otpLimiter)
app.use('/api/auth/login/resend-otp', otpLimiter)
app.use('/api/auth/staff/login', authLimiter)

// ─── Body Parsing ─────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

// ─── Logging ──────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
}

// ─── Health Check ─────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'EstatePro API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
})

// ─── API Routes ───────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/properties', propertyRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/staff', staffRoutes)
app.use('/api/activity', activityRoutes)
app.use('/api/videos', videoRoutes)

// ─── 404 & Error Handling ─────────────────────────────
app.use(notFound)
app.use(errorHandler)

// ─── Start Server ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 EstatePro API running on http://localhost:${PORT}`)
  console.log(`📖 Environment: ${process.env.NODE_ENV ?? 'development'}`)
  console.log(`🔒 CORS allowed: ${allowedOrigins.join(', ')}\n`)
})

export default app

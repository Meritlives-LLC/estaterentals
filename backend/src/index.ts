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

// ─── Security ────────────────────────────────────────
app.use(helmet())

// ─── CORS ─────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())

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
app.use('/api/auth/login', authLimiter)
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

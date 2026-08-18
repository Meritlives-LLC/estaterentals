/**
 * Combined production server: Next.js (frontend) + Express (API)
 *
 * - /api/*  → existing Express app (auth, properties, etc.)
 * - everything else → Next.js
 *
 * Used on Render as a single Web Service.
 * Local dual-server development (frontend + backend separately) is unchanged.
 */

'use strict'

const path = require('path')
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = Number(process.env.PORT) || 3000

// Frontend lives in ./frontend
const nextApp = next({
  dev,
  hostname,
  port,
  dir: path.join(__dirname, 'frontend'),
})
const handle = nextApp.getRequestHandler()

async function main() {
  // Ensure Express does not call app.listen() when required
  process.env.STANDALONE_BACKEND = process.env.STANDALONE_BACKEND || '0'

  // Load compiled Express app (run `npm run build:backend` first)
  let expressApp
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    expressApp = require(path.join(__dirname, 'backend', 'dist', 'index.js')).default
  } catch (err) {
    console.error(
      'Failed to load backend/dist/index.js. Run backend build first (tsc / npm run build:backend).',
      err
    )
    process.exit(1)
  }

  if (!expressApp || typeof expressApp !== 'function') {
    console.error('Express app export is missing or invalid')
    process.exit(1)
  }

  await nextApp.prepare()

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || '/', true)
      const pathname = parsedUrl.pathname || '/'

      // Route API (and legacy /health) to Express
      if (pathname === '/health' || pathname === '/api/health' || pathname.startsWith('/api/')) {
        return expressApp(req, res)
      }

      // All other routes → Next.js
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Request error:', err)
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  })

  server.listen(port, hostname, () => {
    console.log(`\n🚀 Combined server ready`)
    console.log(`   → http://${hostname}:${port}`)
    console.log(`   → API:  http://${hostname}:${port}/api/*`)
    console.log(`   → Env:  ${process.env.NODE_ENV || 'development'}\n`)
  })
}

main().catch((err) => {
  console.error('Failed to start combined server:', err)
  process.exit(1)
})

/**
 * Combined production server:
 *
 * Next.js frontend + Express API
 *
 * /api/*       -> Express
 * everything   -> Next.js
 *
 * Render runs this as ONE Web Service and ONE HTTP listener.
 */

'use strict'

const path = require('path')
const http = require('http')
const { parse } = require('url')
const next = require('next')

// ------------------------------------------------------
// Production configuration
// ------------------------------------------------------

// Prevent backend/src/index.ts from calling app.listen()
// when it is imported below.
process.env.STANDALONE_BACKEND = '0'

// Render sets NODE_ENV/PORT in production.
// Keep a fallback for local execution.
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production'
}

const dev = process.env.NODE_ENV !== 'production'

const hostname = '0.0.0.0'
const port = Number(process.env.PORT) || 3000

// ------------------------------------------------------
// Next.js
// ------------------------------------------------------

const nextApp = next({
  dev,
  hostname,
  port,
  dir: path.join(__dirname, 'frontend'),
})

const handle = nextApp.getRequestHandler()

// ------------------------------------------------------
// Start
// ------------------------------------------------------

async function main() {
  // Load the compiled Express app.
  //
  // backend/src/index.ts exports the app but does NOT
  // call app.listen() because STANDALONE_BACKEND=0.
  const backendModule = require(
    path.join(
      __dirname,
      'backend',
      'dist',
      'index.js'
    )
  )

  const expressApp =
    backendModule.default || backendModule

  if (
    typeof expressApp !== 'function'
  ) {
    throw new Error(
      'Failed to load the Express application from backend/dist/index.js'
    )
  }

  // Prepare Next.js before accepting requests.
  await nextApp.prepare()

  // ----------------------------------------------------
  // ONE HTTP SERVER
  // ----------------------------------------------------

  const server = http.createServer(
    async (req, res) => {
      try {
        const parsedUrl = parse(
          req.url || '/',
          true
        )

        const pathname =
          parsedUrl.pathname || '/'

        // ------------------------------------------------
        // Express API
        //
        // The Express app ALREADY defines:
        //
        // /api/auth
        // /api/properties
        // /api/messages
        // etc.
        //
        // Therefore DO NOT mount it using:
        //
        // app.use('/api', expressApp)
        //
        // That would create /api/api/*.
        // ------------------------------------------------

        if (
          pathname === '/health' ||
          pathname === '/api/health' ||
          pathname.startsWith('/api/')
        ) {
          return expressApp(req, res)
        }

        // ------------------------------------------------
        // Next.js frontend
        // ------------------------------------------------

        return handle(
          req,
          res,
          parsedUrl
        )
      } catch (error) {
        console.error(
          'Request handling error:',
          error
        )

        if (!res.headersSent) {
          res.statusCode = 500
          res.setHeader(
            'Content-Type',
            'application/json'
          )

          res.end(
            JSON.stringify({
              success: false,
              error: 'Internal Server Error',
            })
          )
        }
      }
    }
  )

  // ----------------------------------------------------
  // Server errors
  // ----------------------------------------------------

  server.on(
    'error',
    (error) => {
      console.error(
        'HTTP server error:',
        error
      )

      process.exit(1)
    }
  )

  // ----------------------------------------------------
  // Render listener
  // ----------------------------------------------------

  server.listen(
    port,
    hostname,
    () => {
      console.log(
        '\n🚀 EstateRentals combined server started'
      )

      console.log(
        `🌐 Host: ${hostname}`
      )

      console.log(
        `🔌 Port: ${port}`
      )

      console.log(
        `📖 Environment: ${process.env.NODE_ENV}`
      )

      console.log(
        '🖥️  Frontend: Next.js'
      )

      console.log(
        '🔌 API: Express /api/*'
      )

      console.log(
        '❤️  Health: /health'
      )

      console.log(
        '❤️  API Health: /api/health\n'
      )
    }
  )
}

// ------------------------------------------------------
// Startup failure
// ------------------------------------------------------

main().catch((error) => {
  console.error(
    '❌ Failed to start combined server:',
    error
  )

  process.exit(1)
})
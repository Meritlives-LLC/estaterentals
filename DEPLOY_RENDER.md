# Production deployment: single Render Web Service

## Architecture

One Render **Web Service** runs both:

- **Next.js** (App Router frontend under `frontend/`)
- **Express** (existing API under `backend/`)

Browser talks to **one origin** only:

| Path | Handler |
|------|---------|
| `/` , `/properties`, `/admin`, … | Next.js |
| `/api/*` | Express |
| `/api/health` , `/health` | Express health |

There is **no** Vercel frontend and **no** separate `estate-pgwv.onrender.com` API origin in production.

Cookies (`access_token` path `/api`, `refresh_token` path `/api/auth`) are host-only on the same origin, so `POST /api/auth/refresh` reliably receives `req.cookies.refresh_token`.

---

## Render Web Service settings

| Setting | Value |
|---------|--------|
| **Root Directory** | *(repository root — leave blank)* |
| **Runtime** | Node |
| **Build Command** | `npm run install:all && npm run build` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/api/health` |

### Build Command (exact)

```bash
npm run install:all && npm run build
```

This:

1. Installs root + `backend/` + `frontend/` dependencies  
2. `prisma generate` + `tsc` (backend → `backend/dist`)  
3. `next build` (frontend)

### Start Command (exact)

```bash
npm start
```

Runs `NODE_ENV=production node server.js`, which:

1. Loads `backend/dist/index.js` (Express, **does not** call `listen`)  
2. Prepares Next.js from `frontend/`  
3. Listens on `0.0.0.0:$PORT`

---

## Environment variables (Render dashboard)

Set these on the **single** Web Service (do not commit secrets).

### Required

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Existing PostgreSQL URL (unchanged) |
| `JWT_SECRET` | Existing secret |
| `JWT_REFRESH_SECRET` | Existing secret |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `true` |
| `PUBLIC_URL` | e.g. `https://estaterentals.onrender.com` or custom domain |

### Strongly recommended

| Variable | Example |
|----------|---------|
| `JWT_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `30d` |
| `ALLOWED_ORIGINS` | `https://estaterentals.com,https://www.estaterentals.com` (optional extra) |
| `CLOUDINARY_*` | existing |
| `BUNNY_*` | existing |
| `RESEND_*` | existing |

### Frontend / build

| Variable | Production value |
|----------|------------------|
| `NEXT_PUBLIC_API_URL` | **omit** or leave unused — browser uses `/api` when `NODE_ENV=production` |
| `ESTATE_API_URL` | **do not set** — production rewrites are disabled |

Do **not** point the frontend at `https://estate-pgwv.onrender.com`.

---

## Custom domain

1. In Render → your Web Service → **Custom Domains** → add `estaterentals.com` / `www`.  
2. Point DNS (CNAME or A) as Render instructs.  
3. Set `PUBLIC_URL=https://estaterentals.com`.  
4. Optionally set `ALLOWED_ORIGINS` to include that origin.  

Same service serves both UI and `/api/*`.

---

## Local development (unchanged dual-server)

```bash
# Terminal 1
cd backend && npm run dev    # :5000

# Terminal 2
cd frontend && npm run dev   # :3000, rewrites /api → localhost:5000
```

Optional combined locally after build:

```bash
npm run build && npm start
```

---

## Auth acceptance checklist

1. Open production URL → register/login.  
2. DevTools → Application → Cookies: `access_token` + `refresh_token`, **HttpOnly**, **Secure**.  
3. `GET /api/auth/me` → 200.  
4. Expire/clear access token only → `GET /api/auth/me` → 401 → frontend `POST /api/auth/refresh` with cookie → 200 → retry `me` → 200.  
5. No refresh loop; refresh never calls itself.

---

## What was wrong before

Vercel (frontend) and Render (backend) were **different origins**.  
`Set-Cookie` from the backend was host-scoped to the Render API host.  
Next rewrites proxying `/api` did not make the browser treat cookies as first-party for the Vercel host reliably, so `req.cookies.refresh_token` was often missing → **400** on refresh and **401** on `/me`.
EOF
echo ok
ls -la /home/workdir/artifacts/estaterentals/server.js /home/workdir/artifacts/estaterentals/package.json /home/workdir/artifacts/estaterentals/DEPLOY_RENDER.md

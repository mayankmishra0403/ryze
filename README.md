# RYZE

An AI-powered engineering community platform for Computer Science and
Engineering students — placement prep, daily challenges, community, notes,
startup collaboration, chat, and AI-powered guidance in one self-hosted app.

Full plan: see [plan.md](./plan.md).

## Architecture

```
client/   React 19 + TypeScript + Vite + Tailwind 4  (SPA)
server/   Node + Express + Socket.io + Prisma        (REST + realtime API)
deploy/   docker-compose: nginx → server → postgres  (self-hosted on our VPS)
docs/     ai-api-contract.md (handoff spec for the AI team)
```

- **No Firebase / Supabase** — database, auth, storage, and realtime are built
  and hosted by us.
- **AI models** are built by a separate team and integrated via the contract in
  [docs/ai-api-contract.md](./docs/ai-api-contract.md). Until their service is
  live, the app uses mock AI responses, so every screen works today.

## Getting started (local dev)

Prerequisites: Node 22+, Docker (optional, for Postgres).

```bash
# 1. Postgres (via Docker)
docker run --name ryze-db -e POSTGRES_USER=ryze -e POSTGRES_PASSWORD=ryze \
  -e POSTGRES_DB=ryze -p 5432:5432 -d postgres:16-alpine

# 2. Server
cd server
cp .env.example .env        # set DATABASE_URL etc.
npm install
npx prisma migrate dev      # create schema
npm run seed                # demo users/companies/challenges
npm run dev                 # :5001

# 3. Client (new terminal)
cd client
cp .env.example .env
npm install
npm run dev                 # :5173 (proxies /api and /ws to :5000)
```

Open http://localhost:5173 — sign in with `student@ryze.dev` / `password123`.

## Configuration

| Variable | Where | Purpose |
| -------- | ----- | ------- |
| `DATABASE_URL` | server `.env` | Postgres connection |
| `JWT_*` / `OAUTH_STATE_SECRET` | server `.env` | Auth secrets |
| `GOOGLE_CLIENT_ID/SECRET` | server `.env` | Enables "Continue with Google" (button + flow already built) |
| `AI_BASE_URL` / `AI_SERVICE_KEY` | server `.env` | Point to AI team service; blank = mock mode |
| `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` | server + deploy `.env` | Self-hosted RAG assistant. `AI_PROVIDER=auto\|openai\|gemini`; set `AI_API_KEY` (OpenAI or Gemini) for live LLM answers — blank = answers from the knowledge base with mock text |
| `VITE_AI_ENABLED` | client `.env` | Route AI calls to real proxy |
| `POSTGRES_*`, secrets | deploy `.env` | Production values |

## Deployment (VPS)

Works on a Cloud on Fire Starter plan (2 vCPU / 2 GB RAM / 30 GB NVMe).
Everything is a single `docker compose` stack: nginx → server → postgres.

**1. Install Docker on the VPS**

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
```

**2. Clone the repo**

```bash
git clone https://github.com/mayankmishra0403/ryze.git
cd ryze
```

**3. Configure secrets**

```bash
cp deploy/.env.example deploy/.env
nano deploy/.env   # fill POSTGRES_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
                   # OAUTH_STATE_SECRET, CLIENT_ORIGIN, AI_* (blank = mock mode)
```

Generate strong secrets (on your laptop or the VPS):

```bash
openssl rand -base64 48   # run 3x → JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, OAUTH_STATE_SECRET
openssl rand -base64 24   # → POSTGRES_PASSWORD
```

`CLIENT_ORIGIN` must be the public URL (e.g. `https://app.ryze.dev` or
`http://<VPS-IP>`), or `http://localhost:5173` while testing from your machine.

**4. Start the stack**

```bash
cd deploy
docker compose up -d --build
docker compose ps   # wait until server is healthy
```

**5. Seed demo data** (optional, first run only)

```bash
docker compose exec server npx prisma db seed
```

App is now live on `http://<VPS-IP>` — sign in with `student@ryze.dev` /
`password123`. Live logs: `docker compose logs -f --tail 100`.

**6. HTTPS (Let's Encrypt)** — requires a domain pointing at the VPS IP:

```bash
# a. get the cert
sudo apt install -y certbot
sudo certbot certonly --standalone -d app.ryze.dev -d www.app.ryze.dev --agree-tos -m you@example.com

# b. swap in the SSL nginx config (replaces the HTTP-only one)
sed -i 's/__DOMAIN__/app.ryze.dev/g' nginx-ssl.conf

# c. bring up HTTPS (cert files auto-renewed by certbot's timer)
docker compose -f docker-compose.yml -f docker-compose.ssl.yml up -d --build
```

**Updates:** `git pull && cd deploy && docker compose up -d --build`
(Postgres data lives in the `db_data` volume; uploads in `uploads` — both persist
across rebuilds).

**Backup:** `docker compose exec db pg_dump -U ryze -d ryze > ryze-backup.sql`.

## Project structure

```
client/src/
  api/        http client, AI client + mock adapter
  hooks/      useAuth, (useChat, useRealtimeFeed coming with their modules)
  pages/      dashboard, feed, placement, challenges, notes, startup, chat, profile
  components/ layout + UI primitives
server/src/
  routes/     auth, profile, posts (feed), notes, placement, challenges, startups, chat, notifications, ai, health
  sockets/    Socket.io chat + presence + live feed broadcasts
  middleware/ authGuard, roleGuard, rateLimit, error handling
  services/   sessions, storage (uploads), activity (events + notifications)
  prisma/     schema + seed
```

## Auth

- Email/password (bcrypt + JWT access token + rotating httpOnly refresh cookie).
- Google OAuth: full flow implemented (`/api/auth/google`, callback, upsert user).
  It activates automatically once `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
  are set — no code changes needed.

## Testing

```bash
cd server && npm run typecheck && npm test   # integration + realtime socket tests
cd client && npm run lint && npm run build
```

`npm test` runs the API integration suite and the Socket.io chat tests (auth,
feed, profile, notes, placement, challenges, startups, chat, notifications,
presence, typing, unauthenticated-socket rejection). Tests run against the
separate `ryze_test` Postgres database (`server/.env.test`) so the dev data is
never touched — point it at your DB if you run Postgres on a non-default port,
then `DATABASE_URL=... npx prisma migrate deploy` once on that database.

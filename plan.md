# RYZE — Development Plan

An AI-powered engineering community platform for Computer Science students.
This document captures the final architecture, tech stack, module breakdown, and build schedule.

---

## 1. Project Summary

RYZE is a unified ecosystem for CS students covering placement preparation, daily coding
challenges, community interaction, notes sharing, startup collaboration, project/research
collaboration, and AI-powered guidance.

**Scope split:**

- **We build:** the full web app + our own backend + our own database (self-hosted).
- **AI team builds:** the ML models / AI service (on their own machine).
- **We integrate:** their models via a defined API contract. UI works against a mock until then.

**No Firebase, no Supabase, no managed BaaS** — the entire backend and database are built and
hosted by us.

---

## 2. Final Tech Stack

| Layer            | Choice                                                        |
| ---------------- | ------------------------------------------------------------- |
| Frontend         | React 19 + TypeScript + Vite 7 + Tailwind CSS 4               |
| Backend          | Node.js + TypeScript + Express + Socket.io                    |
| Database / ORM   | PostgreSQL 16 + Prisma                                         |
| Auth             | JWT (access + rotating refresh token)                         |
| Login methods    | Email/password (now) + Google OAuth (button + flow built now, keys later) |
| Realtime         | Socket.io (chat, presence, notifications, live feed)          |
| File uploads     | Multer → local disk (NVMe)                                    |
| Deployment       | Docker (Compose) on VPS behind Nginx + Let's Encrypt TLS      |
| AI integration   | REST proxy to AI team's machine via `AI_BASE_URL` + mock adapter |

### Infrastructure (VPS: 2 vCPU / 2 GB RAM / 30 GB NVMe)

```
VPS
├── Nginx (reverse proxy + TLS)   :80/:443
│    ├── /        → React static build (client/dist)
│    ├── /api/*   → Express API
│    └── /ws      → Socket.io (realtime)
├── server        → Node + Express + Socket.io (Docker container)
├── db            → postgres:16-alpine (Docker container, data on NVMe volume)
└── AI service    → NOT on this machine — runs on AI team's box, called via HTTP

Estimated idle footprint: ~550 MB → comfortable on 2 GB.
```

---

## 3. Repository Layout

```
mini-project/
├── client/                     # React SPA (Vite)
│   ├── src/
│   │   ├── pages/              # login/register, feed, placement, challenges, startup, chat, profile, dashboard
│   │   ├── components/
│   │   ├── hooks/              # useAuth, useChat, useRealtimeFeed...
│   │   ├── api/                # client.ts, ai.ts, mockAI.ts
│   │   └── config.ts           # VITE_API_URL
│   ├── Dockerfile
│   └── package.json
├── server/                     # Express + TypeScript + Socket.io
│   ├── src/
│   │   ├── index.ts            # Express + HTTP server + Socket.io
│   │   ├── routes/             # auth, users, posts, notes, companies, jobs, pyqs, challenges, startups, chat, notifications, uploads, ai
│   │   ├── sockets/            # chat + presence handlers (JWT-authed)
│   │   ├── middleware/         # authGuard, roleGuard, rateLimiter, uploadValidator
│   │   ├── services/           # oauth.ts, token.ts, ai-client.ts, storage.ts
│   │   ├── controllers/
│   │   └── prisma/             # schema.prisma, migrations, seed.ts
│   ├── Dockerfile
│   └── .env.example            # DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID/SECRET, AI_BASE_URL, AI_SERVICE_KEY
├── deploy/
│   ├── docker-compose.yml      # nginx + server + db
│   ├── nginx.conf
│   └── .env.example
├── docs/
│   └── ai-api-contract.md      # spec handed to the AI team
└── README.md
```

---

## 4. Data Model (Prisma schema outline)

| Model                  | Purpose                                         |
| ---------------------- | ----------------------------------------------- |
| `User`                 | credentials, oauthProvider/oauthId, role        |
| `Profile`              | skills, branch, college, resume, avatar         |
| `Post` / `PostLike` / `Comment` | community feed                          |
| `Note` / `NoteTag`     | notes sharing                                  |
| `Company` / `Job` / `PYQ` / `InterviewExperience` / `Roadmap` | placement hub |
| `Challenge` / `ChallengeSubmission` / `Streak` | daily challenges |
| `Startup` / `StartupTeam` / `TeamMember` / `CoFounderMatch` | startup hub |
| `Chat` / `ChatMember` / `Message` | realtime chat                            |
| `Notification`         | notification feed                              |
| `LearningEvent`        | behavior/activity log consumed by AI models    |
| `AIReport` / `Recommendation` | outputs written back by the AI service   |

---

## 5. Authentication

- **Email/password (fully working now):** bcrypt hashing, access token (~15 min),
  rotating refresh token in httpOnly cookie, roles: `student` / `mentor` / `admin`,
  profile setup, avatar upload.
- **Google OAuth (button + flow built now, keys connected later):**
  - Routes built now: `GET /api/auth/google`, `GET /api/auth/google/callback`
  - UI: "Continue with Google" button on the login page
  - Later: fill `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env` + add callback URL in
    Google Cloud Console → Google login works with **zero code changes**.

---

## 6. Realtime (Socket.io)

- Socket.io mounted on the Express HTTP server at `/ws`, authenticated via JWT.
- Chat rooms per `Chat` (DM or channel) for message delivery + typing indicators.
- Presence: socket join/leave tracked per user (online/offline).
- Notifications: pushed to connected sockets; polling as fallback.
- Live feed: `post`/`comment`/`like` events broadcast to subscribed users.

---

## 7. AI Integration Contract

1. **Contract first:** `docs/ai-api-contract.md` defines request/response schemas and the
   exact `LearningEvent` data the AI team consumes, so both teams build in parallel.
2. **Mock mode:** until real endpoints exist, the server (or client `mockAI.ts`) returns
   realistic sample data → all AI UI works today.
3. **Proxy routes (user JWT):**
   - `POST /api/ai/recommendations` → personalized learning paths / content / jobs
   - `POST /api/ai/reports` → AGI-inspired progress reports
   - `POST /api/ai/assistant` → career / interview-prep chat
4. **Data handoff:** we log `LearningEvent`s server-side and expose
   `GET /api/ai/export` (protected by a service key) so the AI team can pull behavior data.
5. **Go-live:** set `AI_BASE_URL` → server proxies to the AI team's machine. No UI changes.

---

## 8. Module Breakdown

| # | Module             | Key features                                                    |
| - | ------------------ | --------------------------------------------------------------- |
| 1 | Authentication     | email/password, Google OAuth (keys later), JWT/refresh, roles    |
| 2 | Student Profiles   | bio, skills, branch, college, resume, avatar, portfolio          |
| 3 | Community Feed     | posts, comments, likes, realtime updates                         |
| 4 | Notes Sharing      | upload (PDF/notes), tags, search                                 |
| 5 | Placement Hub      | companies, jobs, PYQs, interview experiences, roadmaps           |
| 6 | Daily Challenges   | daily problem, submissions, streak tracking, difficulty levels   |
| 7 | Startup Hub        | idea posts, team building, co-founder matching                   |
| 8 | Chat & Notifications | realtime DMs/channels, presence, notification feed             |
| 9 | Learning Events    | activity logging that feeds the AI models                        |
| 10 | AI Integration     | recommendations, reports, assistant (mock → real)               |

---

## 9. Build Phases & Schedule

Timeline window: **13 Jul 2026 → 20 Nov 2026** (Agile, iterative).

| Phase | Scope                                                                 |
| ----- | --------------------------------------------------------------------- |
| 1     | Scaffold + VPS: repo, Vite client, Express server, Prisma schema, docker-compose, nginx, HTTPS |
| 2     | Auth + Profiles: email/password, JWT/refresh, Google button + OAuth routes, profile CRUD, uploads |
| 3     | Community Feed: posts/comments/likes + Socket.io live updates          |
| 4     | Notes Sharing: upload/search/tags                                      |
| 5     | Placement Hub: companies, jobs, PYQs, interview experiences, roadmaps  |
| 6     | Daily Challenges: daily problem, submissions, streaks                  |
| 7     | Startup Hub: ideas, teams, co-founder matching                         |
| 8     | Chat + Notifications: Socket.io DMs/channels, presence, notifications  |
| 9     | Learning events + AI contract: activity logging, contract doc, mock adapter, proxy routes |
| 10    | Testing + Deploy: API tests, seed data, final Docker deploy, AI-team handoff |

Each phase: develop → test → integrate → review (Agile iterations).

---

## 10. Testing & Deployment

- **Testing:** unit tests for auth/services, integration tests for API routes,
  Socket.io message flow tests, seed data, manual UAT.
- **Deployment:** `docker compose up` on the VPS; nginx terminates TLS (Let's Encrypt),
  serves the client build, proxies `/api` and `/ws`.
- **Env-driven config:** everything configurable via `.env` — no code changes for
  Google keys or the AI base URL.

---

## 11. Open / Future Items

- Google OAuth keys (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) — connect later.
- `AI_BASE_URL` — point at the AI team's machine when their service is ready.
- ChromaDB / vector store lives on the AI team's side (not our VPS).
- Scale Postgres (backups, resource tuning) as the community grows.

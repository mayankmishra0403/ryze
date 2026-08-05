# RYZE ↔ AI Team — Integration Contract

This document is the handoff spec between the **RYZE web team** (us) and the
**AI team** (models). Both sides build against this contract so the final
integration is plug-and-play.

**Status:** v1 — proposed. The AI team should review and lock endpoint shapes.

---

## 1. Overview

RYZE's Express server calls the AI team's HTTP service. The web team does **not**
call the AI service directly — all traffic flows through our proxy at
`/api/ai/*` so that auth, CORS, and logging stay on one side.

```
Client (React) → POST /api/ai/... → RYZE Express proxy → AI team service
                                                       (AI_BASE_URL)
```

- While `AI_BASE_URL` is empty, the RYZE server returns **mock responses** so the
  UI is fully testable today.
- The AI team's machine only needs outbound access to pull data via
  `GET /api/ai/export` (see §5).

## 2. Endpoints the AI team exposes (called by RYZE)

All three are `POST`, JSON body, protected by the shared service key:

| Endpoint | Purpose | Auth |
| -------- | ------- | ---- |
| `/recommendations` | Personalized learning paths, content, jobs | `Authorization: Bearer <AI_SERVICE_KEY>` |
| `/reports` | AGI-inspired progress report from learning data | same |
| `/assistant` | Career / interview-prep chat | same |

RYZE forwards these headers:
- `Authorization: Bearer <AI_SERVICE_KEY>` (shared secret)
- `X-User-Id: <supabase-like user id>` (the student RYZE is asking about)
- `Content-Type: application/json`

### 2.1 POST /recommendations

Request:
```json
{ "userId": "cm0000000000000000000001" }
```

Response `200`:
```json
[
  {
    "id": "r1",
    "type": "learning_path | interview | resource | collaboration | job",
    "title": "Strengthen DSA fundamentals",
    "description": "A 6-week path covering arrays, strings, and two-pointer.",
    "reason": "You solved 12 easy problems but no medium difficulty yet.",
    "priority": 1
  }
]
```

### 2.2 POST /reports

Request:
```json
{ "userId": "cm0000000000000000000001" }
```

Response `200`:
```json
{
  "id": "rep-123",
  "periodStart": "2026-07-13T00:00:00.000Z",
  "periodEnd": "2026-08-12T00:00:00.000Z",
  "summary": "Consistent activity; challenge streak grew from 3 to 11 days.",
  "learningScore": 72,
  "strengths": ["11-day challenge streak", "Active knowledge sharing"],
  "improvements": ["Attempt medium/hard problems", "Add resume + GitHub"],
  "recommendations": ["30-day target of 30 challenges"],
  "generatedAt": "2026-08-12T09:00:00.000Z"
}
```

### 2.3 POST /assistant

Request:
```json
{
  "messages": [
    { "role": "user", "content": "How do I prepare for Amazon SDE interviews?" }
  ]
}
```

Response `200`:
```json
{ "reply": "Start with the Amazon SDE sheet: arrays, strings, hashmaps…" }
```

> The web team's `mockAI` returns a plain string; we can align to `{ reply }`
> or a string — **pick one and we will match it.**

## 3. What RYZE provides to the AI team

### 3.1 Learning events (behavior data)

RYZE logs every meaningful student action to the `learning_events` table:

| `type` (examples) | `payload` |
| ----------------- | --------- |
| `auth.login` | `{}` |
| `challenge.solved` | `{ challengeId, difficulty, points }` |
| `challenge.failed` | `{ challengeId, difficulty }` |
| `post.created` | `{ postId, tags }` |
| `post.liked` | `{ postId }` |
| `comment.created` | `{ postId }` |
| `note.uploaded` | `{ noteId, tags }` |
| `note.downloaded` | `{ noteId }` |
| `job.applied` | `{ jobId, companyId }` |
| `profile.completed` | `{ completenessPercent }` |
| `startup.joined` | `{ teamId }` |
| `chat.message.sent` | `{ chatType }` |

Each event also carries `userId` and `createdAt`.

### 3.2 Aggregated exports

AI team can pull events from RYZE over HTTP:

```
GET {RYZE_API}/api/ai/export?limit=5000
Headers: x-service-key: <AI_SERVICE_KEY>
```

Response:
```json
{
  "count": 2,
  "events": [
    {
      "id": "evt1",
      "userId": "cm...",
      "type": "challenge.solved",
      "payload": { "challengeId": "c1", "difficulty": "medium", "points": 20 },
      "createdAt": "2026-08-05T10:00:00.000Z",
      "user": { "id": "cm...", "name": "Aarav", "role": "student" }
    }
  ]
}
```

## 4. How the AI team writes results back

The AI team may optionally write `AIReport` / recommendation rows back into
RYZE's Postgres. Two options:

1. **(Preferred, decoupled)** Return them as the API responses above; RYZE
   stores them. No DB access needed on the AI side.
2. Direct DB access — only if the team is granted a read-write service account
   for the RYZE Postgres. Ask the web team before using this.

## 5. Getting the data model

- RYZE uses **PostgreSQL + Prisma**. Schema: `server/prisma/schema.prisma`.
- Key tables for AI: `User`, `Profile`, `LearningEvent`, `ChallengeSubmission`,
  `Post`, `Note`, `JobApplication`, `Chat`, `Startup`.

## 6. Go-live checklist

- [ ] AI team implements `/recommendations`, `/reports`, `/assistant`.
- [ ] Both sides agree on `/assistant` response shape (string vs `{ reply }`).
- [ ] AI team gets `AI_BASE_URL` + `AI_SERVICE_KEY` from the web team.
- [ ] RYZE sets `AI_BASE_URL` in `deploy/.env`.
- [ ] Frontend flips `VITE_AI_ENABLED=true` (client) → real provider active.
- [ ] End-to-end test with a seeded student profile.

---

## 7. Mock response (current behavior)

With `AI_BASE_URL` empty, `/api/ai/*` returns the mock payloads defined in
`server/src/routes/ai.ts`. The client also carries `src/api/mockAI.ts` as a
resilience fallback. Both match the JSON shapes in §2.

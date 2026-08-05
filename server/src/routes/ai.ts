import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { prisma } from '../db.js'
import { asyncHandler, authGuard, roleGuard, type AuthedRequest } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'
import { searchKnowledge, ingestKnowledge, listKnowledge } from '../services/knowledge.js'
import { chatCompletion } from '../services/llm.js'

export const aiRouter = Router()

// All /ai routes require a signed-in user.
aiRouter.use(authGuard)

async function forwardToAi(path: string, body: unknown, userId: string) {
  if (!config.ai.baseUrl) {
    throw new HttpError(501, 'AI service is not configured (AI_BASE_URL is empty)')
  }
  const res = await fetch(`${config.ai.baseUrl.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.ai.serviceKey}`,
      'X-User-Id': userId,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new HttpError(res.status, `AI service error: ${text.slice(0, 200)}`)
  }
  return res.json()
}

const recommendationsSchema = z.object({ userId: z.string().optional() })

aiRouter.post(
  '/recommendations',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = recommendationsSchema.parse(req.body)
    const userId = body.userId ?? req.userId
    if (config.ai.baseUrl) {
      const data = await forwardToAi('/recommendations', { userId }, req.userId!)
      res.json(data)
      return
    }
    res.json([
      {
        id: 'sr1',
        type: 'learning_path',
        title: 'Strengthen DSA fundamentals',
        description:
          'A 6-week path covering arrays, strings, and two-pointer techniques based on your recent challenge activity.',
        reason: 'You solved 12 easy problems but no medium difficulty yet.',
        priority: 1,
      },
      {
        id: 'sr2',
        type: 'interview',
        title: 'Practice SDE interview questions at Amazon',
        description:
          'A curated set of Amazon PYQs focusing on sliding window and heap patterns.',
        reason: 'Amazon is your top tracked company.',
        priority: 2,
      },
    ])
  }),
)

const reportSchema = z.object({ userId: z.string().optional() })

aiRouter.post(
  '/reports',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = reportSchema.parse(req.body)
    const userId = body.userId ?? req.userId
    if (config.ai.baseUrl) {
      const data = await forwardToAi('/reports', { userId }, req.userId!)
      res.json(data)
      return
    }
    const end = new Date()
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
    res.json({
      id: 'srep1',
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      summary:
        'You have been consistently active in the community this month. Your challenge streak grew and your notes were downloaded 12 times.',
      learningScore: 72,
      strengths: [
        'Consistent daily challenge participation',
        'Active knowledge sharing',
        'Strong placement-hub engagement',
      ],
      improvements: [
        'Attempt more medium/hard challenges',
        'Complete your profile — resume and GitHub link are missing',
      ],
      recommendations: [
        'Set a 30-day target of 30 challenges',
        'Join the Open Source Contributors startup team',
      ],
      generatedAt: end.toISOString(),
    })
  }),
)

const assistantSchema = z.object({
  messages: z.array(
    z.object({ role: z.enum(['user', 'assistant']), content: z.string() }),
  ),
})

aiRouter.post(
  '/assistant',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = assistantSchema.parse(req.body)

    // Forward to the dedicated AI team service when configured.
    if (config.ai.baseUrl && !config.ai.apiKey) {
      const data = await forwardToAi('/assistant', { messages: body.messages }, req.userId!)
      res.json(data)
      return
    }

    const last = body.messages[body.messages.length - 1]
    const question = last?.content ?? ''

    // RAG retrieval over the self-hosted knowledge base.
    const hits = await searchKnowledge(question, 4)
    const context = hits
      .map(
        (h, i) =>
          `[${i + 1}] ${h.title} (source: ${h.source ?? 'knowledge base'})\n${h.content.slice(0, 800)}`,
      )
      .join('\n\n')

    const system =
      context.length > 0
        ? `You are RYZE, a placement-prep and learning assistant for CS students in India.\nAnswer the user's question using the knowledge snippets below. Cite them by number like [1], [2]. If the snippets are not enough, say so and give a short general answer.\n\nKnowledge snippets:\n${context}`
        : 'You are RYZE, a placement-prep and learning assistant for CS students in India. Keep answers concise and actionable.'

    const reply = await chatCompletion([
      { role: 'system', content: system },
      ...body.messages.map((m) => ({ role: m.role, content: m.content })),
    ])

    if (reply) {
      res.json({ reply: reply.content, sources: hits.map((h) => ({ id: h.id, title: h.title, source: h.source })) })
      return
    }

    // No API key or LLM call failed — fall back to an answer grounded in the
    // retrieved knowledge so the assistant still works self-hosted.
    res.json({
      reply: buildFallbackAnswer(question, hits),
      sources: hits.map((h) => ({ id: h.id, title: h.title, source: h.source })),
      mock: true,
    })
  }),
)

function buildFallbackAnswer(
  question: string,
  hits: { id: string; title: string; content: string; source: string | null }[],
): string {
  if (hits.length === 0) {
    return 'I can help with placement preparation, learning roadmaps, and startup collaboration. Try asking about interview prep, a learning roadmap, or which company to target first. (No knowledge base configured — add AI_API_KEY to unlock live answers.)'
  }
  const snippet = hits[0]
  return `Based on the knowledge base: ${snippet.title}${
    snippet.source ? ` (${snippet.source})` : ''
  }. ${snippet.content.slice(0, 500)}`
}

const ingestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(20000),
  source: z.string().trim().max(300).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
})

// GET /api/ai/knowledge?search=...&limit=...
aiRouter.get(
  '/knowledge',
  asyncHandler(async (req: AuthedRequest, res) => {
    const limit = Math.min(Number(req.query.limit ?? 20), 50)
    const search = typeof req.query.search === 'string' ? req.query.search : undefined
    res.json({ docs: await listKnowledge(limit, search) })
  }),
)

// POST /api/ai/knowledge/search — semantic-ish retrieval for the client
aiRouter.post(
  '/knowledge/search',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z.object({ query: z.string().trim().min(1).max(1000) }).parse(req.body)
    const hits = await searchKnowledge(body.query, 6)
    res.json({
      results: hits.map((h) => ({
        id: h.id,
        title: h.title,
        content: h.content,
        source: h.source,
        tags: h.tags,
        score: h.score,
      })),
    })
  }),
)

// POST /api/ai/knowledge/ingest — mentors can grow the knowledge base
aiRouter.post(
  '/knowledge/ingest',
  roleGuard('mentor', 'admin'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = ingestSchema.parse(req.body)
    const doc = await ingestKnowledge(body)
    res.status(201).json({ id: doc.id })
  }),
)

// ---- Data handoff for the AI team ----------------------------------------
// Pulls behavior data from our Postgres. Protected by a service key so the AI
// team's machine can access it without a user session.

aiRouter.get(
  '/export',
  asyncHandler(async (req, res) => {
    const key = req.headers['x-service-key']
    if (key !== config.ai.serviceKey) {
      res.status(401).json({ error: 'Invalid service key' })
      return
    }
    const limit = Math.min(Number(req.query.limit ?? 500), 5000)
    const events = await prisma.learningEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    })
    res.json({ count: events.length, events })
  }),
)

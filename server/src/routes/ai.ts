import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { prisma } from '../db.js'
import { asyncHandler, authGuard, type AuthedRequest } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'

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
    if (config.ai.baseUrl) {
      const data = await forwardToAi('/assistant', { messages: body.messages }, req.userId!)
      res.json(data)
      return
    }
    const last = body.messages[body.messages.length - 1]
    res.json(
      `Mock assistant: I can help with placement preparation, learning roadmaps, and startup collaboration. (Received: "${last?.content?.slice(0, 80)}")`,
    )
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

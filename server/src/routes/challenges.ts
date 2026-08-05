import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import {
  asyncHandler,
  authGuard,
  roleGuard,
  type AuthedRequest,
} from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'
import { logEvent } from '../services/activity.js'
import { judgeSubmission, type JudgeSummary } from '../services/judge.js'
import type { ChallengeDifficulty } from '@prisma/client'

export const challengesRouter = Router()

challengesRouter.use(authGuard)

const testcaseSchema = z.object({
  input: z.string().trim().max(10000),
  expectedOutput: z.string().trim().max(10000),
  isPublic: z.boolean().default(true),
})

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('easy'),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  points: z.number().int().min(1).max(500).default(10),
  date: z.string().datetime().optional(),
  solution: z.string().trim().max(20000).optional().nullable(),
  testcases: z.array(testcaseSchema).max(20).default([]),
})

const submitSchema = z.object({
  code: z.string().trim().min(1).max(50000),
  language: z.string().trim().min(1).max(30).default('javascript'),
})

const runSchema = z.object({
  code: z.string().trim().min(1).max(50000),
  language: z.string().trim().min(1).max(30).default('javascript'),
})

function startOfToday() {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function serializeChallenge(challenge: {
  id: string
  title: string
  description: string
  difficulty: ChallengeDifficulty
  tags: string[]
  points: number
  date: Date
  createdAt: Date
}, submitted?: boolean) {
  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    difficulty: challenge.difficulty,
    tags: challenge.tags,
    points: challenge.points,
    date: challenge.date.toISOString(),
    createdAt: challenge.createdAt.toISOString(),
    submitted: submitted ?? false,
  }
}

// GET /api/challenges/today
challengesRouter.get(
  '/today',
  asyncHandler(async (req: AuthedRequest, res) => {
    const start = startOfToday()
    const end = new Date(start.getTime() + 86_400_000)
    const challenge = await prisma.challenge.findFirst({
      where: { date: { gte: start, lt: end } },
      orderBy: { date: 'desc' },
    })
    if (!challenge) {
      res.json({ challenge: null })
      return
    }
    const submitted = await prisma.challengeSubmission.findUnique({
      where: { challengeId_userId: { challengeId: challenge.id, userId: req.userId! } },
    })
    res.json({ challenge: serializeChallenge(challenge, Boolean(submitted)) })
  }),
)

// GET /api/challenges?difficulty=&limit=
challengesRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const difficulty = typeof req.query.difficulty === 'string' ? req.query.difficulty : undefined
    const limit = Math.min(Number(req.query.limit ?? 30), 100)

    const challenges = await prisma.challenge.findMany({
      take: limit,
      where: difficulty ? { difficulty: difficulty as ChallengeDifficulty } : {},
      orderBy: { date: 'desc' },
    })

    const mine = await prisma.challengeSubmission.findMany({
      where: { userId: req.userId!, challengeId: { in: challenges.map((c) => c.id) } },
      select: { challengeId: true },
    })
    const submitted = new Set(mine.map((m) => m.challengeId))

    res.json({
      challenges: challenges.map((c) => serializeChallenge(c, submitted.has(c.id))),
    })
  }),
)

// POST /api/challenges — mentor/admin only
challengesRouter.post(
  '/',
  roleGuard('mentor', 'admin'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = createSchema.parse(req.body)
    const challenge = await prisma.challenge.create({
      data: {
        title: body.title,
        description: body.description,
        difficulty: body.difficulty as ChallengeDifficulty,
        tags: body.tags,
        points: body.points,
        solution: body.solution ?? null,
        date: body.date ? new Date(body.date) : new Date(),
        createdBy: req.userId!,
        testcases: body.testcases.length
          ? {
              create: body.testcases.map((tc, i) => ({
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isPublic: tc.isPublic,
                order: i,
              })),
            }
          : undefined,
      },
    })
    await logEvent(req.userId!, 'challenge.created', { challengeId: challenge.id })
    res.status(201).json({ challenge: serializeChallenge(challenge) })
  }),
)

// POST /api/challenges/:id/testcases — mentor/admin only
challengesRouter.post(
  '/:id/testcases',
  roleGuard('mentor', 'admin'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const challengeId = String(req.params.id)
    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } })
    if (!challenge) throw new HttpError(404, 'Challenge not found')

    const body = z.object({ testcases: z.array(testcaseSchema).min(1).max(20) }).parse(req.body)
    const existing = await prisma.testcase.count({ where: { challengeId } })
    await prisma.testcase.createMany({
      data: body.testcases.map((tc, i) => ({
        challengeId,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isPublic: tc.isPublic,
        order: existing + i,
      })),
    })
    res.status(201).json({ added: body.testcases.length, total: existing + body.testcases.length })
  }),
)

// GET /api/challenges/leaderboard
challengesRouter.get(
  '/leaderboard',
  asyncHandler(async (_req: AuthedRequest, res) => {
    const rows = await prisma.challengeSubmission.groupBy({
      by: ['userId'],
      _count: { _all: true },
      where: { status: { in: ['accepted', 'submitted'] } },
      orderBy: { _count: { userId: 'desc' } },
      take: 20,
    })
    const users = await prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, name: true, avatarUrl: true },
    })
    const byId = new Map(users.map((u) => [u.id, u]))
    res.json({
      leaderboard: rows.map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        name: byId.get(r.userId)?.name ?? 'Unknown',
        avatarUrl: byId.get(r.userId)?.avatarUrl ?? null,
        solved: r._count._all,
      })),
    })
  }),
)

// GET /api/challenges/:id — detail with public testcases (for the editor)
challengesRouter.get(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const challenge = await prisma.challenge.findUnique({
      where: { id: String(req.params.id) },
      include: {
        testcases: { where: { isPublic: true }, orderBy: { order: 'asc' } },
        submissions: { where: { userId: req.userId! } },
      },
    })
    if (!challenge) throw new HttpError(404, 'Challenge not found')
    const submission = challenge.submissions[0]
    res.json({
      challenge: {
        ...serializeChallenge(challenge, Boolean(submission)),
        testcases: challenge.testcases.map((tc) => ({
          id: tc.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
        })),
      },
      submission: submission
        ? {
            status: submission.status,
            passedTests: submission.passedTests,
            totalTests: submission.totalTests,
            runtimeMs: submission.runtimeMs,
          }
        : null,
    })
  }),
)

// POST /api/challenges/:id/run — test against public testcases, no submission saved
challengesRouter.post(
  '/:id/run',
  asyncHandler(async (req: AuthedRequest, res) => {
    const challengeId = String(req.params.id)
    const body = runSchema.parse(req.body)
    const testcases = await prisma.testcase.findMany({
      where: { challengeId, isPublic: true },
      orderBy: { order: 'asc' },
    })

    const summary = await judgeSubmission(
      body.code,
      body.language,
      testcases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isPublic: tc.isPublic,
      })),
    )
    res.json(serializeJudgeSummary(summary, testcases.map((tc) => tc.input)))
  }),
)

function serializeJudgeSummary(summary: JudgeSummary, inputs?: string[]) {
  return {
    status: summary.status,
    passedTests: summary.passedTests,
    totalTests: summary.totalTests,
    runtimeMs: summary.runtimeMs,
    tests: summary.tests.map((t, i) => ({
      input: inputs?.[i] ?? '',
      passed: t.passed,
      expected: t.expected,
      actual: t.actual,
      error: t.error ?? null,
    })),
  }
}

// POST /api/challenges/:id/submit
challengesRouter.post(
  '/:id/submit',
  asyncHandler(async (req: AuthedRequest, res) => {
    const challengeId = String(req.params.id)
    const body = submitSchema.parse(req.body)
    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } })
    if (!challenge) throw new HttpError(404, 'Challenge not found')

    const testcases = await prisma.testcase.findMany({
      where: { challengeId },
      orderBy: { order: 'asc' },
    })
    const summary = await judgeSubmission(
      body.code,
      body.language,
      testcases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isPublic: tc.isPublic,
      })),
    )

    const submission = await prisma.challengeSubmission.upsert({
      where: { challengeId_userId: { challengeId, userId: req.userId! } },
      update: {
        code: body.code,
        language: body.language,
        status: summary.status,
        passedTests: summary.passedTests,
        totalTests: summary.totalTests,
        runtimeMs: summary.runtimeMs,
      },
      create: {
        challengeId,
        userId: req.userId!,
        code: body.code,
        language: body.language,
        status: summary.status,
        passedTests: summary.passedTests,
        totalTests: summary.totalTests,
        runtimeMs: summary.runtimeMs,
      },
    })

    const [streak, updatedStreak] = await updateStreak(req.userId!)
    await logEvent(req.userId!, 'challenge.submitted', {
      challengeId,
      points: challenge.points,
      status: summary.status,
      passedTests: summary.passedTests,
      totalTests: summary.totalTests,
    })

    const solved =
      summary.status === 'accepted' || summary.status === 'submitted'
    res.status(201).json({
      submission: {
        id: submission.id,
        challengeId: submission.challengeId,
        code: submission.code,
        language: submission.language,
        status: submission.status,
        passedTests: submission.passedTests,
        totalTests: submission.totalTests,
        runtimeMs: submission.runtimeMs,
        createdAt: submission.createdAt.toISOString(),
      },
      result: serializeJudgeSummary(summary),
      solved,
      points: solved ? challenge.points : 0,
      streak: updatedStreak,
    })
  }),
)

// GET /api/challenges/me/stats
challengesRouter.get(
  '/me/stats',
  asyncHandler(async (req: AuthedRequest, res) => {
    const [submissions, streak, today] = await Promise.all([
      prisma.challengeSubmission.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          challenge: { select: { id: true, title: true, difficulty: true, points: true, date: true } },
        },
      }),
      prisma.streak.findUnique({ where: { userId: req.userId! } }),
      prisma.challenge.findFirst({
        where: { date: { gte: startOfToday(), lt: new Date(startOfToday().getTime() + 86_400_000) } },
        orderBy: { date: 'desc' },
        include: { submissions: { where: { userId: req.userId! } } },
      }),
    ])

    const solved = submissions.filter(
      (s) => s.status === 'accepted' || s.status === 'submitted',
    )
    const totalPoints = solved.reduce((sum, s) => sum + s.challenge.points, 0)
    const todaySubmitted = Boolean(today && today.submissions.length > 0)

    res.json({
      stats: {
        submittedCount: solved.length,
        totalPoints,
        streak: streak ? { current: streak.current, longest: streak.longest, lastActive: streak.lastActive } : { current: 0, longest: 0, lastActive: null },
        todaySubmitted,
      },
      recent: submissions.slice(0, 10).map((s) => ({
        id: s.id,
        challengeId: s.challengeId,
        title: s.challenge.title,
        difficulty: s.challenge.difficulty,
        points: s.challenge.points,
        status: s.status,
        passedTests: s.passedTests,
        totalTests: s.totalTests,
        runtimeMs: s.runtimeMs,
        date: s.challenge.date.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
    })
  }),
)

async function updateStreak(userId: string) {
  const now = new Date()
  const today = startOfToday()
  const yesterday = new Date(today.getTime() - 86_400_000)

  const existing = await prisma.streak.findUnique({ where: { userId } })
  let current = 1
  let longest = existing?.longest ?? 1

  if (existing) {
    const last = existing.lastActive
    const lastDay = last ? new Date(last).setUTCHours(0, 0, 0, 0) : null
    if (lastDay === today.getTime()) {
      current = existing.current
    } else if (lastDay === yesterday.getTime()) {
      current = existing.current + 1
    } else {
      current = 1
    }
    longest = Math.max(longest, current)
  }

  const streak = await prisma.streak.upsert({
    where: { userId },
    update: { current, longest, lastActive: now },
    create: { userId, current, longest, lastActive: now },
  })
  return [existing, { current: streak.current, longest: streak.longest, lastActive: streak.lastActive }] as const
}

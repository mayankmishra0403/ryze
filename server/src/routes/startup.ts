import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { asyncHandler, authGuard, type AuthedRequest } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'
import { logEvent, notify } from '../services/activity.js'

export const startupRouter = Router()

startupRouter.use(authGuard)

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  tagline: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(4000),
  lookingFor: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  stage: z.enum(['idea', 'mvp', 'launched', 'growing']).default('idea'),
  membersNeeded: z.number().int().min(1).max(50).default(1),
})

const interestSchema = z.object({
  message: z.string().trim().max(2000).optional().nullable(),
})

function serializeStartup(s: {
  id: string
  ownerId: string
  name: string
  tagline: string
  description: string
  lookingFor: string[]
  stage: string
  membersNeeded: number
  createdAt: Date
  owner: { name: string; avatarUrl: string | null }
  _count?: { teams?: number; matches?: number }
}) {
  return {
    id: s.id,
    ownerId: s.ownerId,
    name: s.name,
    tagline: s.tagline,
    description: s.description,
    lookingFor: s.lookingFor,
    stage: s.stage,
    membersNeeded: s.membersNeeded,
    createdAt: s.createdAt.toISOString(),
    ownerName: s.owner.name,
    ownerAvatar: s.owner.avatarUrl,
    teamCount: s._count?.teams ?? 0,
    interestCount: s._count?.matches ?? 0,
  }
}

// GET /api/startups?limit=&cursor=&stage=
startupRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const limit = Math.min(Number(req.query.limit ?? 20), 50)
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
    const stage = typeof req.query.stage === 'string' ? req.query.stage : undefined

    const startups = await prisma.startup.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: stage ? { stage } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { name: true, avatarUrl: true } },
        _count: { select: { teams: true, matches: true } },
      },
    })

    const hasMore = startups.length > limit
    const page = startups.slice(0, limit)
    res.json({
      startups: page.map(serializeStartup),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    })
  }),
)

// GET /api/startups/me
startupRouter.get(
  '/me',
  asyncHandler(async (req: AuthedRequest, res) => {
    const startups = await prisma.startup.findMany({
      where: { ownerId: req.userId! },
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { name: true, avatarUrl: true } },
        _count: { select: { teams: true, matches: true } },
      },
    })
    res.json({ startups: startups.map(serializeStartup) })
  }),
)

// GET /api/startups/:id
startupRouter.get(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = String(req.params.id)
    const startup = await prisma.startup.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
        teams: {
          include: {
            members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
          },
        },
        matches: { where: { status: 'interested' } },
      },
    })
    if (!startup) throw new HttpError(404, 'Startup not found')

    const isOwner = startup.ownerId === req.userId
    const myInterest = await prisma.coFounderMatch.findUnique({
      where: { userId_startupId: { userId: req.userId!, startupId: id } },
    })
    const myMembership = await prisma.teamMember.findFirst({
      where: { userId: req.userId!, team: { startupId: id } },
    })

    res.json({
      startup: {
        id: startup.id,
        ownerId: startup.ownerId,
        name: startup.name,
        tagline: startup.tagline,
        description: startup.description,
        lookingFor: startup.lookingFor,
        stage: startup.stage,
        membersNeeded: startup.membersNeeded,
        createdAt: startup.createdAt.toISOString(),
        ownerName: startup.owner.name,
        ownerAvatar: startup.owner.avatarUrl,
        isOwner,
        myInterest: myInterest ? { status: myInterest.status, message: myInterest.message } : null,
        amMember: Boolean(myMembership),
      },
      teams: startup.teams.map((team) => ({
        id: team.id,
        name: team.name,
        members: team.members.map((m) => ({
          id: m.id,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
          user: { id: m.user.id, name: m.user.name, avatarUrl: m.user.avatarUrl },
        })),
      })),
      interests: startup.matches.map((m) => ({
        id: m.id,
        status: m.status,
        message: m.message,
        createdAt: m.createdAt.toISOString(),
      })),
    })
  }),
)

// POST /api/startups
startupRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = createSchema.parse(req.body)
    const startup = await prisma.startup.create({
      data: {
        ownerId: req.userId!,
        name: body.name,
        tagline: body.tagline,
        description: body.description,
        lookingFor: body.lookingFor,
        stage: body.stage,
        membersNeeded: body.membersNeeded,
      },
      include: {
        owner: { select: { name: true, avatarUrl: true } },
        _count: { select: { teams: true, matches: true } },
      },
    })
    await prisma.startupTeam.create({
      data: {
        startupId: startup.id,
        name: `${startup.name} Team`,
        members: { create: { userId: req.userId!, role: 'owner' } },
      },
    })
    await logEvent(req.userId!, 'startup.created', { startupId: startup.id, name: startup.name })
    res.status(201).json({ startup: serializeStartup(startup) })
  }),
)

// POST /api/startups/:id/express-interest
startupRouter.post(
  '/:id/express-interest',
  asyncHandler(async (req: AuthedRequest, res) => {
    const startupId = String(req.params.id)
    const body = interestSchema.parse(req.body)
    const startup = await prisma.startup.findUnique({
      where: { id: startupId },
      include: { owner: true },
    })
    if (!startup) throw new HttpError(404, 'Startup not found')
    if (startup.ownerId === req.userId) throw new HttpError(400, 'You own this startup')

    const match = await prisma.coFounderMatch.upsert({
      where: { userId_startupId: { userId: req.userId!, startupId } },
      update: { status: 'interested', message: body.message },
      create: { userId: req.userId!, startupId, status: 'interested', message: body.message },
    })
    const me = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { name: true },
    })
    await notify(
      startup.ownerId,
      'interest',
      'New co-founder interest',
      `${me?.name ?? 'Someone'} is interested in ${startup.name}.`,
    )
    await logEvent(req.userId!, 'startup.interest', { startupId })
    res.status(201).json({ match })
  }),
)

// POST /api/startups/:id/join-team
startupRouter.post(
  '/:id/join-team',
  asyncHandler(async (req: AuthedRequest, res) => {
    const startupId = String(req.params.id)
    const startup = await prisma.startup.findUnique({ where: { id: startupId } })
    if (!startup) throw new HttpError(404, 'Startup not found')

    const existing = await prisma.teamMember.findFirst({
      where: { userId: req.userId!, team: { startupId } },
    })
    if (existing) throw new HttpError(400, 'Already a team member')

    let team = await prisma.startupTeam.findFirst({ where: { startupId } })
    if (!team) {
      team = await prisma.startupTeam.create({
        data: { startupId, name: `${startup.name} Team` },
      })
    }
    const member = await prisma.teamMember.create({
      data: { teamId: team.id, userId: req.userId!, role: 'member' },
    })
    await logEvent(req.userId!, 'startup.team_joined', { startupId })
    res.status(201).json({ member })
  }),
)

// DELETE /api/startups/:id — owner only
startupRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = String(req.params.id)
    const startup = await prisma.startup.findUnique({ where: { id } })
    if (!startup) throw new HttpError(404, 'Startup not found')
    if (startup.ownerId !== req.userId) throw new HttpError(403, 'Not your startup')

    await prisma.startup.delete({ where: { id } })
    res.status(204).end()
  }),
)

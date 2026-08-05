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

export const placementRouter = Router()

placementRouter.use(authGuard)

const companySchema = z.object({
  name: z.string().trim().min(1).max(200),
  website: z.string().url().optional().nullable(),
  about: z.string().max(3000).optional().nullable(),
  hqLocation: z.string().max(200).optional().nullable(),
})

const jobSchema = z.object({
  companyId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  location: z.string().max(200).optional().nullable(),
  type: z.string().trim().min(1).max(50),
  eligibility: z.string().max(500).optional().nullable(),
  salaryRange: z.string().max(120).optional().nullable(),
  applyUrl: z.string().url().optional().nullable(),
})

const pyqSchema = z.object({
  companyId: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  round: z.string().max(120).optional().nullable(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  content: z.string().max(8000).optional().nullable(),
})

const experienceSchema = z.object({
  companyId: z.string().min(1),
  role: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(1000),
  content: z.string().trim().min(1).max(10000),
  rating: z.number().int().min(1).max(5).optional().nullable(),
})

const roadmapSchema = z.object({
  companyId: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(3000),
  steps: z.array(z.string().trim().min(1).max(1000)).max(20),
})

function serializeJob(job: {
  id: string
  companyId: string
  title: string
  location: string | null
  type: string
  eligibility: string | null
  salaryRange: string | null
  applyUrl: string | null
  postedAt: Date
  company: { id: string; name: string; logoUrl: string | null }
}) {
  return {
    id: job.id,
    companyId: job.companyId,
    title: job.title,
    location: job.location,
    type: job.type,
    eligibility: job.eligibility,
    salaryRange: job.salaryRange,
    applyUrl: job.applyUrl,
    postedAt: job.postedAt.toISOString(),
    companyName: job.company.name,
    companyLogo: job.company.logoUrl,
  }
}

// ---- Companies ----

placementRouter.get(
  '/companies',
  asyncHandler(async (req: AuthedRequest, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const companies = await prisma.company.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : {},
      orderBy: { name: 'asc' },
      include: { _count: { select: { jobs: true, pyqs: true, interviewExperiences: true } } },
    })
    res.json({
      companies: companies.map((c) => ({
        id: c.id,
        name: c.name,
        website: c.website,
        logoUrl: c.logoUrl,
        about: c.about,
        hqLocation: c.hqLocation,
        jobCount: c._count.jobs,
        pyqCount: c._count.pyqs,
        experienceCount: c._count.interviewExperiences,
      })),
    })
  }),
)

placementRouter.get(
  '/companies/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = String(req.params.id)
    const [company, jobs, pyqs, experiences, roadmaps, appliedJobIds] = await Promise.all([
      prisma.company.findUnique({ where: { id } }),
      prisma.job.findMany({ where: { companyId: id }, orderBy: { postedAt: 'desc' }, include: { company: true } }),
      prisma.pyq.findMany({ where: { companyId: id }, orderBy: { createdAt: 'desc' } }),
      prisma.interviewExperience.findMany({
        where: { companyId: id },
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { name: true, avatarUrl: true } } },
      }),
      prisma.roadmap.findMany({ where: { companyId: id }, orderBy: { createdAt: 'desc' } }),
      prisma.jobApplication
        .findMany({ where: { userId: req.userId!, job: { companyId: id } }, select: { jobId: true } })
        .then((rows) => new Set(rows.map((r) => r.jobId))),
    ])
    if (!company) throw new HttpError(404, 'Company not found')

    res.json({
      company: {
        id: company.id,
        name: company.name,
        website: company.website,
        logoUrl: company.logoUrl,
        about: company.about,
        hqLocation: company.hqLocation,
        createdAt: company.createdAt.toISOString(),
      },
      jobs: jobs.map((j) => ({ ...serializeJob(j), applied: appliedJobIds.has(j.id) })),
      pyqs: pyqs.map((p) => ({
        id: p.id,
        title: p.title,
        round: p.round,
        difficulty: p.difficulty,
        content: p.content,
        createdAt: p.createdAt.toISOString(),
      })),
      experiences: experiences.map((e) => ({
        id: e.id,
        role: e.role,
        summary: e.summary,
        content: e.content,
        rating: e.rating,
        authorId: e.authorId,
        authorName: e.author.name,
        authorAvatar: e.author.avatarUrl,
        createdAt: e.createdAt.toISOString(),
      })),
      roadmaps: roadmaps.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        steps: r.steps,
        createdAt: r.createdAt.toISOString(),
      })),
    })
  }),
)

placementRouter.post(
  '/companies',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = companySchema.parse(req.body)
    const company = await prisma.company.upsert({
      where: { name: body.name },
      update: {},
      create: body,
    })
    await logEvent(req.userId!, 'company.created', { companyId: company.id, name: company.name })
    res.status(201).json({ company })
  }),
)

// ---- Jobs ----

placementRouter.get(
  '/jobs',
  asyncHandler(async (req: AuthedRequest, res) => {
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined
    const limit = Math.min(Number(req.query.limit ?? 20), 50)
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined

    const jobs = await prisma.job.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: companyId ? { companyId } : {},
      orderBy: { postedAt: 'desc' },
      include: { company: true },
    })
    const hasMore = jobs.length > limit
    const page = jobs.slice(0, limit)

    const mine = await prisma.jobApplication.findMany({
      where: { userId: req.userId!, jobId: { in: page.map((j) => j.id) } },
      select: { jobId: true, status: true },
    })
    const statusByJob = new Map(mine.map((m) => [m.jobId, m.status]))

    res.json({
      jobs: page.map((j) => ({ ...serializeJob(j), applicationStatus: statusByJob.get(j.id) ?? null })),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    })
  }),
)

placementRouter.post(
  '/jobs',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = jobSchema.parse(req.body)
    const company = await prisma.company.findUnique({ where: { id: body.companyId } })
    if (!company) throw new HttpError(404, 'Company not found')

    const job = await prisma.job.create({
      data: {
        companyId: body.companyId,
        title: body.title,
        location: body.location,
        type: body.type,
        eligibility: body.eligibility,
        salaryRange: body.salaryRange,
        applyUrl: body.applyUrl,
      },
      include: { company: true },
    })
    await logEvent(req.userId!, 'job.created', { jobId: job.id, companyId: company.id })
    res.status(201).json({ job: serializeJob(job), applicationStatus: null })
  }),
)

placementRouter.post(
  '/jobs/:id/apply',
  asyncHandler(async (req: AuthedRequest, res) => {
    const jobId = String(req.params.id)
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) throw new HttpError(404, 'Job not found')

    const application = await prisma.jobApplication.upsert({
      where: { jobId_userId: { jobId, userId: req.userId! } },
      update: {},
      create: { jobId, userId: req.userId!, status: 'applied' },
    })
    await logEvent(req.userId!, 'job.applied', { jobId, companyId: job.companyId })
    res.status(201).json({ application })
  }),
)

// GET /api/placement/me/applications
placementRouter.get(
  '/me/applications',
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = await prisma.jobApplication.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      include: { job: { include: { company: true } } },
    })
    res.json({
      applications: rows.map((a) => ({
        id: a.id,
        jobId: a.jobId,
        status: a.status,
        createdAt: a.createdAt.toISOString(),
        job: serializeJob(a.job),
      })),
    })
  }),
)

// ---- PYQs ----

placementRouter.post(
  '/pyqs',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = pyqSchema.parse(req.body)
    const company = await prisma.company.findUnique({ where: { id: body.companyId } })
    if (!company) throw new HttpError(404, 'Company not found')

    const pyq = await prisma.pyq.create({
      data: {
        companyId: body.companyId,
        title: body.title,
        round: body.round,
        difficulty: body.difficulty,
        content: body.content,
      },
    })
    await logEvent(req.userId!, 'pyq.created', { pyqId: pyq.id, companyId: company.id })
    res.status(201).json({ pyq })
  }),
)

// ---- Interview experiences ----

placementRouter.get(
  '/experiences',
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = await prisma.interviewExperience.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        company: { select: { id: true, name: true, logoUrl: true } },
        author: { select: { name: true, avatarUrl: true } },
      },
    })
    res.json({
      experiences: rows.map((e) => ({
        id: e.id,
        companyId: e.companyId,
        companyName: e.company.name,
        companyLogo: e.company.logoUrl,
        role: e.role,
        summary: e.summary,
        content: e.content,
        rating: e.rating,
        authorId: e.authorId,
        authorName: e.author.name,
        authorAvatar: e.author.avatarUrl,
        createdAt: e.createdAt.toISOString(),
      })),
    })
  }),
)

placementRouter.post(
  '/experiences',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = experienceSchema.parse(req.body)
    const company = await prisma.company.findUnique({ where: { id: body.companyId } })
    if (!company) throw new HttpError(404, 'Company not found')

    const experience = await prisma.interviewExperience.create({
      data: {
        companyId: body.companyId,
        authorId: req.userId!,
        role: body.role,
        summary: body.summary,
        content: body.content,
        rating: body.rating,
      },
    })
    await logEvent(req.userId!, 'experience.created', { experienceId: experience.id, companyId: company.id })
    res.status(201).json({ experience })
  }),
)

// ---- Roadmaps (mentor/admin only) ----

placementRouter.post(
  '/roadmaps',
  roleGuard('mentor', 'admin'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = roadmapSchema.parse(req.body)
    const company = await prisma.company.findUnique({ where: { id: body.companyId } })
    if (!company) throw new HttpError(404, 'Company not found')

    const roadmap = await prisma.roadmap.create({
      data: {
        companyId: body.companyId,
        title: body.title,
        description: body.description,
        steps: body.steps,
      },
    })
    await logEvent(req.userId!, 'roadmap.created', { roadmapId: roadmap.id, companyId: company.id })
    res.status(201).json({ roadmap })
  }),
)

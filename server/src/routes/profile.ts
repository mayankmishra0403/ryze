import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { asyncHandler, authGuard, type AuthedRequest } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'
import { uploadAvatar, publicFileUrl } from '../services/storage.js'
import { getActivitySummary, logEvent, notify } from '../services/activity.js'

export const profileRouter = Router()

profileRouter.use(authGuard)

const updateSchema = z.object({
  bio: z.string().max(1000).nullable().optional(),
  branch: z.string().max(120).nullable().optional(),
  year: z.number().int().min(1).max(6).nullable().optional(),
  college: z.string().max(200).nullable().optional(),
  skills: z.array(z.string().max(40).trim().min(1)).max(30).optional(),
  resumeUrl: z.string().url().nullable().optional(),
  githubUrl: z.string().url().nullable().optional(),
  linkedinUrl: z.string().url().nullable().optional(),
})

async function ensureProfile(userId: string) {
  let profile = await prisma.profile.findUnique({ where: { userId } })
  if (!profile) {
    profile = await prisma.profile.create({ data: { userId } })
  }
  return profile
}

profileRouter.get(
  '/me',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.userId!
    const [profile, user] = await Promise.all([
      ensureProfile(userId),
      prisma.user.findUnique({ where: { id: userId } }),
    ])
    res.json({
      profile,
      user: {
        id: user!.id,
        name: user!.name,
        email: user!.email,
        role: user!.role,
        avatarUrl: user!.avatarUrl,
        createdAt: user!.createdAt,
      },
    })
  }),
)

profileRouter.get(
  '/me/activity',
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await getActivitySummary(req.userId!))
  }),
)

profileRouter.put(
  '/me',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = updateSchema.parse(req.body)
    const profile = await prisma.profile.upsert({
      where: { userId: req.userId! },
      update: body,
      create: { userId: req.userId!, ...body },
    })
    await logEvent(req.userId!, 'profile.updated', {
      completeness: await profileCompleteness(profile),
    })
    res.json({ profile })
  }),
)

profileRouter.post(
  '/me/avatar',
  uploadAvatar.single('avatar'),
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.file) throw new HttpError(400, 'No file uploaded')
    const url = publicFileUrl('avatars', req.file.filename)
    await prisma.user.update({
      where: { id: req.userId! },
      data: { avatarUrl: url },
    })
    res.json({ avatarUrl: url })
  }),
)

async function profileCompleteness(profile: {
  bio: string | null
  branch: string | null
  year: number | null
  college: string | null
  resumeUrl: string | null
  githubUrl: string | null
  linkedinUrl: string | null
  skills: string[]
}) {
  const fields = [
    profile.bio,
    profile.branch,
    profile.year,
    profile.college,
    profile.resumeUrl,
    profile.githubUrl,
    profile.linkedinUrl,
    profile.skills.length > 0,
  ]
  const filled = fields.filter(Boolean).length
  return Math.round((filled / fields.length) * 100)
}

// GET /api/profile/:id — public profile for any user
profileRouter.get(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = String(req.params.id)
    const [user, profile, followerCount, followingCount, postCount, solved] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, role: true, avatarUrl: true, createdAt: true },
        }),
        prisma.profile.findUnique({ where: { userId } }),
        prisma.follow.count({ where: { followingId: userId } }),
        prisma.follow.count({ where: { followerId: userId } }),
        prisma.post.count({ where: { authorId: userId } }),
        prisma.challengeSubmission.count({
          where: { userId, status: { in: ['accepted', 'submitted'] } },
        }),
      ])
    if (!user) throw new HttpError(404, 'User not found')

    let isFollowing = false
    if (req.userId && req.userId !== userId) {
      isFollowing =
        (await prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: req.userId, followingId: userId } },
        })) !== null
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        joinedAt: user.createdAt,
      },
      profile: profile
        ? {
            bio: profile.bio,
            branch: profile.branch,
            year: profile.year,
            college: profile.college,
            skills: profile.skills,
            githubUrl: profile.githubUrl,
            linkedinUrl: profile.linkedinUrl,
          }
        : null,
      stats: {
        followers: followerCount,
        following: followingCount,
        posts: postCount,
        solved,
      },
      isFollowing,
    })
  }),
)

// POST /api/profile/:id/follow — toggle follow
profileRouter.post(
  '/:id/follow',
  asyncHandler(async (req: AuthedRequest, res) => {
    const targetId = String(req.params.id)
    if (targetId === req.userId) throw new HttpError(400, 'You cannot follow yourself')
    const target = await prisma.user.findUnique({ where: { id: targetId } })
    if (!target) throw new HttpError(404, 'User not found')

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.userId!, followingId: targetId } },
    })

    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } })
    } else {
      await prisma.follow.create({
        data: { followerId: req.userId!, followingId: targetId },
      })
      await notify(targetId, 'follow', 'New follower', `${req.user?.name ?? 'Someone'} started following you.`)
      await logEvent(req.userId!, 'user.followed', { targetId })
    }

    const followerCount = await prisma.follow.count({ where: { followingId: targetId } })
    res.json({ following: !existing, followerCount })
  }),
)

// GET /api/profile/:id/follows — list a user's follow graph
profileRouter.get(
  '/:id/follows',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = String(req.params.id)
    const [following, followers] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: userId },
        select: { following: { select: { id: true, name: true, avatarUrl: true } } },
      }),
      prisma.follow.findMany({
        where: { followingId: userId },
        select: { follower: { select: { id: true, name: true, avatarUrl: true } } },
      }),
    ])
    res.json({
      following: following.map((f) => f.following),
      followers: followers.map((f) => f.follower),
    })
  }),
)

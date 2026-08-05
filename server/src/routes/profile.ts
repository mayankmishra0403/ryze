import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { asyncHandler, authGuard, type AuthedRequest } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'
import { uploadAvatar, publicFileUrl } from '../services/storage.js'
import { logEvent } from '../services/activity.js'

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

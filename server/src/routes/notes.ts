import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { asyncHandler, authGuard, type AuthedRequest } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'
import { uploadNote, publicFileUrl } from '../services/storage.js'
import { logEvent } from '../services/activity.js'

export const notesRouter = Router()

notesRouter.use(authGuard)

const MAX_LIMIT = 50

function parseNoteInput(body: Record<string, unknown>) {
  const schema = z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    tags: z
      .union([z.array(z.string().trim().min(1).max(30)), z.string()])
      .optional(),
  })
  const parsed = schema.parse(body)
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags
    : parsed.tags
      ? parsed.tags
          .split(',')
          .map((t) => t.trim().replace(/^#/, ''))
          .filter(Boolean)
      : []
  return {
    title: parsed.title,
    description: parsed.description ?? null,
    tags: tags.slice(0, 10),
  }
}

// GET /api/notes?limit=&cursor=&search=&tag=
notesRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const limit = Math.min(Number(req.query.limit ?? 20), MAX_LIMIT)
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const tag = typeof req.query.tag === 'string' ? req.query.tag.trim() : ''

    const where = {
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(tag ? { tags: { has: tag } } : {}),
    }

    const notes = await prisma.note.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where,
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { name: true, avatarUrl: true } } },
    })

    const hasMore = notes.length > limit
    const page = notes.slice(0, limit)

    res.json({
      notes: page.map((n) => ({
        id: n.id,
        title: n.title,
        description: n.description,
        fileUrl: n.fileUrl,
        tags: n.tags,
        downloadCount: n.downloadCount,
        authorId: n.authorId,
        authorName: n.author.name,
        authorAvatar: n.author.avatarUrl,
        createdAt: n.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    })
  }),
)

// GET /api/notes/tags — aggregated tag counts for the tag filter
notesRouter.get(
  '/tags',
  asyncHandler(async (_req: AuthedRequest, res) => {
    const rows = await prisma.note.findMany({
      select: { tags: true },
    })
    const counts = new Map<string, number>()
    for (const row of rows) {
      for (const tag of row.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    const tags = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }))
    res.json({ tags })
  }),
)

// POST /api/notes — multipart/form-data with `file`, `title`, `description`, `tags`
notesRouter.post(
  '/',
  uploadNote.single('file'),
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.file) throw new HttpError(400, 'No file uploaded')
    const { title, description, tags } = parseNoteInput(req.body)

    const note = await prisma.note.create({
      data: {
        authorId: req.userId!,
        title,
        description,
        tags,
        fileUrl: publicFileUrl('notes', req.file.filename),
      },
      include: { author: { select: { name: true, avatarUrl: true } } },
    })
    await logEvent(req.userId!, 'note.created', { noteId: note.id, tags: note.tags })

    res.status(201).json({
      note: {
        id: note.id,
        title: note.title,
        description: note.description,
        fileUrl: note.fileUrl,
        tags: note.tags,
        downloadCount: note.downloadCount,
        authorId: note.authorId,
        authorName: note.author.name,
        authorAvatar: note.author.avatarUrl,
        createdAt: note.createdAt.toISOString(),
      },
    })
  }),
)

// POST /api/notes/:id/download — increments the download counter
notesRouter.post(
  '/:id/download',
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = String(req.params.id)
    const note = await prisma.note.findUnique({ where: { id } })
    if (!note) throw new HttpError(404, 'Note not found')

    const updated = await prisma.note.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    })
    res.json({ downloadCount: updated.downloadCount })
  }),
)

// DELETE /api/notes/:id — author only
notesRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = String(req.params.id)
    const note = await prisma.note.findUnique({ where: { id } })
    if (!note) throw new HttpError(404, 'Note not found')
    if (note.authorId !== req.userId) throw new HttpError(403, 'Not your note')

    await prisma.note.delete({ where: { id } })
    res.status(204).end()
  }),
)

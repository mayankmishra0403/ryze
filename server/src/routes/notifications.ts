import { Router } from 'express'
import { prisma } from '../db.js'
import { asyncHandler, authGuard, type AuthedRequest } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'

export const notificationsRouter = Router()

notificationsRouter.use(authGuard)

function serialize(n: {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  createdAt: Date
}) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }
}

// GET /api/notifications?limit=
notificationsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const limit = Math.min(Number(req.query.limit ?? 30), 100)
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({ where: { userId: req.userId!, read: false } }),
    ])
    res.json({ notifications: notifications.map(serialize), unreadCount })
  }),
)

// POST /api/notifications/read — mark all as read
notificationsRouter.post(
  '/read',
  asyncHandler(async (req: AuthedRequest, res) => {
    const { count } = await prisma.notification.updateMany({
      where: { userId: req.userId!, read: false },
      data: { read: true },
    })
    res.json({ marked: count })
  }),
)

// POST /api/notifications/:id/read — mark one as read
notificationsRouter.post(
  '/:id/read',
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = String(req.params.id)
    const notification = await prisma.notification.findUnique({ where: { id } })
    if (!notification) throw new HttpError(404, 'Notification not found')
    if (notification.userId !== req.userId) throw new HttpError(403, 'Not your notification')

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    })
    res.json({ notification: serialize(updated) })
  }),
)

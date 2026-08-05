import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { asyncHandler, authGuard, type AuthedRequest } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'
import { logEvent } from '../services/activity.js'

export const chatRouter = Router()

chatRouter.use(authGuard)

const dmSchema = z.object({ userId: z.string().min(1) })
const channelSchema = z.object({
  name: z.string().trim().min(1).max(120),
  memberIds: z.array(z.string().min(1)).max(100).default([]),
})

async function serializeChat(chat: {
  id: string
  type: string
  name: string | null
  lastMessageAt: Date | null
  createdAt: Date
  members: { userId: string; user: { name: string; avatarUrl: string | null } }[]
}) {
  const members = chat.members.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    avatarUrl: m.user.avatarUrl,
  }))
  return {
    id: chat.id,
    type: chat.type,
    name: chat.name,
    memberIds: members.map((m) => m.userId),
    members,
    lastMessageAt: chat.lastMessageAt?.toISOString() ?? null,
    createdAt: chat.createdAt.toISOString(),
  }
}

// GET /api/chat/users?q= — search users to start a DM
chatRouter.get(
  '/users',
  asyncHandler(async (req: AuthedRequest, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const users = await prisma.user.findMany({
      where: q
        ? {
            id: { not: req.userId! },
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : { id: { not: req.userId! } },
      orderBy: { name: 'asc' },
      take: 20,
      select: { id: true, name: true, email: true, avatarUrl: true, role: true },
    })
    res.json({ users })
  }),
)

// GET /api/chat
chatRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const chats = await prisma.chat.findMany({
      where: { members: { some: { userId: req.userId! } } },
      orderBy: { lastMessageAt: 'desc' },
      include: { members: { include: { user: { select: { name: true, avatarUrl: true } } } } },
    })
    res.json({ chats: await Promise.all(chats.map(serializeChat)) })
  }),
)

// POST /api/chat/dm
chatRouter.post(
  '/dm',
  asyncHandler(async (req: AuthedRequest, res) => {
    const { userId: otherId } = dmSchema.parse(req.body)
    if (otherId === req.userId) throw new HttpError(400, 'Cannot DM yourself')

    const other = await prisma.user.findUnique({ where: { id: otherId } })
    if (!other) throw new HttpError(404, 'User not found')

    const existing = await prisma.chat.findFirst({
      where: {
        type: 'dm',
        members: { every: { userId: { in: [req.userId!, otherId] } } },
        AND: [{ members: { some: { userId: req.userId! } } }, { members: { some: { userId: otherId } } }],
      },
      include: { members: { include: { user: { select: { name: true, avatarUrl: true } } } } },
    })
    if (existing) {
      res.json({ chat: await serializeChat(existing) })
      return
    }

    const chat = await prisma.chat.create({
      data: {
        type: 'dm',
        members: {
          create: [{ userId: req.userId! }, { userId: otherId }],
        },
      },
      include: { members: { include: { user: { select: { name: true, avatarUrl: true } } } } },
    })
    await logEvent(req.userId!, 'chat.created', { chatId: chat.id, type: 'dm', otherId })
    res.status(201).json({ chat: await serializeChat(chat) })
  }),
)

// POST /api/chat/channel
chatRouter.post(
  '/channel',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = channelSchema.parse(req.body)
    const memberIds = [...new Set([req.userId!, ...body.memberIds])]
    const users = await prisma.user.findMany({ where: { id: { in: memberIds } } })
    if (users.length !== memberIds.length) throw new HttpError(400, 'One or more users not found')

    const chat = await prisma.chat.create({
      data: {
        type: 'channel',
        name: body.name,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
      include: { members: { include: { user: { select: { name: true, avatarUrl: true } } } } },
    })
    await logEvent(req.userId!, 'chat.created', { chatId: chat.id, type: 'channel', name: body.name })
    res.status(201).json({ chat: await serializeChat(chat) })
  }),
)

// GET /api/chat/:id/messages?cursor=&limit=
chatRouter.get(
  '/:id/messages',
  asyncHandler(async (req: AuthedRequest, res) => {
    const chatId = String(req.params.id)
    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: req.userId! } },
    })
    if (!membership) throw new HttpError(403, 'Not a member of this chat')

    const limit = Math.min(Number(req.query.limit ?? 50), 100)
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined

    const messages = await prisma.message.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      include: { sender: { select: { name: true, avatarUrl: true } } },
    })
    const hasMore = messages.length > limit
    const page = messages.slice(0, limit).reverse()

    res.json({
      messages: page.map((m) => ({
        id: m.id,
        chatId: m.chatId,
        senderId: m.senderId,
        senderName: m.sender.name,
        senderAvatar: m.sender.avatarUrl,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page[0]!.id : null,
    })
  }),
)

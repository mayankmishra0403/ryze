import type { Server as HttpServer } from 'node:http'
import { Server as SocketServer } from 'socket.io'
import { verifyAccessToken } from '../lib/jwt.js'
import { prisma } from '../db.js'
import { config } from '../config.js'

interface ClientToServerEvents {
  'chat:join': (chatId: string) => void
  'chat:leave': (chatId: string) => void
  'chat:send': (payload: { chatId: string; content: string }) => void
  'chat:typing': (payload: { chatId: string }) => void
}

export interface ServerToClientEvents {
  'message:new': (payload: {
    chatId: string
    message: {
      id: string
      chatId: string
      senderId: string
      senderName: string
      senderAvatar: string | null
      content: string
      createdAt: string
    }
  }) => void
  'presence:update': (payload: { userId: string; status: 'online' | 'offline' }) => void
  'notification:new': (payload: {
    id: string
    type: string
    title: string
    body: string
    createdAt: string
  }) => void
  'feed:new': (payload: {
    id: string
    authorId: string
    authorName: string
    authorAvatar: string | null
    content: string
    tags: string[]
    likeCount: number
    commentCount: number
    createdAt: string
  }) => void
  'feed:update': (payload: {
    postId: string
    likeCount?: number
    commentCount?: number
  }) => void
  'typing': (payload: { chatId: string; userId: string }) => void
}

interface SocketData {
  userId: string
  userName: string
}

const online = new Map<string, string>()

let io: SocketServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData> | null =
  null

type Emittable = { emit: (event: string, ...args: unknown[]) => void }

export function emitToUser(userId: string, event: string, payload: unknown) {
  ;(io?.to(`user:${userId}`) as unknown as Emittable | undefined)?.emit(event, payload)
}

export function emitGlobal(event: string, payload: unknown) {
  ;(io as unknown as Emittable | null)?.emit(event, payload)
}

export function createSocketServer(httpServer: HttpServer) {
  io = new SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    {},
    SocketData
  >(httpServer, {
    path: '/ws',
    cors: { origin: config.clientOrigin, credentials: true },
  })

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) return next(new Error('Unauthorized'))
    try {
      const payload = verifyAccessToken(token)
      socket.data.userId = payload.sub
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    const userId = socket.data.userId

    socket.join(`user:${userId}`)

    online.set(userId, socket.id)
    socket.broadcast.emit('presence:update', { userId, status: 'online' })
    socket.emit('presence:update', { userId, status: 'online' })

    socket.on('chat:join', (chatId) => {
      void socket.join(`chat:${chatId}`)
    })

    socket.on('chat:leave', (chatId) => {
      void socket.leave(`chat:${chatId}`)
    })

    socket.on('chat:typing', (payload) => {
      socket.to(`chat:${payload.chatId}`).emit('typing', {
        chatId: payload.chatId,
        userId,
      })
    })

    socket.on('chat:send', async (payload) => {
      const content = payload.content.trim().slice(0, 5000)
      if (!content) return

      const membership = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: payload.chatId, userId } },
        include: { user: { select: { name: true, avatarUrl: true } } },
      })
      if (!membership) return

      const message = await prisma.message.create({
        data: { chatId: payload.chatId, senderId: userId, content },
      })
      await prisma.chat.update({
        where: { id: payload.chatId },
        data: { lastMessageAt: new Date() },
      })

      const emitted = {
        id: message.id,
        chatId: message.chatId,
        senderId: userId,
        senderName: membership.user.name,
        senderAvatar: membership.user.avatarUrl,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      }
      io?.to(`chat:${payload.chatId}`).emit('message:new', {
        chatId: payload.chatId,
        message: emitted,
      })
    })

    socket.on('disconnect', () => {
      socket.leave(`user:${userId}`)
      if (online.get(userId) === socket.id) {
        online.delete(userId)
        socket.broadcast.emit('presence:update', { userId, status: 'offline' })
      }
    })
  })

  return io
}

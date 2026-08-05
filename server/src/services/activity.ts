import { prisma } from '../db.js'
import { emitToUser } from '../sockets/index.js'

/** Log a learning/behavior event consumed by the AI team's models. */
export async function logEvent(
  userId: string,
  type: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await prisma.learningEvent.create({
    data: { userId, type, payload: payload as never },
  })
}

/** Create a notification row and push it in realtime to the recipient. */
export async function notify(
  userId: string,
  type: 'like' | 'comment' | 'mention' | 'challenge' | 'startup' | 'interest' | 'follow' | 'save' | 'system',
  title: string,
  body: string,
): Promise<void> {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body },
  })
  emitToUser(userId, 'notification:new', {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    createdAt: notification.createdAt.toISOString(),
  })
}

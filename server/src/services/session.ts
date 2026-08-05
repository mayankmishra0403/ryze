import { randomUUID } from 'node:crypto'
import { prisma } from '../db.js'
import { signRefreshToken, signAccessToken } from '../lib/jwt.js'
import { config } from '../config.js'
import type { Role } from '@prisma/client'

export const REFRESH_COOKIE = 'ryze_refresh'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface SessionUser {
  id: string
  email: string
  name: string
  role: Role
  avatarUrl: string | null
  createdAt: Date
}

export function toPublicUser(user: SessionUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  }
}

export async function createSession(user: SessionUser) {
  const tokenId = randomUUID()
  const session = await prisma.refreshSession.create({
    data: {
      id: tokenId,
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  })
  const accessToken = signAccessToken({ id: user.id, role: user.role })
  const refreshToken = signRefreshToken(user.id, session.id)
  return { accessToken, refreshToken, user: toPublicUser(user) }
}

export async function rotateSession(refreshToken: string) {
  const jwt = await import('../lib/jwt.js')
  const payload = jwt.verifyRefreshToken(refreshToken)
  const session = await prisma.refreshSession.findUnique({
    where: { id: payload.tokenId },
    include: { user: true },
  })
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null
  }
  await prisma.refreshSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  })
  return createSession(session.user)
}

export async function revokeSession(refreshToken: string) {
  try {
    const jwt = await import('../lib/jwt.js')
    const payload = jwt.verifyRefreshToken(refreshToken)
    await prisma.refreshSession.updateMany({
      where: { id: payload.tokenId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  } catch {
    // token already invalid — nothing to revoke
  }
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax' as const,
    path: '/api/auth',
    maxAge: SESSION_TTL_MS,
  }
}

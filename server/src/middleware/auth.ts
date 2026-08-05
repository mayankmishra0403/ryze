import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { verifyAccessToken } from '../lib/jwt.js'
import { prisma } from '../db.js'
import type { Role } from '@prisma/client'

export interface AuthedRequest extends Request {
  userId?: string
  userRole?: Role
  user?: {
    id: string
    email: string
    name: string
    role: Role
    avatarUrl: string | null
    createdAt: Date
  }
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}

export function authGuard(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  try {
    const payload = verifyAccessToken(header.slice(7))
    req.userId = payload.sub
    req.userRole = payload.role as Role
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function roleGuard(...roles: Role[]): RequestHandler {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    next()
  }
}

export async function loadUser(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
) {
  if (!req.userId) {
    next()
    return
  }
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatarUrl: true,
      createdAt: true,
    },
  })
  req.user = user ?? undefined
  next()
}

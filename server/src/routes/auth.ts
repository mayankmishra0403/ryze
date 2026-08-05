import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../db.js'
import { config } from '../config.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { asyncHandler, authGuard, type AuthedRequest } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'
import { rateLimit } from '../middleware/rateLimit.js'
import {
  createSession,
  refreshCookieOptions,
  REFRESH_COOKIE,
  revokeSession,
  rotateSession,
  toPublicUser,
  type SessionUser,
} from '../services/session.js'

export const authRouter = Router()

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  role: z.enum(['student', 'mentor']).optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const authLimiter = rateLimit(15 * 60 * 1000, 20)

authRouter.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body)

    if (body.role === 'mentor') {
      const domain = body.email.split('@')[1]?.toLowerCase() || ''
      const publicFreeDomains = [
        'gmail.com',
        'yahoo.com',
        'hotmail.com',
        'outlook.com',
        'icloud.com',
        'rediffmail.com',
        'yandex.com',
      ]
      if (publicFreeDomains.includes(domain)) {
        throw new HttpError(
          400,
          'Mentors must register with an organization, company or college work email (e.g. name@company.com or name@iit.ac.in)',
        )
      }
    }

    const existing = await prisma.user.findUnique({ where: { email: body.email } })
    if (existing) throw new HttpError(409, 'An account with this email already exists')

    const passwordHash = await hashPassword(body.password)
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        role: body.role ?? 'student',
        isVerified: true,
      },
    })

    const { accessToken, refreshToken, user: publicUser } = await createSession(user)
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions())
    res.status(201).json({ accessToken, user: publicUser })
  }),
)

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body)

    const user = await prisma.user.findUnique({ where: { email: body.email } })
    if (!user?.passwordHash) throw new HttpError(401, 'Invalid email or password')
    const ok = await verifyPassword(body.password, user.passwordHash)
    if (!ok) throw new HttpError(401, 'Invalid email or password')

    const { accessToken, refreshToken, user: publicUser } = await createSession(user)
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions())
    res.json({ accessToken, user: publicUser })
  }),
)

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined
    if (!refreshToken) throw new HttpError(401, 'No refresh token')

    let result: Awaited<ReturnType<typeof rotateSession>>
    try {
      result = await rotateSession(refreshToken)
    } catch {
      throw new HttpError(401, 'Invalid or expired session')
    }
    if (!result) throw new HttpError(401, 'Invalid or expired session')

    const { accessToken, refreshToken: newRefresh, user } = result
    res.cookie(REFRESH_COOKIE, newRefresh, refreshCookieOptions())
    res.json({ accessToken, user })
  }),
)

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined
    if (refreshToken) await revokeSession(refreshToken)
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions())
    res.status(204).end()
  }),
)

authRouter.get(
  '/me',
  authGuard,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } })
    if (!user) throw new HttpError(404, 'User not found')
    res.json({ user: toPublicUser(user as SessionUser) })
  }),
)

// ---- Google OAuth ---------------------------------------------------------
// The full flow is implemented now; it only activates once GOOGLE_CLIENT_ID /
// GOOGLE_CLIENT_SECRET are provided in .env.

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_PROFILE_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

function googleConfigured() {
  return Boolean(config.oauth.googleClientId && config.oauth.googleClientSecret)
}

function googleStateToken() {
  return jwt.sign({ nonce: randomBytes(8).toString('hex') }, config.oauth.stateSecret, {
    expiresIn: '10m',
  })
}

authRouter.get('/google', (req, res) => {
  if (!googleConfigured()) {
    res
      .status(503)
      .json({ error: 'Google OAuth is not configured yet. Connect GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' })
    return
  }
  const params = new URLSearchParams({
    client_id: config.oauth.googleClientId,
    redirect_uri: config.oauth.googleRedirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: googleStateToken(),
    access_type: 'online',
    prompt: 'select_account',
  })
  res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`)
})

authRouter.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const { code, state } = req.query as { code?: string; state?: string }
    if (!googleConfigured()) {
      res.status(503).json({ error: 'Google OAuth is not configured yet.' })
      return
    }
    try {
      jwt.verify(state ?? '', config.oauth.stateSecret)
    } catch {
      throw new HttpError(400, 'Invalid OAuth state')
    }
    if (!code) throw new HttpError(400, 'Missing authorization code')

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.oauth.googleClientId,
        client_secret: config.oauth.googleClientSecret,
        redirect_uri: config.oauth.googleRedirectUri,
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) throw new HttpError(502, 'Google token exchange failed')
    const tokens = (await tokenRes.json()) as { access_token: string }

    const profileRes = await fetch(GOOGLE_PROFILE_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (!profileRes.ok) throw new HttpError(502, 'Failed to fetch Google profile')
    const profile = (await profileRes.json()) as {
      id: string
      email: string
      name?: string
      picture?: string
    }

    let user = await prisma.user.findFirst({
      where: { OR: [{ oauthId: profile.id }, { email: profile.email }] },
    })
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name ?? profile.email.split('@')[0],
          avatarUrl: profile.picture ?? null,
          oauthProvider: 'google',
          oauthId: profile.id,
          isVerified: true,
        },
      })
    } else if (!user.oauthId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { oauthProvider: 'google', oauthId: profile.id, avatarUrl: profile.picture ?? user.avatarUrl },
      })
    }

    const { accessToken, refreshToken } = await createSession(user)
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions())
    res.redirect(`${config.clientOrigin}/login?google=1`)
    // accessToken is intentionally not placed in the URL; the client calls
    // POST /api/auth/refresh to obtain it from the httpOnly cookie.
  }),
)

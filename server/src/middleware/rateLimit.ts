import type { RequestHandler } from 'express'

const buckets = new Map<string, { count: number; resetAt: number }>()

/**
 * Lightweight in-memory rate limiter keyed by IP. Fine for a single-instance
 * deployment; replace with a Redis-backed store if scaling horizontally.
 */
export function rateLimit(windowMs: number, max: number): RequestHandler {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') {
      next()
      return
    }
    const key = req.ip ?? 'unknown'
    const now = Date.now()
    const bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      next()
      return
    }

    bucket.count += 1
    if (bucket.count > max) {
      res.status(429).json({ error: 'Too many requests, slow down' })
      return
    }
    next()
  }
}

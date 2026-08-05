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

export interface ActivitySummary {
  /** YYYY-MM-DD (UTC) -> number of activities that day */
  activity: Record<string, number>
  stats: { currentStreak: number; longestStreak: number; totalActiveDays: number }
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function prevDayKey(key: string): string {
  const d = new Date(`${key}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return dayKey(d)
}

/**
 * Real activity for the heatmap: counts challenge submissions, posts, notes and
 * comments the user created over the trailing 365 days, then derives streaks
 * and total active days from actual rows (no synthetic data).
 */
export async function getActivitySummary(userId: string): Promise<ActivitySummary> {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 365)
  since.setUTCHours(0, 0, 0, 0)

  const [submissions, posts, notes, comments] = await Promise.all([
    prisma.challengeSubmission.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.post.findMany({
      where: { authorId: userId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.note.findMany({
      where: { authorId: userId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.comment.findMany({
      where: { authorId: userId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ])

  const counts = new Map<string, number>()
  const add = (d: Date) => {
    const key = dayKey(d)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  submissions.forEach((s) => add(s.createdAt))
  posts.forEach((p) => add(p.createdAt))
  notes.forEach((n) => add(n.createdAt))
  comments.forEach((c) => add(c.createdAt))

  const activeDates = [...counts.keys()].sort()

  const today = new Date()
  const todayKey = dayKey(today)
  const yesterdayKey = prevDayKey(todayKey)

  let currentStreak = 0
  let cursor = counts.has(todayKey) ? todayKey : yesterdayKey
  while (counts.has(cursor)) {
    currentStreak += 1
    cursor = prevDayKey(cursor)
  }

  let longestStreak = 0
  let run = 0
  let prev = ''
  for (const key of activeDates) {
    run = prev && prevDayKey(prev) === key ? run + 1 : 1
    if (run > longestStreak) longestStreak = run
    prev = key
  }

  return {
    activity: Object.fromEntries(counts),
    stats: { currentStreak, longestStreak, totalActiveDays: activeDates.length },
  }
}

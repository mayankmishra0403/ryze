import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { config as loadEnv } from 'dotenv'
import type { Server as HttpServer } from 'node:http'

let baseUrl = ''
let httpServer: HttpServer

type ApiResult = {
  status: number
  data: any
  headers: Headers
}

async function api(
  path: string,
  opts: {
    method?: string
    token?: string
    body?: unknown
    form?: FormData
    headers?: Record<string, string>
  } = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  let payload: BodyInit | undefined
  if (opts.form) {
    payload = opts.form
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(opts.body)
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: payload,
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data, headers: res.headers }
}

let userSeq = 0
async function registerUser(overrides: Record<string, unknown> = {}) {
  userSeq += 1
  const email = `test_${Date.now()}_${userSeq}@ryze.test`
  const body = { name: `Test User ${userSeq}`, email, password: 'password123', ...overrides }
  const res = await api('/api/auth/register', { method: 'POST', body })
  assert.equal(res.status, 201, `register failed: ${JSON.stringify(res.data)}`)
  return { ...(res.data as any).user, token: (res.data as any).accessToken, email, password: body.password }
}

describe('integration', () => {
  before(async () => {
    loadEnv({ path: '.env.test' })
    process.env.DATABASE_URL = 'postgresql://ryze:ryze@localhost:5433/ryze_test'
    const { prisma } = await import('../src/db.js')
    // Wipe the test DB so runs are deterministic regardless of accumulated data.
    await prisma.$executeRawUnsafe(`
      DO $$ DECLARE r RECORD; BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `)
    const { createHttpServer } = await import('../src/app.js')
    httpServer = createHttpServer()
    await new Promise<void>((resolve) => httpServer.listen(0, resolve))
    const addr = httpServer.address()
    assert.ok(addr && typeof addr === 'object', 'server should listen on a port')
    baseUrl = `http://127.0.0.1:${addr.port}`
  })

  after(async () => {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve())
      httpServer.closeAllConnections()
    })
    const { prisma } = await import('../src/db.js')
    await prisma.$disconnect()
  })

  describe('health', () => {
    test('GET /api/health returns ok', async () => {
      const res = await api('/api/health')
      assert.equal(res.status, 200)
      assert.equal(res.data.status, 'ok')
    })
  })

  describe('auth', () => {
    test('register + login + me + refresh + logout', async () => {
      const user = await registerUser()

      // duplicate email -> 409
      const dup = await api('/api/auth/register', {
        method: 'POST',
        body: { name: user.name, email: user.email, password: user.password },
      })
      assert.equal(dup.status, 409)

      // wrong password -> 401
      const bad = await api('/api/auth/login', {
        method: 'POST',
        body: { email: user.email, password: 'wrongpass' },
      })
      assert.equal(bad.status, 401)

      // correct login -> token + user
      const login = await api('/api/auth/login', {
        method: 'POST',
        body: { email: user.email, password: user.password },
      })
      assert.equal(login.status, 200)
      assert.ok((login.data as any).accessToken)
      assert.equal((login.data as any).user.email, user.email)

      // /me with token
      const me = await api('/api/auth/me', { token: (login.data as any).accessToken })
      assert.equal(me.status, 200)
      assert.equal(me.data.user.email, user.email)

      // refresh with cookie
      const cookie = login.headers.getSetCookie()?.[0] ?? null
      assert.ok(cookie, 'refresh cookie should be set')
      const refresh = await api('/api/auth/refresh', {
        method: 'POST',
        headers: { Cookie: cookie },
      })
      assert.equal(refresh.status, 200)
      assert.ok((refresh.data as any).accessToken)

      // logout -> 204
      const logout = await api('/api/auth/logout', {
        method: 'POST',
        headers: { Cookie: cookie },
      })
      assert.equal(logout.status, 204)
    })

    test('protected routes reject anonymous users', async () => {
      const res = await api('/api/posts')
      assert.equal(res.status, 401)
    })
  })

  describe('feed', () => {
    test('create post, list, like toggle, comment', async () => {
      const a = await registerUser()
      const b = await registerUser()

      const created = await api('/api/posts', {
        method: 'POST',
        token: a.token,
        body: { content: 'Hello from integration test', tags: ['dsa', 'test'] },
      })
      assert.equal(created.status, 201)
      const post = created.data.post
      assert.equal(post.tags.length, 2)
      assert.equal(post.likeCount, 0)

      const list = await api('/api/posts', { token: a.token })
      assert.equal(list.status, 200)
      assert.ok(list.data.posts.some((p: any) => p.id === post.id))

      // b likes -> liked true, count 1
      const like = await api(`/api/posts/${post.id}/like`, { method: 'POST', token: b.token })
      assert.equal(like.status, 200)
      assert.equal(like.data.liked, true)
      assert.equal(like.data.likeCount, 1)

      // unlike -> count 0
      const unlike = await api(`/api/posts/${post.id}/like`, { method: 'POST', token: b.token })
      assert.equal(unlike.data.liked, false)
      assert.equal(unlike.data.likeCount, 0)

      // b comments -> notification for a
      const comment = await api(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        token: b.token,
        body: { content: 'Nice post!' },
      })
      assert.equal(comment.status, 201)

      const comments = await api(`/api/posts/${post.id}/comments`, { token: a.token })
      assert.equal(comments.status, 200)
      assert.equal(comments.data.comments.length, 1)

      // a got a notification from b's comment
      const notifs = await api('/api/notifications', { token: a.token })
      assert.ok(
        notifs.data.notifications.some(
          (n: any) => n.type === 'comment' && n.body.includes('commented'),
        ),
      )
    })

    test('post kind/title, save, threaded replies, follow + following feed', async () => {
      const a = await registerUser()
      const b = await registerUser()

      // b creates a "question" post with a title
      const created = await api('/api/posts', {
        method: 'POST',
        token: b.token,
        body: { content: 'What is a good approach for DP?', kind: 'question', title: 'DP help', tags: ['dp'] },
      })
      assert.equal(created.status, 201)
      assert.equal(created.data.post.kind, 'question')
      assert.equal(created.data.post.title, 'DP help')
      const postId = created.data.post.id

      // a saves it -> saved tab shows it, saved flag true
      const save = await api(`/api/posts/${postId}/save`, { method: 'POST', token: a.token })
      assert.equal(save.data.saved, true)
      const savedFeed = await api('/api/posts?feed=saved', { token: a.token })
      assert.ok(savedFeed.data.posts.some((p: any) => p.id === postId))
      const savedView = savedFeed.data.posts.find((p: any) => p.id === postId)
      assert.equal(savedView.saved, true)

      // a follows b -> following feed includes b's post
      const follow = await api(`/api/profile/${b.id}/follow`, { method: 'POST', token: a.token })
      assert.equal(follow.data.following, true)
      const followingFeed = await api('/api/posts?feed=following', { token: a.token })
      assert.ok(followingFeed.data.posts.some((p: any) => p.id === postId))

      // a follows b got a notification
      const notifs = await api('/api/notifications', { token: b.token })
      assert.ok(notifs.data.notifications.some((n: any) => n.type === 'follow'))

      // a replies to b's comment thread
      const root = await api(`/api/posts/${postId}/comments`, {
        method: 'POST',
        token: b.token,
        body: { content: 'Try recursion first.' },
      })
      const reply = await api(`/api/posts/${postId}/comments`, {
        method: 'POST',
        token: a.token,
        body: { content: 'Got it, thanks!', parentId: root.data.comment.id },
      })
      assert.equal(reply.data.comment.parentId, root.data.comment.id)

      const thread = await api(`/api/posts/${postId}/comments`, { token: a.token })
      const parent = thread.data.comments.find((c: any) => c.id === root.data.comment.id)
      assert.equal(parent.parentId, null)
      const child = thread.data.comments.find((c: any) => c.id === reply.data.comment.id)
      assert.equal(child.parentId, root.data.comment.id)

      // b got a reply notification
      const bNotifs = await api('/api/notifications', { token: b.token })
      assert.ok(bNotifs.data.notifications.some((n: any) => n.type === 'comment' && n.body.includes('replied')))

      // a's follow graph lists b
      const follows = await api(`/api/profile/${a.id}/follows`, { token: a.token })
      assert.ok(follows.data.following.some((u: any) => u.id === b.id))
    })

    test('challenge judge: run, submit verdicts, stats', async () => {
      const user = await registerUser()
      const { prisma } = await import('../src/db.js')
      const challenge = await prisma.challenge.create({
        data: {
          title: 'Judge Test Sum',
          description: 'solve(nums) returns the sum of an array',
          difficulty: 'easy',
          points: 10,
          date: new Date(),
          createdBy: user.id,
          testcases: {
            create: [
              { input: '[1,2,3]', expectedOutput: '6', isPublic: true, order: 0 },
              { input: '[10]', expectedOutput: '10', isPublic: true, order: 1 },
              { input: '[1,1,1]', expectedOutput: '3', isPublic: false, order: 2 },
            ],
          },
        },
      })

      // run against public tests without saving
      const run = await api(`/api/challenges/${challenge.id}/run`, {
        method: 'POST',
        token: user.token,
        body: { code: 'function solve(nums){ return nums.reduce((a,b)=>a+b,0) }', language: 'javascript' },
      })
      assert.equal(run.status, 200)
      assert.equal(run.data.status, 'accepted')
      assert.equal(run.data.passedTests, 2)

      // wrong answer -> no points, status persists
      const wrong = await api(`/api/challenges/${challenge.id}/submit`, {
        method: 'POST',
        token: user.token,
        body: { code: 'function solve(nums){ return 0 }', language: 'javascript' },
      })
      assert.equal(wrong.status, 201)
      assert.equal(wrong.data.solved, false)
      assert.equal(wrong.data.result.status, 'wrong_answer')

      // correct answer -> solved, points earned, hidden tests pass
      const good = await api(`/api/challenges/${challenge.id}/submit`, {
        method: 'POST',
        token: user.token,
        body: { code: 'function solve(nums){ return nums.reduce((a,b)=>a+b,0) }', language: 'javascript' },
      })
      assert.equal(good.status, 201)
      assert.equal(good.data.solved, true)
      assert.equal(good.data.result.status, 'accepted')
      assert.equal(good.data.points, 10)

      const stats = await api('/api/challenges/me/stats', { token: user.token })
      assert.equal(stats.status, 200)
      const mine = stats.data.recent.find((s: any) => s.challengeId === challenge.id)
      assert.equal(mine.status, 'accepted')
      assert.equal(mine.passedTests, 3)

      // leaderboard counts only solved
      const leaderboard = await api('/api/challenges/leaderboard', { token: user.token })
      const entry = leaderboard.data.leaderboard.find((e: any) => e.userId === user.id)
      assert.ok(entry && entry.solved >= 1)
    })

    test('ai knowledge search + assistant fallback', async () => {
      const user = await registerUser()

      const ingest = await api('/api/ai/knowledge/ingest', {
        method: 'POST',
        token: user.token,
        body: { title: 'Test DP Doc', content: 'Dynamic programming breaks problems into overlapping subproblems.', tags: ['dp'] },
      })
      assert.equal(ingest.status, 403) // students cannot ingest

      const search = await api('/api/ai/knowledge/search', {
        method: 'POST',
        token: user.token,
        body: { query: 'dynamic programming subproblems' },
      })
      assert.equal(search.status, 200)

      const chat = await api('/api/ai/assistant', {
        method: 'POST',
        token: user.token,
        body: { messages: [{ role: 'user', content: 'How do I start with dynamic programming?' }] },
      })
      assert.equal(chat.status, 200)
      assert.ok(typeof chat.data.reply === 'string')
      assert.ok(Array.isArray(chat.data.sources))
    })
  })

  describe('profile', () => {
    test('update and read profile', async () => {
      const user = await registerUser()
      const update = await api('/api/profile/me', {
        method: 'PUT',
        token: user.token,
        body: {
          bio: 'Final year CSE',
          branch: 'CSE',
          year: 4,
          college: 'NIT Trichy',
          skills: ['React', 'Node'],
        },
      })
      assert.equal(update.status, 200)
      assert.equal(update.data.profile.bio, 'Final year CSE')

      const me = await api('/api/profile/me', { token: user.token })
      assert.equal(me.status, 200)
      assert.equal(me.data.profile.skills.length, 2)
      assert.equal(me.data.profile.college, 'NIT Trichy')
    })

    test('public profile: stats, isFollowing, follow graph', async () => {
      const a = await registerUser()
      const b = await registerUser()

      // b posts once so stats.posts reflects it
      await api('/api/posts', {
        method: 'POST',
        token: b.token,
        body: { content: 'Public profile test post' },
      })

      // a follows b
      await api(`/api/profile/${b.id}/follow`, { method: 'POST', token: a.token })

      const pub = await api(`/api/profile/${b.id}`, { token: a.token })
      assert.equal(pub.status, 200)
      assert.equal(pub.data.user.name, b.name)
      assert.equal(pub.data.stats.followers, 1)
      assert.equal(pub.data.stats.posts, 1)
      assert.equal(pub.data.isFollowing, true)

      // own view: isFollowing false
      const own = await api(`/api/profile/${a.id}`, { token: a.token })
      assert.equal(own.data.isFollowing, false)

      // 404 for unknown user
      const missing = await api('/api/profile/does-not-exist', { token: a.token })
      assert.equal(missing.status, 404)
    })

    test('activity summary reflects real activity', async () => {
      const user = await registerUser()
      await api('/api/posts', {
        method: 'POST',
        token: user.token,
        body: { content: 'Heatmap post 1' },
      })
      await api('/api/posts', {
        method: 'POST',
        token: user.token,
        body: { content: 'Heatmap post 2' },
      })

      const res = await api('/api/profile/me/activity', { token: user.token })
      assert.equal(res.status, 200)
      const todayKey = new Date().toISOString().slice(0, 10)
      assert.equal(res.data.activity[todayKey], 2)
      assert.equal(res.data.stats.currentStreak, 1)
      assert.equal(res.data.stats.longestStreak, 1)
      assert.equal(res.data.stats.totalActiveDays, 1)
    })
  })

  describe('notes', () => {
    test('upload, search, download, delete', async () => {
      const author = await registerUser()
      const other = await registerUser()

      const form = new FormData()
      form.append('title', 'DBMS Quick Reference')
      form.append('description', 'Key SQL concepts')
      form.append('tags', 'dbms,sql')
      form.append('file', new Blob(['test content'], { type: 'application/pdf' }), 'dbms.pdf')

      const created = await api('/api/notes', { method: 'POST', token: author.token, form })
      assert.equal(created.status, 201)
      const note = created.data.note
      assert.equal(note.title, 'DBMS Quick Reference')

      const list = await api('/api/notes?search=DBMS', { token: author.token })
      assert.equal(list.status, 200)
      assert.ok(list.data.notes.some((n: any) => n.id === note.id))

      const download = await api(`/api/notes/${note.id}/download`, {
        method: 'POST',
        token: author.token,
      })
      assert.equal(download.data.downloadCount, 1)

      const forbidden = await api(`/api/notes/${note.id}`, {
        method: 'DELETE',
        token: other.token,
      })
      assert.equal(forbidden.status, 403)

      const deleted = await api(`/api/notes/${note.id}`, {
        method: 'DELETE',
        token: author.token,
      })
      assert.ok(deleted.status === 200 || deleted.status === 204)
    })
  })

  describe('placement', () => {
    test('company, job, apply, applications', async () => {
      const user = await registerUser()

      const company = await api('/api/placement/companies', {
        method: 'POST',
        token: user.token,
        body: { name: 'Test Corp', hqLocation: 'Bengaluru' },
      })
      assert.equal(company.status, 201)
      const companyId = company.data.company.id

      const companies = await api('/api/placement/companies', { token: user.token })
      assert.ok(companies.data.companies.some((c: any) => c.id === companyId))

      const job = await api('/api/placement/jobs', {
        method: 'POST',
        token: user.token,
        body: { companyId, title: 'SDE Intern', type: 'Full-time', eligibility: '3rd year+', salaryRange: '20-30 LPA' },
      })
      assert.equal(job.status, 201)
      const jobId = job.data.job.id

      const jobs = await api('/api/placement/jobs', { token: user.token })
      assert.ok(jobs.data.jobs.some((j: any) => j.id === jobId))

      const applied = await api(`/api/placement/jobs/${jobId}/apply`, {
        method: 'POST',
        token: user.token,
      })
      assert.equal(applied.status, 201)

      const mine = await api('/api/placement/me/applications', { token: user.token })
      assert.ok(mine.data.applications.some((a: any) => a.jobId === jobId))
    })
  })

  describe('challenges', () => {
    test('today, submit, stats, leaderboard', async () => {
      const user = await registerUser()

      const today = await api('/api/challenges/today', { token: user.token })
      assert.equal(today.status, 200)
      let challengeId = (today.data as any).challenge?.id
      if (!challengeId) {
        const { prisma } = await import('../src/db.js')
        const ch = await prisma.challenge.create({
          data: {
            title: 'Integration Test Challenge',
            description: 'Write a function that sums an array',
            difficulty: 'easy',
            points: 10,
            date: new Date(),
            createdBy: user.id,
          },
        })
        challengeId = ch.id
      }
      assert.ok(challengeId)

      const submit = await api(`/api/challenges/${challengeId}/submit`, {
        method: 'POST',
        token: user.token,
        body: { code: 'function solve() {}', language: 'javascript' },
      })
      assert.equal(submit.status, 201)
      assert.equal(submit.data.submission.language, 'javascript')
      assert.ok(submit.data.streak !== undefined)

      const stats = await api('/api/challenges/me/stats', { token: user.token })
      assert.equal(stats.status, 200)
      assert.ok((stats.data.points ?? 0) >= 0)

      const leaderboard = await api('/api/challenges/leaderboard', { token: user.token })
      assert.equal(leaderboard.status, 200)
      assert.ok(Array.isArray(leaderboard.data.leaderboard))
    })
  })

  describe('startups', () => {
    test('create, list, interest + notification, detail', async () => {
      const owner = await registerUser()
      const interested = await registerUser()

      const created = await api('/api/startups', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Ryze Startup', tagline: 'Student founders', description: 'Building cool stuff', lookingFor: ['dev', 'design'], stage: 'idea', membersNeeded: 3 },
      })
      assert.equal(created.status, 201)
      const startupId = created.data.startup.id

      const list = await api('/api/startups', { token: owner.token })
      assert.ok(list.data.startups.some((s: any) => s.id === startupId))

      const interest = await api(`/api/startups/${startupId}/express-interest`, {
        method: 'POST',
        token: interested.token,
        body: { message: 'I can help build the MVP' },
      })
      assert.equal(interest.status, 201)

      const notifs = await api('/api/notifications', { token: owner.token })
      assert.ok(
        notifs.data.notifications.some(
          (n: any) => n.type === 'interest' && n.body.includes('interested'),
        ),
      )

      const detail = await api(`/api/startups/${startupId}`, { token: interested.token })
      assert.equal(detail.status, 200)
      assert.equal(detail.data.interests.length, 1)
      assert.equal(detail.data.teams.length, 1)
    })
  })

  describe('chat', () => {
    test('dm, channel, messages, membership guard', async () => {
      const a = await registerUser()
      const b = await registerUser()
      const c = await registerUser()

      const dm = await api('/api/chat/dm', {
        method: 'POST',
        token: a.token,
        body: { userId: b.id },
      })
      assert.equal(dm.status, 201)
      const dmId = dm.data.chat.id
      assert.equal(dm.data.chat.type, 'dm')

      const list = await api('/api/chat', { token: a.token })
      assert.ok(list.data.chats.some((ch: any) => ch.id === dmId))

      const messages = await api(`/api/chat/${dmId}/messages`, { token: a.token })
      assert.equal(messages.status, 200)
      assert.deepEqual(messages.data.messages, [])

      const channel = await api('/api/chat/channel', {
        method: 'POST',
        token: a.token,
        body: { name: 'test-channel', memberIds: [b.id] },
      })
      assert.equal(channel.status, 201)
      assert.equal(channel.data.chat.type, 'channel')
      assert.equal(channel.data.chat.memberIds.length, 2)

      // c is not in the DM -> 403
      const forbidden = await api(`/api/chat/${dmId}/messages`, { token: c.token })
      assert.equal(forbidden.status, 403)
    })
  })

  describe('notifications', () => {
    test('list, mark one read, mark all read', async () => {
      const user = await registerUser()

      const list = await api('/api/notifications', { token: user.token })
      assert.equal(list.status, 200)
      const unreadBefore = list.data.unreadCount
      assert.ok(Array.isArray(list.data.notifications))

      if (list.data.notifications.length > 0) {
        const id = list.data.notifications[0].id
        const markOne = await api(`/api/notifications/${id}/read`, {
          method: 'POST',
          token: user.token,
        })
        assert.equal(markOne.status, 200)
        assert.equal(markOne.data.notification.read, true)
      }

      const markAll = await api('/api/notifications/read', {
        method: 'POST',
        token: user.token,
      })
      assert.equal(markAll.status, 200)
      assert.equal(markAll.data.marked, unreadBefore)

      const after = await api('/api/notifications', { token: user.token })
      assert.equal(after.data.unreadCount, 0)
    })
  })
})

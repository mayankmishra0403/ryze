import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { config as loadEnv } from 'dotenv'
import { io as createClient, type Socket } from 'socket.io-client'
import type { Server as HttpServer } from 'node:http'

let baseUrl = ''
let httpServer: HttpServer

async function registerUser(base: string, seq: number) {
  const email = `sock_${Date.now()}_${seq}@ryze.test`
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Socket User ${seq}`, email, password: 'password123' }),
  })
  assert.equal(res.status, 201)
  return (await res.json()) as { accessToken: string; user: { id: string } }
}

function connect(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = createClient(baseUrl, {
      path: '/ws',
      transports: ['websocket'],
      auth: { token },
    })
    s.on('connect', () => resolve(s))
    s.on('connect_error', (err) => reject(err))
  })
}

function once<T>(s: Socket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), timeoutMs)
    s.once(event, (payload: T) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })
}

describe('realtime chat (socket.io)', () => {
  before(async () => {
    loadEnv({ path: '.env.test' })
    process.env.DATABASE_URL = 'postgresql://ryze:ryze@localhost:5433/ryze_test'
    const { createHttpServer } = await import('../src/app.js')
    httpServer = createHttpServer()
    await new Promise<void>((resolve) => httpServer.listen(0, resolve))
    const addr = httpServer.address()
    assert.ok(addr && typeof addr === 'object')
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

  test('message sent over socket is received by the other member', async () => {
    const a = await registerUser(baseUrl, 1)
    const b = await registerUser(baseUrl, 2)

    const dm = await fetch(`${baseUrl}/api/chat/dm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${a.accessToken}`,
      },
      body: JSON.stringify({ userId: b.user.id }),
    })
    assert.equal(dm.status, 201)
    const { chat } = (await dm.json()) as { chat: { id: string } }

    const socketA = await connect(a.accessToken)
    const socketB = await connect(b.accessToken)

    try {
      socketA.emit('chat:join', chat.id)
      socketB.emit('chat:join', chat.id)

      const received = once(socketB, 'message:new')
      socketA.emit('chat:send', { chatId: chat.id, content: 'Hey from A' })
      const payload = (await received) as { chatId: string; message: { content: string; senderId: string } }

      assert.equal(payload.chatId, chat.id)
      assert.equal(payload.message.content, 'Hey from A')
      assert.equal(payload.message.senderId, a.user.id)

      const messages = await fetch(`${baseUrl}/api/chat/${chat.id}/messages`, {
        headers: { Authorization: `Bearer ${b.accessToken}` },
      })
      const body = (await messages.json()) as { messages: { content: string }[] }
      assert.ok(body.messages.some((m) => m.content === 'Hey from A'))
    } finally {
      socketA.close()
      socketB.close()
    }
  })

  test('presence and typing events propagate', async () => {
    const a = await registerUser(baseUrl, 3)
    const b = await registerUser(baseUrl, 4)

    const socketB = await connect(b.accessToken)

    try {
      const presencePromise = new Promise<{ userId: string; status: string }>((resolve) => {
        const handler = (data: { userId: string; status: string }) => {
          if (data.userId === a.user.id) {
            socketB.off('presence:update', handler)
            resolve(data)
          }
        }
        socketB.on('presence:update', handler)
      })
      const socketA = await connect(a.accessToken)
      const p = await presencePromise
      assert.equal(p.userId, a.user.id)
      assert.equal(p.status, 'online')

      const dm = await fetch(`${baseUrl}/api/chat/dm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${a.accessToken}`,
        },
        body: JSON.stringify({ userId: b.user.id }),
      })
      const { chat } = (await dm.json()) as { chat: { id: string } }

      socketA.emit('chat:join', chat.id)
      socketB.emit('chat:join', chat.id)

      // give the server a tick to process both room joins before emitting
      await new Promise((r) => setTimeout(r, 250))

      const typing = once(socketB, 'typing')
      socketA.emit('chat:typing', { chatId: chat.id })
      const t = (await typing) as { chatId: string; userId: string }
      assert.equal(t.chatId, chat.id)
      assert.equal(t.userId, a.user.id)

      socketA.close()
    } finally {
      socketB.close()
    }
  })

  test('unauthenticated socket is rejected', async () => {
    await new Promise<void>((resolve, reject) => {
      const s = createClient(baseUrl, {
        path: '/ws',
        transports: ['websocket'],
        auth: {},
      })
      s.on('connect', () => {
        s.close()
        reject(new Error('unauthenticated socket connected'))
      })
      s.on('connect_error', () => {
        s.close()
        resolve()
      })
    })
  })
})

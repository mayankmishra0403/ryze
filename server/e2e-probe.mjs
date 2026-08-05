import { io as createClient } from 'socket.io-client'

const BASE = 'https://api.oppertunity.xyz'

async function registerUser(seq) {
  const email = `e2e_${Date.now()}_${seq}@ryze.test`
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `E2E User ${seq}`, email, password: 'probe12345' }),
  })
  const body = await res.json()
  return { token: body.accessToken, id: body.user.id, email }
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const s = createClient(BASE, {
      path: '/ws',
      transports: ['websocket'],
      auth: { token },
    })
    s.on('connect', () => resolve(s))
    s.on('connect_error', (err) => reject(err))
  })
}

async function main() {
  const a = await registerUser(1)
  const b = await registerUser(2)

  // 1. A creates DM with B
  const dm = await fetch(`${BASE}/api/chat/dm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.token}` },
    body: JSON.stringify({ userId: b.id }),
  })
  const { chat } = await dm.json()
  console.log('1. DM created:', chat.id, 'members:', chat.memberIds.length)

  // 2. A lists chats — DM should appear
  const list = await fetch(`${BASE}/api/chat`, {
    headers: { Authorization: `Bearer ${a.token}` },
  })
  const listBody = await list.json()
  console.log('2. A chat list contains DM:', listBody.chats.some((c) => c.id === chat.id))

  // 3. Socket send + echo
  const socketA = await connect(a.token)
  const socketB = await connect(b.token)
  socketA.emit('chat:join', chat.id)
  socketB.emit('chat:join', chat.id)
  await new Promise((r) => setTimeout(r, 500))

  const gotA = []
  const gotB = []
  socketA.on('message:new', (p) => gotA.push(p))
  socketB.on('message:new', (p) => gotB.push(p))

  socketA.emit('chat:send', { chatId: chat.id, content: 'hello from e2e' })
  await new Promise((r) => setTimeout(r, 1500))
  console.log('3. sender echo:', gotA.length, '| receiver echo:', gotB.length)

  // 4. History via REST (as A and as B)
  const histA = await fetch(`${BASE}/api/chat/${chat.id}/messages`, {
    headers: { Authorization: `Bearer ${a.token}` },
  })
  const histB = await fetch(`${BASE}/api/chat/${chat.id}/messages`, {
    headers: { Authorization: `Bearer ${b.token}` },
  })
  const bodyA = await histA.json()
  const bodyB = await histB.json()
  console.log('4. history A count:', bodyA.messages.length, '| B count:', bodyB.messages.length)
  console.log('   content match:', bodyA.messages[0]?.content === 'hello from e2e')

  socketA.close()
  socketB.close()

  // cleanup users via REST (no delete endpoint) — note ids for manual cleanup
  console.log('users to clean:', a.email, b.email)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

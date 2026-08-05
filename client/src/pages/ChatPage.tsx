import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { createChannel, createDm, getChatMessages, getChats, searchUsers, type ChatList } from '../api/features'
import { connectSocket, type AppSocket } from '../lib/socket'
import { timeAgo, avatarUrl } from '../lib/format'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Badge, EmptyState } from '../components/ui/Card'
import type { Chat, ChatMessage } from '../types'

interface SearchUser {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  role: string
}

interface ChatWithMeta extends Chat {
  members: { userId: string; name: string; avatarUrl: string | null }[]
}

export function ChatPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const targetUserId = searchParams.get('userId')

  const [chats, setChats] = useState<ChatWithMeta[]>([])
  const [active, setActive] = useState<ChatWithMeta | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [presence, setPresence] = useState<Record<string, string>>({})
  const [showNew, setShowNew] = useState(false)
  const [channelName, setChannelName] = useState('')
  const [showUsers, setShowUsers] = useState(false)
  const [query, setQuery] = useState('')
  const [userResults, setUserResults] = useState<SearchUser[]>([])
  const [socket, setSocket] = useState<AppSocket | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadChats = useCallback(async (): Promise<ChatWithMeta[]> => {
    const data: ChatList = await getChats()
    setChats(data.chats)
    return data.chats
  }, [])

  useEffect(() => {
    let active = true
    loadChats()
      .catch(() => active && setError('Failed to load chats'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [loadChats])

  useEffect(() => {
    const s = connectSocket()
    setSocket(s)
    s.on('message:new', ({ chatId: _chatId, message }) => {
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message],
      )
    })
    s.on('presence:update', ({ userId, status }) => {
      setPresence((prev) => ({ ...prev, [userId]: status }))
    })
    return () => {
      s.off('message:new')
      s.off('presence:update')
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, active])

  const openChat = useCallback(
    async (chat: ChatWithMeta) => {
      setActive(chat)
      setMessages([])
      socket?.emit('chat:leave', active?.id ?? '')
      socket?.emit('chat:join', chat.id)
      try {
        const data = await getChatMessages(chat.id)
        setMessages(data.messages)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load messages')
      }
    },
    [socket, active],
  )

  const openById = useCallback(
    async (chatId: string) => {
      const list = await loadChats()
      const found = list.find((c) => c.id === chatId)
      if (found) await openChat(found)
    },
    [loadChats, openChat],
  )

  const startDm = useCallback(async (otherId: string) => {
    try {
      const { chat } = await createDm(otherId)
      setShowUsers(false)
      setShowNew(false)
      setQuery('')
      setUserResults([])
      await openById(chat.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start chat')
    }
  }, [openById])

  // Handle URL param targetUserId (e.g. /chat?userId=xyz)
  useEffect(() => {
    if (!loading && targetUserId && user?.id) {
      startDm(targetUserId)
    }
  }, [loading, targetUserId, user?.id, startDm])

  const send = (e: FormEvent) => {
    e.preventDefault()
    if (!active || !draft.trim()) return
    socket?.emit('chat:send', { chatId: active.id, content: draft.trim() })
    setDraft('')
  }

  useEffect(() => {
    if (!showUsers) return
    const timer = setTimeout(() => {
      searchUsers(query.trim())
        .then((data) => setUserResults(data.users))
        .catch(() => setUserResults([]))
    }, 200)
    return () => clearTimeout(timer)
  }, [query, showUsers])

  const createNewChannel = async () => {
    if (!channelName.trim()) return
    try {
      const { chat } = await createChannel(channelName.trim(), [])
      setShowNew(false)
      setChannelName('')
      await openById(chat.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create channel')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-ink-400">Loading messages…</div>
  }

  const peer = (chat: ChatWithMeta) => chat.members.find((m) => m.userId !== user?.id)

  return (
    <div className="relative mx-auto flex h-[calc(100vh-8rem)] max-w-5xl overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-xl">
      {/* Sidebar */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-ink-200 bg-ink-50/50">
        <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3.5 bg-white">
          <div>
            <h2 className="font-bold text-ink-900 text-base">Messages & Direct Chats</h2>
            <p className="text-xs text-ink-500">Connect & chat with anyone</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => { setShowNew((v) => !v); setShowUsers(true) }}>
            + New DM
          </Button>
        </div>

        {showNew && (
          <div className="border-b border-ink-200 p-3 bg-white space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowUsers(true)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  showUsers ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600'
                }`}
              >
                💬 Direct Message
              </button>
              <button
                type="button"
                onClick={() => setShowUsers(false)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  !showUsers ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600'
                }`}
              >
                📢 Channel
              </button>
            </div>

            {showUsers ? (
              <div className="space-y-2">
                <Input
                  placeholder="Search user by name or email…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
                <p className="text-[11px] text-ink-400 font-medium px-1">
                  Select a member to start DM:
                </p>
                {userResults.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-ink-400">
                    No users found matching &quot;{query}&quot;
                  </p>
                ) : (
                  <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
                    {userResults.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => void startDm(u.id)}
                          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-brand-50 transition-colors"
                        >
                          <img
                            src={avatarUrl(u.avatarUrl, u.name)}
                            alt=""
                            className="h-7 w-7 rounded-full border border-ink-200"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-ink-900">
                              {u.name}
                            </span>
                            <span className="block truncate text-[11px] text-ink-500">
                              {u.email}
                            </span>
                          </div>
                          <Badge tone={u.role === 'mentor' ? 'amber' : u.role === 'admin' ? 'red' : 'brand'}>
                            {u.role}
                          </Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Channel name (e.g. dsa-prep)"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                />
                <Button size="sm" onClick={() => void createNewChannel()}>
                  Create
                </Button>
              </div>
            )}
          </div>
        )}

        <ul className="flex-1 space-y-1 overflow-y-auto p-2">
          {chats.length === 0 ? (
            <li className="px-4 py-12 text-center text-xs text-ink-400 space-y-2">
              <p>No active conversations yet.</p>
              <Button size="sm" variant="secondary" onClick={() => { setShowNew(true); setShowUsers(true) }}>
                + Start First Chat
              </Button>
            </li>
          ) : (
            chats.map((chat) => {
              const p = peer(chat)
              const isActive = active?.id === chat.id
              const isOnline = p && presence[p.userId] === 'online'

              return (
                <li key={chat.id}>
                  <button
                    type="button"
                    onClick={() => void openChat(chat)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'text-ink-800 hover:bg-white'
                    }`}
                  >
                    <span className="relative shrink-0">
                      <img
                        src={avatarUrl(
                          chat.type === 'dm' ? (p?.avatarUrl ?? null) : null,
                          chat.type === 'dm' ? (p?.name ?? '?') : chat.name ?? '#'
                        )}
                        alt=""
                        className="h-10 w-10 rounded-full border border-white/20"
                      />
                      {chat.type === 'dm' && isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm font-semibold ${
                          isActive ? 'text-white' : 'text-ink-900'
                        }`}
                      >
                        {chat.type === 'dm' ? (p?.name ?? 'Unknown') : `# ${chat.name}`}
                      </span>
                      <span
                        className={`block truncate text-xs ${
                          isActive ? 'text-brand-100' : 'text-ink-400'
                        }`}
                      >
                        {chat.type === 'dm'
                          ? isOnline
                            ? '● Online'
                            : 'Offline'
                          : `${chat.memberIds.length} members`}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </aside>

      {/* Main Chat Conversation Area */}
      <section className="flex min-w-0 flex-1 flex-col bg-white">
        {!active ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState
              title="Direct Messages & Channels"
              description="Pick a conversation from the sidebar or click '+ New DM' to direct message any student, mentor, or admin."
              icon="💬"
            />
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between border-b border-ink-200 px-6 py-3.5 bg-white">
              {active.type === 'dm' ? (
                <div className="flex items-center gap-3">
                  <span className="relative">
                    <img
                      src={avatarUrl(peer(active)?.avatarUrl ?? null, peer(active)?.name ?? '?')}
                      alt=""
                      className="h-10 w-10 rounded-full border border-ink-200"
                    />
                    {presence[peer(active)?.userId ?? ''] === 'online' && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                    )}
                  </span>
                  <div>
                    <h3 className="font-bold text-ink-900 text-base">{peer(active)?.name}</h3>
                    <p
                      className={`text-xs font-medium ${
                        presence[peer(active)?.userId ?? ''] === 'online'
                          ? 'text-emerald-600'
                          : 'text-ink-400'
                      }`}
                    >
                      {presence[peer(active)?.userId ?? ''] === 'online'
                        ? '● Online'
                        : 'Offline'}
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="font-bold text-ink-900 text-base"># {active.name}</h3>
                  <p className="text-xs text-ink-500">{active.memberIds.length} channel members</p>
                </div>
              )}
            </header>

            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto bg-ink-50/30 p-6"
            >
              {messages.length === 0 ? (
                <div className="py-16 text-center text-xs text-ink-400 space-y-2">
                  <p className="text-2xl">👋</p>
                  <p className="font-semibold text-ink-700">No messages in this chat yet</p>
                  <p>Type your message below to start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => {
                  const mine = message.senderId === user?.id
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-2.5 ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                      {!mine && (
                        <img
                          src={avatarUrl(message.senderAvatar, message.senderName)}
                          alt=""
                          className="mt-1 h-8 w-8 shrink-0 rounded-full border border-ink-200"
                        />
                      )}
                      <div className={`max-w-[70%] ${mine ? 'text-right' : ''}`}>
                        {!mine && (
                          <p className="mb-1 text-xs font-semibold text-ink-600">
                            {message.senderName}
                          </p>
                        )}
                        <div
                          className={`inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs ${
                            mine
                              ? 'rounded-br-xs bg-brand-600 font-medium text-white'
                              : 'rounded-bl-xs border border-ink-200 bg-white text-ink-900'
                          }`}
                        >
                          {message.content}
                        </div>
                        <p className="mt-1 text-[10px] text-ink-400 font-medium">
                          {timeAgo(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <form onSubmit={send} className="border-t border-ink-200 p-4 bg-white">
              <div className="flex gap-2">
                <Input
                  placeholder={`Type your message to ${
                    active.type === 'dm' ? (peer(active)?.name ?? '') : `#${active.name}`
                  }…`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={!draft.trim()}>
                  Send ✉
                </Button>
              </div>
            </form>
          </>
        )}
      </section>
      {error && (
        <div className="absolute bottom-4 right-4 rounded-xl border border-red-200 bg-red-900 p-3 text-xs font-bold text-white shadow-xl">
          {error}
        </div>
      )}
    </div>
  )
}

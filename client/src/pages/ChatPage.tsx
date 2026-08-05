import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { createChannel, createDm, getChatMessages, getChats, searchUsers, type ChatList } from '../api/features'
import { connectSocket, type AppSocket } from '../lib/socket'
import { timeAgo, avatarUrl } from '../lib/format'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/Card'
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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
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

  const send = (e: FormEvent) => {
    e.preventDefault()
    if (!active || !draft.trim()) return
    socket?.emit('chat:send', { chatId: active.id, content: draft.trim() })
    setDraft('')
  }

  const startDm = async (otherId: string) => {
    try {
      const { chat } = await createDm(otherId)
      setShowUsers(false)
      setQuery('')
      setUserResults([])
      await openById(chat.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start chat')
    }
  }

  useEffect(() => {
    if (!showUsers) return
    const timer = setTimeout(() => {
      searchUsers(query.trim())
        .then((data) => setUserResults(data.users))
        .catch(() => setUserResults([]))
    }, 250)
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
    <div className="relative mx-auto flex h-[calc(100vh-8rem)] max-w-5xl overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm">
      <aside className="flex w-72 shrink-0 flex-col border-r border-ink-200">
        <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
          <h2 className="font-semibold text-ink-900">Messages</h2>
          <Button size="sm" variant="secondary" onClick={() => setShowNew((v) => !v)}>
            +
          </Button>
        </div>

        {showNew && (
          <div className="border-b border-ink-200 p-3">
            <div className="mb-2 flex gap-2">
              <Button size="sm" variant={showUsers ? 'primary' : 'ghost'} onClick={() => { setShowUsers(true); setShowNew(true) }}>
                New DM
              </Button>
              <Button size="sm" variant={!showUsers ? 'primary' : 'ghost'} onClick={() => setShowUsers(false)}>
                New channel
              </Button>
            </div>
            {showUsers ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Search users…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {userResults.length === 0 ? (
                    <p className="px-2 py-3 text-center text-xs text-ink-400">No users found</p>
                  ) : (
                    <ul className="max-h-40 space-y-1 overflow-y-auto">
                      {userResults.map((u) => (
                        <li key={u.id}>
                          <button
                            type="button"
                            onClick={() => void startDm(u.id)}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-ink-50"
                          >
                            <img src={avatarUrl(u.avatarUrl, u.name)} alt="" className="h-6 w-6 rounded-full" />
                            <span className="text-sm">{u.name}</span>
                            <span className="ml-auto text-xs text-ink-400">{u.role}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
            ) : (
              <div className="flex gap-2">
                <Input placeholder="Channel name" value={channelName} onChange={(e) => setChannelName(e.target.value)} />
                <Button size="sm" onClick={() => void createNewChannel()}>Create</Button>
              </div>
            )}
          </div>
        )}

        <ul className="flex-1 space-y-1 overflow-y-auto p-2">
          {chats.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-ink-400">
              No conversations yet. Start one with +.
            </li>
          ) : (
            chats.map((chat) => {
              const p = peer(chat)
              const isActive = active?.id === chat.id
              return (
                <li key={chat.id}>
                  <button
                    type="button"
                    onClick={() => void openChat(chat)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                      isActive ? 'bg-brand-50' : 'hover:bg-ink-50'
                    }`}
                  >
                    <span className="relative">
                      <img
                        src={avatarUrl(chat.type === 'dm' ? (p?.avatarUrl ?? null) : null, chat.type === 'dm' ? (p?.name ?? '?') : chat.name ?? '#' )}
                        alt=""
                        className="h-9 w-9 rounded-full"
                      />
                      {chat.type === 'dm' && p && presence[p.userId] === 'online' && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-800">
                        {chat.type === 'dm' ? (p?.name ?? 'Unknown') : `# ${chat.name}`}
                      </span>
                      <span className="block truncate text-xs text-ink-400">
                        {chat.type === 'dm' ? (presence[p?.userId ?? ''] === 'online' ? 'Online' : 'Offline') : `${chat.memberIds.length} members`}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {!active ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              title="Select a conversation"
              description="Pick a chat from the sidebar or start a new one."
              icon="✉"
            />
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-ink-200 px-5 py-3">
              {active.type === 'dm' ? (
                <>
                  <img
                    src={avatarUrl(peer(active)?.avatarUrl ?? null, peer(active)?.name ?? '?')}
                    alt=""
                    className="h-9 w-9 rounded-full"
                  />
                  <div>
                    <h3 className="font-semibold text-ink-900">{peer(active)?.name}</h3>
                    <p className={`text-xs ${presence[peer(active)?.userId ?? ''] === 'online' ? 'text-green-600' : 'text-ink-400'}`}>
                      {presence[peer(active)?.userId ?? ''] === 'online' ? '● Online' : 'Offline'}
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <h3 className="font-semibold text-ink-900"># {active.name}</h3>
                  <p className="text-xs text-ink-400">{active.memberIds.length} members</p>
                </div>
              )}
            </header>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-ink-50/40 px-5 py-4">
              {messages.length === 0 ? (
                <EmptyState
                  title="No messages yet"
                  description="Say hello to start the conversation!"
                  icon="💬"
                />
              ) : (
                messages.map((message) => {
                  const mine = message.senderId === user?.id
                  return (
                    <div key={message.id} className={`flex gap-2 ${mine ? 'justify-end' : ''}`}>
                      {!mine && (
                        <img src={avatarUrl(message.senderAvatar, message.senderName)} alt="" className="mt-1 h-7 w-7 shrink-0 rounded-full" />
                      )}
                      <div className={`max-w-[70%] ${mine ? 'text-right' : ''}`}>
                        {!mine && (
                          <p className="mb-0.5 text-xs font-medium text-ink-500">{message.senderName}</p>
                        )}
                        <div
                          className={`inline-block rounded-2xl px-3 py-2 text-sm shadow-sm ${
                            mine
                              ? 'rounded-br-sm bg-brand-600 text-white'
                              : 'rounded-bl-sm border border-ink-200 bg-white text-ink-800'
                          }`}
                        >
                          {message.content}
                        </div>
                        <p className="mt-0.5 text-[10px] text-ink-400">{timeAgo(message.createdAt)}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <form onSubmit={send} className="border-t border-ink-200 p-3">
              <div className="flex gap-2">
                <Input
                  placeholder={`Message ${active.type === 'dm' ? (peer(active)?.name ?? '') : `#${active.name}`}…`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={!draft.trim()}>Send</Button>
              </div>
            </form>
          </>
        )}
      </section>
      {error && (
        <div className="absolute bottom-4 right-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}

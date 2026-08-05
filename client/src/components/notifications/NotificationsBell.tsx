import { useCallback, useEffect, useRef, useState } from 'react'
import { getNotifications, markNotificationRead, markNotificationsRead } from '../../api/features'
import { connectSocket, type AppSocket } from '../../lib/socket'
import { timeAgo } from '../../lib/format'
import type { Notification } from '../../types'

export function NotificationsBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const data = await getNotifications()
      setNotifications(data.notifications)
      setUnread(data.unreadCount)
    } catch {
      // ignore — badge stays at previous value
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const s: AppSocket = connectSocket()
    const handler = (n: Notification) => {
      setNotifications((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev]))
      setUnread((prev) => prev + 1)
    }
    s.on('notification:new', handler)
    return () => {
      s.off('notification:new', handler)
    }
  }, [])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const openPanel = async () => {
    setOpen((v) => !v)
    if (!open) void load()
  }

  const markAll = async () => {
    await markNotificationsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnread(0)
  }

  const markOne = async (id: string) => {
    await markNotificationRead(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnread((prev) => Math.max(0, prev - 1))
  }

  const iconFor = (type: string) => {
    switch (type) {
      case 'like':
        return '♥'
      case 'comment':
        return '💬'
      case 'interest':
        return '✺'
      default:
        return '🔔'
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => void openPanel()}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-lg text-ink-600 transition-colors hover:bg-ink-100"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-ink-900">Notifications</h3>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAll()}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {loading ? (
              <li className="px-4 py-6 text-center text-sm text-ink-400">Loading…</li>
            ) : notifications.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-ink-400">No notifications yet</li>
            ) : (
              notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void markOne(n.id)}
                    className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-50 ${
                      n.read ? 'opacity-60' : 'bg-brand-50/40'
                    }`}
                  >
                    <span className="mt-0.5 w-5 text-center">{iconFor(n.type)}</span>
                    <span className="min-w-0">
                      <span className="block text-sm text-ink-800">{n.body}</span>
                      <span className="block text-xs text-ink-400">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.read && (
                      <span className="ml-auto mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

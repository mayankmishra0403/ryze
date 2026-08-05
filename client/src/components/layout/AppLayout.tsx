import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { NotificationsBell } from '../notifications/NotificationsBell'
import { CommandPalette } from '../ui/CommandPalette'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/feed', label: 'Community Feed', icon: '◉' },
  { to: '/placement', label: 'Placement Hub', icon: '⌖' },
  { to: '/challenges', label: 'Daily Challenges', icon: '⚡' },
  { to: '/notes', label: 'Notes', icon: '▤' },
  { to: '/startup', label: 'Startup Hub', icon: '✺' },
  { to: '/chat', label: 'Messages', icon: '✉' },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCmdPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen">
      <CommandPalette
        isOpen={isCmdPaletteOpen}
        onClose={() => setIsCmdPaletteOpen(false)}
      />

      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-ink-200 bg-white">
        <div className="flex items-center gap-2 border-b border-ink-200 px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-black text-white">
            R
          </span>
          <span className="text-lg font-extrabold tracking-tight text-ink-900">
            RYZE
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                }`
              }
            >
              <span className="w-5 text-center">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-ink-200 p-3">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-100'
              }`
            }
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-200 text-sm font-bold text-ink-700">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </span>
            <span className="truncate">{user?.name ?? 'Profile'}</span>
          </NavLink>
          <Button variant="ghost" size="sm" className="w-full" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </aside>

      <main className="ml-60 flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-ink-200 bg-white px-8 py-3">
          <button
            onClick={() => setIsCmdPaletteOpen(true)}
            className="flex items-center gap-3 rounded-xl border border-ink-200 bg-ink-50 px-3.5 py-1.5 text-xs text-ink-500 transition-colors hover:border-ink-300 hover:bg-ink-100"
          >
            <span>🔍 Search or type command...</span>
            <kbd className="rounded-md border border-ink-200 bg-white px-1.5 py-0.5 font-semibold text-ink-600">
              ⌘K
            </kbd>
          </button>

          <div className="flex items-center gap-4">
            <NotificationsBell />
          </div>
        </header>
        <div className="flex-1 px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}


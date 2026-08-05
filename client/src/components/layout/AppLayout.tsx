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
    <div className="flex min-h-screen bg-[#0b0f19] text-slate-100">
      <CommandPalette
        isOpen={isCmdPaletteOpen}
        onClose={() => setIsCmdPaletteOpen(false)}
      />

      {/* Stitch Dark Sidebar */}
      <aside className="fixed inset-y-0 left-0 flex w-64 flex-col border-r border-white/10 bg-[#111625]/90 backdrop-blur-xl shadow-2xl z-40">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-400 font-black text-white shadow-lg shadow-brand-500/30">
              R
            </span>
            <div>
              <span className="text-xl font-black tracking-tight text-white">
                RYZE
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-400">
                Engineering Elite
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3.5 py-5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-500/15 text-indigo-300 border-l-3 border-brand-500 shadow-xs'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <span className="w-5 text-center text-base opacity-90">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4 bg-white/2">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `mb-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-500/20 text-brand-300' : 'text-slate-300 hover:bg-white/5'
              }`
            }
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 text-sm font-bold text-white shadow-xs">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{user?.name ?? 'Profile'}</p>
              <p className="truncate text-[10px] text-slate-400 uppercase tracking-wider">{user?.role}</p>
            </div>
          </NavLink>
          <Button variant="ghost" size="sm" className="w-full text-slate-400 hover:text-white hover:bg-white/5" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-64 flex min-h-screen flex-1 flex-col bg-[#0b0f19]">
        <header className="flex items-center justify-between border-b border-white/10 bg-[#111625]/80 px-8 py-3.5 backdrop-blur-xl sticky top-0 z-30">
          <button
            onClick={() => setIsCmdPaletteOpen(true)}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-xs text-slate-400 transition-all hover:border-brand-500/40 hover:bg-slate-900 hover:text-slate-200"
          >
            <span>🔍 Search platform or type command...</span>
            <kbd className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-bold text-slate-300">
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


import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

interface CommandItem {
  id: string
  label: string
  category: 'Navigation' | 'Actions' | 'Explore'
  icon: string
  shortcut?: string
  action: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const navigate = useNavigate()

  const items: CommandItem[] = useMemo(
    () => [
      // Navigation
      {
        id: 'nav-dashboard',
        label: 'Go to Dashboard',
        category: 'Navigation',
        icon: '▦',
        action: () => navigate('/dashboard'),
      },
      {
        id: 'nav-feed',
        label: 'Go to Community Feed',
        category: 'Navigation',
        icon: '◉',
        action: () => navigate('/feed'),
      },
      {
        id: 'nav-placement',
        label: 'Go to Placement Hub',
        category: 'Navigation',
        icon: '⌖',
        action: () => navigate('/placement'),
      },
      {
        id: 'nav-challenges',
        label: 'Go to Daily Challenges',
        category: 'Navigation',
        icon: '⚡',
        action: () => navigate('/challenges'),
      },
      {
        id: 'nav-notes',
        label: 'Go to Notes Sharing',
        category: 'Navigation',
        icon: '▤',
        action: () => navigate('/notes'),
      },
      {
        id: 'nav-startup',
        label: 'Go to Startup Hub',
        category: 'Navigation',
        icon: '✺',
        action: () => navigate('/startup'),
      },
      {
        id: 'nav-chat',
        label: 'Go to Messages & Chat',
        category: 'Navigation',
        icon: '✉',
        action: () => navigate('/chat'),
      },
      {
        id: 'nav-profile',
        label: 'Go to Profile',
        category: 'Navigation',
        icon: '👤',
        action: () => navigate('/profile'),
      },

      // Actions
      {
        id: 'act-challenge',
        label: 'Solve Today\'s Coding Challenge',
        category: 'Actions',
        icon: '💻',
        shortcut: '⚡',
        action: () => navigate('/challenges'),
      },
      {
        id: 'act-upload-note',
        label: 'Upload Engineering Notes (PDF)',
        category: 'Actions',
        icon: '📤',
        action: () => navigate('/notes'),
      },
      {
        id: 'act-new-post',
        label: 'Create a Community Post',
        category: 'Actions',
        icon: '✍️',
        action: () => navigate('/feed'),
      },
      {
        id: 'act-pitch-idea',
        label: 'Post a Startup Idea / Find Co-founder',
        category: 'Actions',
        icon: '🚀',
        action: () => navigate('/startup'),
      },

      // Explore
      {
        id: 'exp-pyq',
        label: 'Explore Previous Year Questions (PYQs)',
        category: 'Explore',
        icon: '📚',
        action: () => navigate('/placement'),
      },
      {
        id: 'exp-roadmaps',
        label: 'View Placement Roadmaps',
        category: 'Explore',
        icon: '🗺️',
        action: () => navigate('/placement'),
      },
    ],
    [navigate]
  )

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    )
  }, [items, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (isOpen) {
          onClose()
        } else {
          // Open trigger handled by parent
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSelect = (item: CommandItem) => {
    item.action()
    onClose()
    setQuery('')
  }

  const handleKeyDownModal = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        prev === 0 ? Math.max(0, filteredItems.length - 1) : prev - 1
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex])
      }
    }
  }

  return (
    <div
      className="aria-hidden fixed inset-0 z-50 flex items-start justify-center bg-ink-950/60 pt-20 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDownModal}
      >
        <div className="flex items-center border-b border-ink-200 px-4 py-3">
          <span className="mr-3 text-lg text-ink-400">🔍</span>
          <input
            type="text"
            className="w-full bg-transparent text-base font-medium text-ink-900 placeholder-ink-400 focus:outline-hidden"
            placeholder="Type a command or search (e.g. 'notes', 'placement', 'challenge')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <kbd className="ml-2 rounded-md bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-500 border border-ink-200">
            ESC
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-ink-500">
              No matching command found for &quot;{query}&quot;
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex cursor-pointer items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-ink-700 hover:bg-ink-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-100 text-sm">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-400">{item.category}</span>
                    {item.shortcut && (
                      <kbd className="rounded-sm bg-ink-100 px-1.5 py-0.5 text-xs font-semibold text-ink-500">
                        {item.shortcut}
                      </kbd>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-ink-100 bg-ink-50 px-4 py-2 text-xs text-ink-500">
          <div className="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
          </div>
          <span>RYZE Command Palette</span>
        </div>
      </div>
    </div>
  )
}

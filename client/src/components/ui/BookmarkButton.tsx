import { useState, useEffect } from 'react'
import { useToast } from './Toast'

interface BookmarkButtonProps {
  itemId: string
  itemType: 'note' | 'job' | 'pyq' | 'experience'
  title: string
  className?: string
}

export function BookmarkButton({
  itemId,
  itemType,
  title,
  className = '',
}: BookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ryze_bookmarks') || '[]')
      const exists = saved.some((b: { id: string }) => b.id === itemId)
      setIsBookmarked(exists)
    } catch {
      setIsBookmarked(false)
    }
  }, [itemId])

  const toggleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const saved = JSON.parse(localStorage.getItem('ryze_bookmarks') || '[]')
      if (isBookmarked) {
        const filtered = saved.filter((b: { id: string }) => b.id !== itemId)
        localStorage.setItem('ryze_bookmarks', JSON.stringify(filtered))
        setIsBookmarked(false)
        showToast(`Removed "${title}" from bookmarks`, 'info')
      } else {
        const updated = [...saved, { id: itemId, type: itemType, title, savedAt: new Date().toISOString() }]
        localStorage.setItem('ryze_bookmarks', JSON.stringify(updated))
        setIsBookmarked(true)
        showToast(`Saved "${title}" to bookmarks! 🔖`, 'success')
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <button
      type="button"
      onClick={toggleBookmark}
      title={isBookmarked ? 'Remove Bookmark' : 'Save to Bookmarks'}
      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
        isBookmarked
          ? 'bg-amber-100 text-amber-800 border border-amber-300'
          : 'bg-ink-100 text-ink-600 hover:bg-ink-200 border border-ink-200'
      } ${className}`}
    >
      <span>{isBookmarked ? '🔖 Saved' : '🔖 Bookmark'}</span>
    </button>
  )
}

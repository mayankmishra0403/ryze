import { Button } from '../ui/Button'
import { Badge } from '../ui/Card'
import { BookmarkButton } from '../ui/BookmarkButton'

interface DocumentViewerModalProps {
  note: {
    id: string
    title: string
    description?: string | null
    authorName: string
    fileUrl?: string | null
    downloadCount: number
    tags: string[]
    createdAt: string
  } | null
  onClose: () => void
  onDownload: (noteId: string) => void
}

export function DocumentViewerModal({
  note,
  onClose,
  onDownload,
}: DocumentViewerModalProps) {
  if (!note) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-200 bg-ink-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-xl font-bold text-brand-700">
              📄
            </span>
            <div>
              <h3 className="text-base font-bold text-ink-900">{note.title}</h3>
              <p className="text-xs text-ink-500">
                Uploaded by {note.authorName} · {note.downloadCount} downloads
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400">
              Description & Summary
            </h4>
            <p className="mt-1 text-sm text-ink-700 leading-relaxed">
              {note.description || 'No detailed description provided.'}
            </p>
          </div>

          {note.tags.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400">
                Tags & Subject Categories
              </h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {note.tags.map((tag) => (
                  <Badge key={tag} tone="brand">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Document Preview Box */}
          <div className="rounded-xl border border-ink-200 bg-ink-900 p-8 text-center text-ink-100 space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-800 text-3xl">
              📑
            </div>
            <div>
              <p className="font-semibold text-sm text-white">{note.title}.pdf</p>
              <p className="text-xs text-ink-400">Engineering Study Material PDF Document</p>
            </div>
            <div className="pt-2">
              <Button
                type="button"
                onClick={() => {
                  onDownload(note.id)
                }}
              >
                📥 Download Document ({note.downloadCount} downloads)
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-ink-100 bg-ink-50 px-6 py-3">
          <BookmarkButton itemId={note.id} itemType="note" title={note.title} />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

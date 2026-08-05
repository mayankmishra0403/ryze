import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  deleteNote,
  getNotes,
  getNoteTags,
  trackDownload,
  uploadNote,
  type TagCount,
} from '../api/features'
import { API_URL } from '../config'
import { timeAgo, avatarUrl } from '../lib/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Input, Textarea } from '../components/ui/Input'
import { Badge, Card, EmptyState } from '../components/ui/Card'
import { BookmarkButton } from '../components/ui/BookmarkButton'
import { DocumentViewerModal } from '../components/notes/DocumentViewerModal'
import type { Note } from '../types'

const ACCEPTED = '.pdf,.doc,.docx,.txt,.md'

export function NotesPage() {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [tags, setTags] = useState<TagCount[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [previewNote, setPreviewNote] = useState<Note | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagInput, setTagInput] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const load = useCallback(
    async (cursor?: string) => {
      const data = await getNotes({
        limit: 20,
        cursor,
        search: search || undefined,
        tag: activeTag ?? undefined,
      })
      setNextCursor(data.nextCursor)
      return data.notes
    },
    [search, activeTag],
  )

  useEffect(() => {
    let active = true
    getNoteTags().then(({ tags }) => active && setTags(tags)).catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    load()
      .then((notes) => active && setNotes(notes))
      .catch(() => active && setError('Failed to load notes'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [load])

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault()
    if (!file || !title.trim() || uploading) return
    setUploading(true)
    setError(null)
    setNotice(null)
    try {
      const { note } = await uploadNote({
        file,
        title: title.trim(),
        description: description.trim() || undefined,
        tags: tagInput
          .split(',')
          .map((t) => t.trim().replace(/^#/, ''))
          .filter(Boolean),
      })
      setNotes((prev) => [note, ...prev])
      setFile(null)
      setTitle('')
      setDescription('')
      setTagInput('')
      if (fileRef.current) fileRef.current.value = ''
      setNotice('Note published')
      getNoteTags().then(({ tags }) => setTags(tags)).catch(() => {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (note: Note) => {
    trackDownload(note.id).catch(() => {})
    if (note.fileUrl) {
      window.open(`${API_URL}${note.fileUrl}`, '_blank', 'noopener')
    }
  }

  const handleDelete = async (note: Note) => {
    if (!window.confirm(`Delete "${note.title}"?`)) return
    try {
      await deleteNote(note.id)
      setNotes((prev) => prev.filter((n) => n.id !== note.id))
      setNotice('Note deleted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const applyTag = (tag: string | null) => {
    setActiveTag((prev) => (prev === tag ? null : tag))
    if (searchRef.current) searchRef.current.focus()
  }

  const loadMore = async () => {
    if (!nextCursor) return
    const more = await load(nextCursor)
    setNotes((prev) => [...prev, ...more])
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Notes"
        description="Share study material and discover resources from the community."
      />

      {(notice || error) && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}
        >
          {error ?? notice}
        </p>
      )}

      <Card title="Share a note">
        <form onSubmit={handleUpload} className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileRef.current?.click()}
            >
              Choose file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="truncate text-sm text-ink-500">
              {file ? `${file.name} (${(file.size / 1024).toFixed(0)} KB)` : 'PDF, Word, TXT, MD — up to 20 MB'}
            </span>
          </div>
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. DBMS notes — Unit 3"
            required
          />
          <Textarea
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <Input
            label="Tags (comma separated)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="e.g. dbms, sql, sem5"
          />
          <div className="flex justify-end">
            <Button type="submit" loading={uploading} disabled={!file || !title.trim()}>
              Publish note
            </Button>
          </div>
        </form>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          ref={searchRef}
          placeholder="Search notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => applyTag(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeTag === null
                ? 'bg-brand-600 text-white'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
            }`}
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag.name}
              type="button"
              onClick={() => applyTag(tag.name)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeTag === tag.name
                  ? 'bg-brand-600 text-white'
                  : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
            >
              #{tag.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-ink-400">
          Loading notes…
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          title={activeTag || search ? 'No matching notes' : 'No notes yet'}
          description={
            activeTag || search
              ? 'Try a different tag or search term.'
              : 'Be the first to share your notes with the community!'
          }
          icon="▤"
        />
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <img
                  src={avatarUrl(note.authorAvatar, note.authorName)}
                  alt=""
                  className="h-9 w-9 rounded-full"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="truncate font-semibold text-ink-900">{note.title}</h3>
                    <span className="shrink-0 text-xs text-ink-400">
                      {timeAgo(note.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-ink-500">
                    by {note.authorName}
                    {note.authorId === user?.id ? ' (you)' : ''}
                  </p>
                  {note.description && (
                    <p className="mt-1 text-sm text-ink-700">{note.description}</p>
                  )}
                  {note.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {note.tags.map((tag) => (
                        <Badge key={tag}>{tag}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3 text-xs text-ink-500">
                    <div className="flex items-center gap-3">
                      <span>⬇ {note.downloadCount} downloads</span>
                      {note.authorId === user?.id && (
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={() => void handleDelete(note)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <BookmarkButton itemId={note.id} itemType="note" title={note.title} />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant={note.fileUrl ? 'primary' : 'secondary'}
                    disabled={!note.fileUrl}
                    onClick={() => void handleDownload(note)}
                  >
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPreviewNote(note)}
                  >
                    👁 Preview
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <DocumentViewerModal
        note={previewNote}
        onClose={() => setPreviewNote(null)}
        onDownload={(id) => {
          const n = notes.find((x) => x.id === id)
          if (n) handleDownload(n)
        }}
      />

      {nextCursor && (
        <div className="text-center">
          <Button variant="secondary" onClick={() => void loadMore()}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}

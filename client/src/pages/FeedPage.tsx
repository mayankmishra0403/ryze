import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getSocket } from '../lib/socket'
import { timeAgo, avatarUrl } from '../lib/format'
import { addComment, createPost, getComments, getPosts, toggleLike } from '../api/features'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Textarea, Input } from '../components/ui/Input'
import { Badge, EmptyState } from '../components/ui/Card'
import { RichContent } from '../components/ui/RichContent'
import type { Comment, Post } from '../types'

export function FeedPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [content, setContent] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [commentsFor, setCommentsFor] = useState<Record<string, Comment[]>>({})
  const [openComments, setOpenComments] = useState<Set<string>>(new Set())
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const loadedRef = useRef(false)

  const load = useCallback(async (cursor?: string) => {
    const data = await getPosts(20, cursor)
    setNextCursor(data.nextCursor)
    return data.posts
  }, [])

  useEffect(() => {
    let active = true
    load()
      .then((posts) => {
        if (!active) return
        setPosts((prev) => {
          const merged = new Map(prev.map((p) => [p.id, p]))
          posts.forEach((p) => merged.set(p.id, p))
          return [...merged.values()].sort(
            (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
          )
        })
      })
      .catch(() => setError('Failed to load the feed'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [load])

  useEffect(() => {
    if (loadedRef.current) return
    const socket = getSocket()
    if (!socket) return
    loadedRef.current = true

    socket.on('feed:new', (post) => {
      setPosts((prev) =>
        [post as Post, ...prev].filter(
          (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i,
        ),
      )
    })
    socket.on('feed:update', ({ postId, likeCount, commentCount }) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                likeCount: likeCount ?? p.likeCount,
                commentCount: commentCount ?? p.commentCount,
              }
            : p,
        ),
      )
    })
    return () => {
      socket.off('feed:new')
      socket.off('feed:update')
    }
  }, [])

  const handlePost = async (e: FormEvent) => {
    e.preventDefault()
    if (!content.trim() || posting) return
    setPosting(true)
    setError(null)
    try {
      const { post } = await createPost(
        content.trim(),
        tagInput
          .split(',')
          .map((t) => t.trim().replace(/^#/, ''))
          .filter(Boolean),
      )
      setPosts((prev) => [post, ...prev])
      setContent('')
      setTagInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post')
    } finally {
      setPosting(false)
    }
  }

  const handleLike = async (postId: string) => {
    try {
      const { likeCount } = await toggleLike(postId)
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likeCount } : p)),
      )
    } catch {
      // ignore transient errors
    }
  }

  const toggleComments = async (postId: string) => {
    const next = new Set(openComments)
    if (next.has(postId)) {
      next.delete(postId)
    } else {
      next.add(postId)
      if (!commentsFor[postId]) {
        const { comments } = await getComments(postId)
        setCommentsFor((prev) => ({ ...prev, [postId]: comments }))
      }
    }
    setOpenComments(next)
  }

  const handleComment = async (postId: string) => {
    const draft = commentDrafts[postId] ?? ''
    if (!draft.trim()) return
    try {
      const { comment } = await addComment(postId, draft.trim())
      setCommentsFor((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] ?? []), comment],
      }))
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }))
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p,
        ),
      )
    } catch {
      // ignore
    }
  }

  const loadMore = async () => {
    if (!nextCursor) return
    const more = await load(nextCursor)
    setPosts((prev) => [...prev, ...more])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-ink-400">
        Loading feed…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Community Feed"
        description="Share knowledge, discuss, and connect with the RYZE community."
      />

      <form
        onSubmit={handlePost}
        className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm"
      >
        <div className="flex gap-3">
          <img
            src={avatarUrl(user?.avatarUrl ?? null, user?.name ?? '?')}
            alt=""
            className="h-10 w-10 rounded-full"
          />
          <Textarea
            placeholder="Share something with the community…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="flex-1"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <Input
            placeholder="Tags (comma separated) — e.g. dsa, placement"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            className="max-w-sm"
          />
          <Button type="submit" loading={posting} disabled={!content.trim()}>
            Post
          </Button>
        </div>
      </form>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {posts.length === 0 ? (
        <EmptyState
          title="No posts yet"
          description="Be the first to share something with the community!"
          icon="◉"
        />
      ) : (
        <ul className="space-y-4">
          {posts.map((post) => (
            <li key={post.id} className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <img
                  src={avatarUrl(post.authorAvatar, post.authorName)}
                  alt=""
                  className="h-10 w-10 rounded-full"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-ink-900">
                      {post.authorName}
                    </span>
                    <span className="text-xs text-ink-400">{timeAgo(post.createdAt)}</span>
                  </div>
                  <RichContent content={post.content} className="mt-1 text-ink-800" />
                  {post.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {post.tags.map((tag) => (
                        <Badge key={tag}>#{tag}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-4 border-t border-ink-100 pt-3 text-sm">
                    <button
                      type="button"
                      onClick={() => void handleLike(post.id)}
                      className="flex items-center gap-1 text-ink-500 transition-colors hover:text-brand-600"
                    >
                      ♥ {post.likeCount}
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleComments(post.id)}
                      className="flex items-center gap-1 text-ink-500 transition-colors hover:text-brand-600"
                    >
                      💬 {post.commentCount}
                    </button>
                  </div>

                  {openComments.has(post.id) && (
                    <div className="mt-3 space-y-3">
                      {commentsFor[post.id]?.map((comment) => (
                        <div key={comment.id} className="flex gap-2 rounded-lg bg-ink-50 p-3">
                          <img
                            src={avatarUrl(comment.authorAvatar, comment.authorName)}
                            alt=""
                            className="h-7 w-7 rounded-full"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-xs font-semibold text-ink-800">
                                {comment.authorName}
                              </span>
                              <span className="text-[11px] text-ink-400">
                                {timeAgo(comment.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm text-ink-700">{comment.content}</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Write a comment…"
                          value={commentDrafts[post.id] ?? ''}
                          onChange={(e) =>
                            setCommentDrafts((prev) => ({
                              ...prev,
                              [post.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              void handleComment(post.id)
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => void handleComment(post.id)}
                          disabled={!(commentDrafts[post.id] ?? '').trim()}
                        >
                          Reply
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

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

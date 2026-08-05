import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getSocket } from '../lib/socket'
import { timeAgo, avatarUrl } from '../lib/format'
import {
  addComment,
  createPost,
  getComments,
  getFollows,
  getPosts,
  toggleFollow,
  toggleLike,
  toggleSave,
  type FeedFilter,
} from '../api/features'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Textarea, Input } from '../components/ui/Input'
import { Badge, EmptyState } from '../components/ui/Card'
import { RichContent } from '../components/ui/RichContent'
import type { Comment, Post, PostKind } from '../types'

const FEED_TABS: { key: FeedFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'following', label: 'Following' },
  { key: 'saved', label: 'Saved' },
]

const KIND_LABEL: Record<PostKind, string> = {
  text: 'Text',
  challenge: 'Challenge',
  note: 'Note',
  question: 'Question',
}

export function FeedPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [content, setContent] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [postKind, setPostKind] = useState<PostKind>('text')
  const [commentsFor, setCommentsFor] = useState<Record<string, Comment[]>>({})
  const [openComments, setOpenComments] = useState<Set<string>>(new Set())
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [replyingTo, setReplyingTo] = useState<Record<string, string | null>>({})
  const [feed, setFeed] = useState<FeedFilter>('all')
  const [error, setError] = useState<string | null>(null)
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!user?.id) return
    getFollows(user.id)
      .then(({ following }) =>
        setFollowingIds(new Set(following.map((f) => f.id))),
      )
      .catch(() => {})
  }, [user?.id])

  const load = useCallback(async (cursor?: string) => {
    const data = await getPosts(20, cursor, feed)
    setNextCursor(data.nextCursor)
    return data.posts
  }, [feed])

  useEffect(() => {
    let active = true
    setLoading(true)
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
  }, [load, feed])

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
      const { post } = await createPost({
        content: content.trim(),
        tags: tagInput
          .split(',')
          .map((t) => t.trim().replace(/^#/, ''))
          .filter(Boolean),
        kind: postKind,
      })
      setPosts((prev) => [post, ...prev])
      setContent('')
      setTagInput('')
      setPostKind('text')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post')
    } finally {
      setPosting(false)
    }
  }

  const handleLike = async (postId: string) => {
    try {
      const { likeCount, liked } = await toggleLike(postId)
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likeCount, liked } : p)),
      )
    } catch {
      // ignore transient errors
    }
  }

  const handleSave = async (postId: string) => {
    try {
      const { saved } = await toggleSave(postId)
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, saved } : p)),
      )
      if (feed === 'saved' && !saved) {
        setPosts((prev) => prev.filter((p) => p.id !== postId))
      }
    } catch {
      // ignore transient errors
    }
  }

  const handleFollow = async (authorId: string) => {
    try {
      const { following } = await toggleFollow(authorId)
      setFollowingIds((prev) => {
        const next = new Set(prev)
        if (following) next.add(authorId)
        else next.delete(authorId)
        return next
      })
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
    const parentId = replyingTo[postId] ?? null
    if (!draft.trim()) return
    try {
      const { comment } = await addComment(postId, draft.trim(), parentId)
      setCommentsFor((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] ?? []), comment],
      }))
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }))
      setReplyingTo((prev) => ({ ...prev, [postId]: null }))
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

  const buildCommentTree = (postId: string): Comment[] => {
    const list = commentsFor[postId] ?? []
    const byParent = new Map<string | null, Comment[]>()
    for (const c of list) {
      const key = c.parentId
      const arr = byParent.get(key) ?? []
      arr.push(c)
      byParent.set(key, arr)
    }
    const flatten = (parentId: string | null, depth: number): Comment[] => {
      const kids = byParent.get(parentId) ?? []
      const out: Comment[] = []
      for (const k of kids) {
        out.push(k)
        if (depth < 1) out.push(...flatten(k.id, depth + 1))
      }
      return out
    }
    return flatten(null, 0)
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

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {FEED_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFeed(tab.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                feed === tab.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {feed !== 'all' && (
          <button
            type="button"
            onClick={() => {
              setPosts([])
              setNextCursor(null)
            }}
            className="text-xs text-ink-400 hover:text-ink-600"
          >
            Refresh
          </button>
        )}
      </div>

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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={postKind}
              onChange={(e) => setPostKind(e.target.value as PostKind)}
              className="rounded-lg border border-ink-300 bg-white px-2.5 py-2 text-xs font-medium text-ink-700 focus:outline-hidden"
            >
              {Object.entries(KIND_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <Input
              placeholder="Tags (comma separated) — e.g. dsa, placement"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              className="max-w-sm"
            />
          </div>
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
                <Link
                  to={`/profile/${post.authorId}`}
                  className="flex items-start gap-3"
                >
                  <img
                    src={avatarUrl(post.authorAvatar, post.authorName)}
                    alt=""
                    className="h-10 w-10 rounded-full"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Link
                        to={`/profile/${post.authorId}`}
                        className="text-sm font-semibold text-ink-900 hover:text-brand-600"
                      >
                        {post.authorName}
                      </Link>
                      {post.authorId !== user?.id && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleFollow(post.authorId)}
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                              followingIds.has(post.authorId)
                                ? 'border-brand-200 bg-brand-50 text-brand-600'
                                : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                            }`}
                          >
                            {followingIds.has(post.authorId) ? 'Following ✓' : '+ Follow'}
                          </button>
                          <Link
                            to={`/chat?userId=${post.authorId}`}
                            className="rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[10px] font-bold text-ink-600 hover:bg-ink-100 transition-colors"
                          >
                            💬 Message
                          </Link>
                        </div>
                      )}
                    </span>
                    <span className="text-xs text-ink-400">{timeAgo(post.createdAt)}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <RichContent content={post.content} className="mt-1 text-ink-800" />
                    {post.kind !== 'text' && (
                      <Badge tone={post.kind === 'challenge' ? 'amber' : 'brand'}>
                        {KIND_LABEL[post.kind]}
                      </Badge>
                    )}
                  </div>
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
                      className={`flex items-center gap-1 transition-colors hover:text-brand-600 ${
                        post.liked ? 'text-brand-600' : 'text-ink-500'
                      }`}
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
                    <button
                      type="button"
                      onClick={() => void handleSave(post.id)}
                      className={`flex items-center gap-1 transition-colors hover:text-amber-600 ${
                        post.saved ? 'text-amber-600' : 'text-ink-500'
                      }`}
                    >
                      {post.saved ? '🔖 Saved' : '🔖 Save'}
                    </button>
                  </div>

                  {openComments.has(post.id) && (
                    <div className="mt-3 space-y-3">
                      {buildCommentTree(post.id).map((comment) => (
                        <div
                          key={comment.id}
                          className={`flex gap-2 rounded-lg bg-ink-50 p-3 ${
                            comment.parentId ? 'ml-6' : ''
                          }`}
                        >
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
                            <button
                              type="button"
                              onClick={() =>
                                setReplyingTo((prev) => ({
                                  ...prev,
                                  [post.id]:
                                    (prev[post.id] ?? null) === comment.id
                                      ? null
                                      : comment.id,
                                }))
                              }
                              className="mt-1 text-[11px] font-semibold text-ink-400 hover:text-brand-600"
                            >
                              {replyingTo[post.id] === comment.id ? 'Cancel' : 'Reply'}
                            </button>
                            {replyingTo[post.id] === comment.id && (
                              <div className="mt-2 flex gap-2">
                                <Input
                                  placeholder={`Reply to ${comment.authorName}…`}
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
                            )}
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
                          {replyingTo[post.id] ? 'Reply' : 'Comment'}
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

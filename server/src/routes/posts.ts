import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { asyncHandler, authGuard, type AuthedRequest } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'
import { logEvent, notify } from '../services/activity.js'
import { emitGlobal } from '../sockets/index.js'

export const postsRouter = Router()

postsRouter.use(authGuard)

const createPostSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  kind: z.enum(['text', 'challenge', 'note', 'question']).default('text'),
  title: z.string().trim().max(200).nullable().optional(),
})

const commentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  parentId: z.string().nullable().optional(),
})

async function postWithCounts(postId: string) {
  const [likeCount, commentCount, saveCount] = await Promise.all([
    prisma.postLike.count({ where: { postId } }),
    prisma.comment.count({ where: { postId } }),
    prisma.postSave.count({ where: { postId } }),
  ])
  return { likeCount, commentCount, saveCount }
}

async function serializePost(
  post: { author: { name: string; avatarUrl: string | null } } & {
    id: string
    authorId: string
    kind: string
    title: string | null
    content: string
    tags: string[]
    createdAt: Date
  },
  likeCount: number,
  commentCount: number,
  viewerId?: string,
) {
  let liked = false
  let saved = false
  if (viewerId) {
    const [like, save] = await Promise.all([
      prisma.postLike.findUnique({
        where: { postId_userId: { postId: post.id, userId: viewerId } },
      }),
      prisma.postSave.findUnique({
        where: { postId_userId: { postId: post.id, userId: viewerId } },
      }),
    ])
    liked = Boolean(like)
    saved = Boolean(save)
  }
  return {
    id: post.id,
    authorId: post.authorId,
    authorName: post.author.name,
    authorAvatar: post.author.avatarUrl,
    kind: post.kind,
    title: post.title,
    content: post.content,
    tags: post.tags,
    likeCount,
    commentCount,
    liked,
    saved,
    createdAt: post.createdAt.toISOString(),
  }
}

function serializeComment(c: {
  id: string
  postId: string
  parentId: string | null
  authorId: string
  author: { name: string; avatarUrl: string | null }
  content: string
  createdAt: Date
}) {
  return {
    id: c.id,
    postId: c.postId,
    parentId: c.parentId,
    authorId: c.authorId,
    authorName: c.author.name,
    authorAvatar: c.author.avatarUrl,
    content: c.content,
    createdAt: c.createdAt.toISOString(),
  }
}

// GET /api/posts?limit=20&cursor=<postId>&feed=all|following|saved
postsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const limit = Math.min(Number(req.query.limit ?? 20), 50)
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
    const feed = typeof req.query.feed === 'string' ? req.query.feed : 'all'

    let where: Record<string, unknown> = {}
    if (feed === 'saved') {
      where = {
        saves: { some: { userId: req.userId! } },
      }
    } else if (feed === 'following') {
      where = {
        authorId: {
          in: (
            await prisma.follow.findMany({
              where: { followerId: req.userId! },
              select: { followingId: true },
            })
          ).map((f) => f.followingId),
        },
      }
    }

    const posts = await prisma.post.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where,
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { name: true, avatarUrl: true } } },
    })

    const hasMore = posts.length > limit
    const page = posts.slice(0, limit)

    const results = await Promise.all(
      page.map(async (post) => {
        const counts = await postWithCounts(post.id)
        return serializePost(post, counts.likeCount, counts.commentCount, req.userId)
      }),
    )

    res.json({
      posts: results,
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    })
  }),
)

postsRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = createPostSchema.parse(req.body)
    const post = await prisma.post.create({
      data: {
        authorId: req.userId!,
        content: body.content,
        tags: body.tags,
        kind: body.kind,
        title: body.title ?? null,
      },
      include: { author: { select: { name: true, avatarUrl: true } } },
    })
    const { likeCount, commentCount } = await postWithCounts(post.id)
    await logEvent(req.userId!, 'post.created', { postId: post.id, tags: post.tags, kind: post.kind })

    emitGlobal('feed:new', await serializePost(post, likeCount, commentCount, req.userId))
    res.status(201).json({ post: await serializePost(post, likeCount, commentCount, req.userId) })
  }),
)

// Toggle like on a post
postsRouter.post(
  '/:id/like',
  asyncHandler(async (req: AuthedRequest, res) => {
    const postId = String(req.params.id)
    const post = await prisma.post.findUnique({ where: { id: postId } })
    if (!post) throw new HttpError(404, 'Post not found')

    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId: req.userId! } },
    })

    if (existing) {
      await prisma.postLike.delete({ where: { id: existing.id } })
    } else {
      await prisma.postLike.create({ data: { postId, userId: req.userId! } })
      if (post.authorId !== req.userId) {
        await notify(post.authorId, 'like', 'New like', `${req.user?.name ?? 'Someone'} liked your post.`)
      }
      await logEvent(req.userId!, 'post.liked', { postId })
    }

    const { likeCount } = await postWithCounts(postId)
    emitGlobal('feed:update', { postId, likeCount })
    res.json({ liked: !existing, likeCount })
  }),
)

// Toggle save on a post
postsRouter.post(
  '/:id/save',
  asyncHandler(async (req: AuthedRequest, res) => {
    const postId = String(req.params.id)
    const post = await prisma.post.findUnique({ where: { id: postId } })
    if (!post) throw new HttpError(404, 'Post not found')

    const existing = await prisma.postSave.findUnique({
      where: { postId_userId: { postId, userId: req.userId! } },
    })

    if (existing) {
      await prisma.postSave.delete({ where: { id: existing.id } })
    } else {
      await prisma.postSave.create({ data: { postId, userId: req.userId! } })
      await logEvent(req.userId!, 'post.saved', { postId })
    }

    const { saveCount } = await postWithCounts(postId)
    res.json({ saved: !existing, saveCount })
  }),
)

// GET /api/posts/:id/comments
postsRouter.get(
  '/:id/comments',
  asyncHandler(async (req: AuthedRequest, res) => {
    const comments = await prisma.comment.findMany({
      where: { postId: String(req.params.id) },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { name: true, avatarUrl: true } } },
    })
    res.json({
      comments: comments.map((c) => serializeComment(c)),
    })
  }),
)

// POST /api/posts/:id/comments
postsRouter.post(
  '/:id/comments',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = commentSchema.parse(req.body)
    const post = await prisma.post.findUnique({ where: { id: String(req.params.id) } })
    if (!post) throw new HttpError(404, 'Post not found')

    let parent: { authorId: string } | null = null
    if (body.parentId) {
      parent = await prisma.comment.findFirst({
        where: { id: body.parentId, postId: post.id },
        select: { authorId: true },
      })
      if (!parent) throw new HttpError(404, 'Parent comment not found')
    }

    const comment = await prisma.comment.create({
      data: {
        postId: post.id,
        authorId: req.userId!,
        content: body.content,
        parentId: body.parentId ?? null,
      },
      include: { author: { select: { name: true, avatarUrl: true } } },
    })
    const { commentCount } = await postWithCounts(post.id)
    const authorName = req.user?.name ?? 'Someone'

    if (parent && parent.authorId !== req.userId) {
      await notify(parent.authorId, 'comment', 'New reply', `${authorName} replied to your comment.`)
    } else if (post.authorId !== req.userId) {
      await notify(post.authorId, 'comment', 'New comment', `${authorName} commented on your post.`)
    }
    await logEvent(req.userId!, 'comment.created', { postId: post.id, parentId: comment.parentId })

    emitGlobal('feed:update', { postId: post.id, commentCount })
    res.status(201).json({ comment: serializeComment(comment) })
  }),
)

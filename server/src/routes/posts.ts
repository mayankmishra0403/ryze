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
})

const commentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
})

async function postWithCounts(postId: string) {
  const [likeCount, commentCount] = await Promise.all([
    prisma.postLike.count({ where: { postId } }),
    prisma.comment.count({ where: { postId } }),
  ])
  return { likeCount, commentCount }
}

async function serializePost(post: { author: { name: string; avatarUrl: string | null } } & {
  id: string
  authorId: string
  content: string
  tags: string[]
  createdAt: Date
}, likeCount: number, commentCount: number) {
  return {
    id: post.id,
    authorId: post.authorId,
    authorName: post.author.name,
    authorAvatar: post.author.avatarUrl,
    content: post.content,
    tags: post.tags,
    likeCount,
    commentCount,
    createdAt: post.createdAt.toISOString(),
  }
}

// GET /api/posts?limit=20&cursor=<postId>
postsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const limit = Math.min(Number(req.query.limit ?? 20), 50)
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined

    const posts = await prisma.post.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { name: true, avatarUrl: true } } },
    })

    const hasMore = posts.length > limit
    const page = posts.slice(0, limit)

    const results = await Promise.all(
      page.map(async (post) => {
        const counts = await postWithCounts(post.id)
        return serializePost(post, counts.likeCount, counts.commentCount)
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
      data: { authorId: req.userId!, content: body.content, tags: body.tags },
      include: { author: { select: { name: true, avatarUrl: true } } },
    })
    const { likeCount, commentCount } = await postWithCounts(post.id)
    await logEvent(req.userId!, 'post.created', { postId: post.id, tags: post.tags })

    emitGlobal('feed:new', await serializePost(post, likeCount, commentCount))
    res.status(201).json({ post: await serializePost(post, likeCount, commentCount) })
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
      comments: comments.map((c) => ({
        id: c.id,
        postId: c.postId,
        authorId: c.authorId,
        authorName: c.author.name,
        authorAvatar: c.author.avatarUrl,
        content: c.content,
        createdAt: c.createdAt.toISOString(),
      })),
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

    const comment = await prisma.comment.create({
      data: { postId: post.id, authorId: req.userId!, content: body.content },
      include: { author: { select: { name: true, avatarUrl: true } } },
    })
    const { commentCount } = await postWithCounts(post.id)

    if (post.authorId !== req.userId) {
      await notify(
        post.authorId,
        'comment',
        'New comment',
        `${req.user?.name ?? 'Someone'} commented on your post.`,
      )
    }
    await logEvent(req.userId!, 'comment.created', { postId: post.id })

    emitGlobal('feed:update', { postId: post.id, commentCount })
    res.status(201).json({
      comment: {
        id: comment.id,
        postId: comment.postId,
        authorId: comment.authorId,
        authorName: comment.author.name,
        authorAvatar: comment.author.avatarUrl,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
      },
    })
  }),
)

import { createServer, type Server as HttpServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { config } from './config.js'
import { healthRouter } from './routes/health.js'
import { authRouter } from './routes/auth.js'
import { profileRouter } from './routes/profile.js'
import { postsRouter } from './routes/posts.js'
import { notesRouter } from './routes/notes.js'
import { placementRouter } from './routes/placement.js'
import { challengesRouter } from './routes/challenges.js'
import { startupRouter } from './routes/startup.js'
import { chatRouter } from './routes/chat.js'
import { notificationsRouter } from './routes/notifications.js'
import { aiRouter } from './routes/ai.js'
import { createSocketServer } from './sockets/index.js'
import { errorHandler, notFound } from './middleware/error.js'

/** Build the Express app (middleware + routes). No network listeners. */
export function createApp() {
  const app = express()

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(
    cors({
      origin: config.clientOrigin,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())

  mkdirSync(join(process.cwd(), config.uploadDir), { recursive: true })
  app.use('/uploads', express.static(config.uploadDir))

  app.use('/api', healthRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/profile', profileRouter)
  app.use('/api/posts', postsRouter)
  app.use('/api/notes', notesRouter)
  app.use('/api/placement', placementRouter)
  app.use('/api/challenges', challengesRouter)
  app.use('/api/startups', startupRouter)
  app.use('/api/chat', chatRouter)
  app.use('/api/notifications', notificationsRouter)
  app.use('/api/ai', aiRouter)

  app.use(notFound)
  app.use(errorHandler)

  return app
}

/** Create an HTTP server wired to the app + Socket.io. */
export function createHttpServer(): HttpServer {
  const httpServer = createServer(createApp())
  createSocketServer(httpServer)
  return httpServer
}

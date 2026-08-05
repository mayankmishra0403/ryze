import { config } from './config.js'
import { prisma } from './db.js'
import { createHttpServer } from './app.js'

const httpServer = createHttpServer()

httpServer.listen(config.port, () => {
  console.log(`[ryze] server listening on :${config.port} (${config.env})`)
})

async function shutdown(signal: string) {
  console.log(`[ryze] ${signal} received, shutting down`)
  await prisma.$disconnect()
  httpServer.close(() => process.exit(0))
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

import { io, type Socket } from 'socket.io-client'
import { WS_URL } from '../config'
import { getToken } from '../api/client'

export interface ServerToClientEvents {
  'message:new': (payload: {
    chatId: string
    message: import('../types').ChatMessage
  }) => void
  'presence:update': (payload: {
    userId: string
    status: 'online' | 'offline'
  }) => void
  'notification:new': (payload: import('../types').Notification) => void
  'feed:new': (payload: import('../types').Post) => void
  'feed:update': (payload: {
    postId: string
    likeCount?: number
    commentCount?: number
  }) => void
}

export interface ClientToServerEvents {
  'chat:join': (chatId: string) => void
  'chat:leave': (chatId: string) => void
  'chat:send': (payload: { chatId: string; content: string }) => void
  'chat:typing': (payload: { chatId: string }) => void
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: AppSocket | null = null

export function connectSocket(): AppSocket {
  if (socket) return socket
  socket = io(WS_URL, {
    autoConnect: true,
    auth: (cb) => cb({ token: getToken() }),
    transports: ['websocket'],
  })
  return socket
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}

export function getSocket(): AppSocket | null {
  return socket
}

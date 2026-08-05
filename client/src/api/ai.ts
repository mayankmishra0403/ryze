import { http } from './client'
import type {
  AiAssistantMessage,
  AiRecommendation,
  AiReport,
} from '../types'

export interface AiProvider {
  getRecommendations(userId: string): Promise<AiRecommendation[]>
  getReport(userId: string): Promise<AiReport>
  chat(messages: AiAssistantMessage[]): Promise<string>
}

/**
 * Real provider — proxies to the AI team's service through our Express
 * server (`POST /api/ai/*`). Only reachable once AI_BASE_URL is configured
 * server-side.
 */
export const realAi: AiProvider = {
  getRecommendations: (userId) =>
    http.post<AiRecommendation[]>('/ai/recommendations', { userId }),
  getReport: (userId) => http.post<AiReport>('/ai/reports', { userId }),
  chat: (messages) => http.post<string>('/ai/assistant', { messages }),
}

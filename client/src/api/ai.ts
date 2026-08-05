import { http } from './client'
import type {
  AiAssistantMessage,
  AiChatResult,
  AiRecommendation,
  AiReport,
  KnowledgeDoc,
} from '../types'

export interface AiProvider {
  getRecommendations(userId: string): Promise<AiRecommendation[]>
  getReport(userId: string): Promise<AiReport>
  chat(messages: AiAssistantMessage[]): Promise<AiChatResult>
  searchKnowledge(query: string): Promise<KnowledgeDoc[]>
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
  chat: (messages) => http.post<AiChatResult>('/ai/assistant', { messages }),
  searchKnowledge: (query) =>
    http
      .post<{ results: KnowledgeDoc[] }>('/ai/knowledge/search', { query })
      .then((r) => r.results),
}

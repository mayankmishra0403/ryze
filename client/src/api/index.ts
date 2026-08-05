import { AI_ENABLED } from '../config'
import type { AiProvider } from './ai'
import type { AiAssistantMessage } from '../types'
import { realAi } from './ai'
import { mockAi } from './mockAI'

/**
 * Active AI provider. Uses the real proxy when enabled (VITE_AI_ENABLED=true),
 * otherwise serves mock data. Falls back to mock if the real call fails so
 * the UI never breaks during integration.
 */
class AiManager implements AiProvider {
  private provider: AiProvider = AI_ENABLED ? realAi : mockAi

  setEnabled(enabled: boolean): void {
    this.provider = enabled ? realAi : mockAi
  }

  async getRecommendations(userId: string) {
    try {
      return await this.provider.getRecommendations(userId)
    } catch {
      return mockAi.getRecommendations(userId)
    }
  }

  async getReport(userId: string) {
    try {
      return await this.provider.getReport(userId)
    } catch {
      return mockAi.getReport(userId)
    }
  }

  async chat(messages: AiAssistantMessage[]) {
    try {
      return await this.provider.chat(messages)
    } catch {
      return mockAi.chat(messages)
    }
  }

  async searchKnowledge(query: string) {
    try {
      return await this.provider.searchKnowledge(query)
    } catch {
      return mockAi.searchKnowledge(query)
    }
  }
}

export const ai = new AiManager()

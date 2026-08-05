import type { AiProvider } from './ai'
import type {
  AiAssistantMessage,
  AiChatResult,
  AiRecommendation,
  AiReport,
  KnowledgeDoc,
} from '../types'

/**
 * Mock AI adapter — returns realistic sample data so every AI feature works
 * end-to-end before the AI team's service is wired up. Swap to `realAi`
 * (via VITE_AI_ENABLED) once AI_BASE_URL is live.
 */
export const mockAi: AiProvider = {
  async getRecommendations(_userId: string): Promise<AiRecommendation[]> {
    return [
      {
        id: 'r1',
        type: 'learning_path',
        title: 'Strengthen DSA fundamentals',
        description:
          'A 6-week path covering arrays, strings, and two-pointer techniques based on your recent challenge activity.',
        reason:
          "You solved 12 easy problems but haven't attempted any medium difficulty yet.",
        priority: 1,
      },
      {
        id: 'r2',
        type: 'interview',
        title: 'Practice SDE interview questions at Amazon',
        description:
          'A curated set of Amazon PYQs focusing on sliding window and heap patterns.',
        reason: 'Amazon is your top tracked company and recent PYQs emphasize these topics.',
        priority: 2,
      },
      {
        id: 'r3',
        type: 'resource',
        title: 'Explore system design notes shared by the community',
        description:
          'Three high-rated notes on scalable system design were shared this week.',
        reason: 'Your profile lists backend engineering as a target role.',
        priority: 3,
      },
      {
        id: 'r4',
        type: 'collaboration',
        title: 'Join an open-source project looking for React developers',
        description:
          'The "EduSync" startup team needs a frontend contributor for their mentor-matching feature.',
        reason: 'You contribute regularly to the React community feed.',
        priority: 4,
      },
    ]
  },

  async getReport(_userId: string): Promise<AiReport> {
    const end = new Date()
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
    return {
      id: 'rep1',
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      summary:
        'You have been consistently active in the community this month. Your challenge streak grew from 3 to 11 days, and your profile was viewed 24 times after sharing two placement notes.',
      learningScore: 72,
      strengths: [
        'Consistent daily challenge participation (11-day streak)',
        'Active knowledge sharing — 2 notes and 5 community posts',
        'Strong engagement in the placement hub (saved 14 opportunities)',
      ],
      improvements: [
        'Attempt more medium/hard challenges to push past your current ceiling',
        'Contribute code to a collaborative project to grow your collaboration score',
        'Complete your profile — resume and GitHub link are missing',
      ],
      recommendations: [
        'Set a 30-day target of 30 challenges with at least 5 medium difficulty',
        'Join the "Open Source Contributors" startup team this week',
        'Add your GitHub profile to unlock project recommendations',
      ],
      generatedAt: end.toISOString(),
    }
  },

  async chat(messages: AiAssistantMessage[]): Promise<AiChatResult> {
    const last = messages[messages.length - 1]
    const question = last?.content.toLowerCase() ?? ''
    if (question.includes('interview')) {
      return {
        reply:
          'Great — here is a plan. Start with the Amazon SDE sheet: focus on arrays, strings, and hashmaps. Practice 2 medium problems daily and time yourself. After that, move to system design basics (load balancing, caching, databases). Want me to break down a specific topic?',
        sources: [{ id: 'kb-interview', title: 'Amazon SDE Interview Process', source: 'Mentor handbook' }],
      }
    }
    if (question.includes('roadmap')) {
      return {
        reply:
          'For a solid 6-month roadmap: (1) Master DSA with daily challenges, (2) Build 2 full-stack projects, (3) Complete 10 mock interviews on this platform, (4) Start applying to internships in month 4. I can tailor this to your branch and target companies.',
        sources: [{ id: 'kb-roadmap', title: '6-Month DSA Preparation Plan', source: 'Mentor handbook' }],
      }
    }
    return {
      reply:
        'I can help with placement preparation, learning roadmaps, project guidance, and startup collaboration. Try asking about interview prep, a learning roadmap, or which company to target first.',
      sources: [],
    }
  },

  async searchKnowledge(query: string): Promise<KnowledgeDoc[]> {
    const q = query.toLowerCase()
    if (q.includes('interview') || q.includes('amazon')) {
      return [
        {
          id: 'kb-interview',
          title: 'Amazon SDE Interview Process',
          content:
            'Amazon SDE interviews typically have 4-5 rounds: an online assessment, coding rounds, and leadership principles. Prioritise arrays, strings, hashmaps and sliding window.',
          source: 'Mentor handbook',
          tags: ['interview', 'amazon', 'sde'],
          score: 0.9,
        },
      ]
    }
    if (q.includes('roadmap') || q.includes('dsa')) {
      return [
        {
          id: 'kb-roadmap',
          title: '6-Month DSA Preparation Plan',
          content:
            'Months 1-2: arrays, strings, hashmaps, two pointers. Month 3: trees and graphs. Month 4: dynamic programming. Month 5: system design basics. Month 6: mock interviews.',
          source: 'Mentor handbook',
          tags: ['dsa', 'roadmap'],
          score: 0.95,
        },
      ]
    }
    return []
  },
}

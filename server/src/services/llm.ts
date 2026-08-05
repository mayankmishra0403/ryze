import { config } from '../config.js'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmResponse {
  content: string
  model: string
  provider: string
}

/**
 * Calls a real LLM using the configured API key (OpenAI-compatible endpoint
 * or Google Gemini). Returns null when no key is configured so callers can
 * fall back to a mock/RAG-only answer.
 */
export function isLlmConfigured(): boolean {
  return Boolean(config.ai.apiKey)
}

export async function chatCompletion(
  messages: LlmMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<LlmResponse | null> {
  if (!isLlmConfigured()) return null
  const provider = config.ai.provider === 'gemini' ? 'gemini' : 'openai'
  try {
    return provider === 'gemini'
      ? await callGemini(messages, opts)
      : await callOpenAi(messages, opts)
  } catch {
    return null
  }
}

async function callOpenAi(
  messages: LlmMessage[],
  opts: { maxTokens?: number; temperature?: number },
): Promise<LlmResponse> {
  const base = (config.ai.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.ai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.ai.model,
      messages,
      max_tokens: opts.maxTokens ?? 600,
      temperature: opts.temperature ?? 0.4,
    }),
  })
  if (!res.ok) throw new Error(`LLM error ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as {
    choices: { message?: { content?: string } }[]
    model?: string
  }
  return {
    content: data.choices[0]?.message?.content ?? '',
    model: data.model ?? config.ai.model,
    provider: 'openai',
  }
}

async function callGemini(
  messages: LlmMessage[],
  opts: { maxTokens?: number; temperature?: number },
): Promise<LlmResponse> {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
  const turns = messages.filter((m) => m.role !== 'system')
  const parts: { text: string }[] = []
  if (system) parts.push({ text: system })
  for (const m of turns) parts.push({ text: `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}` })

  const base = (config.ai.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '')
  const url = `${base}/models/${config.ai.model}:generateContent?key=${encodeURIComponent(config.ai.apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        maxOutputTokens: opts.maxTokens ?? 600,
        temperature: opts.temperature ?? 0.4,
      },
    }),
  })
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  return { content: text, model: config.ai.model, provider: 'gemini' }
}

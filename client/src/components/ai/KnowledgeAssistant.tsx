import { useState, type FormEvent } from 'react'
import { ai } from '../../api'
import { Button } from '../ui/Button'
import { Card, EmptyState } from '../ui/Card'
import { Input } from '../ui/Input'
import type { AiAssistantMessage, AiChatResult, KnowledgeDoc } from '../../types'

export function KnowledgeAssistant() {
  const [messages, setMessages] = useState<AiAssistantMessage[]>([])
  const [sources, setSources] = useState<Record<number, AiChatResult['sources']>>({})
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<KnowledgeDoc[] | null>(null)
  const [searching, setSearching] = useState(false)

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    setLoading(true)
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    try {
      const result = await ai.chat(next)
      const assistantIndex = next.length
      setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }])
      setSources((prev) => ({ ...prev, [assistantIndex]: result.sources }))
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, the assistant is unavailable right now.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q || searching) return
    setSearching(true)
    try {
      setResults(await ai.searchKnowledge(q))
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="AI Knowledge Assistant" subtitle="Ask anything about placement prep — answers are grounded in RYZE's knowledge base.">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <EmptyState
              title="Ask RYZE anything"
              description="Try 'How do I prepare for an Amazon SDE interview?' or 'Give me a 6-month DSA roadmap'."
              icon="🤖"
            />
          ) : (
            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {messages.map((m, i) => (
                <div key={i}>
                  <div
                    className={`rounded-lg p-3 text-sm ${
                      m.role === 'user'
                        ? 'bg-brand-50 text-brand-900'
                        : 'bg-ink-50 text-ink-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                  {m.role === 'assistant' && sources[i] && sources[i]!.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5 pl-1">
                      {sources[i]!.map((s) => (
                        <span
                          key={s.id}
                          className="rounded-full border border-ink-200 bg-white px-2 py-0.5 text-[10px] text-ink-500"
                        >
                          📚 {s.title}
                          {s.source ? ` · ${s.source}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="rounded-lg bg-ink-50 p-3 text-sm text-ink-400">
                  RYZE is thinking…
                </div>
              )}
            </div>
          )}
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              placeholder="Ask a question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <Button type="submit" loading={loading} disabled={!input.trim()}>
              Send
            </Button>
          </form>
        </div>
      </Card>

      <Card title="Knowledge Base" subtitle="Search curated placement &amp; DSA docs.">
        <div className="space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="Search knowledge base…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button type="submit" loading={searching} disabled={!query.trim()} variant="secondary">
              Search
            </Button>
          </form>
          {results && (
            <ul className="space-y-2">
              {results.length === 0 ? (
                <EmptyState title="No matches" description="Try different keywords." icon="🔍" />
              ) : (
                results.map((doc) => (
                  <li key={doc.id} className="rounded-lg border border-ink-200 bg-ink-50/50 p-3">
                    <p className="text-sm font-semibold text-ink-900">{doc.title}</p>
                    {doc.source && (
                      <p className="text-[11px] text-ink-400">{doc.source}</p>
                    )}
                    <p className="mt-1 line-clamp-3 text-xs text-ink-600">{doc.content}</p>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}

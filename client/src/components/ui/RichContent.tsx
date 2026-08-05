import { useState } from 'react'

interface RichContentProps {
  content: string
  className?: string
}

export function RichContent({ content, className = '' }: RichContentProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const handleCopy = (codeText: string, idx: number) => {
    navigator.clipboard.writeText(codeText)
    setCopiedIndex(idx)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  // Regex to split by markdown code blocks ```lang ... ```
  const parts = content.split(/(```[\s\S]*?```)/g)

  return (
    <div className={`space-y-2 text-sm leading-relaxed ${className}`}>
      {parts.map((part, idx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const match = part.match(/^```(\w+)?\n?([\s\S]*?)```$/)
          const lang = match?.[1] || 'code'
          const codeText = match?.[2] || part.slice(3, -3)

          return (
            <div
              key={idx}
              className="my-3 overflow-hidden rounded-xl border border-ink-800 bg-ink-950 font-mono text-xs shadow-md"
            >
              <div className="flex items-center justify-between border-b border-ink-800 bg-ink-900 px-3.5 py-2 text-ink-400">
                <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[11px]">
                  {lang}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(codeText.trim(), idx)}
                  className="rounded-md bg-ink-800 px-2.5 py-1 text-[11px] font-medium text-ink-300 hover:bg-ink-700 hover:text-white transition-colors"
                >
                  {copiedIndex === idx ? '✓ Copied' : '📋 Copy Code'}
                </button>
              </div>
              <pre className="overflow-x-auto p-4 leading-relaxed text-emerald-300">
                <code>{codeText.trim()}</code>
              </pre>
            </div>
          )
        }

        // Render standard paragraph text with inline `code` highlights
        const inlineParts = part.split(/(`[^`]+`)/g)
        return (
          <p key={idx} className="whitespace-pre-wrap">
            {inlineParts.map((sub, sIdx) => {
              if (sub.startsWith('`') && sub.endsWith('`')) {
                return (
                  <code
                    key={sIdx}
                    className="mx-0.5 rounded-md bg-ink-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-700 border border-ink-200"
                  >
                    {sub.slice(1, -1)}
                  </code>
                )
              }
              return sub
            })}
          </p>
        )
      })}
    </div>
  )
}

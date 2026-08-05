import { useState } from 'react'
import { Button } from '../ui/Button'
import { runChallenge } from '../../api/features'
import type { JudgeResult } from '../../types'

interface CodeEditorSandboxProps {
  challengeId: string
  initialCode?: string
  onSubmitSolution: (code: string) => void
  submitting: boolean
  isSubmitted: boolean
}

const TEMPLATE = `// Write your JavaScript solution here
// The harness calls your solve(input) function with the parsed
// JSON testcase input and compares its return value to the expected output.
function solve(input) {
  // Example: return reversed array
  if (Array.isArray(input)) return input.slice().reverse();
  return input;
}`

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  accepted: { label: 'Accepted', tone: 'text-emerald-700 bg-emerald-100 border-emerald-300' },
  wrong_answer: { label: 'Wrong Answer', tone: 'text-red-700 bg-red-100 border-red-300' },
  runtime_error: { label: 'Runtime Error', tone: 'text-red-700 bg-red-100 border-red-300' },
  tle: { label: 'Time Limit Exceeded', tone: 'text-amber-700 bg-amber-100 border-amber-300' },
  unsupported: { label: 'Language not supported', tone: 'text-ink-700 bg-ink-100 border-ink-300' },
  submitted: { label: 'Submitted', tone: 'text-brand-700 bg-brand-50 border-brand-200' },
}

export function CodeEditorSandbox({
  challengeId,
  initialCode,
  onSubmitSolution,
  submitting,
  isSubmitted,
}: CodeEditorSandboxProps) {
  const [code, setCode] = useState(initialCode || TEMPLATE)
  const [result, setResult] = useState<JudgeResult | null>(null)
  const [isRunningTests, setIsRunningTests] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runTestCases = async () => {
    if (!code.trim()) return
    setIsRunningTests(true)
    setError(null)
    try {
      setResult(await runChallenge(challengeId, code.trim(), 'javascript'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run tests')
    } finally {
      setIsRunningTests(false)
    }
  }

  const lines = code.split('\n')
  const status = result ? STATUS_LABEL[result.status] ?? STATUS_LABEL.submitted : null

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-ink-800 bg-ink-950 font-mono text-sm shadow-xl">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between border-b border-ink-800 bg-ink-900 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-500/80" />
              <div className="h-3 w-3 rounded-full bg-amber-500/80" />
              <div className="h-3 w-3 rounded-full bg-green-500/80" />
            </div>
            <span className="text-xs font-semibold text-ink-400">solution.js</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-md border border-ink-700 bg-ink-800 px-2.5 py-1 text-xs text-ink-300">
              JavaScript (Node.js)
            </span>
            <button
              type="button"
              onClick={() => setCode(TEMPLATE)}
              className="text-xs text-ink-400 hover:text-ink-200"
            >
              ↺ Reset
            </button>
          </div>
        </div>

        {/* Code Editor Body */}
        <div className="flex min-h-64">
          <div className="select-none w-10 bg-ink-900/50 py-3 pr-3 text-right text-xs text-ink-600">
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="w-full flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-relaxed text-emerald-400 focus:outline-hidden"
            rows={Math.max(10, lines.length)}
          />
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center justify-between border-t border-ink-800 bg-ink-900/80 px-4 py-3">
          <button
            type="button"
            onClick={runTestCases}
            disabled={isRunningTests || !code.trim()}
            className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs font-semibold text-ink-200 hover:bg-ink-700 disabled:opacity-50"
          >
            <span>▶</span>
            <span>{isRunningTests ? 'Running...' : 'Run Test Cases'}</span>
          </button>

          <Button
            type="button"
            onClick={() => onSubmitSolution(code)}
            loading={submitting}
            disabled={isSubmitted || !code.trim()}
          >
            {isSubmitted ? '✓ Solved Today' : 'Submit Solution'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Verdict Panel */}
      {result && (
        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-500">
              Verdict
            </h4>
            {status && (
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${status.tone}`}>
                {status.label}
              </span>
            )}
            <span className="text-xs text-ink-400">
              {result.passedTests}/{result.totalTests} passed
              {result.runtimeMs > 0 && ` · ${result.runtimeMs}ms`}
            </span>
          </div>

          {result.tests.length > 0 && (
            <div className="mt-3 grid gap-2.5">
              {result.tests.map((tc, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border p-3 text-xs ${
                    tc.passed
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className={tc.passed ? 'text-emerald-800' : 'text-red-800'}>
                      Test case #{idx + 1}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-extrabold ${
                        tc.passed ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'
                      }`}
                    >
                      {tc.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-0.5 font-mono text-[11px] text-ink-700">
                    <div><span className="font-semibold opacity-60">Input: </span>{tc.input}</div>
                    <div><span className="font-semibold opacity-60">Expected: </span>{tc.expected}</div>
                    <div>
                      <span className="font-semibold opacity-60">Output: </span>
                      <span className={tc.passed ? 'text-emerald-700' : 'text-red-700'}>
                        {tc.error ? `Error: ${tc.error}` : tc.actual || '(empty)'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

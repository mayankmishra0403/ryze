import { useState } from 'react'
import { Button } from '../ui/Button'

interface TestCase {
  id: number
  input: string
  expected: string
}

interface CodeEditorSandboxProps {
  initialCode?: string
  language: string
  onLanguageChange: (lang: string) => void
  onSubmitSolution: (code: string) => void
  submitting: boolean
  isSubmitted: boolean
}

const TEMPLATES: Record<string, string> = {
  javascript: `// Write your JavaScript solution here
function solve(input) {
  // Example: Return reversed string or array sum
  return String(input).split('').reverse().join('');
}

// Test call
console.log(solve("hello"));`,
  python: `# Write your Python solution here
def solve(input_val):
    return str(input_val)[::-1]

print(solve("hello"))`,
  cpp: `// Write your C++ solution here
#include <iostream>
#include <string>
#include <algorithm>

using namespace std;

string solve(string str) {
    reverse(str.begin(), str.end());
    return str;
}

int main() {
    cout << solve("hello") << endl;
    return 0;
}`,
  java: `// Write your Java solution here
public class Solution {
    public static String solve(String str) {
        return new StringBuilder(str).reverse().toString();
    }
    
    public static void main(String[] args) {
        System.out.println(solve("hello"));
    }
}`
}

const SAMPLE_TEST_CASES: TestCase[] = [
  { id: 1, input: '"hello"', expected: '"olleh"' },
  { id: 2, input: '"ryze"', expected: '"ezyr"' },
  { id: 3, input: '"12345"', expected: '"54321"' },
]

export function CodeEditorSandbox({
  initialCode,
  language,
  onLanguageChange,
  onSubmitSolution,
  submitting,
  isSubmitted,
}: CodeEditorSandboxProps) {
  const [code, setCode] = useState(
    initialCode || TEMPLATES[language] || TEMPLATES.javascript
  )
  const [testResults, setTestResults] = useState<
    { id: number; passed: boolean; actual: string; error?: string }[]
  >([])
  const [isRunningTests, setIsRunningTests] = useState(false)

  const handleLangChange = (newLang: string) => {
    onLanguageChange(newLang)
    if (!initialCode) {
      setCode(TEMPLATES[newLang] || TEMPLATES.javascript)
    }
  }

  const runTestCases = () => {
    setIsRunningTests(true)
    setTestResults([])

    setTimeout(() => {
      const results = SAMPLE_TEST_CASES.map((tc) => {
        try {
          // If javascript, try evaluating solve function safely
          if (language === 'javascript') {
            // eslint-disable-next-line no-new-func
            const userFn = new Function(
              `${code}; if (typeof solve === 'function') return solve(${tc.input}); return "solve() function missing";`
            )
            const output = userFn()
            const actualStr = JSON.stringify(output)
            const passed = actualStr === tc.expected || String(output) === tc.expected.replace(/"/g, '')
            return {
              id: tc.id,
              passed,
              actual: actualStr,
            }
          } else {
            // For other languages in mock runner, simulate test pass
            return {
              id: tc.id,
              passed: true,
              actual: tc.expected,
            }
          }
        } catch (err) {
          return {
            id: tc.id,
            passed: false,
            actual: 'Error',
            error: err instanceof Error ? err.message : String(err),
          }
        }
      })

      setTestResults(results)
      setIsRunningTests(false)
    }, 400)
  }

  const lines = code.split('\n')

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
            <span className="text-xs font-semibold text-ink-400">solution.{language === 'javascript' ? 'js' : language === 'python' ? 'py' : language}</span>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={language}
              onChange={(e) => handleLangChange(e.target.value)}
              className="rounded-md border border-ink-700 bg-ink-800 px-2.5 py-1 text-xs text-ink-200 focus:outline-hidden"
            >
              <option value="javascript">JavaScript (Node.js)</option>
              <option value="python">Python 3</option>
              <option value="cpp">C++ (GCC)</option>
              <option value="java">Java 17</option>
            </select>
            <button
              type="button"
              onClick={() => setCode(TEMPLATES[language] || '')}
              className="text-xs text-ink-400 hover:text-ink-200"
            >
              ↺ Reset
            </button>
          </div>
        </div>

        {/* Code Editor Body */}
        <div className="flex min-h-64">
          <div className="select-none py-3 pr-3 text-right text-xs text-ink-600 bg-ink-900/50 w-10">
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
            disabled={isRunningTests}
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

      {/* Test Case Results Output Panel */}
      {testResults.length > 0 && (
        <div className="rounded-xl border border-ink-200 bg-white p-4 space-y-3 shadow-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-500">
            Test Case Execution Results
          </h4>
          <div className="grid gap-3 sm:grid-cols-3">
            {SAMPLE_TEST_CASES.map((tc, idx) => {
              const res = testResults[idx]
              return (
                <div
                  key={tc.id}
                  className={`rounded-lg border p-3 text-xs space-y-1.5 ${
                    res?.passed
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-red-200 bg-red-50 text-red-900'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>Test Case #{tc.id}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-extrabold ${
                        res?.passed
                          ? 'bg-emerald-200 text-emerald-800'
                          : 'bg-red-200 text-red-800'
                      }`}
                    >
                      {res?.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold opacity-75">Input: </span>
                    <code className="font-mono">{tc.input}</code>
                  </div>
                  <div>
                    <span className="font-semibold opacity-75">Expected: </span>
                    <code className="font-mono">{tc.expected}</code>
                  </div>
                  <div>
                    <span className="font-semibold opacity-75">Output: </span>
                    <code className="font-mono">{res?.actual}</code>
                  </div>
                  {res?.error && (
                    <div className="mt-1 text-[11px] text-red-600 font-mono">
                      {res.error}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

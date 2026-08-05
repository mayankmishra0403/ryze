import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export type JudgeStatus =
  | 'accepted'
  | 'wrong_answer'
  | 'runtime_error'
  | 'tle'
  | 'unsupported'
  | 'submitted'

export interface TestRunResult {
  passed: boolean
  expected: string
  actual: string
  error?: string
  runtimeMs: number
}

export interface TestcaseInput {
  input: string
  expectedOutput: string
  isPublic: boolean
}

export interface JudgeSummary {
  status: JudgeStatus
  passedTests: number
  totalTests: number
  runtimeMs: number
  tests: (TestRunResult & { isPublic: boolean })[]
}

export interface JudgeRunOptions {
  timeoutMs?: number
  memoryMb?: number
}

const SUPPORTED_LANGUAGES = ['javascript']
const MAX_OUTPUT = 1_000_000

export function isJudgeSupported(language: string): boolean {
  return SUPPORTED_LANGUAGES.includes(language)
}

/** Wraps user code so the harness can feed stdin → solve() → stdout. */
function wrapperScript(code: string): string {
  return `${code}

const __fs = require('node:fs');
const __input = __fs.readFileSync(0, 'utf8').trim();
const __parsed = __input === '' ? undefined : JSON.parse(__input);
if (typeof solve !== 'function') {
  process.stderr.write('Error: define a function named solve(input)');
  process.exit(1);
}
const __result = solve(__parsed);
process.stdout.write(JSON.stringify(__result));
`
}

interface RunOutput {
  stdout: string
  stderr: string
  timedOut: boolean
  spawnError?: string
}

function runNode(scriptPath: string, input: string, opts: JudgeRunOptions): Promise<RunOutput> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      env: { PATH: '/usr/bin:/bin:/usr/local/bin' },
      stdio: ['pipe', 'pipe', 'pipe'],
      resourceLimits: {
        maxOldGenerationSizeMb: opts.memoryMb ?? 128,
        maxYoungGenerationSizeMb: 32,
      },
    } as unknown as Parameters<typeof spawn>[2])
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false

    child.stdout!.setEncoding('utf8')
    child.stderr!.setEncoding('utf8')
    child.stdout!.on('data', (d: string) => {
      stdout += d
      if (stdout.length > MAX_OUTPUT) child.kill('SIGKILL')
    })
    child.stderr!.on('data', (d: string) => {
      stderr += d
      if (stderr.length > MAX_OUTPUT) child.kill('SIGKILL')
    })

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, opts.timeoutMs ?? 3000)

    const done = (result: RunOutput) => {
      clearTimeout(timer)
      if (!settled) {
        settled = true
        resolve(result)
      }
    }

    child.on('error', (err) => done({ stdout, stderr, timedOut, spawnError: err.message }))
    child.on('close', (code, signal) => {
      done({ stdout, stderr, timedOut: timedOut || signal === 'SIGKILL' || code === 137 })
    })

    child.stdin!.write(input)
    child.stdin!.end()
  })
}

function normalize(value: string): unknown {
  const trimmed = value.trim()
  if (trimmed === '') return ''
  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

function outputsMatch(actual: string, expected: string): boolean {
  const a = normalize(actual)
  const b = normalize(expected)
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < 1e-9
  }
  return deepEqual(a, b)
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((v, i) => deepEqual(v, b[i]))
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as Record<string, unknown>)
    const keysB = Object.keys(b as Record<string, unknown>)
    if (keysA.length !== keysB.length) return false
    return keysA.every(
      (k) => k in (b as Record<string, unknown>) && deepEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
    )
  }
  return false
}

async function runTestcase(
  code: string,
  testcase: TestcaseInput,
  opts: JudgeRunOptions,
): Promise<TestRunResult> {
  const dir = mkdtempSync(join(tmpdir(), 'ryze-judge-'))
  const file = join(dir, 'solution.cjs')
  writeFileSync(file, wrapperScript(code))

  const start = Date.now()
  const { stdout, stderr, timedOut, spawnError } = await runNode(file, testcase.input, opts)
  const runtimeMs = Date.now() - start

  rmSync(dir, { recursive: true, force: true })

  if (spawnError) {
    return { passed: false, expected: testcase.expectedOutput, actual: '', error: spawnError, runtimeMs }
  }
  if (timedOut) {
    return { passed: false, expected: testcase.expectedOutput, actual: stdout.trim(), error: 'Time limit exceeded', runtimeMs }
  }
  if (stderr.trim()) {
    return {
      passed: false,
      expected: testcase.expectedOutput,
      actual: stdout.trim(),
      error: stderr.trim().slice(0, 500),
      runtimeMs,
    }
  }
  const actual = stdout.trim()
  return {
    passed: outputsMatch(actual, testcase.expectedOutput),
    expected: testcase.expectedOutput,
    actual,
    runtimeMs,
  }
}

/**
 * Runs a submission against all testcases. With no testcases configured the
 * challenge is treated as a manual submission (status "submitted") so legacy
 * challenges keep working.
 */
export async function judgeSubmission(
  code: string,
  language: string,
  testcases: TestcaseInput[],
  opts: JudgeRunOptions = {},
): Promise<JudgeSummary> {
  if (!isJudgeSupported(language)) {
    return {
      status: 'unsupported',
      passedTests: 0,
      totalTests: testcases.length,
      runtimeMs: 0,
      tests: [],
    }
  }

  const totalTests = testcases.length
  if (totalTests === 0) {
    return { status: 'submitted', passedTests: 0, totalTests: 0, runtimeMs: 0, tests: [] }
  }

  let passedTests = 0
  let maxRuntime = 0
  const tests: (TestRunResult & { isPublic: boolean })[] = []
  for (const tc of testcases) {
    const result = await runTestcase(code, tc, opts)
    if (result.passed) passedTests += 1
    maxRuntime = Math.max(maxRuntime, result.runtimeMs)
    tests.push({ ...result, isPublic: tc.isPublic })
  }

  const anyTle = tests.some((t) => t.error === 'Time limit exceeded')
  const anyError = tests.some((t) => t.error && t.error !== 'Time limit exceeded')

  let status: JudgeStatus
  if (passedTests === totalTests) status = 'accepted'
  else if (anyTle) status = 'tle'
  else if (anyError) status = 'runtime_error'
  else status = 'wrong_answer'

  return { status, passedTests, totalTests, runtimeMs: maxRuntime, tests }
}

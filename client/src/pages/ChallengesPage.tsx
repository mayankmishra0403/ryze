import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  createChallenge,
  getChallenges,
  getChallengeStats,
  getLeaderboard,
  getTodayChallenge,
  submitChallenge,
} from '../api/features'
import { avatarUrl } from '../lib/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Input, Textarea } from '../components/ui/Input'
import { Badge, Card, EmptyState } from '../components/ui/Card'
import { CodeEditorSandbox } from '../components/challenges/CodeEditorSandbox'
import type { Challenge, ChallengeStats, LeaderboardEntry } from '../types'

const DIFF_TONES: Record<string, 'green' | 'amber' | 'red'> = {
  easy: 'green',
  medium: 'amber',
  hard: 'red',
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  return (
    <Badge tone={DIFF_TONES[difficulty.toLowerCase()] ?? 'gray'}>
      {difficulty}
    </Badge>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="text-center">
      <p className="text-2xl font-bold text-brand-600">{value}</p>
      <p className="text-sm font-medium text-ink-700">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-400">{hint}</p>}
    </Card>
  )
}

export function ChallengesPage() {
  const { user } = useAuth()
  const isMentor = user?.role === 'mentor' || user?.role === 'admin'
  const [stats, setStats] = useState<ChallengeStats | null>(null)
  const [today, setToday] = useState<(Challenge & { createdAt: string }) | null>(null)
  const [recent, setRecent] = useState<(Challenge & { createdAt: string })[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('javascript')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [difficultyFilter, setDifficultyFilter] = useState('')

  const loadAll = useCallback(async () => {
    const [statsData, todayData, recentData, leaderboardData] = await Promise.all([
      getChallengeStats(),
      getTodayChallenge(),
      getChallenges(),
      getLeaderboard(),
    ])
    setStats(statsData.stats)
    setToday(todayData.challenge)
    setRecent(recentData.challenges)
    setLeaderboard(leaderboardData.leaderboard)
  }, [])

  useEffect(() => {
    let active = true
    loadAll()
      .catch(() => active && setError('Failed to load challenges'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [loadAll])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!today || !code.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      const result = await submitChallenge(today.id, code.trim(), language)
      setStats((prev) =>
        prev
          ? {
              ...prev,
              submittedCount: prev.submittedCount + (prev.todaySubmitted ? 0 : 1),
              totalPoints: prev.totalPoints + (prev.todaySubmitted ? 0 : result.points),
              todaySubmitted: true,
              streak: result.streak,
            }
          : prev,
      )
      setToday((prev) => (prev ? { ...prev, submitted: true } : prev))
      setNotice(`Solved! +${result.points} points, streak ${result.streak.current} 🔥`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    const title = String(data.get('title') ?? '').trim()
    const description = String(data.get('description') ?? '').trim()
    if (!title || !description) return
    try {
      await createChallenge({
        title,
        description,
        difficulty: String(data.get('difficulty') ?? 'easy'),
        tags: String(data.get('tags') ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        points: Number(data.get('points') ?? 10),
      })
      setNotice('Challenge created')
      form.reset()
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-ink-400">
        Loading challenges…
      </div>
    )
  }

  const filteredRecent = difficultyFilter
    ? recent.filter((c) => c.difficulty === difficultyFilter)
    : recent

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Daily Challenges"
        description="Solve a new coding problem every day, build streaks, and earn points."
      />

      {(notice || error) && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}
        >
          {error ?? notice}
        </p>
      )}

      {stats && (
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Current streak" value={`${stats.streak.current} 🔥`} />
          <StatCard label="Longest streak" value={`${stats.streak.longest} 🔥`} />
          <StatCard label="Challenges solved" value={stats.submittedCount} />
          <StatCard label="Total points" value={stats.totalPoints} />
        </div>
      )}

      <Card
        title={today ? "Today's Challenge" : "Today's Challenge"}
        subtitle={
          today
            ? `${new Date(today.date).toDateString()} · ${today.points} points`
            : 'No challenge published for today yet'
        }
        actions={today && (
          <div className="flex gap-2">
            <DifficultyBadge difficulty={today.difficulty} />
            {today.submitted && <Badge tone="green">Solved ✓</Badge>}
          </div>
        )}
      >
        {today ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-ink-900">{today.title}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{today.description}</p>
              {today.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {today.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
            {today.submitted ? (
              <EmptyState
                title="Challenge completed 🎉"
                description="You solved today's challenge. Come back tomorrow for a new problem."
                icon="✅"
              />
            ) : (
              <CodeEditorSandbox
                initialCode={code}
                language={language}
                onLanguageChange={setLanguage}
                onSubmitSolution={(solutionCode) => {
                  setCode(solutionCode)
                  const fakeEvent = { preventDefault: () => {} } as FormEvent
                  handleSubmit(fakeEvent)
                }}
                submitting={submitting}
                isSubmitted={Boolean(today?.submitted)}
              />
            )}
          </div>
        ) : (
          <EmptyState
            title="No challenge today"
            description={isMentor ? 'Publish today\'s challenge below.' : 'Check back soon — a mentor will publish a new problem.'}
            icon="⚡"
          />
        )}
      </Card>

      {isMentor && (
        <Card title="Create a challenge" subtitle="Mentors can publish problems for the community.">
          <form onSubmit={handleCreate} className="space-y-3">
            <Input name="title" label="Title" placeholder="e.g. Merge Intervals" required />
            <Textarea name="description" label="Description" rows={3} required />
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink-700">Difficulty</span>
                <select
                  name="difficulty"
                  defaultValue="easy"
                  className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <Input name="points" label="Points" type="number" defaultValue={10} min={1} max={500} />
              <Input name="tags" label="Tags" placeholder="arrays, dp" />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Create challenge</Button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title="Recent challenges"
        actions={
          <div className="flex gap-1.5">
            {['', 'easy', 'medium', 'hard'].map((d) => (
              <button
                key={d || 'all'}
                type="button"
                onClick={() => setDifficultyFilter(d)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  difficultyFilter === d
                    ? 'bg-brand-600 text-white'
                    : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                }`}
              >
                {d || 'All'}
              </button>
            ))}
          </div>
        }
      >
        {filteredRecent.length === 0 ? (
          <EmptyState title="No challenges yet" description="Mentor-published problems appear here." icon="⚡" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {filteredRecent.map((challenge) => (
              <li key={challenge.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-ink-900">{challenge.title}</span>
                    <DifficultyBadge difficulty={challenge.difficulty} />
                    {challenge.submitted && <Badge tone="green">Solved</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {new Date(challenge.date).toDateString()} · {challenge.points} pts
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Leaderboard" subtitle="Top solvers this week">
        {leaderboard.length === 0 ? (
          <EmptyState title="No solvers yet" description="Be the first to earn points!" icon="🏆" />
        ) : (
          <ol className="divide-y divide-ink-100">
            {leaderboard.map((entry) => (
              <li key={entry.userId} className="flex items-center gap-3 py-2.5">
                <span
                  className={`w-6 text-center text-sm font-bold ${
                    entry.rank === 1 ? 'text-amber-500' : entry.rank === 2 ? 'text-ink-400' : entry.rank === 3 ? 'text-orange-600' : 'text-ink-300'
                  }`}
                >
                  {entry.rank}
                </span>
                <img
                  src={avatarUrl(entry.avatarUrl, entry.name)}
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
                <span className="flex-1 truncate text-sm font-medium text-ink-800">
                  {entry.name}
                  {entry.userId === user?.id && <span className="text-ink-400"> (you)</span>}
                </span>
                <Badge tone="brand">{entry.solved} solved</Badge>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Card } from '../ui/Card'
import { Spinner } from '../ui/Button'
import { getActivity, type ActivitySummary } from '../../api/features'

interface HeatCell {
  dateStr: string
  formattedDate: string
  count: number
}

function getColorClass(count: number) {
  if (count === 0) return 'bg-ink-100'
  if (count === 1) return 'bg-emerald-200'
  if (count === 2) return 'bg-emerald-400'
  if (count === 3) return 'bg-emerald-500'
  return 'bg-emerald-600'
}

export function ActivityHeatmap() {
  const [data, setData] = useState<ActivitySummary | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getActivity()
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setError(false)
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const cells = useMemo<HeatCell[]>(() => {
    const activity = data?.activity ?? {}
    const now = new Date()

    // Start 52 weeks back, aligned to a Sunday so columns line up with weekdays
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 363))
    while (first.getUTCDay() !== 0) first.setUTCDate(first.getUTCDate() - 1)

    const out: HeatCell[] = []
    const cursor = new Date(first)
    while (cursor.getTime() <= now.getTime()) {
      const dateStr = cursor.toISOString().slice(0, 10)
      out.push({
        dateStr,
        formattedDate: cursor.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        count: activity[dateStr] ?? 0,
      })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return out
  }, [data])

  const stats = data?.stats ?? { currentStreak: 0, longestStreak: 0, totalActiveDays: 0 }

  return (
    <Card
      title="Activity & Streak Heatmap"
      subtitle="Visual breakdown of your daily coding challenges, posts, and notes activity"
    >
      {!data && !error ? (
        <div className="flex items-center justify-center py-12 text-ink-400">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 rounded-xl border border-ink-100 bg-ink-50 p-4 text-center">
            <div>
              <p className="text-xl font-bold text-brand-600">🔥 {stats.currentStreak} Days</p>
              <p className="text-xs text-ink-500 font-medium">Current Streak</p>
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-600">🏆 {stats.longestStreak} Days</p>
              <p className="text-xs text-ink-500 font-medium">Longest Streak</p>
            </div>
            <div>
              <p className="text-xl font-bold text-ink-900">{stats.totalActiveDays}</p>
              <p className="text-xs text-ink-500 font-medium">Total Active Days</p>
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex flex-col gap-1 min-w-[650px]">
              <div className="grid grid-flow-col grid-rows-7 gap-1">
                {cells.map((day) => (
                  <div
                    key={day.dateStr}
                    title={`${day.formattedDate}: ${day.count} ${day.count === 1 ? 'activity' : 'activities'}`}
                    className={`h-3 w-3 rounded-xs transition-transform hover:scale-125 ${getColorClass(day.count)}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-ink-500 pt-2 border-t border-ink-100">
            <span>Learned continuously over the past year</span>
            <div className="flex items-center gap-1.5">
              <span>Less</span>
              <span className="h-2.5 w-2.5 rounded-xs bg-ink-100" />
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-200" />
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-400" />
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
              <span>More</span>
            </div>
          </div>
        </div>
      )}
      {error && (
        <p className="mt-2 text-xs text-ink-400">
          Couldn&apos;t load activity data right now.
        </p>
      )}
    </Card>
  )
}

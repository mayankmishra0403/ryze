import { useMemo } from 'react'
import { Card } from '../ui/Card'

interface ActivityHeatmapProps {
  currentStreak?: number
  longestStreak?: number
  totalSubmissions?: number
}

export function ActivityHeatmap({
  currentStreak = 3,
  longestStreak = 7,
  totalSubmissions = 12,
}: ActivityHeatmapProps) {
  // Generate 52 weeks (364 days) of activity mock/historical data ending today
  const activityData = useMemo(() => {
    const days = []
    const today = new Date()

    for (let i = 363; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)

      // Random deterministic density for visual fidelity
      const dayNum = d.getDate()
      let count = 0
      if (i < currentStreak) {
        count = Math.floor(Math.random() * 3) + 1
      } else if ((dayNum * 7 + i) % 5 === 0) {
        count = Math.floor(Math.random() * 4) + 1
      }

      days.push({
        dateStr: d.toISOString().split('T')[0],
        formattedDate: d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        count,
      })
    }
    return days
  }, [currentStreak])

  const getColorClass = (count: number) => {
    if (count === 0) return 'bg-ink-100'
    if (count === 1) return 'bg-emerald-200'
    if (count === 2) return 'bg-emerald-400'
    if (count === 3) return 'bg-emerald-500'
    return 'bg-emerald-600'
  }

  const activeDaysCount = useMemo(() => {
    return activityData.filter((d) => d.count > 0).length
  }, [activityData])

  return (
    <Card
      title="Activity & Streak Heatmap"
      subtitle="Visual breakdown of your daily coding challenges, posts, and notes activity"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4 rounded-xl border border-ink-100 bg-ink-50 p-4 text-center">
          <div>
            <p className="text-xl font-bold text-brand-600">🔥 {currentStreak} Days</p>
            <p className="text-xs text-ink-500 font-medium">Current Streak</p>
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-600">🏆 {longestStreak} Days</p>
            <p className="text-xs text-ink-500 font-medium">Longest Streak</p>
          </div>
          <div>
            <p className="text-xl font-bold text-ink-900">{totalSubmissions + activeDaysCount}</p>
            <p className="text-xs text-ink-500 font-medium">Total Active Days</p>
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="flex flex-col gap-1 min-w-[650px]">
            <div className="grid grid-flow-col grid-rows-7 gap-1">
              {activityData.map((day) => (
                <div
                  key={day.dateStr}
                  title={`${day.formattedDate}: ${day.count} activities`}
                  className={`h-3 w-3 rounded-xs transition-transform hover:scale-125 ${getColorClass(
                    day.count
                  )}`}
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
    </Card>
  )
}

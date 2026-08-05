import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { ai } from '../api'
import { Card, Badge, EmptyState } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { Spinner } from '../components/ui/Button'
import type { AiRecommendation, AiReport } from '../types'

export function DashboardPage() {
  const { user } = useAuth()
  const [recommendations, setRecommendations] = useState<AiRecommendation[]>([])
  const [report, setReport] = useState<AiReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let active = true
    Promise.all([ai.getRecommendations(user.id), ai.getReport(user.id)])
      .then(([recs, rep]) => {
        if (!active) return
        setRecommendations(recs)
        setReport(rep)
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [user])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8 text-brand-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.name ?? 'student'} 👋`}
        description="Your personalized learning intelligence is ready."
      />

      {report && (
        <Card title="Learning Intelligence Report" subtitle="AI-generated progress overview — last 30 days">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="none"
                    stroke="#4f46e5"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(report.learningScore / 100) * 213.6} 213.6`}
                  />
                </svg>
                <span className="absolute text-lg font-bold text-brand-700">
                  {report.learningScore}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-ink-900">Learning score</p>
                <p className="text-xs text-ink-500">out of 100</p>
              </div>
            </div>
            <p className="max-w-xl text-sm text-ink-600">{report.summary}</p>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Recommendations"
          subtitle="Curated by your AI learning engine"
          className="lg:col-span-2"
        >
          {recommendations.length === 0 ? (
            <EmptyState
              title="No recommendations yet"
              description="Your recommendations will appear here as your learning data grows."
            />
          ) : (
            <ul className="space-y-3">
              {recommendations.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-ink-200 bg-ink-50/50 p-4"
                >
                  <div className="flex items-center gap-2">
                    <Badge tone="brand">{r.type.replace('_', ' ')}</Badge>
                    <span className="text-sm font-semibold text-ink-900">{r.title}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-600">{r.description}</p>
                  <p className="mt-1 text-xs italic text-ink-500">{r.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

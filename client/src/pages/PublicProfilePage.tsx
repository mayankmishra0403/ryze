import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getPublicProfile,
  toggleFollow,
  getFollows,
  type FollowList,
} from '../api/features'
import type { PublicProfile } from '../types'
import { avatarUrl, timeAgo } from '../lib/format'
import { useAuth } from '../hooks/useAuth'
import { PageHeader } from '../components/ui/PageHeader'
import { Button, Spinner } from '../components/ui/Button'
import { Card, Badge } from '../components/ui/Card'

export function PublicProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user: me } = useAuth()
  const [data, setData] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'followers' | 'following'>('followers')
  const [graph, setGraph] = useState<FollowList | null>(null)

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    getPublicProfile(id)
      .then((d) => {
        setData(d)
        setIsFollowing(d.isFollowing)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load profile'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    setGraph(null)
    load()
  }, [load])

  const loadGraph = async () => {
    if (!id || graph) return
    try {
      setGraph(await getFollows(id))
    } catch {
      setGraph({ followers: [], following: [] })
    }
  }

  const handleFollow = async () => {
    if (!id || busy) return
    setBusy(true)
    try {
      const { following } = await toggleFollow(id)
      setIsFollowing(following)
      setData((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: following,
              stats: {
                ...prev.stats,
                followers: prev.stats.followers + (following ? 1 : -1),
              },
            }
          : prev,
      )
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8 text-brand-600" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader title="Profile" description="User profile" />
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? 'User not found'}
        </p>
        <Link to="/feed" className="text-sm font-medium text-brand-600 hover:underline">
          ← Back to feed
        </Link>
      </div>
    )
  }

  const isMe = me?.id === data.user.id

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/feed" className="text-sm font-medium text-brand-600 hover:underline">
          ← Back
        </Link>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <img
            src={avatarUrl(data.user.avatarUrl, data.user.name)}
            alt="avatar"
            className="h-20 w-20 rounded-full border border-ink-200"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-ink-900">{data.user.name}</h3>
              <Badge tone="brand">{data.user.role}</Badge>
              {isMe && <Badge>(you)</Badge>}
            </div>
            {data.profile?.bio ? (
              <p className="mt-1 text-sm text-ink-600">{data.profile.bio}</p>
            ) : (
              <p className="mt-1 text-sm text-ink-400">No bio yet</p>
            )}
            <p className="mt-1 text-xs text-ink-400">Joined {timeAgo(data.user.joinedAt)}</p>
          </div>
          {!isMe && (
            <Button
              variant={isFollowing ? 'secondary' : 'primary'}
              size="sm"
              loading={busy}
              onClick={() => void handleFollow()}
            >
              {isFollowing ? 'Following' : '+ Follow'}
            </Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Followers" value={data.stats.followers} />
        <StatCard label="Following" value={data.stats.following} />
        <StatCard label="Posts" value={data.stats.posts} />
        <StatCard label="Challenges solved" value={data.stats.solved} />
      </div>

      {data.profile && (
        <Card title="About">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Field label="Branch" value={data.profile.branch} />
            <Field label="Year" value={data.profile.year ? String(data.profile.year) : null} />
            <Field label="College" value={data.profile.college} />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                Links
              </dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                {data.profile.githubUrl && (
                  <a
                    href={data.profile.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-600 hover:underline"
                  >
                    GitHub
                  </a>
                )}
                {data.profile.linkedinUrl && (
                  <a
                    href={data.profile.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-600 hover:underline"
                  >
                    LinkedIn
                  </a>
                )}
                {!data.profile.githubUrl && !data.profile.linkedinUrl && (
                  <span className="text-ink-400">—</span>
                )}
              </dd>
            </div>
          </dl>
          {data.profile.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.profile.skills.map((skill) => (
                <Badge key={skill}>{skill}</Badge>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card>
        <div className="flex gap-2 border-b border-ink-100 pb-3">
          <button
            type="button"
            onClick={() => {
              setTab('followers')
              void loadGraph()
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              tab === 'followers'
                ? 'bg-brand-50 text-brand-700'
                : 'text-ink-500 hover:bg-ink-50'
            }`}
          >
            Followers ({data.stats.followers})
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('following')
              void loadGraph()
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              tab === 'following'
                ? 'bg-brand-50 text-brand-700'
                : 'text-ink-500 hover:bg-ink-50'
            }`}
          >
            Following ({data.stats.following})
          </button>
        </div>
        <div className="pt-3">
          {!graph ? (
            <button
              type="button"
              onClick={() => void loadGraph()}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Load {tab} list
            </button>
          ) : (
            <ul className="divide-y divide-ink-100">
              {(tab === 'followers' ? graph.followers : graph.following).map((u) => (
                <li key={u.id} className="py-2">
                  <Link
                    to={`/profile/${u.id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-ink-50"
                  >
                    <img
                      src={avatarUrl(u.avatarUrl, u.name)}
                      alt=""
                      className="h-8 w-8 rounded-full"
                    />
                    <span className="text-sm font-semibold text-ink-800">{u.name}</span>
                  </Link>
                </li>
              ))}
              {(tab === 'followers' ? graph.followers : graph.following).length === 0 && (
                <li className="py-4 text-center text-xs text-ink-400">Nobody here yet</li>
              )}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 text-center shadow-sm">
      <div className="text-2xl font-extrabold text-ink-900">{value}</div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">
        {label}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-1 text-ink-800">{value ?? '—'}</dd>
    </div>
  )
}

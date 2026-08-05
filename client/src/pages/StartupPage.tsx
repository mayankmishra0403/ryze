import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  createStartup,
  deleteStartup,
  expressInterest,
  getMyStartups,
  getStartupDetail,
  getStartups,
  joinStartupTeam,
  type StartupList,
} from '../api/features'
import { timeAgo, avatarUrl } from '../lib/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Input, Textarea } from '../components/ui/Input'
import { Badge, Card, EmptyState } from '../components/ui/Card'
import type { Startup, StartupDetail } from '../types'

const STAGE_TONES: Record<string, 'brand' | 'green' | 'amber' | 'red' | 'gray'> = {
  idea: 'amber',
  mvp: 'brand',
  launched: 'green',
  growing: 'red',
}

function StageBadge({ stage }: { stage: string }) {
  return <Badge tone={STAGE_TONES[stage.toLowerCase()] ?? 'gray'}>{stage}</Badge>
}

export function StartupPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'browse' | 'mine'>('browse')
  const [selected, setSelected] = useState<Startup | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const showError = (err: unknown) => {
    setError(err instanceof Error ? err.message : 'Something went wrong')
    setNotice(null)
  }
  const showNotice = (msg: string) => {
    setNotice(msg)
    setError(null)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Startup Hub"
        description="Share startup ideas, find co-founders, and build teams."
      />

      {selected ? (
        <StartupDetailView
          startupId={selected.id}
          onBack={() => setSelected(null)}
          onError={showError}
          onNotice={showNotice}
        />
      ) : (
        <>
          <div className="flex gap-2">
            {(
              [
                ['browse', 'Browse ideas'],
                ['mine', 'My startups'],
              ] as [typeof tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  tab === key ? 'bg-brand-600 text-white' : 'bg-white border border-ink-300 text-ink-600 hover:bg-ink-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {(notice || error) && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
              }`}
            >
              {error ?? notice}
            </p>
          )}

          {tab === 'browse' ? (
            <BrowseTab userId={user?.id} onOpen={setSelected} onError={showError} onNotice={showNotice} />
          ) : (
            <MyStartupsTab onOpen={setSelected} onError={showError} />
          )}
        </>
      )}
    </div>
  )
}

function BrowseTab({
  userId,
  onOpen,
  onError,
  onNotice,
}: {
  userId?: string
  onOpen: (s: Startup) => void
  onError: (e: unknown) => void
  onNotice: (m: string) => void
}) {
  const [startups, setStartups] = useState<Startup[]>([])
  const [stage, setStage] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [lookingFor, setLookingFor] = useState('')
  const [stageValue, setStageValue] = useState('idea')
  const [membersNeeded, setMembersNeeded] = useState(2)

  const load = useCallback(async () => {
    const data: StartupList = await getStartups(stage || undefined)
    setStartups(data.startups)
  }, [stage])

  useEffect(() => {
    let active = true
    setLoading(true)
    load()
      .then(() => active && setLoading(false))
      .catch((e) => active && onError(e))
    return () => {
      active = false
    }
  }, [load, onError])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !tagline.trim() || saving) return
    setSaving(true)
    try {
      const { startup } = await createStartup({
        name: name.trim(),
        tagline: tagline.trim(),
        description: description.trim(),
        lookingFor: lookingFor.split(',').map((s) => s.trim()).filter(Boolean),
        stage: stageValue,
        membersNeeded,
      })
      setStartups((prev) => [startup, ...prev])
      setName('')
      setTagline('')
      setDescription('')
      setLookingFor('')
      setMembersNeeded(2)
      setShowForm(false)
      onNotice('Startup posted!')
    } catch (e) {
      onError(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {['', 'idea', 'mvp', 'launched', 'growing'].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setStage(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                stage === s ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
            >
              {s || 'All stages'}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Share an idea'}
        </Button>
      </div>

      {showForm && (
        <Card title="Share a startup idea">
          <form onSubmit={submit} className="space-y-3">
            <Input label="Project name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CodeCampus" required />
            <Input label="Tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="One-line pitch" required />
            <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            <Input label="Looking for (comma separated)" value={lookingFor} onChange={(e) => setLookingFor(e.target.value)} placeholder="Full-stack dev, UI/UX designer" />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink-700">Stage</span>
                <select
                  value={stageValue}
                  onChange={(e) => setStageValue(e.target.value)}
                  className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900"
                >
                  <option value="idea">Idea</option>
                  <option value="mvp">MVP</option>
                  <option value="launched">Launched</option>
                  <option value="growing">Growing</option>
                </select>
              </label>
              <Input label="Members needed" type="number" min={1} max={50} value={membersNeeded} onChange={(e) => setMembersNeeded(Number(e.target.value))} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={saving}>Share idea</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-ink-400">Loading startups…</div>
      ) : startups.length === 0 ? (
        <EmptyState
          title={stage ? 'No startups in this stage' : 'No ideas yet'}
          description={stage ? 'Try another stage filter.' : 'Be the first to share a startup idea!'}
          icon="✺"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {startups.map((startup) => (
            <li key={startup.id}>
              <button
                type="button"
                onClick={() => onOpen(startup)}
                className="w-full rounded-xl border border-ink-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-ink-900">{startup.name}</h3>
                  <StageBadge stage={startup.stage} />
                </div>
                <p className="mt-0.5 text-sm text-ink-600">{startup.tagline}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {startup.lookingFor.slice(0, 3).map((r) => (
                    <Badge key={r}>{r}</Badge>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3 text-xs text-ink-500">
                  <span className="flex items-center gap-1.5">
                    <img src={avatarUrl(startup.ownerAvatar ?? null, startup.ownerName)} alt="" className="h-5 w-5 rounded-full" />
                    {startup.ownerName}
                    {startup.ownerId === userId ? ' (you)' : ''}
                  </span>
                  <span>{startup.interestCount ?? 0} interested</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MyStartupsTab({
  onOpen,
  onError,
}: {
  onOpen: (s: Startup) => void
  onError: (e: unknown) => void
}) {
  const [startups, setStartups] = useState<Startup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getMyStartups()
      .then((data) => active && setStartups(data.startups))
      .catch((e) => active && onError(e))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [onError])

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-ink-400">Loading…</div>
  }

  return (
    <div className="space-y-3">
      {startups.length === 0 ? (
        <EmptyState title="No startups yet" description="Share your first idea from the Browse tab." icon="✺" />
      ) : (
        startups.map((startup) => (
          <div key={startup.id} className="flex items-center justify-between rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-ink-900">{startup.name}</h3>
                <StageBadge stage={startup.stage} />
              </div>
              <p className="truncate text-sm text-ink-600">{startup.tagline}</p>
              <p className="text-xs text-ink-400">
                {startup.interestCount ?? 0} interested · {startup.teamCount ?? 0} team · created {timeAgo(startup.createdAt)}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => onOpen(startup)}>
              View
            </Button>
          </div>
        ))
      )}
    </div>
  )
}

function StartupDetailView({
  startupId,
  onBack,
  onError,
  onNotice,
}: {
  startupId: string
  onBack: () => void
  onError: (e: unknown) => void
  onNotice: (m: string) => void
}) {
  const [detail, setDetail] = useState<StartupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setDetail(await getStartupDetail(startupId))
  }, [startupId])

  useEffect(() => {
    let active = true
    setLoading(true)
    load()
      .catch((e) => active && onError(e))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [load, onError])

  if (loading || !detail) {
    return <div className="flex items-center justify-center py-16 text-ink-400">Loading…</div>
  }

  const { startup, teams, interests } = detail

  const interest = async () => {
    setBusy(true)
    try {
      await expressInterest(startup.id, message.trim())
      onNotice('Interest sent!')
      setMessage('')
      await load()
    } catch (e) {
      onError(e)
    } finally {
      setBusy(false)
    }
  }

  const join = async () => {
    setBusy(true)
    try {
      await joinStartupTeam(startup.id)
      onNotice('Joined the team!')
      await load()
    } catch (e) {
      onError(e)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Delete "${startup.name}"?`)) return
    setBusy(true)
    try {
      await deleteStartup(startup.id)
      onNotice('Startup deleted')
      onBack()
    } catch (e) {
      onError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-brand-600 hover:underline">
        ← All startups
      </button>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-ink-900">{startup.name}</h2>
              <StageBadge stage={startup.stage} />
            </div>
            <p className="text-sm text-ink-600">{startup.tagline}</p>
            <p className="mt-1 text-xs text-ink-400">
              by {startup.ownerName} · {timeAgo(startup.createdAt)} · needs {startup.membersNeeded} more member(s)
            </p>
          </div>
          {startup.isOwner && (
            <Button variant="danger" size="sm" loading={busy} onClick={() => void remove()}>
              Delete
            </Button>
          )}
        </div>
        <p className="mt-3 text-sm text-ink-700">{startup.description}</p>
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Looking for</p>
          <div className="flex flex-wrap gap-1.5">
            {startup.lookingFor.length === 0 ? (
              <span className="text-sm text-ink-500">Open to anyone</span>
            ) : (
              startup.lookingFor.map((r) => <Badge key={r} tone="brand">{r}</Badge>)
            )}
          </div>
        </div>
      </Card>

      {!startup.isOwner && (
        <Card title="Get involved">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              placeholder="Message (optional) — your skills, why you're interested…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="flex-1"
            />
            <div className="flex gap-2">
              <Button loading={busy} disabled={startup.amMember} onClick={() => void interest()}>
                {startup.myInterest ? 'Interest sent ✓' : 'Express interest'}
              </Button>
              <Button variant="secondary" loading={busy} disabled={startup.amMember} onClick={() => void join()}>
                {startup.amMember ? 'In team ✓' : 'Join team'}
              </Button>
            </div>
          </div>
          {startup.myInterest?.message && (
            <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
              Your message: “{startup.myInterest.message}”
            </p>
          )}
        </Card>
      )}

      {startup.isOwner && interests.length > 0 && (
        <Card title="Interest received" subtitle={`${interests.length} person(s) reached out`}>
          <ul className="divide-y divide-ink-100">
            {interests.map((item) => (
              <li key={item.id} className="py-2 text-sm text-ink-700">
                {item.message ? `“${item.message}”` : 'Interested in joining'}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Team">
        {teams.length === 0 ? (
          <EmptyState title="No team yet" description="A team is created when someone joins." icon="👥" />
        ) : (
          <ul className="space-y-4">
            {teams.map((team) => (
              <li key={team.id}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{team.name}</p>
                <div className="flex flex-wrap gap-2">
                  {team.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 rounded-full border border-ink-200 bg-ink-50 py-1 pl-1 pr-3"
                    >
                      <img src={avatarUrl(member.user.avatarUrl, member.user.name)} alt="" className="h-6 w-6 rounded-full" />
                      <span className="text-sm font-medium text-ink-800">{member.user.name}</span>
                      <Badge tone={member.role === 'owner' ? 'amber' : 'gray'}>{member.role}</Badge>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

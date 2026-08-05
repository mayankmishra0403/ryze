import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  addExperience,
  addPyq,
  addRoadmap,
  applyToJob,
  createCompany,
  createJob,
  getCompanies,
  getCompanyDetail,
  getExperiences,
  getJobs,
  getMyApplications,
  type CompanyList,
} from '../api/features'
import { timeAgo, avatarUrl } from '../lib/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Input, Textarea } from '../components/ui/Input'
import { Badge, Card, EmptyState } from '../components/ui/Card'
import { RichContent } from '../components/ui/RichContent'
import type {
  Company,
  CompanyDetail,
  InterviewExperience,
  Job,
  JobApplication,
} from '../types'

type Tab = 'companies' | 'jobs' | 'applications' | 'experiences'

const DIFF_TONES: Record<string, 'green' | 'amber' | 'red'> = {
  easy: 'green',
  medium: 'amber',
  hard: 'red',
}

function difficultyTone(d: string) {
  return DIFF_TONES[d.toLowerCase()] ?? 'gray'
}

export function PlacementPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('companies')
  const [selected, setSelected] = useState<Company | null>(null)
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
        title="Placement Hub"
        description="Companies, jobs, previous year questions, interview experiences and roadmaps."
      />

      {selected ? (
        <CompanyDetailView
          companyId={selected.id}
          isMentor={user?.role === 'mentor' || user?.role === 'admin'}
          onBack={() => setSelected(null)}
          onError={showError}
          onNotice={showNotice}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['companies', 'Companies'],
                ['jobs', 'Jobs'],
                ['applications', 'My applications'],
                ['experiences', 'Experiences'],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  tab === key
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-ink-600 border border-ink-300 hover:bg-ink-50'
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

          {tab === 'companies' && <CompaniesTab onOpen={setSelected} onError={showError} onNotice={showNotice} />}
          {tab === 'jobs' && <JobsTab onError={showError} onNotice={showNotice} />}
          {tab === 'applications' && <ApplicationsTab onError={showError} />}
          {tab === 'experiences' && <ExperiencesTab onError={showError} />}
        </>
      )}
    </div>
  )
}

// ---- Companies ----

function CompaniesTab({
  onOpen,
  onError,
  onNotice,
}: {
  onOpen: (c: Company) => void
  onError: (e: unknown) => void
  onNotice: (m: string) => void
}) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [hq, setHq] = useState('')
  const [about, setAbout] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const data: CompanyList = await getCompanies(search || undefined)
    setCompanies(data.companies)
  }, [search])

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
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const { company } = await createCompany({
        name: name.trim(),
        website: website.trim() || null,
        hqLocation: hq.trim() || null,
        about: about.trim() || null,
      })
      setCompanies((prev) => [...prev, company])
      setName('')
      setWebsite('')
      setHq('')
      setAbout('')
      setShowForm(false)
      onNotice(`Added ${company.name}`)
    } catch (e) {
      onError(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ New company'}
        </Button>
      </div>

      {showForm && (
        <Card title="Add a company">
          <form onSubmit={submit} className="space-y-3">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
              <Input label="HQ location" value={hq} onChange={(e) => setHq(e.target.value)} placeholder="City, Country" />
            </div>
            <Textarea label="About" value={about} onChange={(e) => setAbout(e.target.value)} rows={3} />
            <div className="flex justify-end">
              <Button type="submit" loading={saving}>Add company</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-ink-400">Loading companies…</div>
      ) : companies.length === 0 ? (
        <EmptyState
          title={search ? 'No matching companies' : 'No companies yet'}
          description={search ? 'Try a different search.' : 'Add the first company to the hub!'}
          icon="🏢"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {companies.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onOpen(c)}
                className="w-full rounded-xl border border-ink-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 font-bold text-brand-700">
                    {c.logoUrl ? (
                      <img src={c.logoUrl} alt="" className="h-10 w-10 rounded-lg object-contain" />
                    ) : (
                      c.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-ink-900">{c.name}</h3>
                    <p className="truncate text-xs text-ink-500">{c.hqLocation ?? '—'}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Badge tone="brand">{c.jobCount ?? 0} jobs</Badge>
                  <Badge>{c.pyqCount ?? 0} PYQs</Badge>
                  <Badge>{c.experienceCount ?? 0} experiences</Badge>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---- Company detail ----

function CompanyDetailView({
  companyId,
  isMentor,
  onBack,
  onError,
  onNotice,
}: {
  companyId: string
  isMentor: boolean
  onBack: () => void
  onError: (e: unknown) => void
  onNotice: (m: string) => void
}) {
  const [detail, setDetail] = useState<CompanyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<'jobs' | 'pyqs' | 'experiences' | 'roadmaps'>('jobs')

  const load = useCallback(async () => {
    setDetail(await getCompanyDetail(companyId))
  }, [companyId])

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

  const refresh = async () => {
    const next = await getCompanyDetail(companyId)
    setDetail(next)
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-brand-600 hover:underline">
        ← All companies
      </button>

      <Card>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50 text-xl font-bold text-brand-700">
            {detail.company.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-ink-900">{detail.company.name}</h2>
            {detail.company.hqLocation && (
              <p className="text-sm text-ink-500">{detail.company.hqLocation}</p>
            )}
            {detail.company.website && (
              <a
                href={detail.company.website}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-brand-600 hover:underline"
              >
                {detail.company.website}
              </a>
            )}
          </div>
        </div>
        {detail.company.about && <p className="mt-3 text-sm text-ink-700">{detail.company.about}</p>}
      </Card>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['jobs', `Jobs (${detail.jobs.length})`],
            ['pyqs', `PYQs (${detail.pyqs.length})`],
            ['experiences', `Experiences (${detail.experiences.length})`],
            ['roadmaps', `Roadmaps (${detail.roadmaps.length})`],
          ] as [typeof section, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              section === key ? 'bg-brand-600 text-white' : 'bg-white border border-ink-300 text-ink-600 hover:bg-ink-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'jobs' && (
        <JobSection detail={detail} onRefresh={refresh} onError={onError} onNotice={onNotice} />
      )}
      {section === 'pyqs' && (
        <PyqSection detail={detail} onRefresh={refresh} onError={onError} onNotice={onNotice} />
      )}
      {section === 'experiences' && (
        <ExperienceSection detail={detail} onRefresh={refresh} onError={onError} onNotice={onNotice} />
      )}
      {section === 'roadmaps' && (
        <RoadmapSection detail={detail} isMentor={isMentor} onRefresh={refresh} onError={onError} onNotice={onNotice} />
      )}
    </div>
  )
}

function JobSection({
  detail,
  onRefresh,
  onError,
  onNotice,
}: {
  detail: CompanyDetail
  onRefresh: () => void
  onError: (e: unknown) => void
  onNotice: (m: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Full-time')
  const [location, setLocation] = useState('')
  const [salary, setSalary] = useState('')
  const [eligibility, setEligibility] = useState('')
  const [applyUrl, setApplyUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await createJob({
        companyId: detail.company.id,
        title: title.trim(),
        type,
        location: location.trim() || null,
        salaryRange: salary.trim() || null,
        eligibility: eligibility.trim() || null,
        applyUrl: applyUrl.trim() || null,
      })
      setTitle('')
      setType('Full-time')
      setLocation('')
      setSalary('')
      setEligibility('')
      setApplyUrl('')
      setShowForm(false)
      await onRefresh()
      onNotice('Job posted')
    } catch (err) {
      onError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Post job'}
        </Button>
      </div>
      {showForm && (
        <Card title="Post a job">
          <form onSubmit={submit} className="space-y-3">
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="SDE Intern 2027" required />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Type" value={type} onChange={(e) => setType(e.target.value)} />
              <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <Input label="Salary range" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="₹8–12 LPA" />
            <Textarea label="Eligibility" value={eligibility} onChange={(e) => setEligibility(e.target.value)} rows={2} />
            <Input label="Apply URL" value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} placeholder="https://…" />
            <div className="flex justify-end">
              <Button type="submit" loading={saving}>Post job</Button>
            </div>
          </form>
        </Card>
      )}

      {detail.jobs.length === 0 ? (
        <EmptyState title="No jobs" description="Post the first opening at this company." icon="💼" />
      ) : (
        <ul className="space-y-3">
          {detail.jobs.map((job) => (
            <JobCard key={job.id} job={job} onError={onError} onNotice={onNotice} />
          ))}
        </ul>
      )}
    </div>
  )
}

function JobCard({
  job,
  onError,
  onNotice,
}: {
  job: Job
  onError: (e: unknown) => void
  onNotice: (m: string) => void
}) {
  const [applying, setApplying] = useState(false)

  const apply = async () => {
    setApplying(true)
    try {
      await applyToJob(job.id)
      onNotice(`Applied to ${job.title}`)
    } catch (err) {
      onError(err)
    } finally {
      setApplying(false)
    }
  }

  return (
    <li className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold text-ink-900">{job.title}</h4>
          <p className="text-xs text-ink-500">
            {job.location ?? 'Remote'} · {job.type}
            {job.salaryRange ? ` · ${job.salaryRange}` : ''}
          </p>
          {job.eligibility && <p className="mt-1 text-sm text-ink-600">Eligibility: {job.eligibility}</p>}
          <p className="mt-1 text-xs text-ink-400">Posted {timeAgo(job.postedAt)}</p>
        </div>
        {job.applied || job.applicationStatus ? (
          <Badge tone="green">Applied ✓</Badge>
        ) : (
          <div className="flex shrink-0 flex-col gap-2">
            <Button size="sm" loading={applying} onClick={() => void apply()}>
              Apply
            </Button>
            {job.applyUrl && (
              <a href={job.applyUrl} target="_blank" rel="noreferrer" className="text-center text-xs text-brand-600 hover:underline">
                External link
              </a>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

function PyqSection({
  detail,
  onRefresh,
  onError,
  onNotice,
}: {
  detail: CompanyDetail
  onRefresh: () => void
  onError: (e: unknown) => void
  onNotice: (m: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [round, setRound] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await addPyq({
        companyId: detail.company.id,
        title: title.trim(),
        round: round.trim() || null,
        difficulty,
        content: content.trim() || null,
      })
      setTitle('')
      setRound('')
      setContent('')
      setShowForm(false)
      await onRefresh()
      onNotice('PYQ added')
    } catch (err) {
      onError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Add PYQ'}
        </Button>
      </div>
      {showForm && (
        <Card title="Add a previous year question">
          <form onSubmit={submit} className="space-y-3">
            <Input label="Question title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Round" value={round} onChange={(e) => setRound(e.target.value)} placeholder="Coding round / HR" />
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink-700">Difficulty</span>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
            </div>
            <Textarea label="Content / solution notes" value={content} onChange={(e) => setContent(e.target.value)} rows={4} />
            <div className="flex justify-end">
              <Button type="submit" loading={saving}>Add PYQ</Button>
            </div>
          </form>
        </Card>
      )}

      {detail.pyqs.length === 0 ? (
        <EmptyState title="No PYQs yet" description="Share previous year questions from this company." icon="📄" />
      ) : (
        <ul className="space-y-3">
          {detail.pyqs.map((pyq) => (
            <li key={pyq.id} className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold text-ink-900">{pyq.title}</h4>
                <Badge tone={difficultyTone(pyq.difficulty)}>{pyq.difficulty}</Badge>
              </div>
              {pyq.round && <p className="text-xs text-ink-500">Round: {pyq.round}</p>}
              {pyq.content && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">{pyq.content}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ExperienceSection({
  detail,
  onRefresh,
  onError,
  onNotice,
}: {
  detail: CompanyDetail
  onRefresh: () => void
  onError: (e: unknown) => void
  onNotice: (m: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [role, setRole] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [rating, setRating] = useState(4)
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!role.trim() || !summary.trim() || !content.trim() || saving) return
    setSaving(true)
    try {
      await addExperience({
        companyId: detail.company.id,
        role: role.trim(),
        summary: summary.trim(),
        content: content.trim(),
        rating,
      })
      setRole('')
      setSummary('')
      setContent('')
      setShowForm(false)
      await onRefresh()
      onNotice('Experience shared')
    } catch (err) {
      onError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Share experience'}
        </Button>
      </div>
      {showForm && (
        <Card title="Share your interview experience">
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Role applied for" value={role} onChange={(e) => setRole(e.target.value)} required />
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink-700">Rating (1–5)</span>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{'★'.repeat(n)}</option>
                  ))}
                </select>
              </label>
            </div>
            <Textarea label="Summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} required />
            <Textarea label="Full experience" value={content} onChange={(e) => setContent(e.target.value)} rows={6} required />
            <div className="flex justify-end">
              <Button type="submit" loading={saving}>Share</Button>
            </div>
          </form>
        </Card>
      )}

      {detail.experiences.length === 0 ? (
        <EmptyState title="No experiences yet" description="Share your interview experience to help others." icon="🗣" />
      ) : (
        <ul className="space-y-3">
          {detail.experiences.map((exp) => (
            <li key={exp.id} className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <img src={avatarUrl(exp.authorAvatar ?? null, exp.authorName)} alt="" className="h-6 w-6 rounded-full" />
                  <h4 className="font-semibold text-ink-900">{exp.role}</h4>
                </div>
                <span className="text-sm text-amber-500">{'★'.repeat(exp.rating ?? 0)}{'☆'.repeat(5 - (exp.rating ?? 0))}</span>
              </div>
              <p className="text-xs text-ink-500">by {exp.authorName}</p>
              <p className="mt-2 text-sm text-ink-700">{exp.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RoadmapSection({
  detail,
  isMentor,
  onRefresh,
  onError,
  onNotice,
}: {
  detail: CompanyDetail
  isMentor: boolean
  onRefresh: () => void
  onError: (e: unknown) => void
  onNotice: (m: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [stepsText, setStepsText] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const steps = stepsText.split('\n').map((s) => s.trim()).filter(Boolean)
    if (!title.trim() || steps.length === 0 || saving) return
    setSaving(true)
    try {
      await addRoadmap({
        companyId: detail.company.id,
        title: title.trim(),
        description: description.trim(),
        steps,
      })
      setTitle('')
      setDescription('')
      setStepsText('')
      setShowForm(false)
      await onRefresh()
      onNotice('Roadmap added')
    } catch (err) {
      onError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {isMentor && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : '+ Add roadmap'}
          </Button>
        </div>
      )}
      {showForm && (
        <Card title="Add a roadmap">
          <form onSubmit={submit} className="space-y-3">
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            <Textarea
              label="Steps (one per line)"
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              rows={5}
              placeholder={'Learn the fundamentals\nPractice 300+ problems\nBuild 3 projects'}
              required
            />
            <div className="flex justify-end">
              <Button type="submit" loading={saving}>Add roadmap</Button>
            </div>
          </form>
        </Card>
      )}

      {detail.roadmaps.length === 0 ? (
        <EmptyState
          title="No roadmaps yet"
          description={isMentor ? 'Add a preparation roadmap for students.' : 'Check back soon for a mentor-prepared roadmap.'}
          icon="🗺"
        />
      ) : (
        <ul className="space-y-3">
          {detail.roadmaps.map((rm) => (
            <li key={rm.id} className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
              <h4 className="font-semibold text-ink-900">{rm.title}</h4>
              <p className="mt-1 text-sm text-ink-700">{rm.description}</p>
              <ol className="mt-3 space-y-1.5">
                {rm.steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-700">
                    <span className="font-semibold text-brand-600">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---- Jobs tab ----

function JobsTab({
  onError,
  onNotice,
}: {
  onError: (e: unknown) => void
  onNotice: (m: string) => void
}) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getJobs()
      .then((data) => active && setJobs(data.jobs))
      .catch((e) => active && onError(e))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [onError])

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-ink-400">Loading jobs…</div>
  }

  return (
    <ul className="space-y-3">
      {jobs.length === 0 ? (
        <EmptyState title="No jobs posted" description="Jobs from the hub will appear here." icon="💼" />
      ) : (
        jobs.map((job) => (
          <li key={job.id}>
            <JobCard job={job} onError={onError} onNotice={onNotice} />
          </li>
        ))
      )}
    </ul>
  )
}

// ---- My applications ----

function ApplicationsTab({ onError }: { onError: (e: unknown) => void }) {
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getMyApplications()
      .then((data) => active && setApplications(data.applications))
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
      {applications.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="Apply to jobs from the Companies or Jobs tabs and track them here."
          icon="📝"
        />
      ) : (
        <ul className="space-y-3">
          {applications.map((app) => (
            <li key={app.id} className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-ink-900">
                    {app.job.title} <span className="font-normal text-ink-500">@ {app.job.companyName}</span>
                  </h4>
                  <p className="text-xs text-ink-400">
                    Applied {timeAgo(app.createdAt)} · {app.job.location ?? 'Remote'} · {app.job.type}
                  </p>
                </div>
                <Badge tone="green">{app.status}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---- Experiences tab ----

function ExperiencesTab({ onError }: { onError: (e: unknown) => void }) {
  const [experiences, setExperiences] = useState<InterviewExperience[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getExperiences()
      .then((data) => active && setExperiences(data.experiences))
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
      {experiences.length === 0 ? (
        <EmptyState
          title="No experiences shared yet"
          description="Stories from the community will appear here."
          icon="🗣"
        />
      ) : (
        <ul className="space-y-3">
          {experiences.map((exp) => (
            <li key={exp.id} className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <img src={avatarUrl(exp.authorAvatar ?? null, exp.authorName)} alt="" className="h-7 w-7 rounded-full" />
                  <div>
                    <h4 className="font-semibold text-ink-900">{exp.role}</h4>
                    <p className="text-xs text-ink-500">
                      {exp.companyName} · by {exp.authorName} · {timeAgo(exp.createdAt)}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-amber-500">{'★'.repeat(exp.rating ?? 0)}{'☆'.repeat(5 - (exp.rating ?? 0))}</span>
              </div>
              <div className="mt-2 border-t border-ink-100 pt-2">
                <p className="text-sm font-semibold text-ink-800">{exp.summary}</p>
                <RichContent content={exp.content} className="mt-2 text-ink-700" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getProfile, updateProfile, uploadAvatar, type ProfileBundle } from '../api/features'
import { avatarUrl } from '../lib/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Input, Textarea } from '../components/ui/Input'
import { Card, Badge } from '../components/ui/Card'
import { Spinner } from '../components/ui/Button'

export function ProfilePage() {
  const [bundle, setBundle] = useState<ProfileBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [skills, setSkills] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    bio: '',
    branch: '',
    year: '',
    college: '',
    githubUrl: '',
    linkedinUrl: '',
    resumeUrl: '',
  })

  useEffect(() => {
    getProfile()
      .then((data) => {
        setBundle(data)
        setForm({
          bio: data.profile.bio ?? '',
          branch: data.profile.branch ?? '',
          year: data.profile.year ? String(data.profile.year) : '',
          college: data.profile.college ?? '',
          githubUrl: data.profile.githubUrl ?? '',
          linkedinUrl: data.profile.linkedinUrl ?? '',
          resumeUrl: data.profile.resumeUrl ?? '',
        })
        setSkills(data.profile.skills.join(', '))
      })
      .catch(() => setError('Failed to load your profile'))
      .finally(() => setLoading(false))
  }, [])

  const handleAvatar = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const { avatarUrl } = await uploadAvatar(file)
      setBundle((prev) => (prev ? { ...prev, user: { ...prev.user, avatarUrl } } : prev))
      setMessage('Avatar updated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const { profile } = await updateProfile({
        bio: form.bio || null,
        branch: form.branch || null,
        year: form.year ? Number(form.year) : null,
        college: form.college || null,
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        githubUrl: form.githubUrl || null,
        linkedinUrl: form.linkedinUrl || null,
        resumeUrl: form.resumeUrl || null,
      })
      setBundle((prev) => (prev ? { ...prev, profile } : prev))
      setMessage('Profile saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !bundle) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8 text-brand-600" />
      </div>
    )
  }

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Your Profile" description="Manage your public student profile." />

      <Card>
        <div className="flex items-center gap-4">
          <img
            src={avatarUrl(bundle.user.avatarUrl, bundle.user.name)}
            alt="avatar"
            className="h-20 w-20 rounded-full border border-ink-200"
          />
          <div className="flex-1">
            <h3 className="text-lg font-bold text-ink-900">{bundle.user.name}</h3>
            <p className="text-sm text-ink-500">{bundle.user.email}</p>
            <Badge tone="brand" >{bundle.user.role}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleAvatar(e.target.files?.[0])}
            />
            <Button
              variant="secondary"
              size="sm"
              loading={uploading}
              onClick={() => fileRef.current?.click()}
            >
              Upload photo
            </Button>
          </div>
        </div>
      </Card>

      {(message || error) && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}
        >
          {error ?? message}
        </p>
      )}

      <Card title="Details">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            label="Bio"
            value={form.bio}
            onChange={(e) => set('bio')(e.target.value)}
            rows={3}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Branch"
              value={form.branch}
              onChange={(e) => set('branch')(e.target.value)}
            />
            <Input
              label="Year"
              type="number"
              min={1}
              max={6}
              value={form.year}
              onChange={(e) => set('year')(e.target.value)}
            />
          </div>
          <Input
            label="College"
            value={form.college}
            onChange={(e) => set('college')(e.target.value)}
          />
          <Input
            label="Skills (comma separated)"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
          />
          <Input
            label="GitHub URL"
            value={form.githubUrl}
            onChange={(e) => set('githubUrl')(e.target.value)}
            placeholder="https://github.com/you"
          />
          <Input
            label="LinkedIn URL"
            value={form.linkedinUrl}
            onChange={(e) => set('linkedinUrl')(e.target.value)}
            placeholder="https://linkedin.com/in/you"
          />
          <Input
            label="Resume URL"
            value={form.resumeUrl}
            onChange={(e) => set('resumeUrl')(e.target.value)}
            placeholder="https://…"
          />
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              Save profile
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

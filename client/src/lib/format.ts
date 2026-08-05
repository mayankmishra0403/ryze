import { API_URL } from '../config'

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  if (diff < 60_000) return 'just now'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function avatarUrl(url: string | null | undefined, name: string): string {
  if (url) return apiFileUrl(url)
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4f46e5&color=fff`
}

/**
 * Resolve a server-relative upload path (e.g. "/uploads/notes/x.pdf") to a full URL.
 * In dev the API runs on its own origin (API_URL is absolute), in production the
 * SPA and API share an origin and API_URL is "/api", so uploads resolve against
 * the window origin instead of being prefixed with "/api".
 */
export function apiFileUrl(path: string): string {
  if (path.startsWith('http')) return path
  if (API_URL.startsWith('http')) return `${API_URL}${path}`
  return `${window.location.origin}${path}`
}

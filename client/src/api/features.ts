import { http, getToken } from './client'
import { API_URL } from '../config'
import type {
  Challenge,
  ChallengeDetail,
  ChallengeStats,
  ChallengeSubmission,
  Comment,
  Company,
  CompanyDetail,
  InterviewExperience,
  Job,
  JobApplication,
  JudgeResult,
  LeaderboardEntry,
  Note,
  Post,
  PostKind,
  Profile,
  PublicProfile,
  Pyq,
  Roadmap,
  Startup,
  StartupDetail,
  Chat,
  ChatMessage,
  Notification,
} from '../types'

// ---- Profile ----

export interface ProfileBundle {
  profile: Profile
  user: {
    id: string
    name: string
    email: string
    role: string
    avatarUrl: string | null
    createdAt: string
  }
}

export interface UpdateProfileInput {
  bio?: string | null
  branch?: string | null
  year?: number | null
  college?: string | null
  skills?: string[]
  resumeUrl?: string | null
  githubUrl?: string | null
  linkedinUrl?: string | null
}

export function getProfile(): Promise<ProfileBundle> {
  return http.get<ProfileBundle>('/profile/me')
}

export interface ActivitySummary {
  activity: Record<string, number>
  stats: { currentStreak: number; longestStreak: number; totalActiveDays: number }
}

export function getActivity(): Promise<ActivitySummary> {
  return http.get<ActivitySummary>('/profile/me/activity')
}

export function updateProfile(input: UpdateProfileInput): Promise<{ profile: Profile }> {
  return http.put<{ profile: Profile }>('/profile/me', input)
}

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const form = new FormData()
  form.append('avatar', file)
  const res = await fetch(`${API_URL}/profile/me/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
    credentials: 'include',
  })
  if (!res.ok) {
    let message = 'Upload failed'
    try {
      const body = await res.json()
      message = body.error ?? message
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  return res.json()
}

// ---- Community feed ----

export type FeedFilter = 'all' | 'following' | 'saved'

export interface PostList {
  posts: Post[]
  nextCursor: string | null
}

export function getPosts(
  limit = 20,
  cursor?: string,
  feed: FeedFilter = 'all',
): Promise<PostList> {
  const params = new URLSearchParams({ limit: String(limit), feed })
  if (cursor) params.set('cursor', cursor)
  return http.get<PostList>(`/posts?${params.toString()}`)
}

export function createPost(input: {
  content: string
  tags?: string[]
  kind?: PostKind
  title?: string
}): Promise<{ post: Post }> {
  return http.post<{ post: Post }>('/posts', {
    content: input.content,
    tags: input.tags ?? [],
    kind: input.kind ?? 'text',
    title: input.title ?? null,
  })
}

export function toggleLike(postId: string): Promise<{ liked: boolean; likeCount: number }> {
  return http.post<{ liked: boolean; likeCount: number }>(`/posts/${postId}/like`)
}

export function toggleSave(postId: string): Promise<{ saved: boolean; saveCount: number }> {
  return http.post<{ saved: boolean; saveCount: number }>(`/posts/${postId}/save`)
}

export function getComments(postId: string): Promise<{ comments: Comment[] }> {
  return http.get<{ comments: Comment[] }>(`/posts/${postId}/comments`)
}

export function addComment(
  postId: string,
  content: string,
  parentId?: string | null,
): Promise<{ comment: Comment }> {
  return http.post<{ comment: Comment }>(`/posts/${postId}/comments`, { content, parentId })
}

// ---- Follows ----

export function toggleFollow(userId: string): Promise<{ following: boolean; followerCount: number }> {
  return http.post<{ following: boolean; followerCount: number }>(`/profile/${userId}/follow`)
}

export interface FollowList {
  following: { id: string; name: string; avatarUrl: string | null }[]
  followers: { id: string; name: string; avatarUrl: string | null }[]
}

export function getFollows(userId: string): Promise<FollowList> {
  return http.get<FollowList>(`/profile/${userId}/follows`)
}

export function getPublicProfile(userId: string): Promise<PublicProfile> {
  return http.get<PublicProfile>(`/profile/${userId}`)
}

// ---- Notes sharing ----

export interface NoteList {
  notes: Note[]
  nextCursor: string | null
}

export interface TagCount {
  name: string
  count: number
}

export function getNotes(params: {
  limit?: number
  cursor?: string
  search?: string
  tag?: string
}): Promise<NoteList> {
  const qs = new URLSearchParams()
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.cursor) qs.set('cursor', params.cursor)
  if (params.search) qs.set('search', params.search)
  if (params.tag) qs.set('tag', params.tag)
  return http.get<NoteList>(`/notes?${qs.toString()}`)
}

export function getNoteTags(): Promise<{ tags: TagCount[] }> {
  return http.get<{ tags: TagCount[] }>('/notes/tags')
}

export async function uploadNote(input: {
  file: File
  title: string
  description?: string
  tags: string[]
}): Promise<{ note: Note }> {
  const form = new FormData()
  form.append('file', input.file)
  form.append('title', input.title)
  if (input.description) form.append('description', input.description)
  form.append('tags', input.tags.join(','))
  const res = await fetch(`${API_URL}/notes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
    credentials: 'include',
  })
  if (!res.ok) {
    let message = 'Upload failed'
    try {
      const body = await res.json()
      message = body.error ?? message
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  return res.json()
}

export function trackDownload(noteId: string): Promise<{ downloadCount: number }> {
  return http.post<{ downloadCount: number }>(`/notes/${noteId}/download`)
}

export function deleteNote(noteId: string): Promise<void> {
  return http.del(`/notes/${noteId}`)
}

// ---- Placement hub ----

export interface CompanyList {
  companies: Company[]
}

export interface JobList {
  jobs: Job[]
  nextCursor: string | null
}

export interface ExperienceList {
  experiences: InterviewExperience[]
}

export interface ApplicationList {
  applications: JobApplication[]
}

export function getCompanies(search?: string): Promise<CompanyList> {
  const qs = new URLSearchParams()
  if (search) qs.set('search', search)
  return http.get<CompanyList>(`/placement/companies?${qs.toString()}`)
}

export function getCompanyDetail(companyId: string): Promise<CompanyDetail> {
  return http.get<CompanyDetail>(`/placement/companies/${companyId}`)
}

export function createCompany(input: {
  name: string
  website?: string | null
  about?: string | null
  hqLocation?: string | null
}): Promise<{ company: Company }> {
  return http.post<{ company: Company }>('/placement/companies', input)
}

export function getJobs(companyId?: string): Promise<JobList> {
  const qs = new URLSearchParams()
  if (companyId) qs.set('companyId', companyId)
  return http.get<JobList>(`/placement/jobs?${qs.toString()}`)
}

export function createJob(input: {
  companyId: string
  title: string
  location?: string | null
  type: string
  eligibility?: string | null
  salaryRange?: string | null
  applyUrl?: string | null
}): Promise<{ job: Job; applicationStatus: string | null }> {
  return http.post<{ job: Job; applicationStatus: string | null }>(
    '/placement/jobs',
    input,
  )
}

export function applyToJob(jobId: string): Promise<{ application: JobApplication }> {
  return http.post<{ application: JobApplication }>(`/placement/jobs/${jobId}/apply`)
}

export function getMyApplications(): Promise<ApplicationList> {
  return http.get<ApplicationList>('/placement/me/applications')
}

export function getExperiences(): Promise<ExperienceList> {
  return http.get<ExperienceList>('/placement/experiences')
}

export function addExperience(input: {
  companyId: string
  role: string
  summary: string
  content: string
  rating?: number | null
}): Promise<{ experience: InterviewExperience }> {
  return http.post<{ experience: InterviewExperience }>('/placement/experiences', input)
}

export function addPyq(input: {
  companyId: string
  title: string
  round?: string | null
  difficulty: string
  content?: string | null
}): Promise<{ pyq: Pyq }> {
  return http.post<{ pyq: Pyq }>('/placement/pyqs', input)
}

export function addRoadmap(input: {
  companyId: string
  title: string
  description: string
  steps: string[]
}): Promise<{ roadmap: Roadmap }> {
  return http.post<{ roadmap: Roadmap }>('/placement/roadmaps', input)
}

// ---- Daily challenges ----

export interface TodayChallenge {
  challenge: (Challenge & { createdAt: string }) | null
}

export interface ChallengeList {
  challenges: (Challenge & { createdAt: string })[]
}

export interface SubmitResult {
  submission: ChallengeSubmission
  result: JudgeResult
  solved: boolean
  points: number
  streak: { current: number; longest: number; lastActive: string | null }
}

export interface ChallengeStatsResponse {
  stats: ChallengeStats
  recent: {
    id: string
    challengeId: string
    title: string
    difficulty: string
    points: number
    status: string
    passedTests: number | null
    totalTests: number | null
    runtimeMs: number | null
    date: string
    createdAt: string
  }[]
}

export function getTodayChallenge(): Promise<TodayChallenge> {
  return http.get<TodayChallenge>('/challenges/today')
}

export function getChallenges(difficulty?: string): Promise<ChallengeList> {
  const qs = new URLSearchParams()
  if (difficulty) qs.set('difficulty', difficulty)
  return http.get<ChallengeList>(`/challenges?${qs.toString()}`)
}

export function getChallengeDetail(id: string): Promise<{
  challenge: ChallengeDetail
  submission: (Pick<ChallengeSubmission, 'status' | 'passedTests' | 'totalTests' | 'runtimeMs'> & {}) | null
}> {
  return http.get(`/challenges/${id}`)
}

export function createChallenge(input: {
  title: string
  description: string
  difficulty: string
  tags: string[]
  points: number
  solution?: string
  testcases?: { input: string; expectedOutput: string; isPublic: boolean }[]
}): Promise<{ challenge: Challenge }> {
  return http.post<{ challenge: Challenge }>('/challenges', input)
}

export function submitChallenge(
  challengeId: string,
  code: string,
  language = 'javascript',
): Promise<SubmitResult> {
  return http.post<SubmitResult>(`/challenges/${challengeId}/submit`, { code, language })
}

export function runChallenge(
  challengeId: string,
  code: string,
  language = 'javascript',
): Promise<JudgeResult> {
  return http.post<JudgeResult>(`/challenges/${challengeId}/run`, { code, language })
}

export function getChallengeStats(): Promise<ChallengeStatsResponse> {
  return http.get<ChallengeStatsResponse>('/challenges/me/stats')
}

export function getLeaderboard(): Promise<{ leaderboard: LeaderboardEntry[] }> {
  return http.get<{ leaderboard: LeaderboardEntry[] }>('/challenges/leaderboard')
}

// ---- Startup hub ----

export interface StartupList {
  startups: Startup[]
  nextCursor: string | null
}

export function getStartups(stage?: string): Promise<StartupList> {
  const qs = new URLSearchParams()
  if (stage) qs.set('stage', stage)
  return http.get<StartupList>(`/startups?${qs.toString()}`)
}

export function getMyStartups(): Promise<StartupList> {
  return http.get<StartupList>('/startups/me')
}

export function getStartupDetail(id: string): Promise<StartupDetail> {
  return http.get<StartupDetail>(`/startups/${id}`)
}

export function createStartup(input: {
  name: string
  tagline: string
  description: string
  lookingFor: string[]
  stage: string
  membersNeeded: number
}): Promise<{ startup: Startup }> {
  return http.post<{ startup: Startup }>('/startups', input)
}

export function expressInterest(
  startupId: string,
  message?: string,
): Promise<{ match: { status: string; message: string | null } }> {
  return http.post<{ match: { status: string; message: string | null } }>(
    `/startups/${startupId}/express-interest`,
    { message: message || null },
  )
}

export function joinStartupTeam(startupId: string): Promise<{ member: { id: string; role: string } }> {
  return http.post<{ member: { id: string; role: string } }>(`/startups/${startupId}/join-team`)
}

export function deleteStartup(startupId: string): Promise<void> {
  return http.del(`/startups/${startupId}`)
}

// ---- Chat ----

export interface ChatList {
  chats: (Chat & { members: { userId: string; name: string; avatarUrl: string | null }[] })[]
}

export interface MessageList {
  messages: ChatMessage[]
  nextCursor: string | null
}

export function getChats(): Promise<ChatList> {
  return http.get<ChatList>('/chat')
}

export interface UserSearchResult {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  role: string
}

export function searchUsers(query: string): Promise<{ users: UserSearchResult[] }> {
  return http.get<{ users: UserSearchResult[] }>(`/chat/users?q=${encodeURIComponent(query)}`)
}

export function createDm(userId: string): Promise<{ chat: Chat }> {
  return http.post<{ chat: Chat }>('/chat/dm', { userId })
}

export function createChannel(name: string, memberIds: string[]): Promise<{ chat: Chat }> {
  return http.post<{ chat: Chat }>('/chat/channel', { name, memberIds })
}

export function getChatMessages(chatId: string, cursor?: string): Promise<MessageList> {
  const qs = new URLSearchParams()
  if (cursor) qs.set('cursor', cursor)
  return http.get<MessageList>(`/chat/${chatId}/messages?${qs.toString()}`)
}

// ---- Notifications ----

export function getNotifications(): Promise<{
  notifications: Notification[]
  unreadCount: number
}> {
  return http.get<{ notifications: Notification[]; unreadCount: number }>('/notifications')
}

export function markNotificationsRead(): Promise<{ marked: number }> {
  return http.post<{ marked: number }>('/notifications/read')
}

export function markNotificationRead(id: string): Promise<{ notification: Notification }> {
  return http.post<{ notification: Notification }>(`/notifications/${id}/read`)
}

export type Role = 'student' | 'mentor' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  avatarUrl: string | null
  createdAt: string
}

export interface Profile {
  id: string
  userId: string
  bio: string | null
  branch: string | null
  year: number | null
  college: string | null
  skills: string[]
  resumeUrl: string | null
  githubUrl: string | null
  linkedinUrl: string | null
}

export type PostKind = 'text' | 'challenge' | 'note' | 'question'

export interface Post {
  id: string
  authorId: string
  authorName: string
  authorAvatar: string | null
  kind: PostKind
  title: string | null
  content: string
  tags: string[]
  likeCount: number
  commentCount: number
  createdAt: string
  liked?: boolean
  saved?: boolean
}

export interface Comment {
  id: string
  postId: string
  parentId: string | null
  authorId: string
  authorName: string
  authorAvatar: string | null
  content: string
  createdAt: string
}

export interface Note {
  id: string
  authorId: string
  authorName: string
  authorAvatar: string | null
  title: string
  description: string | null
  fileUrl: string | null
  tags: string[]
  downloadCount: number
  createdAt: string
}

export interface Company {
  id: string
  name: string
  website: string | null
  logoUrl: string | null
  about: string | null
  hqLocation: string | null
  jobCount?: number
  pyqCount?: number
  experienceCount?: number
}

export interface Job {
  id: string
  companyId: string
  companyName: string
  companyLogo?: string | null
  title: string
  location: string | null
  type: string
  eligibility: string | null
  salaryRange: string | null
  applyUrl: string | null
  postedAt: string
  applicationStatus?: string | null
  applied?: boolean
}

export interface Pyq {
  id: string
  companyId: string
  companyName?: string
  title: string
  round: string | null
  difficulty: string
  content: string | null
  createdAt: string
}

export interface InterviewExperience {
  id: string
  companyId: string
  companyName?: string
  companyLogo?: string | null
  authorId: string
  authorName: string
  authorAvatar?: string | null
  role: string
  summary: string
  content: string
  rating: number | null
  createdAt: string
}

export interface Roadmap {
  id: string
  title: string
  description: string
  steps: string[]
  createdAt: string
}

export interface JobApplication {
  id: string
  jobId: string
  status: string
  createdAt: string
  job: Job
}

export interface CompanyDetail {
  company: Company
  jobs: Job[]
  pyqs: Pyq[]
  experiences: InterviewExperience[]
  roadmaps: Roadmap[]
}

export type JudgeStatus =
  | 'accepted'
  | 'wrong_answer'
  | 'runtime_error'
  | 'tle'
  | 'unsupported'
  | 'submitted'

export interface JudgeTestResult {
  input: string
  passed: boolean
  expected: string
  actual: string
  error?: string | null
  runtimeMs: number
}

export interface JudgeResult {
  status: JudgeStatus
  passedTests: number
  totalTests: number
  runtimeMs: number
  tests: JudgeTestResult[]
}

export interface ChallengeDetail {
  id: string
  title: string
  description: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  points: number
  date: string
  createdAt: string
  submitted: boolean
  testcases: { id: string; input: string; expectedOutput: string }[]
}

export interface Challenge {
  id: string
  title: string
  description: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  points: number
  date: string
  solvedCount?: number
  submitted?: boolean
}

export interface ChallengeSubmission {
  id: string
  challengeId: string
  userId: string
  code: string
  language: string
  status: string
  passedTests: number | null
  totalTests: number | null
  runtimeMs: number | null
  createdAt: string
}

export interface ChallengeStats {
  submittedCount: number
  totalPoints: number
  streak: { current: number; longest: number; lastActive: string | null }
  todaySubmitted: boolean
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  name: string
  avatarUrl: string | null
  solved: number
}

export interface Startup {
  id: string
  ownerId: string
  ownerName: string
  ownerAvatar?: string | null
  name: string
  tagline: string
  description: string
  lookingFor: string[]
  stage: string
  membersNeeded: number
  createdAt: string
  teamCount?: number
  interestCount?: number
}

export interface StartupTeamMember {
  id: string
  role: string
  joinedAt: string
  user: { id: string; name: string; avatarUrl: string | null }
}

export interface StartupTeam {
  id: string
  name: string
  members: StartupTeamMember[]
}

export interface StartupDetail {
  startup: Startup & {
    isOwner: boolean
    myInterest: { status: string; message: string | null } | null
    amMember: boolean
  }
  teams: StartupTeam[]
  interests: { id: string; status: string; message: string | null; createdAt: string }[]
}

export interface Chat {
  id: string
  type: 'dm' | 'channel'
  name: string | null
  memberIds: string[]
  lastMessageAt: string | null
}

export interface ChatMessage {
  id: string
  chatId: string
  senderId: string
  senderName: string
  senderAvatar: string | null
  content: string
  createdAt: string
  pending?: boolean
}

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  body: string
  read: boolean
  createdAt: string
}

export interface LearningEvent {
  id: string
  userId: string
  type: string
  payload: Record<string, unknown>
  createdAt: string
}

export interface AiRecommendation {
  id: string
  type: string
  title: string
  description: string
  reason: string
  priority: number
}

export interface AiReport {
  id: string
  periodStart: string
  periodEnd: string
  summary: string
  learningScore: number
  strengths: string[]
  improvements: string[]
  recommendations: string[]
  generatedAt: string
}

export interface AiAssistantMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiKnowledgeSource {
  id: string
  title: string
  source: string | null
}

export interface AiChatResult {
  reply: string
  sources: AiKnowledgeSource[]
  mock?: boolean
}

export interface KnowledgeDoc {
  id: string
  title: string
  content: string
  source: string | null
  tags: string[]
  score?: number
}

export interface PublicProfile {
  user: {
    id: string
    name: string
    role: Role
    avatarUrl: string | null
    joinedAt: string
  }
  profile: {
    bio: string | null
    branch: string | null
    year: number | null
    college: string | null
    skills: string[]
    githubUrl: string | null
    linkedinUrl: string | null
  } | null
  stats: {
    followers: number
    following: number
    posts: number
    solved: number
  }
  isFollowing: boolean
}

import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/password.js'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await hashPassword('password123')

  const student = await prisma.user.upsert({
    where: { email: 'student@ryze.dev' },
    update: {},
    create: {
      email: 'student@ryze.dev',
      name: 'Aarav Student',
      passwordHash,
      isVerified: true,
      profile: {
        create: {
          bio: 'Final year CS student preparing for SDE roles.',
          branch: 'Computer Science',
          year: 4,
          college: 'RYZE Engineering College',
          skills: ['React', 'TypeScript', 'DSA', 'SQL'],
        },
      },
    },
  })

  const mentor = await prisma.user.upsert({
    where: { email: 'mentor@ryze.dev' },
    update: {},
    create: {
      email: 'mentor@ryze.dev',
      name: 'Priya Mentor',
      passwordHash,
      role: 'mentor',
      isVerified: true,
      profile: {
        create: {
          bio: 'Software engineer mentoring juniors on placement prep.',
          skills: ['System Design', 'Interviews', 'Backend'],
        },
      },
    },
  })

  const admin = await prisma.user.upsert({
    where: { email: 'admin@ryze.dev' },
    update: {},
    create: {
      email: 'admin@ryze.dev',
      name: 'System Admin',
      passwordHash,
      role: 'admin',
      isVerified: true,
      profile: {
        create: {
          bio: 'Platform Administrator.',
          skills: ['DevOps', 'Security', 'Management'],
        },
      },
    },
  })

  const amazon = await prisma.company.upsert({
    where: { name: 'Amazon' },
    update: {},
    create: {
      name: 'Amazon',
      website: 'https://amazon.jobs',
      hqLocation: 'Seattle, WA',
      about: 'E-commerce and cloud computing leader hiring SDE interns.',
    },
  })

  const google = await prisma.company.upsert({
    where: { name: 'Google' },
    update: {},
    create: {
      name: 'Google',
      website: 'https://careers.google.com',
      hqLocation: 'Mountain View, CA',
      about: 'Search and AI company with strong hiring pipeline for grads.',
    },
  })

  await prisma.job.upsert({
    where: { id: 'seed-job-1' },
    update: {},
    create: {
      id: 'seed-job-1',
      companyId: amazon.id,
      title: 'SDE Intern 2027',
      location: 'Bengaluru / Remote',
      type: 'Internship',
      eligibility: '2027 batch, CGPA 7+',
      salaryRange: '₹60K/month stipend',
      applyUrl: 'https://amazon.jobs',
    },
  })

  await prisma.job.upsert({
    where: { id: 'seed-job-2' },
    update: {},
    create: {
      id: 'seed-job-2',
      companyId: google.id,
      title: 'STEP Intern 2027',
      location: 'Hyderabad',
      type: 'Internship',
      eligibility: '2027/2028 batch, strong DSA',
      salaryRange: '₹65K/month stipend',
      applyUrl: 'https://careers.google.com',
    },
  })

  await prisma.pyq.upsert({
    where: { id: 'seed-pyq-1' },
    update: {},
    create: {
      id: 'seed-pyq-1',
      companyId: amazon.id,
      title: 'Two Sum - LeetCode 1',
      round: 'Online Assessment',
      difficulty: 'easy',
      content: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
    },
  })

  await prisma.interviewExperience.upsert({
    where: { id: 'seed-exp-1' },
    update: {},
    create: {
      id: 'seed-exp-1',
      companyId: google.id,
      authorId: student.id,
      role: 'SDE Intern',
      summary: '3 rounds: coding, system design basics and HR. Medium difficulty, focused on arrays and graphs.',
      content: 'Round 1 was two coding problems on arrays and sliding window. Round 2 covered a small system design of a URL shortener. Round 3 was a behavioural chat with the hiring manager.',
      rating: 4,
    },
  })

  await prisma.roadmap.upsert({
    where: { id: 'seed-roadmap-1' },
    update: {},
    create: {
      id: 'seed-roadmap-1',
      companyId: amazon.id,
      title: 'Amazon SDE Prep Roadmap',
      description: 'A structured 6-month plan to clear the Amazon SDE interview loop.',
      steps: [
        'Master DSA: arrays, strings, linked lists, trees, graphs, DP',
        'Solve 300+ problems on LeetCode with company tags',
        'Build 2–3 full-stack projects with deployment',
        'Practice leadership principles (STAR method)',
        'Give 3+ mock interviews with peers',
      ],
    },
  })

  await prisma.challenge.upsert({
    where: { id: 'seed-challenge-1' },
    update: {},
    create: {
      id: 'seed-challenge-1',
      title: 'Reverse an Array',
      description:
        'Given an integer array nums, reverse it and return the reversed array. Write a function solve(nums) that returns the reversed array.',
      difficulty: 'easy',
      tags: ['array'],
      points: 20,
      solution:
        'function solve(nums) { return nums.slice().reverse() }',
      date: new Date(),
      createdBy: mentor.id,
    },
  })

  await prisma.testcase.deleteMany({
    where: { challengeId: { in: ['seed-challenge-1', 'seed-challenge-2'] } },
  })
  await prisma.testcase.createMany({
    data: [
      { challengeId: 'seed-challenge-1', input: '[1,2,3,4]', expectedOutput: '[4,3,2,1]', isPublic: true, order: 0 },
      { challengeId: 'seed-challenge-1', input: '[5]', expectedOutput: '[5]', isPublic: true, order: 1 },
      { challengeId: 'seed-challenge-1', input: '[7,8,9]', expectedOutput: '[9,8,7]', isPublic: false, order: 2 },
      { challengeId: 'seed-challenge-1', input: '[]', expectedOutput: '[]', isPublic: false, order: 3 },
      { challengeId: 'seed-challenge-2', input: '[1,2,3,1]', expectedOutput: 'true', isPublic: true, order: 0 },
      { challengeId: 'seed-challenge-2', input: '[1,2,3,4]', expectedOutput: 'false', isPublic: true, order: 1 },
      { challengeId: 'seed-challenge-2', input: '[1,1,1,3,3,4,3,2,4,2]', expectedOutput: 'true', isPublic: false, order: 2 },
      { challengeId: 'seed-challenge-2', input: '[]', expectedOutput: 'false', isPublic: false, order: 3 },
    ],
  })

  const yesterday = new Date(Date.now() - 86_400_000)
  yesterday.setUTCHours(0, 0, 0, 0)
  const dayBefore = new Date(yesterday.getTime() - 86_400_000)

  await prisma.challenge.upsert({
    where: { id: 'seed-challenge-2' },
    update: {},
    create: {
      id: 'seed-challenge-2',
      title: 'Contains Duplicate',
      description: 'Given an integer array nums, return true if any value appears at least twice in the array.',
      difficulty: 'easy',
      tags: ['array', 'hash-set'],
      points: 10,
      date: yesterday,
      createdBy: mentor.id,
    },
  })

  await prisma.challenge.upsert({
    where: { id: 'seed-challenge-3' },
    update: {},
    create: {
      id: 'seed-challenge-3',
      title: 'LRU Cache',
      description: 'Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.',
      difficulty: 'hard',
      tags: ['design', 'hash-map'],
      points: 40,
      date: dayBefore,
      createdBy: mentor.id,
    },
  })

  await prisma.challengeSubmission.upsert({
    where: { challengeId_userId: { challengeId: 'seed-challenge-2', userId: student.id } },
    update: {},
    create: {
      challengeId: 'seed-challenge-2',
      userId: student.id,
      code: 'function containsDuplicate(nums) { return new Set(nums).size !== nums.length }',
      language: 'javascript',
      status: 'accepted',
      passedTests: 4,
      totalTests: 4,
      runtimeMs: 12,
    },
  })

  await prisma.challengeSubmission.upsert({
    where: { challengeId_userId: { challengeId: 'seed-challenge-3', userId: student.id } },
    update: {},
    create: {
      challengeId: 'seed-challenge-3',
      userId: student.id,
      code: 'class LRUCache { constructor(c) { this.cap = c; this.map = new Map() } get(k) { if (!this.map.has(k)) return -1; const v = this.map.get(k); this.map.delete(k); this.map.set(k, v); return v } put(k, v) { if (this.map.has(k)) this.map.delete(k); this.map.set(k, v); if (this.map.size > this.cap) this.map.delete(this.map.keys().next().value) } }',
      language: 'javascript',
      status: 'submitted',
      passedTests: 0,
      totalTests: 0,
      runtimeMs: 0,
    },
  })

  await prisma.challengeSubmission.upsert({
    where: { challengeId_userId: { challengeId: 'seed-challenge-2', userId: mentor.id } },
    update: {},
    create: {
      challengeId: 'seed-challenge-2',
      userId: mentor.id,
      code: 'function containsDuplicate(nums) { const seen = new Set(); for (const n of nums) { if (seen.has(n)) return true; seen.add(n) } return false }',
      language: 'javascript',
      status: 'accepted',
      passedTests: 4,
      totalTests: 4,
      runtimeMs: 9,
    },
  })

  await prisma.streak.upsert({
    where: { userId: student.id },
    update: {},
    create: { userId: student.id, current: 2, longest: 2, lastActive: new Date() },
  })

  const startup = await prisma.startup.upsert({
    where: { id: 'seed-startup-1' },
    update: {},
    create: {
      id: 'seed-startup-1',
      ownerId: student.id,
      name: 'CodeCampus',
      tagline: 'Peer-learning platform for CS students',
      description:
        'A study-buddy matching app that connects students in the same class for group problem solving, mock interviews and project collabs. Looking to validate the idea with a small batch before building the MVP.',
      lookingFor: ['Full-stack dev', 'UI/UX designer'],
      stage: 'idea',
      membersNeeded: 3,
    },
  })

  const team = await prisma.startupTeam.create({
    data: {
      startupId: startup.id,
      name: 'CodeCampus Team',
      members: { create: { userId: student.id, role: 'owner' } },
    },
  })

  await prisma.learningEvent.create({
    data: {
      userId: student.id,
      type: 'startup.created',
      payload: { startupId: startup.id, name: startup.name },
    },
  })

  await prisma.post.upsert({
    where: { id: 'seed-post-1' },
    update: {},
    create: {
      id: 'seed-post-1',
      authorId: student.id,
      content: 'Started my DSA revision with the daily challenge streak — 7 days and counting! Who else is preparing for SDE interviews this semester?',
      tags: ['dsa', 'placement'],
    },
  })

  await prisma.learningEvent.create({
    data: {
      userId: student.id,
      type: 'profile.updated',
      payload: { skills: ['React', 'TypeScript', 'DSA', 'SQL'] },
    },
  })

  await prisma.note.create({
    data: {
      authorId: student.id,
      title: 'DSA Cheat Sheet — Arrays & Strings',
      description: 'My condensed revision notes covering sliding window, two pointers and common patterns.',
      tags: ['dsa', 'revision'],
      downloadCount: 42,
    },
  })

  await prisma.note.create({
    data: {
      authorId: mentor.id,
      title: 'Placement Prep Roadmap (Sem 5→7)',
      description: 'Semester-by-semester roadmap: core CS, projects, internships and mock interviews.',
      tags: ['placement', 'roadmap'],
      downloadCount: 128,
    },
  })

  const knowledgeDocs = [
    {
      id: 'seed-kb-1',
      title: 'Amazon SDE Interview Process',
      content:
        'Amazon SDE interviews typically have 4-5 rounds: an online assessment (2-3 coding problems), 1-2 coding rounds focused on data structures and algorithms, a system design round for senior roles, and a leadership principles round. Practice with the STAR method for behavioural questions. Prioritise arrays, strings, hashmaps, trees and sliding window patterns. Expect medium difficulty problems with follow-ups on time and space complexity.',
      source: 'Mentor handbook',
      tags: ['interview', 'amazon', 'sde'],
    },
    {
      id: 'seed-kb-2',
      title: '6-Month DSA Preparation Plan',
      content:
        'Month 1-2: Master arrays, strings, hashmaps and two pointers. Month 3: Trees, graphs and BFS/DFS. Month 4: Dynamic programming — start with classic problems like climbing stairs and knapsack. Month 5: System design basics — load balancing, caching, databases, API design. Month 6: Mock interviews, revise company-tagged questions, and focus on weak topics. Solve at least one challenge daily to build a streak.',
      source: 'Mentor handbook',
      tags: ['dsa', 'roadmap', 'preparation'],
    },
    {
      id: 'seed-kb-3',
      title: 'Writing Solutions for the Code Judge',
      content:
        'The RYZE code judge runs your solution as a Node.js script. Define a function named solve(input) that receives the parsed JSON testcase input and returns the expected output. The judge compares your return value to the expected output after JSON normalisation, so number precision within 1e-9 is accepted. Solutions must finish within 3 seconds and 128MB of memory. Public test cases are visible; hidden test cases are used for the final verdict.',
      source: 'Platform docs',
      tags: ['judge', 'challenges', 'javascript'],
    },
    {
      id: 'seed-kb-4',
      title: 'Building a Strong Resume for Off-Campus Placements',
      content:
        'Keep your resume to one page. Lead with a strong summary and skills section that matches the job description. List 2-3 projects with measurable impact (e.g. "cut query time by 40%"). Include one or two competitive programming achievements. Tailor keywords for ATS screening. Get your resume reviewed by a mentor on RYZE before applying.',
      source: 'Career services',
      tags: ['resume', 'placement', 'offcampus'],
    },
  ]
  for (const doc of knowledgeDocs) {
    await prisma.knowledgeDoc.upsert({
      where: { id: doc.id },
      update: {},
      create: {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        source: doc.source,
        tags: doc.tags,
        embeddedAt: new Date(),
      },
    })
  }

  console.log('Seeded users:', student.email, mentor.email)
  console.log('Seeded companies:', amazon.name, google.name)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

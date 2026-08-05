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
      title: 'Reverse a Linked List',
      description: 'Given the head of a singly linked list, reverse the list and return its head.',
      difficulty: 'medium',
      tags: ['linked-list'],
      points: 20,
      date: new Date(),
      createdBy: mentor.id,
    },
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

import { prisma } from '../db.js'

export interface KnowledgeSearchHit {
  id: string
  title: string
  content: string
  source: string | null
  tags: string[]
  score: number
  embeddedAt: Date | null
}

/** Simple tokenizer — lowercase, strip punctuation, drop stop words. */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'and', 'or', 'but', 'if', 'then', 'than', 'so', 'for', 'with', 'of',
  'to', 'in', 'on', 'at', 'by', 'from', 'as', 'it', 'its', 'this', 'that',
  'what', 'which', 'who', 'whom', 'how', 'do', 'does', 'did', 'will', 'would',
  'can', 'could', 'should', 'may', 'might', 'not', 'no', 'yes', 'you', 'your',
  'i', 'me', 'my', 'we', 'our', 'they', 'their', 'he', 'she', 'him', 'her',
  'please', 'tell', 'about', 'me', 'for', 'explain', 'help',
])

export function tokenize(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const raw of text.toLowerCase().split(/[^a-z0-9+#.]+/)) {
    if (!raw || STOP_WORDS.has(raw)) continue
    counts.set(raw, (counts.get(raw) ?? 0) + 1)
  }
  return counts
}

function dot(a: Map<string, number>, b: Map<string, number>): number {
  let sum = 0
  for (const [term, count] of a) {
    const other = b.get(term)
    if (other) sum += count * other
  }
  return sum
}

function norm(a: Map<string, number>): number {
  let sum = 0
  for (const count of a.values()) sum += count * count
  return Math.sqrt(sum) || 1
}

/**
 * Keyword/overlap retrieval over stored knowledge documents. No external
 * embedding service or vector DB needed — keeps the 2GB VPS footprint tiny.
 */
export async function searchKnowledge(
  query: string,
  limit = 5,
): Promise<KnowledgeSearchHit[]> {
  const queryTokens = tokenize(query)
  if (queryTokens.size === 0) return []

  const docs = await prisma.knowledgeDoc.findMany({ take: 200 })
  const scored: KnowledgeSearchHit[] = []

  for (const doc of docs) {
    const titleTokens = tokenize(doc.title)
    const contentTokens = tokenize(doc.content)
    const tagTokens = tokenize(doc.tags.join(' '))
    const sim =
      (dot(queryTokens, contentTokens) / norm(queryTokens)) *
      (0.7 / norm(contentTokens))
    const titleBoost = 1.5 * (dot(queryTokens, titleTokens) / (norm(queryTokens) * norm(titleTokens) || 1))
    const tagBoost = 1.2 * (dot(queryTokens, tagTokens) / (norm(queryTokens) * norm(tagTokens) || 1))
    const score = sim + titleBoost + tagBoost
    if (score <= 0) continue
    scored.push({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      source: doc.source,
      tags: doc.tags,
      score,
      embeddedAt: doc.embeddedAt,
    })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

export async function ingestKnowledge(input: {
  title: string
  content: string
  source?: string | null
  tags?: string[]
}): Promise<{ id: string }> {
  const doc = await prisma.knowledgeDoc.create({
    data: {
      title: input.title,
      content: input.content,
      source: input.source ?? null,
      tags: input.tags ?? [],
      embeddedAt: new Date(),
    },
  })
  return { id: doc.id }
}

export async function listKnowledge(limit = 20, search?: string) {
  const docs = await prisma.knowledgeDoc.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  if (!search) {
    return docs.map((d) => ({
      id: d.id,
      title: d.title,
      source: d.source,
      tags: d.tags,
      createdAt: d.createdAt.toISOString(),
    }))
  }
  const hits = await searchKnowledge(search, limit)
  return hits.map((h) => ({
    id: h.id,
    title: h.title,
    source: h.source,
    tags: h.tags,
    createdAt: h.embeddedAt?.toISOString() ?? null,
  }))
}

import type { KnowledgeDoc } from '../types'

export const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'do', 'does',
  'did', 'for', 'from', 'has', 'have', 'he', 'her', 'his', 'how', 'i', 'in', 'is', 'it',
  'its', 'not', 'of', 'on', 'or', 'our', 'out', 'so', 'than', 'that', 'the', 'their',
  'them', 'then', 'there', 'these', 'they', 'this', 'those', 'to', 'too', 'up', 'us',
  'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'who', 'why', 'will',
  'with', 'would', 'you', 'your'
])

export function tokenize(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .match(/[a-z0-9]+/g)
  if (!tokens) return []
  return tokens.filter((t) => t.length > 1 && !STOPWORDS.has(t)).map(stem)
}

/**
 * Porter stemmer (compact JS port). Reduces "returned"/"returns"/"returning" → "return"
 * so retrieval matches word forms, not just exact tokens.
 */
function stem(word: string): string {
  if (word.length < 3) return word
  const w = word.replace(/'s?$/, '')
  let step1 = w
  if (/(ing|ed)$/.test(w)) {
    const base = w.replace(/(ing|ed)$/, '')
    step1 = /(at|bl|iz)$/.test(base) ? base + 'e' : /([^aeiou][aeiouy][^aeiou])$/.test(base) ? base : /[aeiou]/.test(base) ? base : w
  } else if (/(sses|ies)$/.test(w)) {
    step1 = w.replace(/(sses|ies)$/, (m) => (m === 'ies' ? 'y' : 'ss'))
  } else if (/(us|ss)$/.test(w)) {
    step1 = w
  } else if (/s$/.test(w) && !/ss$/.test(w)) {
    step1 = w.replace(/s$/, '')
  }
  const s2 = step1.replace(/(ational|tional)$/, (m) => (m === 'ational' ? 'ate' : 'tion'))
    .replace(/enci$/, 'ence').replace(/anci$/, 'ance').replace(/izer$/, 'ize')
    .replace(/(bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|iveness|ful)$/, (m) => {
      const map: Record<string, string> = { bli: 'ble', alli: 'al', entli: 'ent', eli: 'e', ousli: 'ous', ization: 'ize', ation: 'ate', ator: 'ate', alism: 'al', iveness: 'ive', fulness: 'ful', ousness: 'ous', ful: 'ful' }
      return map[m] ?? m
    })
    .replace(/(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/, '')
    .replace(/(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/, '')
    .replace(/e$/, (m, _, str) => (/(ss|o|th|ch|sh)$/.test(str.slice(0, -1)) ? m : ''))
    .replace(/ll$/, 'l')
  return s2.length >= 2 ? s2 : word
}

export function chunkDoc(content: string, size = 450, overlap = 80): string[] {
  const sentences = content
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let current = ''
  for (const s of sentences) {
    if (current && current.length + s.length + 1 > size) {
      chunks.push(current)
      // Carry complete sentences only; slicing characters produces fragments such
      // as 'ore Credit' in reference replies and model context.
      const tail: string[] = []
      for (const sentence of current.split('\n').reverse()) {
        if (tail.join('\n').length + sentence.length > overlap) break
        tail.unshift(sentence)
      }
      current = [...tail, s].join('\n')
    } else {
      current = current ? `${current}\n${s}` : s
    }
  }
  if (current) chunks.push(current)
  return chunks
}

export interface RetrievedChunk {
  docTitle: string
  text: string
  score: number
}

interface ChunkItem {
  docTitle: string
  text: string
  tokens: string[]
}

const K1 = 1.4
const B = 0.8

function buildChunks(docs: KnowledgeDoc[]): ChunkItem[] {
  const items: ChunkItem[] = []
  for (const d of docs) {
    for (const c of chunkDoc(d.content)) {
      items.push({ docTitle: d.title, text: c, tokens: tokenize(d.title + ' ' + c) })
    }
  }
  return items
}

/** BM25-style retrieval over the knowledge base. Pure local — nothing leaves the device. */
export function retrieveKnowledge(docs: KnowledgeDoc[], question: string, topN = 3): RetrievedChunk[] {
  const chunks = buildChunks(docs)
  if (chunks.length === 0) return []

  const qTokens = tokenize(question.replace(/\bwork\b/gi, /\bhow\b/i.test(question) ? '' : 'work'))
  if (qTokens.length === 0) return []

  const n = chunks.length
  const docFreq = new Map<string, number>()
  for (const c of chunks) {
    for (const t of new Set(c.tokens)) docFreq.set(t, (docFreq.get(t) ?? 0) + 1)
  }
  const docLen = chunks.map((c) => c.tokens.length)
  const avgdl = docLen.reduce((a, b) => a + b, 0) / n || 1

  const scored: { item: ChunkItem; score: number }[] = []
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]
    const tf = new Map<string, number>()
    for (const t of c.tokens) tf.set(t, (tf.get(t) ?? 0) + 1)

    let score = 0
    for (const t of qTokens) {
      const f = tf.get(t) ?? 0
      if (f === 0) continue
      const df = docFreq.get(t) ?? 0
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5))
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (docLen[i] / avgdl))))
    }
    // A matching section heading is more authoritative than an incidental mention.
    const headings = [...c.text.matchAll(/([A-Za-z][A-Za-z -]{0,40}):/g)].flatMap(m => tokenize(m[1]))
    if (qTokens.some(t => headings.includes(t))) score += 2
    if (score > 0) scored.push({ item: c, score })
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((s) => ({ docTitle: s.item.docTitle, text: s.item.text, score: s.score }))
}

/** Build the context string injected into the prompt. Empty when nothing relevant. */
export function buildKnowledgeContext(docs: KnowledgeDoc[], question: string, topN = 3): string {
  if (!docs || docs.length === 0) return ''
  const top = retrieveKnowledge(docs, question, topN)
  if (top.length === 0) return ''
  const body = top.map((c) => `### ${c.docTitle}\n${c.text}`).join('\n\n')
  return `## Knowledge base (use these facts if they answer the question)\n\n${body}`
}

/**
 * True when a KB chunk is a strong, FAQ-style match for the question: at least
 * 60% of the question's meaningful tokens appear in one retrieved chunk (score
 * >= 0.5). This is what lets Agent X actively answer from the knowledge base
 * on EVERY question — even ones without a policy keyword like "policy" or
 * "return" (e.g. "what should be done after a resolution is provided?").
 * Product-specific words rarely satisfy the overlap, so catalog lookups stay
 * on the catalog path and are not hijacked.
 */
export function kbStronglyMatches(question: string, docs: KnowledgeDoc[], topN = 3): boolean {
  if (!docs || docs.length === 0) return false
  const qTokens = [...new Set(tokenize(question))]
  if (qTokens.length === 0) return false
  return retrieveKnowledge(docs, question, topN)
    .filter((c) => c.score >= 0.5)
    .some((c) => {
      const tokens = new Set(tokenize(c.docTitle + ' ' + c.text))
      return qTokens.filter((t) => tokens.has(t)).length / qTokens.length >= 0.6
    })
}

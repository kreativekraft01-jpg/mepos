import { normalizeInventoryQuery } from './inventoryLanguage'
import { transactionFigures, todaysTransactions } from './figures'
import type { Settings, Product, Sale, Customer, Category, KnowledgeDoc } from '../types'
import { formatDateTime } from './format'
import { STOPWORDS, tokenize, retrieveKnowledge, kbStronglyMatches } from './rag'

/** Result returned by catalogAnswer — includes an optional correctedQuery when a typo is detected. */
export interface CatalogAnswer {
  message: string
  correctedQuery?: string
  /**
   * How deterministic/trustworthy the answer is (0–1), used by the pipeline to
   * decide whether catalogAnswer won fairly or whether a fuzzy/natural-language
   * question should be routed to the LLM. High when the intent was clearly
   * structured (counts, stock, grade, price, sort); low for fuzzy subject matches
   * and "here's what we have instead" fallbacks.
   */
  confidence?: number
}

/* ── Fuzzy matching utilities ─────────────────────────────────────────────── */

/** Levenshtein edit distance between two lowercase strings. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const prev = new Array<number>(b.length + 1)
  const curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]
  }
  return prev[b.length]
}

/** True when two words are close enough to be a typo (distance ≤ 1 for words ≥ 5 chars, or first chars match + distance ≤ 2 for words ≥ 6 chars). */
function fuzzyMatchWord(query: string, candidate: string): boolean {
  if (query === candidate) return true
  if (candidate.includes(query) || query.includes(candidate)) return true
  // Normalize hyphens for comparison (spiderman vs spider-man)
  const qNorm = query.replace(/-/g, '')
  const cNorm = candidate.replace(/-/g, '')
  if (qNorm === cNorm) return true
  if (cNorm.includes(qNorm) || qNorm.includes(cNorm)) return true
  const dist = levenshtein(qNorm, cNorm)
  if (qNorm.length >= 5 && dist <= 1) return true
  if (qNorm.length >= 6 && dist <= 2 && qNorm[0] === cNorm[0]) return true
  return false
}

/** Fuzzy-match a query phrase against a text. Returns true if all query tokens fuzzy-match tokens in the text. */
function fuzzyMatchPhrase(queryTokens: string[], textTokens: string[]): boolean {
  const textSet = new Set(textTokens)
  return queryTokens.every((qt) =>
    textSet.has(qt) || textTokens.some((tt) => fuzzyMatchWord(qt, tt))
  )
}

/** Extract likely actor/actress names from a product description. E.g. "starring Tom Holland, Zendaya" → ["tom holland", "zendaya"] */
function extractActorNames(description: string): string[] {
  const match = description.match(/starring\s+([^·]+)/i)
  if (!match) return []
  return match[1]
    .split(/,\s*/)
    .map((n) => n.trim().toLowerCase())
    .filter((n) => n.length >= 2)
}

/** Fuzzy-match a subject against actor names in a description. Returns { matched: true, actor? } or { matched: false, closest? }. */
function matchActorFuzzy(subjectTokens: string[], description: string): { matched: boolean; actor?: string; closest?: string } {
  const actors = extractActorNames(description)
  if (actors.length === 0) return { matched: false }

  // Try exact/substring match first — require all subject tokens to match distinct actor parts
  for (const actor of actors) {
    const actorParts = actor.split(/\s+/)
    const matchedParts = new Set<number>()
    let allMatched = true
    for (const st of subjectTokens) {
      let found = false
      for (let i = 0; i < actorParts.length; i++) {
        if (!matchedParts.has(i) && (actorParts[i].includes(st) || st.includes(actorParts[i]))) {
          matchedParts.add(i)
          found = true
          break
        }
      }
      if (!found) { allMatched = false; break }
    }
    if (allMatched && subjectTokens.length > 0) {
      return { matched: true, actor }
    }
  }

  // Try fuzzy match
  for (const actor of actors) {
    const actorWords = actor.split(/\s+/)
    if (fuzzyMatchPhrase(subjectTokens, actorWords)) {
      return { matched: true, actor }
    }
  }

  // Find closest actor by Levenshtein on full name
  let bestDist = Infinity
  let bestActor = actors[0]
  const subjectFull = subjectTokens.join(' ')
  for (const actor of actors) {
    const dist = levenshtein(subjectFull, actor)
    if (dist < bestDist) {
      bestDist = dist
      bestActor = actor
    }
  }

  return { matched: false, closest: bestActor }
}

/**
 * Detect typos in the subject by comparing each word against catalog content.
 * Returns the corrected subject if a typo is found, or undefined if no correction needed.
 * Only flags words that are close (Levenshtein ≤ 2) but not exact matches.
 */
function detectTypo(subject: string, products: Product[], categories: Category[]): string | undefined {
  const words = subject.toLowerCase().match(/[a-z0-9]+/g) ?? []
  if (words.length === 0) return undefined

  // Build a set of all meaningful words from the catalog
  const catWords = new Set<string>()
  const catName = new Map(categories.map((c) => [c.id, c.name]))
  for (const p of products) {
    const text = `${p.name} ${catName.get(p.categoryId) ?? ''} ${p.description}`.toLowerCase()
    for (const w of text.match(/[a-z0-9][a-z0-9-]*/g) ?? []) {
      if (w.length >= 3) {
        catWords.add(w)
        catWords.add(singularize(w))
      }
    }
  }

  let corrected = false
  const newWords = [...words]
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (w.length < 3 || STOPWORDS.has(w) || INTENT_STOPWORDS.has(w)) continue
    // Skip pure numbers — they're prices/quantities, not typos
    if (/^\d+$/.test(w)) continue

    // Already an exact catalog word (or its singular form) — skip
    if (catWords.has(w) || catWords.has(singularize(w))) continue

    // Also check without hyphens (spiderman vs spider-man)
    const wNorm = w.replace(/-/g, '')
    let foundExact = false
    for (const cw of catWords) {
      if (cw.replace(/-/g, '') === wNorm) { foundExact = true; break }
    }
    if (foundExact) continue

    // Find closest catalog word
    let bestDist = Infinity
    let bestWord = ''
    for (const cw of catWords) {
      if (Math.abs(cw.length - w.length) > 2) continue
      const cwNorm = cw.replace(/-/g, '')
      const wNorm2 = w.replace(/-/g, '')
      // Require first character to match — prevents "brad" → "grade"
      if (cwNorm[0] !== wNorm2[0]) continue
      const dist = levenshtein(wNorm2, cwNorm)
      if (dist < bestDist) { bestDist = dist; bestWord = cw }
    }

    // Only flag as typo if close enough and not already correct
    // Tighter threshold: dist ≤ 1 for short words, ≤ 2 for longer words
    const maxDist = w.length >= 5 ? 2 : 1
    if (bestDist >= 1 && bestDist <= maxDist && bestWord.length >= 3) {
      newWords[i] = bestWord
      corrected = true
    }
  }

  return corrected ? newWords.join(' ') : undefined
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  resolvedQuery?: string
  products?: ProductHit[]
  sources?: { title: string; text: string }[]
}

export interface StoreSnapshot {
  storeName: string
  currency: string
  taxRate: number
  productCount: number
  catalog: { name: string; grade: string; stock: number }[]
  lowStock: { name: string; stock: number }[]
  todaySalesCount: number
  todayFigures?: ReturnType<typeof transactionFigures>
  todayRevenue: number
  totalSalesCount: number
  totalRevenue: number
  topProduct?: string
  customerCount: number
  creditOutstanding: number
}

export interface ProductHit {
  id: string
  name: string
  grade: string
  stock: number
  price: number
  categoryName: string
  description: string
}

const K1 = 1.4
const B = 0.8

/**
 * Retrieval over the product catalog for the AI: returns only the products whose name or
 * category matches the query, ranked by relevance, capped at `maxResults`.
 *
 * This mirrors how a production vector DB would return only the relevant chunk(s) for a
 * query — the LLM prompt never receives the full catalog, keeping tokens/load low.
 */
export function retrieveProducts(
  products: Product[],
  categories: Category[],
  query: string,
  maxResults = 6
): ProductHit[] {
  const qTokens = tokenize(query)
  if (qTokens.length === 0) return []

  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const docs = products.map((p) => {
    const text = `${p.name} ${catName.get(p.categoryId) ?? ''} ${p.description}`
    return { p, tokens: tokenize(text), len: 0 }
  })
  docs.forEach((d) => (d.len = d.tokens.length))
  const avgdl = docs.reduce((s, d) => s + d.len, 0) / docs.length || 1

  const docFreq = new Map<string, number>()
  for (const d of docs) for (const t of new Set(d.tokens)) docFreq.set(t, (docFreq.get(t) ?? 0) + 1)
  const n = docs.length

  const rawWords = rawQueryWords(query)

  const scored: { p: Product; score: number }[] = []
  for (const d of docs) {
    const tf = new Map<string, number>()
    for (const t of d.tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
    let score = 0
    for (const t of qTokens) {
      const f = tf.get(t) ?? 0
      if (f === 0) continue
      const df = docFreq.get(t) ?? 0
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5))
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (d.len / avgdl))))
    }
    if (score > 0) scored.push({ p: d.p, score })
  }

  // Fall back to raw word substring matching so plurals/forms the stemmer misses still hit
  // (e.g. "phones" → "iPhone 15", "switches" → "Nintendo Switch OLED").
  const docText = (p: Product) => `${p.name} ${catName.get(p.categoryId) ?? ''} ${p.description}`.toLowerCase()
  const rawHitIds = new Set<string>()
  if (rawWords.length > 0) {
    for (const p of products) {
      const text = docText(p)
      if (rawWords.some((w) => text.includes(w))) rawHitIds.add(p.id)
    }
  }

  // Exact phrase matching for multi-word queries (e.g. "Tom Cruise" must match as a phrase,
  // not just the individual words "tom" and "cruise" which would also hit "Tom Holland").
  const queryLower = query.toLowerCase()
  const meaningfulWords = queryLower.match(/[a-z0-9]{3,}/g) ?? []
  const phrases: string[] = []
  // Build 2-word and 3-word consecutive phrases from non-stopword words
  const sigWords = meaningfulWords.filter((w) => !STOPWORDS.has(w))
  for (let i = 0; i < sigWords.length - 1; i++) phrases.push(`${sigWords[i]} ${sigWords[i + 1]}`)
  for (let i = 0; i < sigWords.length - 2; i++) phrases.push(`${sigWords[i]} ${sigWords[i + 1]} ${sigWords[i + 2]}`)
  const phraseBoost = new Map<string, number>()
  if (phrases.length > 0) {
    for (const p of products) {
      const text = docText(p)
      let hits = 0
      for (const phrase of phrases) {
        if (text.includes(phrase)) hits++
      }
      if (hits > 0) phraseBoost.set(p.id, hits * 2) // big boost for exact phrase match
    }
  }

  // Fuzzy matching fallback: when no exact phrase hits, try fuzzy token matching
  // to handle typos like "tom cruse" → "tom cruise", "keanu reeves" → "keanu reeves"
  const hasExactPhraseHits = phraseBoost.size > 0
  const fuzzyHits = new Map<string, number>()
  if (!hasExactPhraseHits && sigWords.length > 0) {
    for (const p of products) {
      const text = docText(p)
      const docTokens = text.split(/\s+/)
      let fuzzyScore = 0
      // Fuzzy match phrases (consecutive tokens) — first token must match exactly
      // For multi-word queries, skip individual word matching to avoid "movies" matching everything
      if (sigWords.length >= 2) {
        for (let i = 0; i < sigWords.length - 1; i++) {
          for (let j = 0; j < docTokens.length - 1; j++) {
            if (sigWords[i] === docTokens[j] && fuzzyMatchWord(sigWords[i + 1], docTokens[j + 1])) {
              fuzzyScore += 3 // bonus for fuzzy phrase match
            }
          }
        }
      } else {
        // Single-word queries: individual word fuzzy matching
        for (const sw of sigWords) {
          if (docTokens.some((dt) => fuzzyMatchWord(sw, dt))) fuzzyScore += 1
        }
      }
      // Also check actor names in descriptions specifically
      const actorResult = matchActorFuzzy(sigWords, p.description)
      if (actorResult.matched) fuzzyScore += 4
      if (fuzzyScore > 0) fuzzyHits.set(p.id, fuzzyScore)
    }
  }

  const combined = new Map<string, { p: Product; score: number }>()
  for (const s of scored) combined.set(s.p.id, s)
  for (const id of rawHitIds) {
    const p = products.find((x) => x.id === id)
    if (!p) continue
    if (combined.has(id)) combined.get(id)!.score += 0.5
    else combined.set(id, { p, score: 0.5 })
  }
  // Apply phrase boost — exact phrase matches rank much higher
  for (const [id, boost] of phraseBoost) {
    if (combined.has(id)) combined.get(id)!.score += boost
    else {
      const p = products.find((x) => x.id === id)
      if (p) combined.set(id, { p, score: boost })
    }
  }
  // Apply fuzzy hits — lower weight than exact matches but still surfaces typo-tolerant results
  for (const [id, boost] of fuzzyHits) {
    if (combined.has(id)) combined.get(id)!.score += boost * 0.4
    else {
      const p = products.find((x) => x.id === id)
      if (p) combined.set(id, { p, score: boost * 0.4 })
    }
  }

  return [...combined.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((x) => ({
      id: x.p.id,
      name: x.p.name,
      grade: x.p.grade,
      stock: x.p.stock,
      price: x.p.price,
      categoryName: catName.get(x.p.categoryId) ?? '',
      description: x.p.description
    }))
}

/** Common device synonyms the catalog may not literally contain (stand-in for vector embeddings). */
const SYNONYMS: Record<string, string[]> = {
  phone: ['smartphone', 'iphone', 'galaxy s', 'pixel'],
  phones: ['smartphone', 'iphone', 'galaxy s', 'pixel'],
  smartphone: ['smartphone', 'iphone', 'galaxy s', 'pixel'],
  smartphones: ['smartphone', 'iphone', 'galaxy s', 'pixel'],
  mobile: ['smartphone', 'iphone', 'galaxy s', 'pixel'],
  earbud: ['airpod', 'earbud'],
  earbuds: ['airpod', 'earbud'],
  headphones: ['airpod', 'headphone', 'wh-1000', 'qc45'],
  headphone: ['airpod', 'headphone', 'wh-1000', 'qc45'],
  speaker: ['jbl', 'flip', 'bose', 'sony'],
  laptop: ['macbook', 'elitebook', 'ipad'],
  notebook: ['macbook', 'elitebook'],
  tablet: ['ipad'],
  watch: ['apple watch', 'galaxy watch'],
  wearable: ['apple watch', 'galaxy watch'],
  band: ['apple watch', 'galaxy watch'],
  console: ['ps5', 'xbox', 'switch'],
  game: ['zelda', 'mario', 'animal crossing', 'god of war', 'spider-man', 'elden ring', 'halo'],
  switch: ['nintendo switch'],
  camera: ['canon', 'eos', 'dji'],
  drone: ['dji'],
  movie: ['blu-ray', '4k', 'uhd'],
  movies: ['blu-ray', '4k', 'uhd'],
  film: ['blu-ray', '4k', 'uhd'],
  films: ['blu-ray', '4k', 'uhd'],
  actor: ['starring', 'actor'],
  actress: ['starring', 'actress'],
  actors: ['starring', 'actor'],
  actresses: ['starring', 'actress'],
  blu: ['blu-ray', 'blu-ray'],
  bluray: ['blu-ray'],
  '4k': ['4k', 'uhd', 'blu-ray'],
  hd: ['4k', 'uhd', 'blu-ray'],
  disc: ['blu-ray', '4k', 'uhd'],
  media: ['blu-ray', '4k', 'uhd', 'movie', 'movies'],
  superhero: ['spider-man', 'batman', 'panther', 'guardians'],
  action: ['john wick', 'top gun', 'spider-man'],
  comedy: ['barbie', 'glass onion', 'puss in boots'],
  drama: ['oppenheimer', 'interstellar', 'dark knight', 'flower moon'],
  sci: ['dune', 'interstellar', 'everything everywhere'],
  animated: ['puss in boots']
}

/** Lowercased raw words from the query (stopwords removed) used for substring matching. */
function rawQueryWords(query: string): string[] {
  const words = query.toLowerCase().match(/[a-z0-9]+/g) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const w of words) {
    if (w.length < 3 || STOPWORDS.has(w) || seen.has(w)) continue
    seen.add(w)
    const singular = singularize(w)
    out.push(w, singular)
    for (const syn of SYNONYMS[singular] ?? []) out.push(syn)
  }
  return out
}

export function buildSnapshot(
  products: Product[],
  sales: Sale[],
  customers: Customer[],
  settings: Settings
): StoreSnapshot {
  const today = todaysTransactions(sales)
  const figures = transactionFigures(today)
  const all = transactionFigures(sales)
  const itemCounts = new Map<string, number>()
  for (const s of sales.filter(s => s.kind === 'sale')) for (const it of s.items) itemCounts.set(it.productId, (itemCounts.get(it.productId) ?? 0) + it.qty)
  const topId = [...itemCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

  return {
    storeName: settings.storeName,
    currency: settings.currency,
    taxRate: settings.taxRate,
    productCount: products.length,
    catalog: products.map((p) => ({ name: p.name, grade: p.grade, stock: p.stock })),
    lowStock: products
      .filter((p) => p.stock <= p.lowStockThreshold)
      .map((p) => ({ name: p.name, stock: p.stock }))
      .sort((a, b) => a.stock - b.stock),
    todayFigures: figures,
    todaySalesCount: figures.orders,
    todayRevenue: figures.sales,
    totalSalesCount: all.orders,
    totalRevenue: all.sales,
    topProduct: topId ? products.find((p) => p.id === topId)?.name : undefined,
    customerCount: customers.length,
    creditOutstanding: customers.reduce((s, c) => s + c.balance, 0)
  }
}

export function buildAssistantSystemPrompt(
  s: StoreSnapshot,
  kbContext: string,
  customerPrompt = '',
  attachedCustomerName?: string,
  relevant: ProductHit[] = []
): string {
  const relevantSection =
    relevant.length > 0
      ? [
          'Products relevant to the current question (search result — use THIS list to answer any "how many / how much / which / how are graded" question; count only from this list, never guess):',
          relevant.map((p) =>
            `- ${p.name} (${p.categoryName}) · Grade ${p.grade} · £${p.price.toFixed(2)} · stock ${p.stock}${p.description ? ` · ${p.description}` : ''}`
          ).join('\n')
        ]
      : ['No products in the catalog match this question — if the question asks for product counts or availability, say you don\'t have matching data. If the user asked about a specific actor, explicitly state we don\'t have movies by that actor and list actors we DO have. Never show unrelated products as if they match.']
  return [
    `You are the private AI assistant for "${s.storeName}", a store that buys, sells, and exchanges refurbished electronics and media (movies on Blu-ray / 4K UHD). We sell NO new items. Everything runs locally on the store's own machine — all data is private.`,
    'Every device is graded A–F on intake: A = like new, B = very good/light wear, C = good/visible wear, D = fair, E = poor, F = for parts. Recommend within a customer\'s preferred grade and budget.',
    'Movies and media are also graded A–F on condition (disc and case quality). Movie descriptions include actor names — when a customer asks about an actor, search the catalog for movies featuring that actor.',
    'REASONING RULES — follow strictly:',
    '1. VALIDATE actor names before answering. If user asks for "Tom Cruise" but results only show Tom Holland, say "We don\'t have Tom Cruise movies, but we do have Tom Holland in Spider-Man." Never mix up similar-sounding actors.',
    '2. HANDLE TYPOS: users may misspell names (e.g. "tom cruse" for "tom cruise"). Match the intended name. If unsure, ask.',
    '3. DATA NOT AVAILABLE: if nothing matches, say so clearly. Never guess or invent products. Suggest what we DO have.',
    '4. EXACT MATCHING: when a user names a specific actor, only return products featuring that exact actor. Do NOT show different actors just because they share a first name or genre.',
    '5. If the relevant products list is empty, say we don\'t carry that and suggest alternatives.',
    'Help store staff with: how to use the POS, products, inventory, sales reports, customers, store credit, trade-ins/exchanges, checkout, and movie/media queries (actor availability, movie titles, genres).',
    'When a customer is asked about, use ONLY the customer context / purchase data provided below. Report exactly what is listed — receipt number, date, items, totals.',
    'NEVER invent products, dates, prices, purchases, or a customer\'s preferences. If the data you need is not in this prompt, say you don\'t have it and ask for clarification.',
    'Keep answers short (under 150 words), practical and conversational. Use bullet points when helpful.',
    'Live store data:',
    `- Products in catalog: ${s.productCount}`,
    `- In stock: ${s.catalog.filter((p) => p.stock > 0).length} devices`,
    `- Low-stock items: ${s.lowStock.length}`,
    `- Sales today: ${s.todaySalesCount} (${fmt(s.todayRevenue, s.currency)})`,
    s.topProduct ? `- Best seller: ${s.topProduct}` : '',
    attachedCustomerName ? `- Customer currently attached at checkout: ${attachedCustomerName}. Questions using "she/he/this customer" refer to them unless a name is given.` : '',
    'When a follow-up question refers back to the previous question, it is rewritten to include the topic in parentheses, e.g. "how many are grade C (of: iphones)". The "(of: …)" part is the subject the user is still asking about — answer ONLY about that subject.',
    ...relevantSection,
    kbContext,
    customerPrompt,
    'When customer context is provided, ALWAYS use the customer data (purchases, spending, suggestions) to answer. The knowledge base is for store policies and procedures only — never use it to answer questions about a specific customer.'
  ]
    .filter(Boolean)
    .join('\n')
}

function fmt(n: number, cur: string): string {
  return `${cur}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Words that signal the current question refers back to the previous question's topic. */
const FOLLOWUP_KEYWORDS =
  /under|below|cheapest|where|last buys|last sales|latest|quantity|grade|graded|prices?|costs?|counts?|stock|left|available|how many|how much|what about|how about|them|those|these|they|that\b|the same|their|its|any\b|each\b|ones?\b|in total|altogether|of those|of them|which ones?|are graded|are in|we have|you have|we got|you got|we carry|you carry|which\b|any\b|got\b/i

const SUBJECT_LEAD =
  /^(how many|how much|what about|what is|what are|what's|whats|which|what|do we have|do you have|are there|is there|we have|you have|can you|tell me|give me|show me|recommend me|looking for|find me|recommend|suggest|list|count|number of|any|got|u have|ya got|do ya have|any idea|you got)\s+/i

const SUBJECT_TAIL =
  /\s*(we have|you have|do we have|do you have|are there|is there|in stock|available|on hand|currently|right now|do we carry|do you carry|are in stock|are available|are left)\s*[?.!]*$/i

/** Pulls the noun-phrase topic out of a previous question, e.g. "how many iphones we have" → "iphones". */
function extractSubject(prior: string): string {
  const s = prior
    .trim()
    .replace(/[?.!]+$/g, '')
    .replace(SUBJECT_LEAD, '')
    .replace(SUBJECT_TAIL, '')
    .replace(/^(the|our|your|some|all)\s+/i, '')
    .trim()
  return s
}

/** Removes the "(of: …)" subject annotation appended by resolveFollowUp. */
export function stripFollowUpAnnotation(question: string): string {
  return question.replace(/\s*\(of:\s*[^)]*\)\s*$/i, '').trim()
}

/** Whole-catalog nouns a user can ask about without naming a specific product. */
const WHOLE_CATALOG = new Set([
  'product', 'products', 'catalog', 'catalogue', 'item', 'items', 'stock', 'inventory',
  'device', 'devices', 'everything', 'list',
  'movie', 'movies', 'film', 'films', 'media', 'blu-ray', 'bluray', 'disc', 'discs'
])

/** Words that point back to a previously mentioned product (real follow-ups). */
const REFERENTIAL = /\b(that|this|these|those|they|them|their|it|its|the same|of those|of them|the above|ones?)\b/i

/**
 * True when the question names its own concrete subject — either a specific catalog
 * product, a category, or a whole-catalog noun — meaning it is a fresh standalone
 * question and should NOT be rewritten as a follow-up of the previous turn.
 */
function hasOwnSubject(q: string, catalogNames: string[]): boolean {
  if (/^(?:(?:how many|how much|quantity|price|prices|where is it|where are they|last buys|last sales|latest buys|latest sales)(?:\s+(?:left|in stock|each|please))?|(?:got|need|have you got)\s+\d+|(?:any\s+)?cheapest|(?:only\s+)?grade\s+[a-f](?:\s+only)?|(?:under|below)\s*[£$€]?\d+(?:\.\d+)?)\s*[?.!]*$/i.test(q)) return false
  const remainder = q
    .replace(/[?.!]+$/g, '')
    .replace(SUBJECT_LEAD, '')
    .replace(SUBJECT_TAIL, '')
    .trim()
  if (/\b(phones?|smartphones?|laptops?|tablets?|headphones?|cameras?|watches|wearables|gaming|audio|sales|revenue|customers?|polic(?:y|ies)|banking)\b/i.test(q)) return true
  if (REFERENTIAL.test(remainder)) return false
  // A named item remains a new topic even when it is absent from our catalog.
  if (/^(?:do (?:we|you) have|have (?:we|you) got|got|any)\b/i.test(q) && cleanSubjectForProducts(remainder).replace(/[?.!]/g, '').trim().length >= 3) return true
  const words = remainder
    .toLowerCase()
    .replace(/[^a-z0-9' -]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3)
  // Pure numbers are not product subjects (e.g. "which 4 we have?" → "4" is not a subject)
  if (words.length === 0 || words.every((w) => /^\d+$/.test(w))) return false
  if (words.some((w) => WHOLE_CATALOG.has(singularize(w)))) return true
  const tokens = new Set(words.map(singularize))
  for (const name of catalogNames) {
    const set = nameTokenSet(name)
    for (const t of tokens) if (tokenHits(set, t)) return true
  }
  return false
}

/** English singularization: iphones → iphone, watches → watch, boxes → box, movies → movie. */
function singularize(word: string): string {
  const w = word.toLowerCase()
  if (w.length <= 3) return w
  if (w === 'movies') return 'movie'
  if (/ies$/.test(w)) return `${w.slice(0, -3)}y`
  // Sibilant endings: "watches" → "watch", "glasses" → "glass", "boxes" → "box"
  if (/(?:sh|ch|ss|zz|x|s)es$/.test(w)) return w.slice(0, -2)
  // Regular plurals: "iphones" → "iphone", "phones" → "phone", "movies" → "movie"
  if (/s$/.test(w) && !/ss$/.test(w) && !/us$/.test(w) && !/is$/.test(w)) return w.slice(0, -1)
  return w
}

/** Significant tokens of a product name, both singular and raw, e.g. "Nintendo Switch OLED" → {nintendo, switch, oled}. */
function nameTokenSet(name: string): Set<string> {
  const set = new Set<string>()
  for (const w of name.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (w.length < 3) continue
    set.add(w)
    set.add(singularize(w))
  }
  return set
}

/** True when a question token refers to a product-name token, allowing plural/prefix forms. */
function tokenHits(set: Set<string>, token: string): boolean {
  if (set.has(token)) return true
  if (token.length < 4) return false
  for (const s of set) if (s.startsWith(token) || token.startsWith(s)) return true
  return false
}

/**
 * Resolves follow-up questions that omit their topic, e.g. Q1 "how many iphones we have?"
 * followed by Q2 "how many are grade C?" → "how many are grade C (of: iphones)".
 * Questions that already name their own subject are left untouched. `catalogNames`
 * supplies the product names used to detect a self-contained subject.
 * Returns the question unchanged when it's not a follow-up or has no prior turn.
 */
export function resolveFollowUp(
  question: string,
  priorUserQuestion?: string,
  catalogNames: string[] = []
): string {
  const q = normalizeInventoryQuery(question)
  if (priorUserQuestion && /^(?:now|again|check again|and now|still)[?.!]*$/i.test(q)) return priorUserQuestion
  if (!priorUserQuestion || !FOLLOWUP_KEYWORDS.test(q)) return q
  const inherited = priorUserQuestion.match(/\(of:\s*([^)]*)\)\s*$/i)?.[1]
  let subject = inherited || extractSubject(priorUserQuestion)
  if (inherited) {
    // Carry the latest explicit constraints forward through multiple turns.
    const priorText = stripFollowUpAnnotation(priorUserQuestion)
    const grade = priorText.match(/grade[sd]?\s+[a-f]\b/i)?.[0]
    const budget = priorText.match(/(?:under|below|less than|up to)\s*[£$€]?\s*\d+(?:\.\d+)?/i)?.[0]
    if (grade) subject = `${subject.replace(/grade[sd]?\s+[a-f]\b/ig, '').trim()} ${grade}`
    if (budget) subject = `${subject.replace(/(?:under|below|less than|up to)\s*[£$€]?\s*\d+(?:\.\d+)?/ig, '').trim()} ${budget}`
  }
  if (!subject || /\b(sales|revenue|banking|policy|policies|customers?)\b/i.test(subject)) return q
  if (hasOwnSubject(q, catalogNames)) return q
  const ql = q.toLowerCase()
  const subjWords = subject
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && w !== 'and' && w !== 'for')
  if (subjWords.length > 0 && subjWords.every((w) => ql.includes(w))) return q
  return `${q} (of: ${subject})`
}

/** Strip sort/recommend/price/grade/availability words from a subject so subjectProducts only matches the actual product noun. */
function cleanSubjectForProducts(subject: string): string {
  const cleaned = subject
    .replace(/deals?|cheapest|most expensive|best value|lowest price|highest price|affordable|budget|best (deal|price)|least expensive|lowest|highest|price (low|high|up|down)/gi, '')
    .replace(/recommend(?:ation|ations|ed|ing|er|ers)?|suggest(?:ion|ions|ed|ing|er|ers)?|find me|looking for|give me/gi, '')
    .replace(/do (we|you) have|do (we|you) carry|are there|is there|we have|you have|we got|you got|have we|got any|we carry|you carry/i, '')
    .replace(/(?:for|that is|is)\s+(?:under|below|less than|up to)\s*(?:£|\$|gbp|usd|pounds?|dollars?)?\s*\d+(?:\.\d{1,2})?\s*(?:£|\$|gbp|usd|pounds?|dollars?)?/gi, '')
    .replace(/(?:under|below|less than|cheaper than|up to|no more than|between)\s*(?:£|\$|gbp|usd|pounds?|dollars?)?\s*\d+(?:\.\d{1,2})?\s*(?:£|\$|gbp|usd|pounds?|dollars?)?/gi, '')
    .replace(/\b\d+(?:\.\d{1,2})?\s*(?:£|\$|gbp|usd|pounds?|dollars?)\b/gi, '')
    .replace(/grade[sd]?\s+[a-f]\b/gi, '')
    .replace(/\b(that|is|it|for|the|a|an|and|or|but|to|of|in|on|at|by|with|from|any|got|some|all|like|just|really|very|also|maybe|perhaps|good|best|nice|great|options?|option|available|availability|right now|right|now|currently|in stock|out of stock|stock|on hand|browse|browsing|category|categories|type|types|kind|kinds|count|total|many|much|about|what|which|how)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  // Drop any remaining single-letter or two-letter words, plus leftover noise fragments
  return cleaned
    .split(/\s+/)
    .filter((w) => (w.length >= 3 || /^\d+$/.test(w)) && !/^(nation|ation|tions|ions)$/i.test(w))
    .join(' ')
}

/** Search-intent / constraint words that should never be treated as product keywords. */
const INTENT_STOPWORDS = new Set([
  'deal', 'deals', 'recommend', 'recommended', 'recommending', 'recommendation', 'recommendations',
  'suggest', 'suggested', 'suggesting', 'suggestion', 'suggestions',
  'looking', 'find', 'show', 'list', 'give', 'cheapest', 'expensive',
  'affordable', 'budget', 'best', 'value', 'price', 'prices', 'under', 'below', 'above',
  'over', 'between', 'less', 'more', 'than', 'grade', 'graded', 'grades',
  'me', 'some', 'would', 'like', 'please', 'could', 'can',
  'options', 'option', 'available', 'availability', 'right', 'now', 'currently',
  'stock', 'browse', 'browsing', 'category', 'categories', 'count', 'total',
  'many', 'much', 'good', 'nice', 'great', 'other', 'another', 'type', 'types',
  'kind', 'kinds', 'any', 'got', 'carry', 'have', 'had', 'has',
])

/** Significant query words (raw + singular) used to pick the subject products, with SYNONYMS expansion. */
function subjectWords(subject: string): string[] {
  const out = new Set<string>()
  for (const w of subject.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (w.length < 3 || STOPWORDS.has(w) || INTENT_STOPWORDS.has(w)) continue
    out.add(w)
    const singular = singularize(w)
    out.add(singular)
    for (const syn of SYNONYMS[singular] ?? []) {
      if (syn.length >= 3) out.add(syn)
    }
  }
  return [...out]
}

/** Products whose name, category, or description matches the subject; whole-catalog nouns match everything. */
function subjectProducts(subject: string, products: Product[], categories: Category[]): { products: Product[]; correctedSubject?: string } {
  const numbers = cleanSubjectForProducts(subject).match(/\b\d+\b/g) ?? []
  if (numbers.length) products = products.filter(p => numbers.every(n => new Set<string>(p.name.match(/\b\d+\b/g) ?? []).has(n)))
  const words = subjectWords(subject)
  if (words.length === 0) return { products: [] }
  // Split words into specific (actor/product) and whole-catalog nouns
  const specific = words.filter((w) => !WHOLE_CATALOG.has(singularize(w)))
  const hasWholeCatalog = words.length !== specific.length
  // If the subject is ONLY whole-catalog nouns (e.g. "movies", "products"), match everything
  if (hasWholeCatalog && specific.length === 0) return { products: [...products] }
  // If there are specific words alongside whole-catalog nouns (e.g. "Tom Cruise movies"),
  // match ONLY on the specific words — the whole-catalog noun is just context, not a filter
  const matchWords = specific.length > 0 ? specific : words

  // Actor constraints apply to recorded cast, not incidental title/genre words.
  const actorTokens = (subject.toLowerCase().match(/[a-zÀ-ž]+/g) ?? [])
    .filter(w => !STOPWORDS.has(w) && !INTENT_STOPWORDS.has(w) && !WHOLE_CATALOG.has(singularize(w)) && !['starring', 'actor', 'actress', 'with', 'featuring'].includes(w))
  if (!actorTokens.length && /\b(movies?|films?|media)\b/i.test(subject)) {
    return { products: products.filter(p => /\b(movies?|films?|media)\b/i.test(categories.find(c => c.id === p.categoryId)?.name ?? '') || /blu-ray|starring/i.test(p.description)) }
  }
  const actorMatches = products.filter(p => matchActorFuzzy(actorTokens, p.description).matched)
  if (actorTokens.length && actorMatches.length) return { products: actorMatches }

  // Build multi-word phrases from the original subject for exact matching
  const rawWords = subject.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []
  const sigRaw = rawWords.filter((w) => !STOPWORDS.has(w))
  const phrases: string[] = []
  for (let i = 0; i < sigRaw.length - 1; i++) phrases.push(`${sigRaw[i]} ${sigRaw[i + 1]}`)
  for (let i = 0; i < sigRaw.length - 2; i++) phrases.push(`${sigRaw[i]} ${sigRaw[i + 1]} ${sigRaw[i + 2]}`)

  const catName = new Map(categories.map((c) => [c.id, c.name]))

  // Phase 1: exact matching (word-boundary for short words to avoid "phones" matching "headphones")
  const exactMatches = products.filter((p) => {
    const text = `${p.name} ${catName.get(p.categoryId) ?? ''} ${p.description}`.toLowerCase()
    if (phrases.length > 0) return phrases.some((ph) => text.includes(ph))
    return matchWords.some((w) => {
      if (w.length <= 6) return new RegExp(`(?:^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z]|$)`).test(text)
      return text.includes(w)
    })
  })

  if (exactMatches.length > 0) return { products: exactMatches }

  // Phase 2: fuzzy matching — handle typos like "tom cruse" → "tom cruise"
  const fuzzyMatches: { p: Product; score: number }[] = []
  for (const p of products) {
    const text = `${p.name} ${catName.get(p.categoryId) ?? ''} ${p.description}`.toLowerCase()
    const docTokens = text.split(/\s+/)
    let score = 0

    if (sigRaw.length >= 2) {
      for (let i = 0; i < sigRaw.length - 1; i++) {
        for (let j = 0; j < docTokens.length - 1; j++) {
          if (sigRaw[i] === docTokens[j] && fuzzyMatchWord(sigRaw[i + 1], docTokens[j + 1])) {
            score += 5
          }
        }
      }
    } else {
      for (const mw of matchWords) {
        if (docTokens.some((dt) => fuzzyMatchWord(mw, dt))) score += 2
      }
    }

    const actorResult = matchActorFuzzy(matchWords, p.description)
    if (actorResult.matched) score += 4

    if (score > 0) fuzzyMatches.push({ p, score })
  }

  if (fuzzyMatches.length > 0) {
    // Detect typos in the original subject and suggest correction
    const correctedSubject = detectTypo(subject, products, categories)
    return {
      products: fuzzyMatches.sort((a, b) => b.score - a.score).map((m) => m.p),
      correctedSubject
    }
  }

  // Phase 3: no matches at all
  return { products: [] }
}

/**
 * Deterministically answers "how many … / do you have … / which are grade …" questions
 * straight from the database, so counts can never be hallucinated or self-contradictory
 * (e.g. "12 phones graded A" followed by "7 smartphones, mixed grades"). Returns undefined
 * when the question isn't a clear count/availability question — callers then fall back to
 * the model or the offline reply.
 */
export function catalogAnswer(question: string, products: Product[], categories: Category[]): CatalogAnswer | undefined {
  const comparison = compareAnswer(question, products, categories)
  if (comparison) return { message: comparison, confidence: 1 }
  if (/\b(tvs?|televisions?)\b/i.test(question)) {
    products = products.filter(p => /\b(tv|television)s?\b/i.test(p.name + ' ' + (categories.find(c => c.id === p.categoryId)?.name ?? '')))
    if (!products.length) return { message: 'We do not have any TVs in the catalog.', confidence: 1 }
  }
  const ann = question.match(/\(of:\s*([^)]+)\)$/i)
  const raw = stripFollowUpAnnotation(question).trim()
  const subject = ann ? ann[1].trim() : extractSubject(raw)
  if (!subject) return undefined

  // Detect typos early — runs for ALL query types, including "do we have X?"
  const correctedSubject = detectTypo(subject, products, categories)
  if (correctedSubject && correctedSubject !== subject) {
    const correctedResults = subjectProducts(correctedSubject, products, categories).products
    if (correctedResults.length > 0) {
      const correctedLabel = correctedSubject.replace(/\s+/g, ' ').slice(0, 32).trim()
      return {
        message: `Did you mean "${correctedLabel}"? I found ${correctedResults.length} result${correctedResults.length !== 1 ? 's' : ''} for that.`,
        correctedQuery: correctedSubject,
        confidence: 1
      }
    }
  }

  const q = question.toLowerCase()
  const countIntent = /how many|number of|count|total|how much|altogether/.test(q)
  const availIntent = /do (you|we) have|are there|is there|\bany\b|got\b|have (you|we)|available|in stock|left\b|on hand|carry|stock\b/.test(q)
  const categoryIntent = /what categ|list categ|show.*categ|browse categ|categories|kinds of|types of|what do you sell|what do we sell|what can i buy|what (items|products) do you have|what (items|products) are there/i.test(q)
  const recommendIntent = /recommend|suggest|show me|looking for|find me|give me|which |what .*(phones|laptops|computers|tablets|devices|products|movies|films|media)/i.test(q)
  const sortIntent = /cheapest|most expensive|best value|lowest price|highest price|affordable|budget|best (deal|price)|lowest|highest|price (low|high|up|down)|least expensive/i.test(q)

  // Shared constraint extraction — used by both the fallback path and the main flow.
  // Grade detection: "grade F", "graded B", and bare letters like "computers F" / "F phones".
  const gradeWord = (q.match(/grade[sd]?\s+([a-f])\b/i) ?? [])[1]?.toUpperCase()
  const bareGrade = (() => {
    const nouns = 'phones?|laptops?|computers?|tablets?|headphones?|earphones?|earbuds?|wearables?|watches?|smartwatches?|gaming|games?|consoles?|cameras?|drones?|movies?|films?|discs?|ipads?|audio|media|tech|electronics'
    const after = q.match(new RegExp(`\\b(?:${nouns})\\s+([a-f])\\b`, 'i'))
    const before = q.match(new RegExp(`\\b([a-f])\\s+(?:${nouns})\\b`, 'i'))
    const raw = (after ?? before)?.[1]
    return raw ? raw.toUpperCase() : undefined
  })()
  const gradeLetter = gradeWord ?? bareGrade
  // Price constraints: "under £400", "under 400 pounds", "below $200", "400 GBP"
  const priceMatch = q.match(/(?:under|below|less than|cheaper than|up to|no more than|between)\s*(?:£|\$|gbp|usd|pounds?|dollars?)?\s*(\d+(?:\.\d{1,2})?)\s*(?:£|\$|gbp|usd|pounds?|dollars?)?/i)
    ?? q.match(/(\d+(?:\.\d{1,2})?)\s*(?:£|\$|gbp|usd|pounds?|dollars?)\b/i)
  const maxPrice = priceMatch ? parseFloat(priceMatch[1]) : undefined

  // Category browsing — "what categories", "list categories", "show me categories"
  if (categoryIntent) {
    const catName = new Map(categories.map((c) => [c.id, c.name]))
    const byCat = new Map<string, number>()
    for (const p of products) {
      const cn = catName.get(p.categoryId) ?? 'Other'
      byCat.set(cn, (byCat.get(cn) ?? 0) + 1)
    }
    if (byCat.size > 0) {
      const lines = [...byCat.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `• ${name} — ${count} product${count !== 1 ? 's' : ''}`)
      return { message: `Here are the categories we carry (${products.length} products total):\n${lines.join('\n')}\n\nAsk me to "show me [category]" to browse a specific category.`, confidence: 1 }
    }
  }
  if (!countIntent && !availIntent && !categoryIntent && !recommendIntent && !sortIntent) {
    // Clean subject: strip sort/recommend/price/grade keywords so we match on the product noun
    const cleaned = cleanSubjectForProducts(subject)
    const searchSubject = cleaned.length >= 3 ? cleaned : subject

    // Fallback: query doesn't match explicit intent patterns (e.g. "tom cruise movies",
    // "iphones", "macbooks"), but still try to search based on the subject.
    let result = subjectProducts(searchSubject, products, categories).products

    // Apply grade filter if present
    if (gradeLetter && result.length > 0) {
      result = result.filter((p) => p.grade.toUpperCase() === gradeLetter)
    }
    // Apply price filter if present
    if (maxPrice !== undefined && result.length > 0) {
      result = result.filter((p) => p.price <= maxPrice)
    }

    // If no results from subject matching, try category-based filtering
    // Skip for pure numbers or very short subjects — they're not real product queries
    if (result.length === 0 && subject.length >= 3 && !/^\d+$/.test(subject.trim())) {
      const catName = new Map(categories.map((c) => [c.id, c.name]))
      const subLower = subject.toLowerCase()

      // 1. Exact category name match: "show me Smartphones", "show me Gaming"
      for (const [catId, cn] of catName) {
        if (cn.toLowerCase() === subLower || cn.toLowerCase().includes(subLower) || subLower.includes(cn.toLowerCase())) {
          const catProducts = products.filter((p) => p.categoryId === catId)
          if (catProducts.length > 0) {
            const inStock = catProducts.filter((p) => p.stock > 0)
            const top = catProducts
              .slice(0, 5)
              .map((p) => `• ${p.name} · Grade ${p.grade} · £${p.price.toFixed(2)} · ${p.stock > 0 ? `${p.stock} in stock` : 'out of stock'}`)
              .join('\n')
            const more = catProducts.length > 5 ? `\n…and ${catProducts.length - 5} more` : ''
            return { message: `Here are our ${cn} (${catProducts.length} products, ${inStock.length} in stock):\n${top}${more}`, confidence: 1 }
          }
        }
      }

      // 2. Description keyword match: "show me Blu-ray", "show me action"
      const descMatches = products.filter((p) => {
        const desc = p.description.toLowerCase()
        const name = p.name.toLowerCase()
        return desc.includes(subLower) || name.includes(subLower)
      })
      if (descMatches.length > 0) {
        const inStock = descMatches.filter((p) => p.stock > 0)
        const top = descMatches
          .slice(0, 5)
          .map((p) => `• ${p.name} · Grade ${p.grade} · £${p.price.toFixed(2)} · ${p.stock > 0 ? `${p.stock} in stock` : 'out of stock'}`)
          .join('\n')
        const more = descMatches.length > 5 ? `\n…and ${descMatches.length - 5} more` : ''
        return { message: `Found ${descMatches.length} product${descMatches.length !== 1 ? 's' : ''} matching "${subject}" (${inStock.length} in stock):\n${top}${more}`, confidence: 0.6 }
      }
    }

    if (result.length > 0) {
      const fbSubjectLabel = searchSubject.replace(/\s+/g, ' ').slice(0, 32).trim()
      const inStock = (list: Product[]) => list.filter((p) => p.stock > 0)
      const labelFor = (n: number, label: string) => (n === 1 ? label.replace(/\s*s$/, '') : label)
      const fmtProduct = (p: Product) => {
        const desc = p.description ? ` · ${p.description}` : ''
        return `• ${p.name} · Grade ${p.grade} · £${p.price.toFixed(2)} · ${p.stock > 0 ? `${p.stock} in stock` : 'out of stock'}${desc}`
      }
      if (result.length === 1) {
        const p = result[0]
        return { message: `Yes — we have the ${p.name} · Grade ${p.grade} · £${p.price.toFixed(2)}${p.stock > 0 ? ` · ${p.stock} in stock` : ' · currently out of stock'}.`, confidence: 0.5 }
      }
      const top = result
        .slice(0, 4)
        .map((p) => `• ${p.name} · Grade ${p.grade} · £${p.price.toFixed(2)} · ${p.stock > 0 ? `${p.stock} in stock` : 'out of stock'}`)
        .join('\n')
      return { message: `Yes, we have ${result.length} matching "${fbSubjectLabel}":\n${top}${result.length > 4 ? `\n…and ${result.length - 4} more` : ''}`, confidence: 0.5 }
    }
    return { message: `We don't have anything matching "${subject}" in the catalog.`, confidence: 0.5 }
  }

  const stockIntent = /in stock|available|left\b|on hand|out of stock|currently/.test(q)

  // Clean subject for product matching: strip sort/recommend/price/grade keywords
  const cleanedMain = cleanSubjectForProducts(subject)
  const mainSearchSubject = cleanedMain.length >= 3 ? cleanedMain : subject
  const result = subjectProducts(mainSearchSubject, products, categories)
  const matched = result.products
  const inStock = (list: Product[]) => list.filter((p) => p.stock > 0)
  const labelFor = (n: number, label: string) => (n === 1 ? label.replace(/\s*s$/, '') : label)
  const subjectLabel = mainSearchSubject.replace(/\s+/g, ' ').slice(0, 32).trim()

  const fmtProduct = (p: Product) => {
    const desc = p.description ? ` · ${p.description}` : ''
    return `• ${p.name} · Grade ${p.grade} · £${p.price.toFixed(2)} · ${p.stock > 0 ? `${p.stock} in stock` : 'out of stock'}${desc}`
  }

  /**
   * When exact filters (grade + price) return 0 results, relax constraints progressively
   * to show partial matches. Returns a helpful message with alternatives.
   */
  const relaxedConstraintsMessage = (subjectLabel: string, allMatched: Product[], gradeLetter?: string, maxPrice?: number): CatalogAnswer => {
    const inStockAll = inStock(allMatched)
    const gradeOnly = gradeLetter ? inStockAll.filter((p) => p.grade.toUpperCase() === gradeLetter) : []
    const priceOnly = maxPrice !== undefined ? inStockAll.filter((p) => p.price <= maxPrice) : []

    const lines: string[] = []

    if (gradeOnly.length > 0 && priceOnly.length > 0) {
      // Both constraints exist but no overlap
      if (gradeLetter) lines.push(`We don't currently have any ${subjectLabel} that are both grade ${gradeLetter} and under £${maxPrice} in stock.`)
      // Nearest match: the grade-B option closest to budget, so we can offer the most relevant alternative
      const nearest = maxPrice !== undefined ? gradeOnly.slice().sort((a, b) => Math.abs(a.price - maxPrice!) - Math.abs(b.price - maxPrice!))[0] : gradeOnly[0]
      if (nearest) {
        const diff = nearest.price - (maxPrice ?? 0)
        if (diff > 0) {
          lines.push(`\nThe closest we have is the ${nearest.name} (grade ${nearest.grade}) at £${nearest.price.toFixed(2)} — just £${diff.toFixed(2)} over your budget.`)
        } else {
          lines.push(`\nThe best grade ${gradeLetter} ${subjectLabel} within your budget is the ${nearest.name} at £${nearest.price.toFixed(2)}.`)
        }
      }
      const cheapest = gradeOnly.length > 0 ? gradeOnly.slice().sort((a, b) => a.price - b.price)[0] : undefined
      if (cheapest && cheapest !== nearest) {
        lines.push(`If you'd like, the cheapest grade ${gradeLetter} ${subjectLabel} is the ${cheapest.name} at £${cheapest.price.toFixed(2)}.`)
      }
      const different = priceOnly.filter((p) => !gradeOnly.includes(p))
      if (different.length > 0) {
        lines.push(`\nOr for under £${maxPrice} I have these (different grades): ${different.slice(0, 3).map((p) => `${p.name} (grade ${p.grade}) at £${p.price.toFixed(2)}`).join(', ')}${different.length > 3 ? `, and ${different.length - 3} more` : ''}.`)
      }
      lines.push(`\nWould you like to know anything else?`)
    } else if (inStockAll.length > 0) {
      lines.push(`We don't currently have any ${subjectLabel}${gradeLetter ? ` grade ${gradeLetter}` : ''}${maxPrice !== undefined ? ` under £${maxPrice}` : ''} in stock, but here's what we do have:`)
      lines.push(...inStockAll.slice(0, 4).map(fmtProduct))
      if (inStockAll.length > 4) lines.push(`…and ${inStockAll.length - 4} more`)
      lines.push(`\nWould you like to know anything else?`)
    } else {
      return { message: `We don't have any ${subjectLabel}${gradeLetter ? ` grade ${gradeLetter}` : ''}${maxPrice !== undefined ? ` under £${maxPrice}` : ''} in stock right now. Would you like to know anything else?`, confidence: 1 }
    }
    return { message: lines.join('\n'), confidence: 1 }
  }

  /** Build a smart "not found" message: detect what the user was looking for and suggest alternatives. */
  const smartNotFound = (subjectLabel: string, products: Product[], categories: Category[]): CatalogAnswer => {
    // 1. Try category-based filtering: exact category name or description keyword
    const catName = new Map(categories.map((c) => [c.id, c.name]))
    const subLower = subjectLabel.toLowerCase()

    // Exact category name match
    for (const [catId, cn] of catName) {
      if (cn.toLowerCase() === subLower || cn.toLowerCase().includes(subLower) || subLower.includes(cn.toLowerCase())) {
        const catProducts = products.filter((p) => p.categoryId === catId)
        if (catProducts.length > 0) {
          const inStock = catProducts.filter((p) => p.stock > 0)
          const top = catProducts
            .slice(0, 5)
            .map((p) => `• ${p.name} · Grade ${p.grade} · £${p.price.toFixed(2)} · ${p.stock > 0 ? `${p.stock} in stock` : 'out of stock'}`)
            .join('\n')
          const more = catProducts.length > 5 ? `\n…and ${catProducts.length - 5} more` : ''
          return { message: `Here are our ${cn} (${catProducts.length} products, ${inStock.length} in stock):\n${top}${more}`, confidence: 1 }
        }
      }
    }

    // Description keyword match (e.g. "Blu-ray", "action")
    const descMatches = products.filter((p) => {
      const desc = p.description.toLowerCase()
      const name = p.name.toLowerCase()
      return desc.includes(subLower) || name.includes(subLower)
    })
    if (descMatches.length > 0) {
      const inStock = descMatches.filter((p) => p.stock > 0)
      const top = descMatches
        .slice(0, 5)
        .map((p) => `• ${p.name} · Grade ${p.grade} · £${p.price.toFixed(2)} · ${p.stock > 0 ? `${p.stock} in stock` : 'out of stock'}`)
        .join('\n')
      const more = descMatches.length > 5 ? `\n…and ${descMatches.length - 5} more` : ''
      return { message: `Found ${descMatches.length} product${descMatches.length !== 1 ? 's' : ''} matching "${subjectLabel}" (${inStock.length} in stock):\n${top}${more}`, confidence: 0.5 }
    }
    // Check if the user was searching for an actor by looking for "starring" patterns in subject
    const actorWords = subjectWords(subject).filter((w) => !WHOLE_CATALOG.has(singularize(w)))
    if (actorWords.length > 0 && /\b(movies?|films?|actors?|actress|starring|cast)\b/i.test(question)) {
      // Collect all actor names from the catalog
      const allActors: { name: string; movie: string }[] = []
      for (const p of products) {
        const names = extractActorNames(p.description)
        for (const name of names) allActors.push({ name, movie: p.name })
      }

      // Try fuzzy matching the user's query against known actors
      const subjectFull = actorWords.join(' ')
      let bestMatch: { name: string; movie: string; dist: number } | null = null
      for (const a of allActors) {
        const dist = levenshtein(subjectFull, a.name)
        if (!bestMatch || dist < bestMatch.dist) bestMatch = { ...a, dist }
      }

      if (bestMatch && bestMatch.dist <= 3) {
        return {
          message: `We don't have anything matching "${subjectLabel}" in the catalog. Did you mean ${bestMatch.name} (${bestMatch.movie})?`,
          correctedQuery: `${bestMatch.name} movies`,
          confidence: 0.7
        }
      }

      // No close match — list available actors
      const uniqueActors = [...new Set(allActors.map((a) => a.name))].sort()
      if (uniqueActors.length > 0) {
        const actorList = uniqueActors.slice(0, 8).join(', ')
        const more = uniqueActors.length > 8 ? ` and ${uniqueActors.length - 8} more` : ''
        return { message: `We don't have "${subjectLabel}" in the catalog. We do have movies with these actors: ${actorList}${more}.`, confidence: 0.5 }
      }
    }

    // Generic not found — suggest what we do have in related categories
    const related = products.filter((p) => {
      const cn = catName.get(p.categoryId) ?? ''
      return cn.toLowerCase().includes(subjectLabel.toLowerCase()) ||
        subjectLabel.toLowerCase().includes(cn.toLowerCase())
    })
    if (related.length > 0) {
      const list = related.slice(0, 4).map((p) => `• ${p.name} · £${p.price.toFixed(2)}`).join('\n')
      return { message: `We don't have "${subjectLabel}" in the catalog. Here's what we do have:\n${list}${related.length > 4 ? `\n…and ${related.length - 4} more` : ''}`, confidence: 0.5 }
    }

    return { message: `We don't have anything matching "${subjectLabel}" in the catalog.`, confidence: 0.5 }
  }

  if (countIntent) {
    if (gradeLetter) {
      const gradeFiltered = matched.filter((p) => p.grade.toUpperCase() === gradeLetter)
      const set = maxPrice !== undefined ? gradeFiltered.filter((p) => p.price <= maxPrice) : gradeFiltered
      if (set.length === 0) {
        return {
          message: maxPrice !== undefined
            ? `We don't have any ${subjectLabel} graded ${gradeLetter} under £${maxPrice}${
                matched.length > 0 ? ` (we carry ${matched.length} ${subjectLabel} in total).` : '.'
              }`
            : `We don't have any ${subjectLabel} graded ${gradeLetter}${
                matched.length > 0 ? ` (we carry ${matched.length} ${subjectLabel} in total).` : '.'
              }`,
          confidence: 1
        }
      }
      return {
        message: stockIntent
          ? `We have ${inStock(set).length} ${labelFor(set.length, subjectLabel)} graded ${gradeLetter} in stock (out of ${set.length}).`
          : `We have ${set.length} ${labelFor(set.length, subjectLabel)} graded ${gradeLetter} (${inStock(set).length} in stock).`,
        confidence: 1
      }
    }
    if (matched.length === 0) return smartNotFound(subjectLabel, products, categories)
    const catName = new Map(categories.map((c) => [c.id, c.name]))
    const byCat = new Map<string, number>()
    for (const p of matched) {
      const cn = catName.get(p.categoryId) ?? 'Other'
      byCat.set(cn, (byCat.get(cn) ?? 0) + 1)
    }
    const stockCount = inStock(matched).length
    if (byCat.size > 1) {
      const lines = [`We have ${matched.length} ${labelFor(matched.length, subjectLabel)} (${stockCount} in stock):`]
      for (const [cn, n] of byCat) lines.push(`• ${cn}: ${n}${stockIntent ? ` (${inStock(matched.filter((p) => (catName.get(p.categoryId) ?? 'Other') === cn)).length} in stock)` : ''}`)
      return { message: lines.join('\n'), confidence: 1 }
    }
    if (stockIntent) {
      return { message: `We have ${stockCount} ${labelFor(stockCount, subjectLabel)} in stock right now${matched.length !== stockCount ? ` (out of ${matched.length})` : ''}.`, confidence: 1 }
    }
    return { message: `We have ${matched.length} ${labelFor(matched.length, subjectLabel)} in the catalog (${stockCount} in stock).`, confidence: 1 }
  }

  if (matched.length === 0) return smartNotFound(subjectLabel, products, categories)

  // Sort intent — cheapest / most expensive / best value
  if (sortIntent) {
    let set = inStock(matched)
    if (gradeLetter) set = set.filter((p) => p.grade.toUpperCase() === gradeLetter)
    if (maxPrice !== undefined) set = set.filter((p) => p.price <= maxPrice)
    if (set.length === 0) return relaxedConstraintsMessage(subjectLabel, matched, gradeLetter, maxPrice)
    const ascending = /cheapest|lowest|affordable|budget|best (deal|price)|least expensive/i.test(q)
    const sorted = ascending ? [...set].sort((a, b) => a.price - b.price) : [...set].sort((a, b) => b.price - a.price)
    const top = sorted.slice(0, 5).map(fmtProduct).join('\n')
    const more = sorted.length > 5 ? `\n…and ${sorted.length - 5} more` : ''
    const label = ascending ? 'cheapest' : 'most expensive'
    return { message: `Here are the ${label} ${subjectLabel}${gradeLetter ? ` (grade ${gradeLetter})` : ''}${maxPrice !== undefined ? ` under £${maxPrice}` : ''}:\n${top}${more}`, confidence: 1 }
  }

  // Recommend / list intent — show matching products with prices
  if (recommendIntent) {
    let set = inStock(matched)
    if (gradeLetter) set = set.filter((p) => p.grade.toUpperCase() === gradeLetter)
    if (maxPrice !== undefined) set = set.filter((p) => p.price <= maxPrice)
    if (set.length === 0) return relaxedConstraintsMessage(subjectLabel, matched, gradeLetter, maxPrice)
    const sorted = [...set].sort((a, b) => a.price - b.price)
    const top = sorted.slice(0, 5).map(fmtProduct).join('\n')
    const more = sorted.length > 5 ? `\n…and ${sorted.length - 5} more options` : ''
    const constraints = []
    if (gradeLetter) constraints.push(`grade ${gradeLetter}`)
    if (maxPrice !== undefined) constraints.push(`under £${maxPrice}`)
    const intro = constraints.length > 0
      ? `Here are ${subjectLabel} matching your criteria (${constraints.join(', ')}):`
      : `Here are some ${subjectLabel} I'd recommend:`
    return { message: `${intro}\n${top}${more}`, confidence: 1 }
  }

  if (gradeLetter) {
    const gradeFiltered = matched.filter((p) => p.grade.toUpperCase() === gradeLetter)
    const set = maxPrice !== undefined ? gradeFiltered.filter((p) => p.price <= maxPrice) : gradeFiltered
    const avail = inStock(set).length
    if (avail > 0) return { message: `Yes — we have ${avail} ${subjectLabel} graded ${gradeLetter}${maxPrice !== undefined ? ` under £${maxPrice}` : ''} in stock:\n${inStock(set).slice(0, 8).map(fmtProduct).join('\n')}`, confidence: 1 }
    return {
      message: set.length > 0
        ? `We carry ${set.length} ${subjectLabel} graded ${gradeLetter}${maxPrice !== undefined ? ` under £${maxPrice}` : ''}, but they're currently out of stock.`
        : `We don't have any ${subjectLabel} graded ${gradeLetter}${maxPrice !== undefined ? ` under £${maxPrice}` : ''}.`,
      confidence: 1
    }
  }
  if (maxPrice !== undefined) {
    const set = inStock(matched).filter((p) => p.price <= maxPrice)
    if (set.length === 0) return { message: `We don't have any ${subjectLabel} under £${maxPrice} in stock right now.`, confidence: 1 }
    const top = set.slice(0, 4).map((p) => `• ${p.name} · Grade ${p.grade} · £${p.price.toFixed(2)} · ${p.stock} in stock`).join('\n')
    return { message: `We have ${set.length} ${subjectLabel} under £${maxPrice} in stock:\n${top}${set.length > 4 ? `\n…and ${set.length - 4} more` : ''}`, confidence: 1 }
  }
  if (matched.length === 1) {
    const p = matched[0]
    return { message: `Yes — we have the ${p.name} · Grade ${p.grade} · £${p.price.toFixed(2)}${p.stock > 0 ? ` · ${p.stock} in stock` : ' · currently out of stock'}.`, confidence: 0.5 }
  }
  const top = matched
    .slice(0, 4)
    .map((p) => `• ${p.name} · Grade ${p.grade} · £${p.price.toFixed(2)} · ${p.stock > 0 ? `${p.stock} in stock` : 'out of stock'}`)
    .join('\n')
  return { message: `Yes, we have ${matched.length} matching "${subjectLabel}":\n${top}${matched.length > 4 ? `\n…and ${matched.length - 4} more` : ''}`, confidence: 0.5 }
}

/**
 * Deterministically answers "compare X vs Y" / "X or Y" questions by looking up
 * two products and presenting a side-by-side comparison. Returns undefined when
 * the question isn't a comparison or fewer than two products can be matched.
 */
export function compareAnswer(question: string, products: Product[], categories: Category[]): string | undefined {
  const q = question.toLowerCase()
  const compareIntent = /\b(compare|vs\.?|versus|or\b|difference between|which (is )?better|which one)/i.test(q)
  if (!compareIntent) return undefined

  // Strip leading "compare" / "difference between" / "which is better" noise
  const cleaned = q
    .replace(/^(compare|difference between|which(?:\s+is)?\s+better)\s+/i, '')
    .replace(/^(what(?:'s| is| are)\s+(?:the\s+)?difference\s+between)\s+/i, '')

  // Split on common separators
  const parts = cleaned.split(/\s+(?:vs\.?|versus|or|and|compared to)\s+/i).map((s) => s.trim().replace(/[?.,!]+$/, ''))
  if (parts.length < 2) return undefined

  // Try to find a matching product for each part
  const found: Product[] = []
  for (const part of parts) {
    if (part.length < 2) continue
    const matches = subjectProducts(part, products, categories).products
    if (matches.length > 0) found.push(matches[0])
  }

  if (found.length < 2) return undefined
  const [a, b] = found

  const fmtProduct = (p: Product) =>
    `${p.name} · Grade ${p.grade} · £${p.price.toFixed(2)}${p.stock > 0 ? ` · ${p.stock} in stock` : ' · out of stock'}`

  const lines = [`Here's a comparison:\n`]
  lines.push(`1. ${fmtProduct(a)}`)
  lines.push(`2. ${fmtProduct(b)}`)
  lines.push('')

  if (a.price < b.price) {
    lines.push(`${a.name} is £${(b.price - a.price).toFixed(2)} cheaper.`)
  } else if (a.price > b.price) {
    lines.push(`${b.name} is £${(a.price - b.price).toFixed(2)} cheaper.`)
  } else {
    lines.push(`Both are the same price.`)
  }

  if (a.grade !== b.grade) {
    const gradeOrder = 'ABCDEF'
    const aBetter = gradeOrder.indexOf(a.grade) < gradeOrder.indexOf(b.grade)
    lines.push(`${aBetter ? a.name : b.name} has a better condition grade (${aBetter ? a.grade : b.grade} vs ${aBetter ? b.grade : a.grade}).`)
  }

  return lines.join('\n')
}

export interface CustomerPurchase {
  receiptNo: string
  date: string
  items: string
  total: number
  currency: string
}

export interface CustomerContext {
  customerId: string
  customerName: string
  phone: string
  email: string
  balance: number
  notes: string
  purchases: CustomerPurchase[]
  purchasedProducts: { name: string; qty: number }[]
  suggestions: { name: string; price: number; grade: string; reason: string }[]
  spentTotal: number
  orderCount: number
}

const NAME_STOP = new Set([
  'the', 'a', 'an', 'of', 'to', 'for', 'and', 'with', 'last', 'buy', 'bought', 'purchase',
  'purchases', 'history', 'added', 'customer', 'customers', 'recent', 'recently', 'find',
  'show', 'tell', 'me', 'my', 'their', 'her', 'his', 'what', 'which', 'is', 'are', 'did', 'do'
])

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !NAME_STOP.has(w))
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function wordIn(q: string, token: string): boolean {
  return new RegExp(`\\b${escRe(token)}\\b`).test(q)
}

const PLACEHOLDER_NAMES = /walk-?in|guest|cash customer|anonymous/i

/** Matches a saved customer by name appearing in the question. Full name wins; first-name-only also matches. */
export function findCustomerMention(question: string, customers: Customer[]): Customer | undefined {
  const q = question.toLowerCase()
  let best: Customer | undefined
  let bestScore = 0
  for (const c of customers) {
    if (PLACEHOLDER_NAMES.test(c.name)) continue
    const fullName = c.name.toLowerCase()
    let score = 0
    if (wordIn(q, fullName)) {
      score = 100 + fullName.length
    } else {
      for (const t of nameTokens(c.name)) {
        if (wordIn(q, t)) score += 1
      }
    }
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}

/** Phrases that refer to the currently attached checkout customer without naming them. */
const REFER_ATTACHED = /(^|\s)(she|her|hers|he|him|his|their|they|them|this\s+customer|that\s+customer|the\s+customer|the\s+added\s+customer|the\s+attached\s+customer|selected\s+customer|current\s+customer|attached\s+customer|added\s+customer|the\s+client|this\s+client|this\s+person|this\s+guy|this\s+shopper|the\s+shopper|the\s+buyer|the\s+user|my\s+customer|just\s+added|checkout\s+customer)\b/i

/** Purchase-history / recommendation / account-intent that can bind to the attached customer. */
const CUSTOMER_INTENT =
  /last\s+buy|buy\s+last|last\s+purchase|bought\s+last|purchase\s+history|buying\s+history|order\s+history|orders?\b|recent\s+(orders?|purchases?)|last\s+order|how\s+many\s+orders?|total\s+spent|how\s+much.*spent|spending|balance|store\s+credit|phone|email|notes?|top\s+purchases?|most\s+(bought|recent)|frequent|usually\s+buys?|favourite|favorite|recommend|suggest|what\s+do\s+(they|she|he)\s+like|what\s+did\s+(she|he|they)\s+buy|did\s+(she|he|they)\s+buy|upsell|cross.?sell|what\s+else|complement\w*|accessori[zs]e|what\s+should.*suggest|what\s+to\s+suggest|latest\s+purchases?|follow.?up|additional|interested|go\s+well|suitable|relevant|need\s+after|after\s+buy\w*|based\s+on.*purchas\w*|based\s+on.*bought|based\s+on.*buy\w*|based\s+on.*history|review\w*\s+.*purchas|their\s+latest|his\s+latest|her\s+latest|they\s+bought|she\s+bought|he\s+bought|related\s+products|complementary|next\s+order|purchased\s+most/i

/**
 * Builds a private on-device context for a customer:
 * 1. a customer named in the question, else
 * 2. the customer attached at checkout when the question refers to them ("she", "this customer"…), else
 * 3. undefined.
 */
export function buildCustomerContext(
  question: string,
  customers: Customer[],
  sales: Sale[],
  products: Product[],
  categories: Category[],
  currency: string,
  attachedCustomerId?: string
): CustomerContext | undefined {
  const named = findCustomerMention(question, customers)
  const attached = attachedCustomerId ? customers.find((c) => c.id === attachedCustomerId) : undefined

  let customer: Customer | undefined
  if (named) {
    customer = named
  } else if (attached && (REFER_ATTACHED.test(question) || CUSTOMER_INTENT.test(question))) {
    customer = attached
  } else {
    return undefined
  }

  const theirSales = sales
    .filter((s) => s.customerId === customer.id)
    .sort((a, b) => b.createdAt - a.createdAt)

  const nameByProduct = new Map(products.map((p) => [p.id, p.name]))
  const catByProduct = new Map(products.map((p) => [p.id, p.categoryId]))
  const nameByCat = new Map(categories.map((c) => [c.id, c.name]))
  for (const s of theirSales) for (const it of s.items) if (!nameByProduct.has(it.productId)) nameByProduct.set(it.productId, it.name)

  const qtyByProduct = new Map<string, number>()
  for (const s of theirSales) {
    for (const it of s.items) qtyByProduct.set(it.productId, (qtyByProduct.get(it.productId) ?? 0) + it.qty)
  }

  const purchasedProducts = [...qtyByProduct.entries()]
    .map(([productId, qty]) => ({ name: nameByProduct.get(productId) ?? 'item', qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  const catQty = new Map<string, { qty: number; topItem: string }>()
  for (const [productId, qty] of qtyByProduct) {
    const cat = catByProduct.get(productId)
    if (!cat) continue
    const cur = catQty.get(cat) ?? { qty: 0, topItem: '' }
    cur.qty += qty
    if (!cur.topItem || qty > qtyByProduct.get(productId)!) cur.topItem = nameByProduct.get(productId) ?? 'item'
    catQty.set(cat, cur)
  }
  const topCats = [...catQty.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 3)
    .map(([cat, info]) => ({ cat, ...info }))

  // Recency-aware signals: co-purchase patterns and store frequency go stale, so weight
  // orders by how recent they are and only count co-purchases within the last 90 days.
  const DAY = 86400000
  const newestSale = sales.length ? Math.max(...sales.map((s) => s.createdAt)) : Date.now()
  const recentCutoff = newestSale - 90 * DAY
  const weight = (createdAt: number) => {
    const ageDays = Math.max(0, (newestSale - createdAt) / DAY)
    return ageDays <= 30 ? 1 : ageDays <= 90 ? 0.5 : 0.15
  }

  const overallFreq = new Map<string, number>()
  for (const s of sales)
    for (const it of s.items) overallFreq.set(it.productId, (overallFreq.get(it.productId) ?? 0) + it.qty * weight(s.createdAt))

  const nameById = new Map(products.map((p) => [p.id, p.name]))
  const boughtSet = new Set(qtyByProduct.keys())

  // "New arrival" = a product added to the catalog recently that has never been sold yet.
  const newestCreated = Math.max(...products.map((p) => p.createdAt))
  const soldSet = new Set(sales.flatMap((s) => s.items.map((it) => it.productId)))
  const isNewArrival = (p: Product) => !soldSet.has(p.id) && newestCreated - p.createdAt <= 7 * DAY

  // Co-purchase counts (last 90 days): for each candidate (unbought) product, how often each of
  // the customer's past items appeared in the same order. Used for "bought together" reasons.
  const coBought = new Map<string, Map<string, number>>()
  for (const s of sales) {
    if (s.createdAt < recentCutoff) continue
    for (const it of s.items) {
      if (boughtSet.has(it.productId)) continue
      const map = coBought.get(it.productId) ?? new Map<string, number>()
      coBought.set(it.productId, map)
      for (const it2 of s.items) {
        if (it2.productId !== it.productId && boughtSet.has(it2.productId)) {
          map.set(it2.productId, (map.get(it2.productId) ?? 0) + 1)
        }
      }
    }
  }

  const candidates = products
    .filter((p) => !boughtSet.has(p.id) && p.stock > 0 && topCats.some((t) => t.cat === p.categoryId))
    .map((p) => {
      const isNew = isNewArrival(p)
      const co = [...(coBought.get(p.id) ?? new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1])[0]
      const top = topCats.find((t) => t.cat === p.categoryId)
      let reason: string
      if (isNew) {
        reason = `new arrival in ${nameByCat.get(p.categoryId) ?? 'the store'}`
      } else if (co) {
        reason = `bought together with ${nameById.get(co[0]) ?? 'their usual items'} in ${co[1]} recent order${co[1] > 1 ? 's' : ''}`
      } else if (top?.topItem) {
        reason = `same category as their frequent pick ${top.topItem}`
      } else {
        reason = `top seller in ${nameByCat.get(p.categoryId) ?? 'a range they buy'}`
      }
      if (p.stock <= p.lowStockThreshold) reason += ` · only ${p.stock} left in stock`
      const coScore = co ? co[1] * 3 : 0
      const newScore = isNew ? 6 : 0
      return { name: p.name, price: p.price, grade: p.grade, reason, score: coScore + newScore + (overallFreq.get(p.id) ?? 0) }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((c) => ({ name: c.name, price: c.price, grade: c.grade, reason: c.reason }))

  return {
    customerId: customer.id,
    customerName: customer.name,
    phone: customer.phone,
    email: customer.email,
    balance: customer.balance,
    notes: customer.notes,
    purchases: theirSales.slice(0, 5).map((s) => ({
      receiptNo: s.receiptNo,
      date: formatDateTime(s.createdAt),
      items: s.items.map((it) => `${it.name} ×${it.qty}`).join(', ') || '(no items)',
      total: s.total,
      currency
    })),
    purchasedProducts,
    suggestions: candidates,
    spentTotal: theirSales.filter((s) => s.kind === 'sale').reduce((sum, s) => sum + s.total, 0),
    orderCount: theirSales.filter((s) => s.kind === 'sale').length
  }
}

export function buildCustomerPrompt(c: CustomerContext, attached = false): string {
  const cur = c.purchases[0]?.currency ?? ''
  const lines: string[] = []
  lines.push('Customer context (private, on-device):')
  lines.push(`- Matched customer: ${c.customerName}${attached ? ' (attached at checkout)' : ''}`)
  if (c.phone) lines.push(`- Phone: ${c.phone}`)
  if (c.email) lines.push(`- Email: ${c.email}`)
  if (c.balance > 0) lines.push(`- Store credit balance: ${fmt(c.balance, cur)}`)
  if (c.notes) lines.push(`- Notes: ${c.notes}`)
  lines.push(`- Total orders: ${c.orderCount} · Total spent: ${fmt(c.spentTotal, cur)}`)
  if (c.purchases.length === 0) {
    lines.push(`- ${c.customerName} has no purchases yet.`)
  } else {
    lines.push('- Recent purchases (newest first):')
    for (const p of c.purchases) {
      lines.push(`  · ${p.receiptNo} · ${p.date} · ${p.items} · ${fmt(p.total, p.currency)}`)
    }
    lines.push(`- Their most-bought items: ${c.purchasedProducts.map((x) => x.name).join(', ') || 'n/a'}`)
  }
  if (c.suggestions.length > 0) {
    lines.push(
      `- Recommendation candidates (in stock, in categories they buy): ${c.suggestions
        .map((s) => `${s.name} · Grade ${s.grade} (${fmt(s.price, cur)} — ${s.reason})`)
        .join('; ')}`
    )
  }
  lines.push('When asked for recommendations, list each product on its own line as: "• Product · Grade X (price) — short reason". Use the reason and grade provided above verbatim; never invent a reason, grade, or product that is not listed.')
  return lines.join('\n')
}

/**
 * True when a question is aimed at the product catalog rather than store policy:
 * it names a product/category, or asks about price, grade, stock, or recommendations.
 *
 * This is the single source of truth for catalog-vs-policy routing. It is used by
 * the evidence pipeline AND the offline fallback so that product lookups (e.g.
 * "can you recommend phones under £200 grade B") are never answered from the
 * knowledge base. The catalog is the authoritative source for product questions.
 */
export function isCatalogQuestion(question: string, products: Product[], categories: Category[]): boolean {
  const q = question.toLowerCase()

  // Price / grade / stock / recommendation intent — inherently catalog questions.
  if (/\b(under |below|less than|cheaper|up to|no more than|grade|graded|in stock|out of stock|available|how much|price|budget|recommend|suggest|browse)\b|£|\$|\bpounds?\b|\bdollars?\b|\bgbp\b|\busd\b/i.test(q)) {
    return true
  }

  // Category names mentioned verbatim.
  if (categories.some((c) => c.name.toLowerCase().split(/\s+/).some((w) => w.length >= 4 && new RegExp(`\\b${w}\\b`).test(q)))) {
    return true
  }

  // A concrete product token from the catalog.
  for (const p of products) {
    for (const w of p.name.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []) {
      if (new RegExp(`\\b${w}\\b`).test(q)) return true
    }
  }

  return false
}

/**
 * True when a question is a genuine store-policy / procedure question (how the store
 * operates) rather than a product lookup. Requires an unambiguous policy keyword and
 * that the question is not actually about catalog products.
 */
export function isProceduralQuestion(question: string, products: Product[], categories: Category[]): boolean {
  if (/\b(policy|policies|warranty|procedure|how (?:do i|to) (?:return|refund|exchange))\b/i.test(question)) return true
  if (/\bhow\b/i.test(question) && /\b(checkout|exchanges?|intake|grading|grade a device)\b/i.test(question)) return true
  if (isCatalogQuestion(question, products, categories)) return false
  return /\b(how do i|how to|process|procedure|procedures|policy|policies|rules|instructions|guide|workflow|return (?:a )?(?:device|item|product|phone|laptop)|refund|exchange|trade.?in|warranty|restock|grading|intake)\b/i.test(question)
}

/**
 * Search the knowledge base for relevant chunks and return a formatted answer.
 * Returns undefined when no KB docs are available or no relevant chunks are found.
 */
export function kbAnswer(question: string, knowledgeDocs: KnowledgeDoc[]): string | undefined {
  if (!knowledgeDocs || knowledgeDocs.length === 0) return undefined
  const chunks = retrieveKnowledge(knowledgeDocs, question, 3).filter(chunk => chunk.score >= 0.5)
  if (chunks.length === 0) return undefined
  // Score threshold: skip chunks that are too weakly relevant
  if (chunks[0].score < 0.5) return undefined
  const lines: string[] = []
  for (const chunk of chunks) {
    lines.push(`**${chunk.docTitle}:**`)
    lines.push(chunk.text.trim())
    lines.push('')
  }
  return lines.join('\n').trim()
}

/**
 * Deterministic customer-answer handler.
 * Detects whether the question is about the attached/named customer and, if so,
 * returns a deterministic answer.  Returns null when the question is NOT about
 * a customer so the normal pipeline (catalog → compare → offline/LLM) continues.
 */
export function customerAnswer(
  question: string,
  s: StoreSnapshot,
  customerCtx?: CustomerContext,
  attachedName?: string
): string | null {
  const q = stripFollowUpAnnotation(question).toLowerCase().trim()
  const hasName = attachedName ? q.includes(attachedName.toLowerCase()) : false
  const hasPronounOrRef = REFER_ATTACHED.test(q)
  const hasIntent = CUSTOMER_INTENT.test(q)

  const isCustomerQ = hasIntent && (hasName || hasPronounOrRef)

  if (!isCustomerQ) return null

  if (!customerCtx) {
    if (hasPronounOrRef && !hasName) {
      return attachedName
        ? `No customer is attached right now. You can attach ${attachedName} from the Customers tab, then ask again.`
        : `No customer is attached at checkout. Open the Customers tab, tap a customer, then tap "Attach to checkout" to get started.`
    }
    return `I can look up that customer's info. Which customer? Try: "purchase history for Alice" or "recommend products for John".`
  }

  return customerOfflineAnswer(customerCtx, s, question)
}

/** Local canned answers used when the on-device model isn't loaded yet. Fully private, zero dependencies. */
export function offlineReply(question: string, s: StoreSnapshot, customerCtx?: CustomerContext, attachedName?: string, knowledgeDocs?: KnowledgeDoc[], products?: Product[], categories?: Category[]): string {
  const q = stripFollowUpAnnotation(question).toLowerCase().trim()
  const low = s.lowStock
  const lowList = low.slice(0, 5).map((l) => `• ${l.name} — ${l.stock} left`).join('\n')

  if (/^(hi|hey|hello|yo|sup|good (morning|afternoon|evening)|namaste|hola)/.test(q)) {
    return `Hey! 👋 I'm the assistant for ${s.storeName} — we buy, sell & exchange refurbished tech (grades A–F, no new items).\n\nAsk me about today's sales, low stock, available devices, customers (e.g. "what did Alice buy last?"), trade-ins, or how to use the POS.`
  }

  if (customerCtx) {
    return customerOfflineAnswer(customerCtx, s, question)
  }

  const askingCustomer = customerAnswer(question, s, undefined, attachedName)
  if (askingCustomer) return askingCustomer

  // Knowledge base first — for procedural / operational / policy questions the canned
  // keyword checks below would otherwise intercept with less-specific answers.
  // The KB is also actively consulted for ANY question with a strong FAQ-style
  // match (kbStronglyMatches), not just policy-keyword ones, so uploaded FAQ
  // documents answer even without a keyword like "policy" or "return". Product
  // lookups without a real KB overlap still route to the catalog path.
  if (
    knowledgeDocs &&
    knowledgeDocs.length > 0 &&
    products &&
    categories &&
    (isProceduralQuestion(question, products, categories) || kbStronglyMatches(question, knowledgeDocs))
  ) {
    const kbResult = kbAnswer(question, knowledgeDocs)
    if (kbResult) return kbResult
  }

  if (q.includes('refund') || q.includes('return')) {
    return `There's no one-tap refund button yet. To reverse an order:\n\n1. Find the sale in Sales → open the receipt\n2. Note the receipt # and amount\n3. Edit the customer balance (if store credit) in Customers\n\nTip: delete/re-add items on the next order to adjust stock. Want me to suggest a refund feature?`
  }

  if (q.includes('low stock') || q.includes('stock') || q.includes('inventory') || q.includes('restock')) {
    if (low.length === 0) return `Great news — nothing is low on stock right now! All ${s.productCount} products are above their alert threshold.`
    return `You have ${low.length} low-stock item${low.length > 1 ? 's' : ''}:\n\n${lowList}${low.length > 5 ? '\n…and more' : ''}\n\nOpen Inventory → Restock to add units in one tap.`
  }

  if (q.includes('today') && (q.includes('sale') || q.includes('revenue') || q.includes('earning') || q.includes('how'))) {
    return `Today so far for ${s.storeName}:\n\n• Revenue: ${fmt(s.todayRevenue, s.currency)}\n• Orders: ${s.todaySalesCount}\n• Avg order: ${s.todaySalesCount ? fmt(s.todayRevenue / s.todaySalesCount, s.currency) : fmt(0, s.currency)}\n• All-time: ${fmt(s.totalRevenue, s.currency)} across ${s.totalSalesCount} sales${s.topProduct ? `\n• Best seller: ${s.topProduct}` : ''}`
  }

  if (q.includes('credit') || q.includes('balance') || q.includes('owe')) {
    return `Store credit works like a tab:\n\n• Pick a customer at checkout\n• Choose “Store Credit” as payment\n• The total is added to their balance and shown on their profile\n• Outstanding right now: ${fmt(s.creditOutstanding, s.currency)} across ${s.customerCount} customers`
  }

  if (q.includes('customer')) {
    return `You have ${s.customerCount} customers saved. You can add/edit them in Customers, and attach one to an order in the POS to track their spend. ${s.creditOutstanding > 0 ? `\n\n⚠️ ${fmt(s.creditOutstanding, s.currency)} is outstanding in store credit.` : ''}`
  }

  if (q.includes('product') || q.includes('catalog') || q.includes('add product') || q.includes('sku') || q.includes('grade')) {
    return `The catalog has ${s.productCount} refurbished devices, each graded A–F (A = like new … F = for parts). In Products you can add/edit/delete items, set the condition grade, price & cost, stock thresholds, categories, and images. Duplicate SKUs are blocked automatically.`
  }

  if (q.includes('print') || q.includes('receipt')) {
    return `Every checkout shows a receipt. In the POS: checkout → the receipt modal → “Print receipt”. You can also re-open any past receipt from Sales → click a row → Print.`
  }

  if (q.includes('tax')) {
    return `Tax is ${s.taxRate}%, applied to the discounted subtotal at checkout. Change it anytime in Settings → Store information.`
  }

  if (q.includes('trade') || q.includes('exchange') || q.includes('buy back') || q.includes('buyback') || q.includes('sell') || (q.includes('buy') && (q.includes('device') || q.includes('item') || q.includes('phone') || q.includes('laptop')))) {
    return `We buy, sell & exchange refurbished devices — no new items. Every device is graded A–F on intake (A = like new … F = for parts) before it can be listed. Exchange/trade-in value is applied as store credit: attach the customer at checkout and choose Store Credit as the payment method. All sales include a 12-month warranty and 30-day returns.`
  }

  if (/cheapest|most expensive|best value|lowest price|highest price|affordable|budget/i.test(q)) {
    return `I can help you sort products by price! Try being specific, e.g. "cheapest phones", "most expensive laptops grade A", or "best value tablets under £200". Load the in-browser model in Settings for full AI-powered answers.`
  }

  if (/\bcompare\b|vs\.?|versus|difference between|which (is )?better/i.test(q)) {
    return `I can compare products for you! Try naming two specific products, e.g. "compare iPhone 13 vs Samsung Galaxy S23" or "iPhone 14 or iPhone 15". Load the in-browser model in Settings for full AI-powered answers.`
  }

  if (q.includes('movie') || q.includes('film') || q.includes('actor') || q.includes('actress') || q.includes('starring') || q.includes('blu-ray') || q.includes('media')) {
    return `We have a Media/Movies section with Blu-ray and 4K UHD titles! Our catalog includes films with actors like Tom Holland, Robert Pattinson, Cillian Murphy, Keanu Reeves, Margot Robbie, and more.\n\nTry:\n• "do we have Tom Holland movies?"\n• "which Robert Pattinson films do we have?"\n• "show me action movies"\n• "cheapest movies"\n\nLoad the in-browser model in Settings for full AI-powered answers.`
  }

  if (q.includes('checkout') || q.includes('pay') || q.includes('payment')) {
    return `At checkout you can pay by Cash, Card, UPI, or Store Credit (needs a customer attached). Add a discount at the top of the cart panel, then press the green button or hit Enter.`
  }

  if (q.includes('help') || q.includes('how do i') || q.includes('how to') || q.includes('what can')) {
    return `I can help you with:\n\n• Today's sales & revenue\n• Low stock / inventory\n• Customers & store credit\n• Products & catalog\n• Movies & media (actor search, titles)\n• Printing receipts\n• Tax & checkout settings\n\nTry one of those, e.g. "Which products are low on stock?" or "Do we have any Tom Holland movies?"`
  }

  if (q.includes('thank')) return `You're welcome! 🎉 Anything else I can help you with?`

  // Knowledge base fallback — search KB for any unmatched question
  if (knowledgeDocs && knowledgeDocs.length > 0) {
    const kbResult = kbAnswer(question, knowledgeDocs)
    if (kbResult) return kbResult
  }

  return `I'm not sure about that one. Try asking about sales, low stock, products, customers, receipts, or how to checkout. (Tip: load the in-browser model in Settings to unlock full answers.)`
}

function customerOfflineAnswer(c: CustomerContext, s: StoreSnapshot, question: string): string {
  const cur = c.purchases[0]?.currency ?? s.currency
  const q = question.toLowerCase()

  if (c.purchases.length === 0) {
    return `${c.customerName} is saved in your customers but hasn't checked out any orders yet. Attach them to a sale in the POS, then I can track their purchase history.`
  }

  // Balance / store credit
  if (/\b(balance|credit|owed|owe|outstanding)\b/.test(q)) {
    if (c.balance > 0) return `${c.customerName} has ${fmt(c.balance, cur)} in store credit outstanding.`
    return `${c.customerName} has no store credit balance outstanding.`
  }

  // Contact info
  if (/\b(phone|email|contact|number|address)\b/.test(q)) {
    const parts: string[] = []
    if (c.phone) parts.push(`Phone: ${c.phone}`)
    if (c.email) parts.push(`Email: ${c.email}`)
    if (!c.phone && !c.email) return `${c.customerName} has no contact details on file.`
    return `${c.customerName}'s contact details:\n• ${parts.join('\n• ')}`
  }

  // Total spent / spending
  if (/\b(total|spent|spending|how much|lifetime|all time)\b/.test(q)) {
    return `${c.customerName} has placed ${c.orderCount} order${c.orderCount !== 1 ? 's' : ''} totalling ${fmt(c.spentTotal, cur)}. Their most-bought items: ${c.purchasedProducts.slice(0, 3).map((x) => x.name).join(', ')}.`
  }

  // How many orders / visits
  if (/\b(how many|number of|count|total|visits?)\b/.test(q)) {
    return `${c.customerName} has placed ${c.orderCount} order${c.orderCount !== 1 ? 's' : ''} in total, spending ${fmt(c.spentTotal, cur)}.`
  }

  // Top purchases / most bought / frequent
  if (/\b(top|most bought|frequent|usual|favourite|favorite|liked|prefer)\b/.test(q)) {
    const items = c.purchasedProducts.slice(0, 5).map((x) => `• ${x.name} (×${x.qty})`).join('\n')
    return `${c.customerName}'s most-bought items:\n${items}\n\nThey tend to buy from categories they return to frequently.`
  }

  // Upsell / cross-sell / what else / recommendations
  if (/\b(recommend|suggest|upsell|cross.?sell|what else|complement|accessori|what should)\b/.test(q)) {
    if (c.suggestions.length === 0) return `No upsell candidates found for ${c.customerName} right now.`
    const recs = c.suggestions.slice(0, 3).map((sg) => `• ${sg.name} · Grade ${sg.grade} (${fmt(sg.price, cur)}) — ${sg.reason}`).join('\n')
    return `Based on ${c.customerName}'s purchase history, they may like:\n${recs}`
  }

  // Last order / purchase history / recent orders
  const last = c.purchases[0]
  const lines: string[] = []
  lines.push(`Last purchase of ${c.customerName}:`)
  lines.push(`• ${last.receiptNo} on ${last.date}`)
  lines.push(`• ${last.items}`)
  lines.push(`• Total: ${fmt(last.total, cur)}`)
  if (c.purchases.length > 1) {
    lines.push(`\n${c.purchases.length} orders in total · ${fmt(c.spentTotal, cur)} spent`)
  }
  if (c.suggestions.length > 0) {
    lines.push(`\nBased on their history, they may also like:`)
    for (const sg of c.suggestions.slice(0, 3)) {
      lines.push(`• ${sg.name} · Grade ${sg.grade} (${fmt(sg.price, cur)}) — ${sg.reason}`)
    }
  }
  return lines.join('\n')
}

export function inventoryProducts(subject: string, products: Product[], categories: Category[]): Product[] {
  const clean = cleanSubjectForProducts(subject)
  const sku = products.find(p => p.sku.toLowerCase() === subject.trim().toLowerCase())
  let matches = sku ? [sku] : subjectProducts(clean, products, categories).products
  const grade = subject.match(/grade[sd]?\s+([a-f])\b/i)?.[1]
  const budget = subject.match(/(?:under|below|less than|up to)\s*[£$€]?\s*(\d+(?:\.\d+)?)/i)?.[1]
  if (grade) matches = matches.filter(p => p.grade.toLowerCase() === grade.toLowerCase())
  if (budget) matches = matches.filter(p => p.price <= Number(budget))
  return matches
}

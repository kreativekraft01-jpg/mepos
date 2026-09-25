/**
 * Randomized property-based tests for the deterministic AI answer path.
 *
 * Generates thousands of natural-language queries, computes the *correct*
 * expected answer directly from the seed DB (ground truth), then checks
 * that catalogAnswer's output (and the pipeline routing decision) is
 * consistent with it — i.e. every product named in the answer actually
 * satisfies the query's filters, and no filter is ignored.
 *
 * Run with: npx esbuild src/utils/test-random.ts --bundle --platform=node
 *           --format=esm --outfile=/tmp/random.mjs && node /tmp/random.mjs
 */
import { catalogAnswer, retrieveProducts } from './ai'
import { decideAnswer, retrieveEvidence } from './pipeline'
import { seedProducts, seedCategories, seedCustomers } from '../store/seed'

const catName = new Map(seedCategories.map((c) => [c.id, c.name]))

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const rand = (n: number) => Math.floor(Math.random() * n)
const pick = <T,>(arr: T[]): T => arr[rand(arr.length)]
const chance = (p: number) => Math.random() < p

/** Products grouped by category name (lowercased). */
const byCategory = (() => {
  const m = new Map<string, typeof seedProducts>()
  for (const p of seedProducts) {
    const cn = (catName.get(p.categoryId) ?? '').toLowerCase()
    if (!m.has(cn)) m.set(cn, [])
    m.get(cn)!.push(p)
  }
  return m
})()

/** Category label words users use, e.g. "phones" -> smartphones, "beverages" -> coffee. */
const CATEGORY_PHRASES: Record<string, string[]> = {
  smartphones: ['phones', 'smartphones'],
  'laptops & tablets': ['laptops', 'laptops & tablets', 'tablets', 'computers'],
  'audio & headphones': ['headphones', 'audio', 'earphones', 'earbuds'],
  wearables: ['wearables', 'watches', 'smartwatches'],
  gaming: ['gaming', 'games', 'consoles'],
  'cameras & drones': ['cameras', 'drones'],
  'media/movies': ['movies', 'films', 'blu-ray', 'discs'],
}

function subjectPhraseFor(categoryId: string): string {
  const cat = seedCategories.find((c) => c.id === categoryId)
  const phrases = CATEGORY_PHRASES[cat?.name.toLowerCase() ?? '']
  return phrases ? pick(phrases) : (cat?.name ?? 'products')
}

const BUDGET_WORDS = ['under', 'below', 'less than', 'up to', 'no more than']
const MONEY_SUFFIX = ['', '£', '$', 'gbp', 'pounds', 'GBP', 'pound']
const GRADE_WORDS = ['grade', 'graded', '']

/** e.g. "400" or "£400" or "400 pounds" or "under 400" etc */
function priceToken(price: number, style: 'bare' | 'symbol' | 'word' | 'symbolWord'): string {
  const n = Math.round(price * 100) / 100
  switch (style) {
    case 'bare': return String(n)
    case 'symbol': return `£${n}`
    case 'word': return `${n} pounds`
    case 'symbolWord': return `${n} GBP`
  }
}

/* ── Query builders ───────────────────────────────────────────────────────── */

interface GenQuery {
  q: string
  /** Category the query is about (or null if whole-catalog/generic). */
  categoryId: string | null
  grade?: string
  maxPrice?: number
  intent: 'avail' | 'recommend' | 'sort' | 'count' | 'category' | 'generic'
}

const LEAD_PHRASES = {
  avail: ['do we have', 'do you have', 'we got any', 'are there', 'is there', 'you got', 'we have', 'do we carry', 'have we got'],
  recommend: ['recommend me', 'can you recommend', 'suggest some', 'what are good', 'give me', 'show me some', 'what do you suggest', 'any recommendations for'],
  sort: ['which is the cheapest', 'what is the cheapest', 'cheapest', 'which are the most expensive', 'most expensive', 'best value', 'cheapest options for'],
  count: ['how many', 'how many', 'what is the count of', 'how many'],
  category: ['show me', 'list', 'what categories', 'browse', 'what do we sell in'],
  generic: ['', 'do we have any', 'we have', 'tell me about'],
}

const TAIL_PHRASES = {
  avail: ['available?', 'in stock?', 'right now?', 'in stock right now?', 'available right now?', ''],
  recommend: ['', 'options', 'that are good', '?'],
  sort: ['', '?'],
  count: ['?', ' are there?', ' do we have?', ' in stock?'],
  category: ['', 'available', '?'],
  generic: ['', '?'],
}

let marginCount = 0

function buildQuery(): GenQuery {
  const style = rand(4) //
  const intent = pick([
    'avail', 'avail', 'avail',       // availability most common
    'recommend', 'recommend',
    'sort', 'sort',
    'count', 'count',
    'category',
    'generic'
  ]) as GenQuery['intent']

  // 60% a specific category, 40% the whole catalog
  const category = chance(0.6)
    ? pick([...seedCategories])
    : null

  const maxPrice = category && chance(0.45)
    ? Math.round((rand(9) + 1) * 60 + pick([0, 20, 45, 80]))
    : undefined
  const grade = category && chance(0.35)
    ? pick(['A', 'B', 'C', 'D', 'F'])
    : undefined

  const lead = pick(LEAD_PHRASES[intent])
  let subject: string
  if (category) {
    subject = subjectPhraseFor(category.id)
  } else {
    // whole-catalog noun
    subject = pick(['phones', 'laptops', 'headphones', 'movies', 'gaming', 'wearables', 'products', 'tech', 'electronics', 'everything'])
  }

  // Build constraints phrase
  const constraints: string[] = []
  const priceStyles = ['bare', 'symbol', 'word', 'symbolWord'] as const
  const pStyle = priceStyles[style]
  if (grade && maxPrice !== undefined) {
    constraints.push(`${chance(0.5) ? 'grade ' : 'graded '}${grade} under ${priceToken(maxPrice, pStyle)}`)
  } else if (grade) {
    constraints.push(`${GRADE_WORDS[rand(GRADE_WORDS.length)]} ${grade}`.trim())
  } else if (maxPrice !== undefined) {
    const bw = BUDGET_WORDS[rand(BUDGET_WORDS.length)]
    constraints.push(`${bw} ${priceToken(maxPrice, pStyle)}`)
  }

  const tail = pick(TAIL_PHRASES[intent])
  const constraintStr = constraints.length > 0 ? ` ${constraints.join(' and ')}` : ''
  const q = `${lead} ${subject}${constraintStr} ${tail}`.replace(/\s+/g, ' ').trim()
  return { q, categoryId: category?.id ?? null, grade, maxPrice, intent }
}

/* ── Ground truth — the products that SHOULD be in the answer ─────────────── */

function expectedMatches(g: GenQuery): typeof seedProducts {
  let set = seedProducts
  if (g.categoryId) {
    set = set.filter((p) => p.categoryId === g.categoryId)
  } else {
    // whole-catalog — match any product whose category label is plausible,
    // or use subjectWords. For whole-catalog questions, any product is valid.
  }
  if (g.grade) set = set.filter((p) => p.grade.toUpperCase() === g.grade)
  if (g.maxPrice !== undefined) set = set.filter((p) => p.price <= g.maxPrice)
  return set
}

/* ── Validators ───────────────────────────────────────────────────────────── */

/**
 * Extract all `• Name · …` product names a catalog answer lists, and all
 * prices in £ form. This detects hallucinated/irrelevant products and
 * swallowed filters.
 */
function analyzeAnswer(g: GenQuery, answer: string) {
  const bullets = [...answer.matchAll(/•\s*([^\n·]+)/g)].map((m) => m[1].trim())
  const prices = [...answer.matchAll(/£(\d+\.?\d*)/g)].map((m) => parseFloat(m[1]))

  const problems: string[] = []

  // 1. If a maxPrice is given, every listed £ price must be ≤ maxPrice.
  if (g.maxPrice !== undefined && prices.length > 0) {
    const over = prices.filter((p) => p > g.maxPrice + 0.001)
    if (over.length > 0) problems.push(`listed price £${over.join(', £')} exceeds under-${g.maxPrice} filter`)
  }

  // 2. If a grade is given and answer lists product names, every named product
  //    that exists in the DB must have that grade.  (skip names we can't match)
  if (g.grade && bullets.length > 0) {
    const bad = bullets.filter((b) => {
      const prod = seedProducts.find((p) => p.name.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(p.name.toLowerCase().split('·')[0].trim().toLowerCase()))
      return prod ? prod.grade.toUpperCase() !== g.grade : false
    })
    if (bad.length > 0) problems.push(`grade ${g.grade} filter violated by: ${bad.join('; ')}`)
  }

  // 3. A hard "don't have / no matching / nothing" answer must be consistent:
  //    if ground truth has ≥1 in-stock match it should NOT be a pure negative.
  const truth = expectedMatches(g)
  const truthInStock = truth.filter((p) => p.stock > 0)
  const isPureNegative = /don't have|no matching|not .* in stock|nothing matching|out of stock right now/.test(answer)
  if (isPureNegative && truthInStock.length > 0) {
    problems.push(`said "not found" but ${truthInStock.length} matching product(s) exist`)
  }

  return { problems, bullets, truth: truth.length, truthInStock: truthInStock.length }
}

/* ── Pipeline routing checks ──────────────────────────────────────────────── */

function checkRouting(g: GenQuery, answer: string | null) {
  const problems: string[] = []
  // A clear availability/count question about a named category should be
  // deterministic (confident). We can't call the LLM, so we just assert that
  // structured intents produced a deterministic answer.
  if ((g.intent === 'avail' || g.intent === 'count' || g.intent === 'sort') && g.categoryId && !answer) {
    problems.push('structured intent yielded NO deterministic answer (would fall to LLM/offline)')
  }
  return problems
}

/* ── Main loop ────────────────────────────────────────────────────────────── */

const N = Number(process.env.N || 2000)
let failures = 0
let total = 0
const seen: string[] = []

for (let i = 0; i < N; i++) {
  const g = buildQuery()
  total++

  const cat = catalogAnswer(g.q, seedProducts, seedCategories)
  const answer = cat?.message ?? ''
  const { problems } = analyzeAnswer(g, answer)

  const evidence = retrieveEvidence(g.q, {
    products: seedProducts, categories: seedCategories,
    customers: seedCustomers, sales: [], currency: 'GBP',
    knowledge: [], kbEnabled: false, skills: [], skillsEnabled: false,
    snapshot: {},
  })
  const decision = decideAnswer(evidence)
  const routeProblems = checkRouting(g, decision.answer)

  const allProblems = [...problems, ...routeProblems]
  if (allProblems.length > 0) {
    failures++
    seen.push(
      `Q: "${g.q}"\n` +
      `   intent=${g.intent} cat=${g.categoryId ?? 'whole'} grade=${g.grade ?? '-'} maxPrice=${g.maxPrice ?? '-'}\n` +
      `   answer: ${answer.slice(0, 200)}\n` +
      `   problems:\n${allProblems.map((p) => `     - ${p}`).join('\n')}`
    )
    if (seen.length <= 30) console.log(seen[seen.length - 1] + '\n')
  }
}

console.log(`\n=== ${total} queries | ${failures} with issues ===`)
if (failures > 0) console.log('First issues:\n' + seen.slice(0, 30).join('\n\n'))
process.exit(failures > 0 ? 1 : 0)

// quick inline debug demo (temporary)
console.error('style range', (()=>{const t:(typeof import('./ai')['catalogAnswer'])|null=null;return 'ok'})())

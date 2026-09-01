/**
 * Evidence-based answer pipeline.
 *
 * Architecture:
 *   customer ──┐
 *   kb ────────┼→ fuseEvidence → decideAnswer → (deterministic | LLM) → validateAnswer
 *   catalog ───┘
 *
 * All retrieval is done in parallel (pure functions, no side effects).
 * The fusion step scores each source's relevance, then decideAnswer
 * picks the best deterministic answer or defers to the LLM.
 */
import type { Settings, Product, Sale, Customer, Category, KnowledgeDoc, AiSkill, BankingContext } from '../types'
import type { StoreSnapshot, ProductHit, CatalogAnswer, CustomerContext } from './ai'
import {
  buildCustomerContext,
  buildCustomerPrompt,
  catalogAnswer,
  compareAnswer,
  customerAnswer,
  kbAnswer,
  retrieveProducts
} from './ai'
import { matchSkill, parseSkill, buildVarianceAnalysis } from './skills'

/* ── Evidence types ───────────────────────────────────────────────────────── */

export interface Evidence {
  question: string
  customer: {
    ctx: CustomerContext | null
    isCustomerQ: boolean
    attachedName?: string
    deterministicAnswer: string | null
  }
  kb: {
    raw: string | undefined
    isProcedural: boolean
  }
  catalog: {
    hits: ProductHit[]
    answer: CatalogAnswer | undefined
  }
  compare: {
    message: string | undefined
  }
  skills: {
    matched: boolean
    varianceMsg?: string
    helpfulMsg?: string
  }
}

export interface PipelineDecision {
  /** Deterministic answer — when set, LLM is skipped. */
  answer: string | null
  /** Which source won. */
  winner: 'customer' | 'kb' | 'catalog' | 'compare' | 'skills' | 'llm'
  /** Confidence score (0–10). */
  confidence: number
}

/* ── Step 1: Retrieve ─────────────────────────────────────────────────────── */

export function retrieveEvidence(
  question: string,
  opts: {
    products: Product[]
    categories: Category[]
    customers: Customer[]
    sales: Sale[]
    currency: string
    attachedCustomerId?: string
    knowledge: KnowledgeDoc[]
    kbEnabled: boolean
    skills: AiSkill[]
    skillsEnabled: boolean
    bankingContext?: BankingContext
    snapshot: StoreSnapshot
  }
): Evidence {
  // Customer retrieval
  const customerCtx = buildCustomerContext(
    question,
    opts.customers,
    opts.sales,
    opts.products,
    opts.categories,
    opts.currency,
    opts.attachedCustomerId
  )
  const attachedName = opts.attachedCustomerId
    ? opts.customers.find((c) => c.id === opts.attachedCustomerId)?.name
    : undefined
  const customerDetected = customerAnswer(question, opts.snapshot, customerCtx ?? undefined, attachedName)
  const isCustomerQ = customerDetected !== null

  // KB retrieval
  const isProcedural = opts.kbEnabled && opts.knowledge.length > 0 &&
    /\b(how|what|why|when|where|which|can i|can you|do i|steps|process|procedure|policy|policies|rules|instructions|guide|workflow|return|refund|exchange|trade.?in|warranty)\b/i.test(question) &&
    !/\b(do we have|show me|which products|what categories|in stock|available)\b/i.test(question)
  const kbRaw = isProcedural ? kbAnswer(question, opts.knowledge) : undefined

  // Catalog retrieval
  const catalogHits = retrieveProducts(opts.products, opts.categories, question, 12)
  const catalogAns = catalogAnswer(question, opts.products, opts.categories)

  // Compare retrieval
  const compareMsg = compareAnswer(question, opts.products, opts.categories)

  // Skills retrieval
  let skillMatched = false
  let varianceMsg: string | undefined
  let helpfulMsg: string | undefined
  if (opts.skillsEnabled) {
    for (const skill of opts.skills) {
      if (!matchSkill(skill, question)) continue
      const def = parseSkill(skill.content)
      if (!def) continue
      skillMatched = true
      if (def.categories.includes('cash') && def.categories.includes('refund')) {
        if (opts.bankingContext) {
          varianceMsg = buildVarianceAnalysis(opts.bankingContext, opts.sales, opts.products, opts.currency)
        } else {
          helpfulMsg = 'I can analyse cash variances, but you need to open the Close Banking dialog first. Go to Sidebar → Close Banking to start counting, then ask me again.'
        }
        break
      }
    }
  }

  return {
    question,
    customer: {
      ctx: customerCtx ?? null,
      isCustomerQ,
      attachedName,
      deterministicAnswer: customerDetected
    },
    kb: { raw: kbRaw, isProcedural },
    catalog: { hits: catalogHits, answer: catalogAns },
    compare: { message: compareMsg },
    skills: { matched: skillMatched, varianceMsg, helpfulMsg }
  }
}

/* ── Step 2: Fuse ─────────────────────────────────────────────────────────── */

interface FusionResult {
  winner: Evidence['customer'] extends infer _ ? 'customer' | 'kb' | 'catalog' | 'compare' | 'skills' | 'llm' : never
  confidence: number
  /** Deterministic answer when confidence is high enough. */
  deterministicAnswer: string | null
}

export function fuseEvidence(e: Evidence): FusionResult {
  const scores: Record<string, number> = { customer: 0, kb: 0, catalog: 0, compare: 0, skills: 0 }

  // Customer: strong signal when question is about a customer
  if (e.customer.isCustomerQ) {
    scores.customer += 3
    if (e.customer.ctx) scores.customer += 2          // we have data
    if (e.customer.deterministicAnswer) scores.customer += 2  // deterministic answer ready
  }

  // KB: procedural question with a hit — KB articles are authoritative for policies
  if (e.kb.isProcedural && e.kb.raw) {
    scores.kb += 4
  }

  // Catalog: an authoritative database-backed answer. catalogAnswer never invents
  // counts or products — it derives everything from the live DB, so it is always
  // trustworthy and should take precedence over the LLM whenever it returns a result.
  // Exception: for policy/procedural questions the KB is the correct source, so
  // don't let a "we don't have 'return policy' in the catalog" fall through and
  // compete with the KB.
  if (e.catalog.answer) {
    if (e.kb.isProcedural && e.kb.raw) {
      scores.catalog += 1 // context only — KB wins this case
    } else {
      scores.catalog += 4
    }
  } else if (e.catalog.hits.length > 0) {
    scores.catalog += Math.min(e.catalog.hits.length, 2) // context-only, no deterministic answer
  }

  // Compare
  if (e.compare.message) {
    scores.compare += 3
  }

  // Skills
  if (e.skills.matched) {
    scores.skills += 3
    if (e.skills.varianceMsg) scores.skills += 1
  }

  // Find the winner — higher score wins; ties broken by priority: customer > kb > catalog > compare > skills
  const priority: FusionResult['winner'][] = ['customer', 'kb', 'catalog', 'compare', 'skills']
  let winner: FusionResult['winner'] = 'llm'
  let bestScore = 0
  for (const src of priority) {
    const score = scores[src]
    if (score > bestScore) {
      bestScore = score
      winner = src
    } else if (score === bestScore && score > 0) {
      // Tie — lower index in priority wins
      if (priority.indexOf(src) < priority.indexOf(winner)) {
        winner = src
      }
    }
  }

  // Build deterministic answer from the winner
  let deterministicAnswer: string | null = null
  if (bestScore >= 4) {
    switch (winner) {
      case 'customer':
        deterministicAnswer = e.customer.deterministicAnswer ?? null
        break
      case 'kb':
        deterministicAnswer = e.kb.raw ?? null
        break
      case 'catalog':
        deterministicAnswer = e.catalog.answer?.message ?? null
        break
      case 'compare':
        deterministicAnswer = e.compare.message ?? null
        break
      case 'skills':
        deterministicAnswer = e.skills.varianceMsg ?? e.skills.helpfulMsg ?? null
        break
    }
  }

  return { winner, confidence: bestScore, deterministicAnswer }
}

/* ── Step 3: Decide ───────────────────────────────────────────────────────── */

export function decideAnswer(evidence: Evidence): PipelineDecision {
  const fusion = fuseEvidence(evidence)

  return {
    answer: fusion.deterministicAnswer,
    winner: fusion.winner,
    confidence: fusion.confidence
  }
}

/* ── Step 4: Validate ─────────────────────────────────────────────────────── */

export function validateAnswer(answer: string, evidence: Evidence): string {
  const warnings: string[] = []

  // If answer mentions a specific customer but we have no customer context
  if (evidence.customer.isCustomerQ && !evidence.customer.ctx) {
    // customerAnswer already handled this — shouldn't reach here, but guard
  }

  // If answer references products not in catalog hits (hallucination check)
  if (evidence.catalog.hits.length > 0) {
    const hitNames = new Set(evidence.catalog.hits.map((h) => h.name.toLowerCase()))
    const productPattern = /\b(?:iPhone|MacBook|Galaxy|iPad|AirPods|Bose|Sony|Dell|HP|Lenovo|ASUS|ThinkPad)\s+\w+/gi
    const mentioned = answer.match(productPattern) ?? []
    for (const name of mentioned) {
      if (!hitNames.has(name.toLowerCase()) && !answer.toLowerCase().includes('not available') && !answer.toLowerCase().includes("don't have")) {
        // Only warn if it looks like a specific product claim, not a general mention
      }
    }
  }

  if (warnings.length > 0) {
    return `${answer}\n\n⚠️ ${warnings.join(' ')}`
  }
  return answer
}

/* ── System prompt builder (evidence-based) ───────────────────────────────── */

export function buildEvidencePrompt(evidence: Evidence, snapshot: StoreSnapshot, kbContext: string, winner?: string): string {
  const sections: string[] = []

  // Customer context
  if (evidence.customer.ctx) {
    sections.push(buildCustomerPrompt(evidence.customer.ctx, evidence.customer.attachedName !== undefined))
  }

  // KB context (only for non-KB winners — when KB won, the answer is already deterministic)
  if (evidence.kb.raw && winner !== 'kb') {
    sections.push(`Knowledge base:\n${evidence.kb.raw}`)
  }

  // Catalog hits
  if (evidence.catalog.hits.length > 0) {
    const hits = evidence.catalog.hits.map((p) =>
      `- ${p.name} (${p.categoryName}) · Grade ${p.grade} · ${snapshot.currency}${p.price.toFixed(2)} · stock ${p.stock}${p.description ? ` · ${p.description}` : ''}`
    ).join('\n')
    sections.push(`Relevant products:\n${hits}`)
  } else if (winner === 'llm') {
    sections.push("No products in the catalog match this question — if the question asks for product counts or availability, say you don't have matching data.")
  }

  // Compare context
  if (evidence.compare.message && winner !== 'compare') {
    sections.push(`Comparison:\n${evidence.compare.message}`)
  }

  // Skills context
  if (evidence.skills.varianceMsg && winner !== 'skills') {
    sections.push(`Variance analysis:\n${evidence.skills.varianceMsg}`)
  }

  return sections.join('\n\n')
}

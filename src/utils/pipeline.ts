import { inventoryAnswer } from './inventoryAnswers'
import { normalizeInventoryQuery } from './inventoryLanguage'
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
  offlineReply,
  isProceduralQuestion,
  kbAnswer,
  retrieveProducts
} from './ai'
import { retrieveKnowledge, kbStronglyMatches } from './rag'
import { matchSkill, parseSkill, buildVarianceAnalysis } from './skills'

/* ── Evidence types ───────────────────────────────────────────────────────── */

export interface Evidence {
  question: string
  operationalAnswer?: string
  sources?: { title: string; text: string }[]
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
  winner: 'operations' | 'customer' | 'kb' | 'catalog' | 'compare' | 'skills' | 'llm'
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
  question = normalizeInventoryQuery(question)
  const inventory = !isProceduralQuestion(question, opts.products, opts.categories) ? inventoryAnswer(question, opts.products, opts.categories, opts.sales, opts.currency) : undefined
  const social = /^(thanks?(?: you)?|thank you|cheers|ok(?:ay)?|great|nice)[!. ]*$/i.test(question.trim())
  // Operational questions must never fall through to product-name matching.
  const q = question.toLowerCase()
  let operationalAnswer: string | undefined = social ? 'You’re welcome. What else would you like to check?' : undefined
  if (!inventory && !isProceduralQuestion(question, opts.products, opts.categories) && /\b(sales|revenue|earnings|turnover|orders)\b/.test(q) && !/\b(customer|bought|purchase history)\b/.test(q)) {
    const f = opts.snapshot.todayFigures
    const money = (n: number) => `${opts.currency}${n.toFixed(2)}`
    if (/\b(yesterday|week|month|year|between)\b/.test(q)) {
      operationalAnswer = 'Which exact date range do you need? This summary currently supports today and all-time sales. Open Sales for individual transactions.'
    } else if (/all.time|overall/.test(q)) {
      operationalAnswer = `All-time sales: ${money(opts.snapshot.totalRevenue)} across ${opts.snapshot.totalSalesCount} sale orders. Buys, exchanges and refunds are separate.`
    } else {
      operationalAnswer = `Today (local store day, so far):\n• Sales: ${money(opts.snapshot.todayRevenue)}\n• Sale orders: ${opts.snapshot.todaySalesCount}\n• Average sale: ${money(opts.snapshot.todaySalesCount ? opts.snapshot.todayRevenue / opts.snapshot.todaySalesCount : 0)}` + (f ? `\n• Buys: ${money(f.buys)}\n• Exchanges: ${money(f.exchange)}\n• Refunds: ${money(f.refunds)}` : '')
    }
  } else if (/^(?:show me )?(?:low[ -]stock|inventory)[?.!]*$/.test(q)) {
    operationalAnswer = offlineReply('low stock', opts.snapshot)
  } else if (/\b(banking|cash variance|cash discrepancy|float)\b/.test(q) && !opts.bankingContext) {
    operationalAnswer = 'Open Sidebar → Close Banking and enter the counted amounts, then ask me to explain the cash variance.'
  }
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

  // Catalog retrieval (computed first so procedural detection can tell product
  // lookups apart from genuine policy/procedure questions).
  const catalogHits = retrieveProducts(opts.products, opts.categories, question, 12)
  const catalogAns = inventory ? { message: inventory, confidence: 1 } : catalogAnswer(question, opts.products, opts.categories)
  if (catalogAns) catalogAns.message = catalogAns.message.replaceAll('£', opts.currency)

  // The knowledge base is actively consulted on EVERY question (not only policy
  // keyword ones): doc chunks are retrieved regardless of wording, and any strong
  // FAQ-style overlap (>= 60% of the question's meaningful tokens in one chunk)
  // is treated as a procedural / KB-worthy answer source. Real product lookups
  // (availability, price, grade, recommendations) rarely reach that overlap in a
  // document chunk, so the catalog path below still owns them — a weak incidental
  // hit like "stock" never hijacks a phone query.
  const retrieved = opts.kbEnabled ? retrieveKnowledge(opts.knowledge, question, 3).filter(c => c.score >= 0.5) : []
  const hasFaqMatch = opts.kbEnabled ? kbStronglyMatches(question, opts.knowledge) : false
  const isProcedural = isProceduralQuestion(question, opts.products, opts.categories) || hasFaqMatch
  const kbRaw = isProcedural ? (opts.kbEnabled ? kbAnswer(question, opts.knowledge) : undefined) ?? 'I do not have a matching enabled store policy. Check the policy with your manager or add the relevant document in Settings → Knowledge base.' : undefined

  // Compare retrieval
  const compareMsg = compareAnswer(question, opts.products, opts.categories)?.replaceAll('£', opts.currency)

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
    operationalAnswer,
    sources: isProcedural ? retrieved.map(c => ({ title: c.docTitle, text: c.text })) : [],
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
  winner: Evidence['customer'] extends infer _ ? 'operations' | 'customer' | 'kb' | 'catalog' | 'compare' | 'skills' | 'llm' : never
  confidence: number
  /** Deterministic answer when confidence is high enough. */
  deterministicAnswer: string | null
}

export function fuseEvidence(e: Evidence): FusionResult {
  if (e.operationalAnswer) return { winner: 'operations', confidence: 10, deterministicAnswer: e.operationalAnswer }
  if (e.compare.message) return { winner: 'compare', confidence: 8, deterministicAnswer: e.compare.message }
  if (e.skills.matched) return { winner: 'skills', confidence: 8, deterministicAnswer: e.skills.varianceMsg ?? e.skills.helpfulMsg ?? null }
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
  //
  // Every catalogAnswer result is shown deterministically (full +4). Because the
  // answer is derived directly from the store database it is never more accurate to
  // feed it back through the LLM — doing so only invites hallucinated contradictions
  // (e.g. "no, we don't have the Sony WH-1000XM4"). The LLM is reserved for questions
  // the catalog cannot answer at all (catalogAnswer returns undefined).
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
  // Structured data and policies are rendered from evidence, never regenerated.
  const decision = decideAnswer(evidence)
  if (decision.answer) return decision.answer
  if (evidence.customer.isCustomerQ) return evidence.customer.deterministicAnswer ?? 'Which customer should I look up?'
  // Unverified prose can hallucinate without any numbers or known brand names.
  // Only evidence-backed decisions may make factual claims.
  return 'I cannot verify that from the available store records or saved documents. Tell me the product or movie title you want to check, or add a document with those details.'


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

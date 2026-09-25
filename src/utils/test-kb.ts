/**
 * Knowledge-base reply correctness tests.
 *
 * Verifies that genuine KB (policy / procedure) questions:
 *   1. are detected as procedural (isProceduralQuestion),
 *   2. are answered from the KB (winner === 'kb') by the real pipeline the
 *      assistant uses (retrieveEvidence → fuseEvidence → decideAnswer),
 *   3. return the CORRECT facts from the seed knowledge base (content check,
 *      not just "non-empty"),
 *   4. and that offlineReply also answers them from the KB rather than a
 *      canned keyword fallback.
 *
 * Also guards regressions: catalog/stock questions must never be hijacked by
 * the KB, and questions outside the KB must not fabricate policy answers.
 */
import { catalogAnswer, kbAnswer, offlineReply, isProceduralQuestion } from './ai'
import { retrieveKnowledge } from './rag'
import { retrieveEvidence, fuseEvidence, decideAnswer } from './pipeline'
import { seedProducts, seedCategories, seedKnowledge } from '../store/seed'

let passed = 0
let failed = 0
const failures: string[] = []

function check(title: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++
    console.log(`\u2705 ${title}`)
  } else {
    failed++
    failures.push(title)
    console.log(`\u274c ${title}`)
    if (detail) console.log(`    ${detail}`)
  }
}

function snapshot() {
  return {
    storeName: 'TechStore',
    currency: '\u00a3',
    taxRate: 0.2,
    productCount: seedProducts.length,
    catalog: seedProducts.map((p) => ({ name: p.name, grade: p.grade, stock: p.stock })),
    lowStock: seedProducts.filter((p) => p.stock <= p.lowStockThreshold).map((p) => ({ name: p.name, stock: p.stock })),
    todaySalesCount: 0,
    todayRevenue: 0,
    totalSalesCount: 0,
    totalRevenue: 0,
    customerCount: 0,
    creditOutstanding: 0
  }
}

const opts = {
  products: seedProducts,
  categories: seedCategories,
  customers: [],
  sales: [],
  currency: '\u00a3',
  knowledge: seedKnowledge,
  kbEnabled: true,
  skills: [],
  skillsEnabled: false,
  snapshot: snapshot()
}

// === 1. Procedural classification ===
console.log('\n=== 1. isProceduralQuestion classification ===\n')

const proceduralTrue: [string, string][] = [
  ['What is the return policy?', 'return policy'],
  ['How do I exchange a device?', 'exchange'],
  ['What is your trade-in policy?', 'trade-in'],
  ['What does the warranty cover?', 'warranty'],
  ['What is the grading system?', 'grading'],
  ['How do I grade a device on intake?', 'intake'],
  ['How does checkout work?', 'workflow']
]
for (const [q, why] of proceduralTrue) {
  check(`Procedural(true): "${q}"`, isProceduralQuestion(q, seedProducts, seedCategories) === true, `expected procedural because: ${why}`)
}

const proceduralFalse: string[] = [
  'do we have the Sony WH-1000XM4 in stock?',
  'phones under \u00a3200',
  'grade A phones',
  'recommend me a grade B laptop',
  'cheapest headphones'
]
for (const q of proceduralFalse) {
  check(`Procedural(false): "${q}"`, isProceduralQuestion(q, seedProducts, seedCategories) === false, 'should be routed to the catalog, not the KB')
}

// === 2. kbAnswer content correctness (fact-level) ===
console.log('\n=== 2. kbAnswer fact accuracy ===\n')

const facts: [string, string[]][] = [
  // Store policies
  ['What is the return policy?', ['30 days', 'receipt']],
  ['Can I return a device?', ['30 days', 'receipt']],
  ['How do returns work?', ['30 days', 'original receipt']],
  ['What is the warranty?', ['12-month warranty']],
  ['What does the warranty cover?', ['12-month warranty']],
  ['What grading system do you use?', ['Grade A', 'Grade F']],
  ['What does Grade A mean?', ['like new']],
  ['What does Grade F mean?', ['parts']],
  ['Do you sell new items?', ['no new items', 'refurbished']],
  ['Do you buy used phones?', ['buy', 'grade']],
  ['Can I trade in my old phone?', ['store credit', 'trade in']],
  ['How do exchanges work?', ['store credit', 'customer']],
  ['What is the exchange policy?', ['store credit']],
  ['How long do I have to return something?', ['30 days']],
  // Daily operations
  ['How do I start my day?', ['Dashboard', 'low-stock']],
  ['How do I grade a device on intake?', ['test', 'grade A-F']],
  ['How does checkout work?', ['customer', 'receipt', 'Charge']],
  ['How do I end the day?', ['Reconcile', 'cash drawer']]
]
for (const [q, expected] of facts) {
  const r = kbAnswer(q, seedKnowledge)
  const missing = expected.filter((e) => !r?.toLowerCase().includes(e.toLowerCase()))
  check(`Fact: "${q}"`, r !== undefined, 'KB returned nothing')
  check(`Fact: "${q}" contains ${expected.join(' / ')}`, missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : undefined)
}

// === 3. Pipeline routing — the actual assistant path ===
console.log('\n=== 3. Pipeline routing (retrieveEvidence → fuseEvidence → decideAnswer) ===\n')

const kbRouted: [string, string[]][] = [
  ['What is the return policy?', ['30 days', 'receipt']],
  ['How do exchanges work?', ['store credit']],
  ['What is the warranty?', ['12-month warranty']],
  ['What is the grading system?', ['Grade A', 'Grade F']],
  ['How do I grade a device on intake?', ['grade A-F']],
  ['How does checkout work?', ['receipt']],
  ['How do I end the day?', ['cash drawer']],
  ['How do I start my day?', ['low-stock']]
]
for (const [q, expected] of kbRouted) {
  const e = retrieveEvidence(q, opts)
  const f = fuseEvidence(e)
  const decision = decideAnswer(e)
  const ans = decision.answer ?? ''
  const missing = expected.filter((x) => !ans.toLowerCase().includes(x.toLowerCase()))
  check(`KB wins: "${q}" → winner=${f.winner} (conf ${f.confidence})`, f.winner === 'kb' && f.confidence >= 4, `got winner=${f.winner} conf=${f.confidence}`)
  check(`KB answer correct: "${q}" has ${expected.join(' / ')}`, missing.length === 0, missing.length ? `answer was: ${ans.slice(0, 150)}` : undefined)
}

// Catalog questions must NOT route to KB
console.log('\n--- Guardrail: catalog questions never hijacked by KB ---')
const notKb: [string, string[]][] = [
  ['do we have the Sony WH-1000XM4 in stock?', ['Sony WH-1000XM4']],
  ['phones under \u00a3200', ['Galaxy S22']],
  ['grade A phones', ['iPhone 15']],
  ['recommend me a grade B laptop', ['MacBook']],
  ['cheapest headphones', ['JBL']]
]
for (const [q, expected] of notKb) {
  const e = retrieveEvidence(q, opts)
  const f = fuseEvidence(e)
  const decision = decideAnswer(e)
  const ans = decision.answer ?? catalogAnswer(q, seedProducts, seedCategories)?.message ?? (e.catalog.answer?.message ?? '')
  check(`Not KB: "${q}" → winner=${f.winner}`, f.winner !== 'kb', `got winner=${f.winner} (KB hijack!) conf=${f.confidence}`)
  check(`Not KB: "${q}" answer references catalog`, expected.some((x) => ans.includes(x)), `answer was: ${ans.slice(0, 120)}`)
}

// === 4. offlineReply answers KB questions from the KB ===
console.log('\n=== 4. offlineReply KB answer path ===\n')

const offlineKb: [string, string[]][] = [
  ['What is the return policy?', ['30 days', 'receipt']],
  ['How do exchanges work?', ['store credit']],
  ['What is the warranty?', ['12-month warranty']],
  ['How do I grade a device on intake?', ['grade']],
  ['How does checkout work?', ['receipt']],
  ['How do I end the day?', ['cash drawer']],
  ['How do I start my day?', ['low-stock']]
]
for (const [q, expected] of offlineKb) {
  const a = offlineReply(q, snapshot(), undefined, undefined, seedKnowledge, seedProducts, seedCategories)
  const missing = expected.filter((x) => !a.toLowerCase().includes(x.toLowerCase()))
  check(`offlineReply: "${q}" answered from KB`, missing.length === 0, missing.length ? `missing ${missing.join(', ')} → answer was: ${a.slice(0, 160)}` : undefined)
}

// offlineReply must NOT answer a non-KB product question with policy text
for (const q of ['do we have the Sony WH-1000XM4 in stock?', 'phones under \u00a3200']) {
  const a = offlineReply(q, snapshot(), undefined, undefined, seedKnowledge, seedProducts, seedCategories)
  check(`offlineReply guardrail: "${q}" not a policy answer`, !a.includes('30 days') && !a.includes('warranty'), `answer was: ${a.slice(0, 120)}`)
}

// === 5. Retrieval relevance ranking ===
console.log('\n=== 5. Retrieval relevance ===\n')
const rank: [string, string][] = [
  ['What is the return policy?', 'Store policies'],
  ['How do I grade a device on intake?', 'Daily operations'],
  ['What is the warranty?', 'Store policies'],
  ['How does checkout work?', 'Daily operations'],
  ['How do I start my day?', 'Daily operations'],
  ['How do exchanges work?', 'Store policies']
]
for (const [q, doc] of rank) {
  const top = retrieveKnowledge(seedKnowledge, q, 1)
  check(`Top chunk for "${q}" is "${doc}"`, top.length > 0 && top[0].docTitle === doc, top.length ? `got "${top[0].docTitle}"` : 'no chunk')
}

console.log(`\n=== ${passed} passed, ${failed} failed / ${passed + failed} total ===`)
if (failures.length > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exitCode = 1
}
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSnapshot, resolveFollowUp, offlineReply } from '../src/utils/ai'
import { retrieveEvidence, decideAnswer, validateAnswer } from '../src/utils/pipeline'
import { seedProducts, seedCategories } from '../src/store/seed'
import { transactionFigures, todaysTransactions } from '../src/utils/figures'
import type { Sale, Settings } from '../src/types'
const settings = { storeName: 'Test', currency: '£', taxRate: 20 } as Settings
const snapshot = buildSnapshot(seedProducts, [], [], settings)
function evidence(question: string, extra = {}) {
  return retrieveEvidence(question, { products: seedProducts, categories: seedCategories, customers: [], sales: [], currency: '£', knowledge: [], kbEnabled: true, skills: [], skillsEnabled: true, snapshot, ...extra })
}
const names = seedProducts.map(p => p.name).concat(seedCategories.map(c => c.name))
test('sales → phones resets the subject and keeps budget and grade', () => {
  const first = "What are today's sales?"
  assert.equal(decideAnswer(evidence(first)).winner, 'operations')
  assert.match(decideAnswer(evidence(first)).answer!, /Sales: £0.00/)
  const next = resolveFollowUp('Show me grade A phones under £400', first, names)
  assert.equal(next, 'Show me grade A phones under £400')
  const answer = decideAnswer(evidence(next)).answer!
  assert.match(answer, /Galaxy S23/)
  assert.doesNotMatch(answer, /today's sales|actors|iPhone 15/)
})
test('repeated follow-ups retain product subject, new categories reset it', () => {
  const second = resolveFollowUp('how many are grade A?', 'how many iphones?', names)
  const third = resolveFollowUp('what about grade B?', second, names)
  assert.match(third, /\(of: iphones grade A\)/)
  const reset = resolveFollowUp('show me laptops under £700', third, names)
  assert.equal(reset, 'show me laptops under £700')
})
test('dashboard and assistant figures separate transaction kinds and future entries', () => {
  const now = new Date()
  const make = (kind: Sale['kind'], total: number, createdAt = now.getTime()) => ({ kind, total, createdAt, items: [] } as unknown as Sale)
  const sales = [make('sale', 100), make('buy', -20), make('refund', -10), make('exchange', 5), make('sale', 999, now.getTime() + 86400000)]
  assert.deepEqual(transactionFigures(todaysTransactions(sales, now)), { sales: 100, buys: 20, refunds: 10, exchange: 5, orders: 1 })
  const s = buildSnapshot([], sales, [], settings)
  assert.equal(s.todayRevenue, 100)
  assert.equal(s.todaySalesCount, 1)
})
test('missing and disabled policies cannot invent refund instructions', () => {
  for (const kbEnabled of [true, false]) {
    const answer = decideAnswer(evidence('What is our refund policy?', { kbEnabled })).answer!
    assert.match(answer, /matching enabled store policy/)
    assert.doesNotMatch(answer, /30.day|12.month|delete|balance/)
  }
})
test('policy answers include inspectable source evidence', () => {
  const e = evidence('What is our refund policy?', { knowledge: [{ id: 'p', title: 'Refund policy', content: 'Refund policy: Returns require the original receipt.', updatedAt: 0 }] })
  assert.equal(decideAnswer(e).winner, 'kb')
  assert.match(decideAnswer(e).answer!, /original receipt/)
  assert.equal(e.sources?.[0].title, 'Refund policy')
})
test('validation replaces contradictory generated business facts', () => {
  const e = evidence("Today's sales")
  assert.equal(validateAnswer('Sales are £9999', e), decideAnswer(e).answer)
  const unknown = evidence('hello')
  unknown.catalog.answer = undefined
  unknown.catalog.hits = []
  assert.match(validateAnswer('The iPhone 99 is £200 and in stock', unknown), /cannot verify/)
})
test('cash variance without context provides actionable guidance', () => {
  assert.match(decideAnswer(evidence('Explain cash variance')).answer!, /Close Banking/)
})
test('low stock is answered without a model', () => {
  assert.equal(decideAnswer(evidence('Low stock')).winner, 'operations')
})

import { browserChat } from '../src/utils/browserLlm'
import { interrupted } from './mock-webllm'
test('local generation streams progress and returns the complete answer', async () => {
  const progress: string[] = []
  const result = await browserChat('test-model', [{ role: 'user', content: 'hello' }], { onProgress: text => progress.push(text) })
  assert.equal(result, 'Hello there')
  assert.deepEqual(progress, ['Hello', 'Hello there'])
})
test('stopping a request rejects late output and interrupts generation', async () => {
  const controller = new AbortController()
  const progress: string[] = []
  await assert.rejects(browserChat('test-model', [{ role: 'user', content: 'hello' }], {
    signal: controller.signal,
    onProgress: text => { progress.push(text); controller.abort() }
  }), { name: 'AbortError' })
  assert.deepEqual(progress, ['Hello'])
  assert.equal(interrupted, 1)
})
test('already stopped requests never emit progress', async () => {
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(browserChat('test-model', [], { signal: controller.signal, onProgress: () => assert.fail('late progress') }), { name: 'AbortError' })
})
test('catalog answers use configured currency', () => {
  assert.match(decideAnswer(evidence('grade A phones under 400', { currency: '$' })).answer!, /\$389.99/)
})

test('changed grade and budget survive subsequent follow-ups', () => {
  const second = resolveFollowUp('what about grade B under 200?', 'show me phones grade A under 400', names)
  const third = resolveFollowUp('how many are left?', second, names)
  assert.match(third, /grade B/)
  assert.match(third, /under 200/)
  assert.doesNotMatch(third, /grade A|under 400/)
})

import { answerFromKnowledge, checkKnowledgeReply, knowledgeMessages } from '../src/utils/knowledgeAi'
test('saved FAQs route to knowledge without requiring policy keywords', () => {
  const docs = [{ id: 'hours', title: 'Opening hours', content: 'Monday to Friday: 9am to 5pm.', updatedAt: 0 }]
  const e = evidence('What are your opening hours?', { knowledge: docs })
  assert.equal(decideAnswer(e).winner, 'kb')
  assert.match(decideAnswer(e).answer!, /9am to 5pm/)
})
test('the knowledge base is actively consulted on every question, not just policy keywords', () => {
  const complaints = { id: 'c', title: 'Customer complaints workflow', content: 'If a customer reports an issue outside the 12-month warranty period: the first step is to listen, check their receipt and purchase record, and confirm that the device is out of warranty before offering paid repair, trade-in, or store credit. After a resolution is provided, the team should follow up with the customer to confirm that their concerns have been addressed and their needs have been met.', updatedAt: 0 }
  const first = evidence('What is the first step when a customer reports an issue outside the warranty period?', { knowledge: [complaints] })
  assert.equal(decideAnswer(first).winner, 'kb')
  assert.match(decideAnswer(first).answer!, /out of warranty|first step|listen|trade-in/)
  const followUp = evidence('What should be done after a resolution is provided?', { knowledge: [complaints] })
  assert.equal(decideAnswer(followUp).winner, 'kb')
  assert.match(decideAnswer(followUp).answer!, /follow up with the customer to confirm that their concerns have been addressed and their needs have been met/)
})
test('offline fallback answers the same uploaded FAQ from the KB', () => {
  const complaints = { id: 'c', title: 'Customer complaints workflow', content: 'After a resolution is provided, the team should follow up with the customer to confirm that their concerns have been addressed and their needs have been met.', updatedAt: 0 }
  const answer = offlineReply('What should be done after a resolution is provided?', snapshot, undefined, undefined, [complaints], seedProducts, seedCategories)
  assert.match(answer, /follow up with the customer/)
})
test('KB replies are concise and answer the question, not a whole document chunk', async () => {
  const complaints = { id: 'c', title: 'Customer complaints workflow', content: 'If a customer reports an issue outside the 12-month warranty period: the first step is to listen, check their receipt and purchase record, and confirm that the device is out of warranty before offering paid repair, trade-in, or store credit. After a resolution is provided, the team should follow up with the customer to confirm that their concerns have been addressed and their needs have been met.', updatedAt: 0 }
  const first = evidence('What is the first step when a customer reports an issue outside the warranty period?', { knowledge: [complaints] })
  const firstAnswer = (await answerFromKnowledge(first)).content
  assert.ok(firstAnswer.length < 230, `expected a concise answer, got ${firstAnswer.length} chars: ${firstAnswer}`)
  assert.match(firstAnswer, /first step is to listen/)
  assert.doesNotMatch(firstAnswer, /\*\*|\bcustomer complaints workflow\b/i)
  const followUp = evidence('What should be done after a resolution is provided?', { knowledge: [complaints] })
  const followUpAnswer = (await answerFromKnowledge(followUp)).content
  assert.match(followUpAnswer, /follow up with the customer to confirm (that )?their concerns have been addressed/)
})
test('document edits and deletion take effect on the next reply', () => {
  const original = { id: 'returns', title: 'Return policy', content: 'Returns require a receipt within 30 days.', updatedAt: 0 }
  assert.match(decideAnswer(evidence('What is the return policy?', { knowledge: [original] })).answer!, /30 days/)
  const changed = { ...original, content: 'Returns require a receipt within 14 days.' }
  const updated = decideAnswer(evidence('What is the return policy?', { knowledge: [changed] })).answer!
  assert.match(updated, /14 days/)
  assert.doesNotMatch(updated, /30 days/)
  assert.match(decideAnswer(evidence('What is the return policy?', { knowledge: [] })).answer!, /do not have a matching/)
})
test('KB toggle prevents saved policy use even when documents exist', () => {
  const e = evidence('What is the return policy?', { kbEnabled: false, knowledge: [{ id: 'p', title: 'Return policy', content: 'Returns within 99 days.', updatedAt: 0 }] })
  assert.deepEqual(e.sources, [])
  assert.doesNotMatch(decideAnswer(e).answer!, /99/)
})
test('knowledge generator receives the saved references and returns cited wording', async () => {
  const e = evidence('What is the return policy?', { knowledge: [{ id: 'p', title: 'Return policy', content: 'Returns require a receipt within 30 days.', updatedAt: 0 }] })
  const result = await answerFromKnowledge(e, async messages => {
    assert.match(messages[1].content, /Returns require a receipt within 30 days/)
    return 'Bring your receipt and return the item within 30 days. [1]'
  })
  assert.equal(result.usedAi, true)
  assert.match(result.content, /Bring your receipt/)
})
test('unsupported numbers, changed units and invalid citations fall back to saved facts', async () => {
  const e = evidence('What is the return policy?', { knowledge: [{ id: 'p', title: 'Return policy', content: 'Returns require a receipt within 30 days.', updatedAt: 0 }] })
  const expected = /receipt within 30 days/
  for (const response of ['Returns accepted for 90 days. [1]', 'Returns accepted for 30 months. [1]', 'Returns accepted for 30 days. [9]']) {
    const result = await answerFromKnowledge(e, async () => response)
    assert.equal(result.usedAi, false)
    assert.match(result.content, expected)
  }
})
test('missing references skip generation; model failure uses saved reference', async () => {
  const missing = evidence('What is the return policy?')
  await answerFromKnowledge(missing, async () => { assert.fail('No facts to generate from'); return '' })
  const e = evidence('What is the return policy?', { knowledge: [{ id: 'p', title: 'Return policy', content: 'A receipt is required.', updatedAt: 0 }] })
  const result = await answerFromKnowledge(e, async () => { throw new Error('GPU unavailable') })
  assert.equal(result.usedAi, false)
  assert.match(result.content, /receipt is required/)
  assert.equal(result.note, '')
})
test('cancelling knowledge generation cannot return a late reply', async () => {
  const e = evidence('What is the return policy?', { knowledge: [{ id: 'p', title: 'Return policy', content: 'A receipt is required.', updatedAt: 0 }] })
  const controller = new AbortController()
  await assert.rejects(answerFromKnowledge(e, async () => { controller.abort(); return 'A receipt is required. [1]' }, controller.signal), { name: 'AbortError' })
})

import { chunkDoc } from '../src/utils/rag'
test('retrieval chunks preserve whole sentences at overlap boundaries', () => {
  const sentences = ['A long opening statement contains useful reference details.', 'Returns require the original receipt.', 'Items must be returned within thirty days.']
  const chunks = chunkDoc(sentences.join(' '), 65, 15)
  for (const chunk of chunks) assert.ok(sentences.some(s => chunk.startsWith(s)))
})

test('natural KB wording is accepted without inline citations', async () => {
  const e = evidence('What is the return policy?', { knowledge: [{ id: 'p', title: 'Return policy', content: 'Returns require a receipt within 30 days.', updatedAt: 0 }] })
  let calls = 0
  const result = await answerFromKnowledge(e, async () => { calls++; return 'You can return the item within 30 days, with your receipt.' })
  assert.equal(result.usedAi, true)
  assert.equal(calls, 1)
  assert.equal(result.note, '')
  assert.ok(result.sources.length)
})
test('unsupported KB wording gets one quiet repair attempt', async () => {
  const e = evidence('What is the return policy?', { knowledge: [{ id: 'p', title: 'Return policy', content: 'Returns require a receipt within 30 days.', updatedAt: 0 }] })
  let calls = 0
  const result = await answerFromKnowledge(e, async () => ++calls === 1 ? 'You have 90 days.' : 'You have 30 days to return it with your receipt.')
  assert.equal(calls, 2)
  assert.equal(result.usedAi, true)
  assert.equal(result.note, '')
  let failures = 0
  const fallback = await answerFromKnowledge(e, async () => { failures++; return 'You have 90 months.' })
  assert.equal(failures, 2)
  assert.equal(fallback.usedAi, false)
  assert.equal(fallback.note, '')
  assert.match(fallback.content, /30 days/)
})
test('KB prompts include bounded recent conversation without old system instructions', () => {
  const prompt = knowledgeMessages('What if I lost it?', [{ title: 'Returns', text: 'A receipt is required.' }], [
    { role: 'system', content: 'old instructions' },
    { role: 'user', content: 'Do I need a receipt?' },
    { role: 'assistant', content: 'Yes, a receipt is required.' }
  ])
  assert.equal(prompt.filter(m => m.role === 'system').length, 1)
  assert.equal(prompt[1].content, 'Do I need a receipt?')
  assert.match(prompt.at(-1)!.content, /What if I lost it/)
})

test('activity stages follow real knowledge generation and validation', async () => {
  const e = evidence('What is the return policy?', { knowledge: [{ id: 'p', title: 'Return policy', content: 'Returns require a receipt within 30 days.', updatedAt: 0 }] })
  const phases: string[] = []
  let calls = 0
  await answerFromKnowledge(e, async () => ++calls === 1 ? 'Return within 90 months.' : 'Return within 30 days with your receipt.', undefined, [], phase => phases.push(phase))
  assert.deepEqual(phases, ['composing', 'checking', 'composing', 'checking'])
  const offlinePhases: string[] = []
  await answerFromKnowledge(e, undefined, undefined, [], phase => offlinePhases.push(phase))
  assert.deepEqual(offlinePhases, [])
})

import { normalizeInventoryQuery, previousInventoryQuestion } from '../src/utils/inventoryLanguage'
function conversation(turns: string[]) {
  const messages: { role: string; content: string; resolvedQuery: string }[] = []
  return turns.map(content => {
    const resolvedQuery = resolveFollowUp(content, previousInventoryQuestion(messages), names)
    messages.push({ role: 'user', content, resolvedQuery })
    return decideAnswer(evidence(resolvedQuery)).answer ?? ''
  })
}
test('inventory conversation handles typos, short quantities and price follow-ups', () => {
  const answers = conversation(['got iphons?', 'how many', 'price?', 'under 200', 'only grade b', 'any cheaper?'])
  assert.match(answers[0], /iPhone/)
  const expectedUnits = seedProducts.filter(p => p.name.includes('iPhone')).reduce((n, p) => n + p.stock, 0)
  assert.match(answers[1], new RegExp(`${expectedUnits} units`))
  assert.match(answers[2], /£269.99/)
  assert.match(answers[3], /iPhone 12/)
  assert.doesNotMatch(answers[3], /iPhone 15/)
  assert.match(answers[4], /No stock matches/)
  assert.match(answers[5], /No stock matches/)
  assert.doesNotMatch(answers.join(' '), /actors|movies with/)
})
test('specific model numbers do not expand to other models', () => {
  const answers = conversation(['iphone13', 'got 2?', 'got 20?', 'where is it?'])
  assert.match(answers[0], /iPhone 13/)
  assert.doesNotMatch(answers[0], /iPhone 15|iPhone 12/)
  assert.match(answers[1], /^Yes.*9 units/)
  assert.match(answers[2], /^No.*9 units/)
  assert.match(answers[3], /Shelf locations are not recorded/)
})
test('small talk does not erase the inventory topic', () => {
  const answers = conversation(['iphone 13', 'thanks', 'how mny left?'])
  assert.match(answers[1], /welcome/)
  assert.match(answers[2], /9 units/)
})
test('new product topics clear old budget and grade filters', () => {
  const answers = conversation(['phones under 400', 'grade a only', 'what about laptops', 'how many left?'])
  assert.match(answers[1], /Galaxy S23/)
  assert.match(answers[2], /MacBook Pro/)
  assert.doesNotMatch(answers[3], /Galaxy|iPhone/)
  assert.match(answers[3], /units in stock across/)
})
test('short questions without context ask for the product', () => {
  for (const q of ['price?', 'under 200', 'how many?', 'where is it?']) {
    assert.match(decideAnswer(evidence(q)).answer!, /Which product/)
  }
})
test('out-of-stock requests show zero-stock records only', () => {
  const products = seedProducts.map((p, i) => ({ ...p, stock: i === 0 ? 0 : p.stock }))
  const answer = decideAnswer(evidence('oos?', { products })).answer!
  assert.match(answer, /1 out-of-stock product/)
  assert.match(answer, new RegExp(products[0].sku))
  assert.doesNotMatch(answer, new RegExp(products[1].sku))
})
test('stock shorthand is normalized without changing SKU or model digits', () => {
  assert.equal(normalizeInventoryQuery('qty PH-003'), 'quantity PH-003')
  assert.equal(normalizeInventoryQuery('low stok'), 'low stock')
  assert.equal(normalizeInventoryQuery('gr B iphon13'), 'grade B iphone 13')
})
test('missing stock history matches exact box ID and sorts newest first', () => {
  const product = { ...seedProducts[0], id: 'fifa-ps4', name: 'FIFA 17 PS4', sku: 'FIFA-PS4', stock: 1 }
  const other = { ...product, id: 'fifa-xbox', name: 'FIFA 17 Xbox', sku: 'FIFA-XBOX' }
  const sale = (id: string, kind: Sale['kind'], createdAt: number, productId: string) => ({ id, receiptNo: id, kind, createdAt, items: [{ productId, qty: 1 }] } as Sale)
  const sales = [sale('BUY-OLDER', 'buy', 1000, product.id), sale('SALE-NEWER', 'sale', 2000, product.id), sale('OTHER-BOX', 'buy', 3000, other.id)]
  const extra = { products: [product, other], sales }
  const ambiguous = decideAnswer(evidence('fifa 17 cant find it', extra)).answer!
  assert.match(ambiguous, /Which exact box/)
  const result = decideAnswer(evidence('where is FIFA-PS4?', extra)).answer!
  assert.ok(result.indexOf('SALE-NEWER') < result.indexOf('BUY-OLDER'))
  assert.doesNotMatch(result, /OTHER-BOX/)
  assert.match(result, /cannot confirm where/)
  const buys = decideAnswer(evidence('last buys? (of: FIFA-PS4)', extra)).answer!
  assert.match(buys, /BUY-OLDER/)
  assert.doesNotMatch(buys, /SALE-NEWER|OTHER-BOX/)
  assert.equal(product.stock, 1)
})

test('follow-up rechecks use changing stock, including sell-out and restock', () => {
  const base = { ...seedProducts[0], id: 'new-speaker', name: 'Orbit Speaker 27', sku: 'ORBIT-27', stock: 3 }
  let products = [base]
  const ask = (q: string) => decideAnswer(evidence(q, { products })).answer!
  const first = 'how many ORBIT-27?'
  assert.match(ask(first), /^3 units/)
  const followUp = resolveFollowUp('now?', first, [base.name, base.sku])
  products = [{ ...base, stock: 0 }]
  assert.match(ask(followUp), /^0 units/)
  products = [{ ...base, stock: 8 }]
  assert.match(ask(resolveFollowUp('check again', followUp, [base.name, base.sku])), /^8 units/)
})
test('new product records are searchable without retraining and removed ones are not recalled', () => {
  const product = { ...seedProducts[0], id: 'fresh', name: 'Nebula Camera 42', sku: 'NEB-42', stock: 6 }
  assert.match(decideAnswer(evidence('qty NEB-42', { products: [product] })).answer!, /^6 units/)
  assert.match(decideAnswer(evidence('qty NEB-42', { products: [] })).answer!, /couldn't find/)
  assert.match(decideAnswer(evidence('qty NEB-42', { products: [{ ...product, name: 'Nebula Camera 42 Renewed' }] })).answer!, /Renewed/)
})
test('SKU prefixes cannot mix different box records', () => {
  const short = { ...seedProducts[0], id: 'short', sku: 'STCK-22', name: 'Speaker 22', stock: 4 }
  const long = { ...short, id: 'long', sku: 'STCK-22-PRO', name: 'Speaker 22 Pro', stock: 9 }
  assert.equal(normalizeInventoryQuery('qty STCK-22-PRO'), 'quantity STCK-22-PRO')
  const answer = decideAnswer(evidence('qty STCK-22-PRO', { products: [short, long] })).answer!
  assert.match(answer, /^9 units/)
  assert.doesNotMatch(answer, /13 units/)
})
test('new buy transactions appear on recheck and unrelated boxes stay excluded', () => {
  const p = { ...seedProducts[0], id: 'dynamic', sku: 'NEW-BOX', name: 'New stock item', stock: 1 }
  const sale = { id: 'buy1', receiptNo: 'NEW-RECEIPT', kind: 'buy', createdAt: Date.now(), items: [{ productId: p.id, qty: 1 }] } as Sale
  const q = 'last buys NEW-BOX'
  assert.match(decideAnswer(evidence(q, { products: [p], sales: [] })).answer!, /No recorded transactions/)
  assert.match(decideAnswer(evidence(resolveFollowUp('again', q, [p.sku]), { products: [p], sales: [sale] })).answer!, /NEW-RECEIPT/)
})

test('changed price and grade are applied to the next filtered lookup', () => {
  const product = { ...seedProducts[0], id: 'mutable', name: 'Orbit Phone 77', sku: 'ORB-77', stock: 5, grade: 'B', price: 150 }
  const query = 'grade B under 200 (of: Orbit Phone 77)'
  assert.match(decideAnswer(evidence(query, { products: [product] })).answer!, /£150.00/)
  assert.match(decideAnswer(evidence(query, { products: [{ ...product, price: 250 }] })).answer!, /No stock matches/)
  assert.match(decideAnswer(evidence(query, { products: [{ ...product, grade: 'C' }] })).answer!, /No stock matches/)
})
test('low-stock and out-of-stock counts update with live stock changes', () => {
  const product = { ...seedProducts[0], stock: 1, lowStockThreshold: 2 }
  const first = decideAnswer(evidence(`low stock (of: ${product.sku})`, { products: [product] })).answer!
  assert.match(first, /1 low-stock product/)
  const replenished = decideAnswer(evidence(`low stock (of: ${product.sku})`, { products: [{ ...product, stock: 6 }] })).answer!
  assert.match(replenished, /No low-stock/)
})

 test('misspelled actor movie searches use recorded cast only', () => {
  assert.match(decideAnswer(evidence('got Zenday movies?')).answer!, /Did you mean .zendaya movies.*2 results/ )
  for (const q of ['Zendaya movies', 'do we have Zendaya films?']) {
    const answer = decideAnswer(evidence(q)).answer!
    assert.match(answer, /Spider-Man: No Way Home/)
    assert.match(answer, /Dune: Part Two/)
    assert.doesNotMatch(answer, /John Wick|Oppenheimer|don.t have/)
  }
 })
 test('ungrounded prose cannot invent film credits without numbers', () => {
  const e = evidence('hello')
  e.catalog.answer = undefined
  e.catalog.hits = []
  assert.match(validateAnswer('Zendaya stars in The Batman.', e), /cannot verify/)
 })

test('reverse grade wording resets an explicit iPhone subject after iPhone 12', () => {
  const first = 'do we have iphone 12?'
  assert.match(decideAnswer(evidence(first)).answer!, /iPhone 12/)
  for (const question of ['any iphone in B grade?', 'do we have any iphone in B grade?', 'any iphone in B-grade?', 'any iphone in grade-B?']) {
    const resolved = resolveFollowUp(question, first, names)
    assert.doesNotMatch(resolved, /of:/)
    const answer = decideAnswer(evidence(resolved)).answer!
    assert.match(answer, /iPhone 13/)
    assert.match(answer, /Grade B/)
    assert.doesNotMatch(answer, /iPhone 12|actors|movies|Grade [ACF]/)
  }
})
test('grade-only followup retains model but a named category replaces movies', () => {
  const follow = resolveFollowUp('B grade?', 'do we have iphone 12?', names)
  assert.match(follow, /of:.*iphone 12/i)
  assert.doesNotMatch(decideAnswer(evidence(follow)).answer!, /actors|movies|iPhone 13/)
  for (const question of ['any iphone in B grade?', 'do we have laptops in B grade?', 'do we have unknowncamera?']) {
    const resolved = resolveFollowUp(question, 'Zendaya movies', names)
    const answer = decideAnswer(evidence(resolved)).answer!
    assert.doesNotMatch(answer, /actors|Zendaya|Spider-Man|Dune/)
  }
})

test('reverse-grade answers reflect changing inventory and switch categories', () => {
  const original = seedProducts.find(p => /iPhone 13/.test(p.name))!
  const products = seedProducts.map(p => p.id === original.id ? { ...p, stock: 3, price: 123 } : p)
  const query = resolveFollowUp('any iphone in B grade?', 'Zendaya movies', names)
  const answer = decideAnswer(evidence(query, { products })).answer!
  assert.match(answer, /123.00/)
  assert.match(answer, /3 in stock/)
  const changed = products.map(p => p.id === original.id ? { ...p, grade: 'C' as const } : p)
  assert.doesNotMatch(decideAnswer(evidence(query, { products: changed })).answer!, /iPhone 13|actors/)
  const laptops = decideAnswer(evidence(resolveFollowUp('any laptops in B grade?', query, names))).answer!
  assert.match(laptops, /ThinkPad|EliteBook/)
  assert.doesNotMatch(laptops, /iPhone|actors|Dune/)
})

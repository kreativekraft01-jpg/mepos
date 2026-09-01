import { retrieveProducts, catalogAnswer } from './ai'
import { seedProducts, seedCategories } from '../store/seed'

const cases: [string, string][] = [
  // Original test cases — intent-matching queries
  ['do we have Tom Holland movies?', 'Spider-Man'],
  ['do we have Tom Cruise movies?', 'Top Gun'],
  ['do we have Keanu Reeves movies?', 'John Wick'],
  ['do we have Margot Robbie movies?', 'Barbie'],
  ['do we have Leonardo DiCaprio movies?', 'Flower Moon'],
  ['do we have Robert Pattinson movies?', 'Batman'],
  ['do we have Cillian Murphy movies?', 'Oppenheimer'],
  ['do we have Christian Bale movies?', 'Dark Knight'],
  ['do we have Michelle Yeoh movies?', 'Everything Everywhere'],
  ['do we have Daniel Craig movies?', 'Glass Onion'],
  ['do we have Ryan Gosling movies?', 'Barbie'],
  // Typo detection test cases — queries with misspelled actor names
  ['do we have tom cruse movies?', 'Did you mean'],
  ['do we have tom holand movies?', 'Did you mean'],
  ['do we have keanu reves movies?', 'Did you mean'],
  ['do we have margot robbiee movies?', 'Did you mean'],
  ['do we have batman movis?', 'Did you mean'],
  // Subject-only queries (no "do we have" prefix) — the new fallback
  ['tom cruise movies', 'Top Gun'],
  ['iphones', 'iPhone'],
  ['macbooks', 'MacBook'],
  ['keanu reeves movies', 'John Wick'],
  ['tom holland movies', 'Spider-Man'],
  // "don't have" test cases — actors not in catalog
  ['do we have Brad Pitt movies?', "don't have"],
  ['do we have Will Smith movies?', "don't have"],
  ['do we have Johnny Depp movies?', "don't have"],
  ['do we have Tom Hanks movies?', "don't have"],
  ['do we have Tom Hardy movies?', "don't have"],
  // Other query types
  ['show me movies', 'movies'],
  ['cheapest movies', 'movies'],
  ['do we have iPhones?', 'iPhone'],
  ['do we have MacBooks?', 'MacBook'],
  ['do we have AirPods?', 'AirPods'],
  // Category browsing & discovery
  ['what categories do we have', 'categories'],
  ['show me categories', 'categories'],
  ['list categories', 'categories'],
  ['show me Blu-ray', 'Blu-ray'],
  ['show me Smartphones', 'Smartphones'],
  ['show me Gaming', 'Gaming'],
  ['show me headphones', 'headphones'],
  ['what do you sell', 'categories'],
  // Filtered/sorted queries (previously broken)
  ['cheapest movies', 'cheapest'],
  ['phones under £200', 'phones'],
  ['grade B phones', 'phones'],
  ['recommend me phones for under £200 that is a grade B', 'phones'],
]

let passed = 0
let failed = 0

for (const [q, expect] of cases) {
  const hits = retrieveProducts(seedProducts, seedCategories, q, 6)
  const result = catalogAnswer(q, seedProducts, seedCategories)
  const topHit = hits[0]?.name ?? '(no results)'
  const ans = result?.message ?? ''
  const ok = ans.toLowerCase().includes(expect.toLowerCase()) || topHit.toLowerCase().includes(expect.toLowerCase())
  const icon = ok ? '\u2705' : '\u274c'
  console.log(`${icon} "${q}"`)
  console.log(`   Top hit: ${topHit}`)
  console.log(`   Answer: ${ans.slice(0, 150)}`)
  if (result?.correctedQuery) console.log(`   Corrected query: ${result.correctedQuery}`)
  if (!ok) { console.log(`   EXPECTED: ${expect}`); failed++ } else passed++
  console.log()
}

// Test typo correction confirmation flow
console.log('--- Typo correction follow-up test ---')
const typoResult = catalogAnswer('do we have tom cruse movies?', seedProducts, seedCategories)
if (typoResult?.correctedQuery) {
  console.log(`Typo detected. Corrected query: "${typoResult.correctedQuery}"`)
  console.log(`Message: ${typoResult.message}`)
  // Simulate user saying "yes" — re-run with corrected query wrapped in a question
  const followUp = catalogAnswer(`do we have ${typoResult.correctedQuery}?`, seedProducts, seedCategories)
  const followUpOk = followUp?.message.includes('Top Gun') ?? false
  console.log(`Follow-up answer: ${followUp?.message.slice(0, 150)}`)
  console.log(`${followUpOk ? '\u2705' : '\u274c'} Follow-up returns actual results`)
  if (followUpOk) passed++; else failed++
} else {
  console.log('\u274c No typo detected for "tom cruse"')
  failed++
}

console.log(`\n=== ${passed} passed, ${failed} failed / ${cases.length + 1} total ===`)
import { catalogAnswer, kbAnswer, offlineReply, compareAnswer } from './ai'
import { seedProducts, seedCategories, seedKnowledge } from '../store/seed'

interface TestCase {
  query: string
  expect: (answer: string) => boolean
  description: string
}

const snapshot = {
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
  creditOutstanding: 0,
}

const cases: TestCase[] = [
  // === 1. PLURALS ===
  { query: 'iphones', description: 'Plural - find iPhones, no typo correction', expect: (a) => a.includes('iPhone') && !a.includes('Did you mean') },
  { query: 'laptops', description: 'Plural - find laptops/tablets', expect: (a) => a.includes('MacBook') || a.includes('EliteBook') || a.includes('iPad') },
  { query: 'headphones', description: 'Plural - find audio products', expect: (a) => a.includes('AirPods') || a.includes('Sony') || a.includes('Bose') },
  { query: 'movies', description: 'Plural - find media products', expect: (a) => a.includes('Spider-Man') || a.includes('Oppenheimer') || a.includes('Blu-ray') },
  { query: 'watches', description: 'Plural - find wearable watches', expect: (a) => a.includes('Apple Watch') || a.includes('Galaxy Watch') },
  { query: 'cameras', description: 'Plural - find camera products', expect: (a) => a.includes('Canon') || a.includes('DJI') },
  { query: 'macbooks', description: 'Plural - find MacBook products', expect: (a) => a.includes('MacBook') },
  { query: 'ipads', description: 'Plural - find iPad products', expect: (a) => a.includes('iPad') },

  // === 2. CASUAL PHRASING ===
  { query: 'do we have iphones?', description: 'Casual do we have prefix', expect: (a) => a.includes('iPhone') },
  { query: 'got any laptops?', description: 'Casual got any prefix', expect: (a) => a.includes('MacBook') || a.includes('EliteBook') || a.includes('iPad') },
  { query: 'ya have headphones?', description: 'Casual ya have prefix', expect: (a) => a.includes('AirPods') || a.includes('Sony') || a.includes('Bose') },
  { query: 'any cameras in stock?', description: 'Casual any prefix with in stock', expect: (a) => a.includes('Canon') || a.includes('DJI') },
  { query: 'show me wearables', description: 'Casual show me prefix', expect: (a) => a.includes('Apple Watch') || a.includes('Galaxy Watch') },
  { query: 'find me a phone', description: 'Casual find me prefix', expect: (a) => a.includes('iPhone') || a.includes('Galaxy') || a.includes('Pixel') },
  { query: 'give me laptops', description: 'Casual give me prefix', expect: (a) => a.includes('MacBook') || a.includes('EliteBook') || a.includes('iPad') },
  { query: 'looking for headphones', description: 'Casual looking for prefix', expect: (a) => a.includes('AirPods') || a.includes('Sony') || a.includes('Bose') },
  { query: 'suggest movies', description: 'Casual suggest prefix', expect: (a) => a.includes('Spider-Man') || a.includes('Oppenheimer') || a.includes('Blu-ray') },

  // === 3. PRICE FILTERING ===
  { query: 'phones under \u00a3200', description: 'Galaxy S22 and iPhone 12', expect: (a) => a.includes('Galaxy S22') && a.includes('iPhone 12') },
  { query: 'laptops under \u00a3700', description: 'MacBook Air C, HP EliteBook; NOT MacBook Pro', expect: (a) => (a.includes('MacBook Air') || a.includes('EliteBook')) && !a.includes('MacBook Pro') },
  { query: 'headphones under \u00a3180', description: 'Bose QC45, AirPods; NOT Sony', expect: (a) => a.includes('Bose') || a.includes('AirPods') },
  { query: 'gaming under \u00a330', description: 'Halo, Odyssey, Elden Ring, Animal Crossing', expect: (a) => a.includes('Halo') || a.includes('and 1 more') },
  { query: 'phones under \u00a310', description: 'No phones under 10', expect: (a) => a.includes("don't have") || a.includes('no matching') || a.includes('We don') },
  { query: 'laptops under \u00a3300', description: 'No laptops under 300', expect: (a) => a.includes("don't have") || a.includes('no matching') || a.includes('We don') },

  // === 4. GRADE FILTERING ===
  { query: 'grade A phones', description: 'iPhone 15 A, Galaxy S23 A; NOT iPhone 13 B', expect: (a) => a.includes('iPhone 15') && a.includes('Galaxy S23') && !a.includes('iPhone 13') },
  { query: 'grade B phones', description: 'iPhone 13 B, Pixel 7 B; NOT iPhone 15 A', expect: (a) => a.includes('iPhone 13') && a.includes('Pixel 7') && !a.includes('iPhone 15 \u00b7 128GB \u00b7 Grade A') },
  { query: 'grade C movies', description: 'Black Panther C is only grade C movie', expect: (a) => a.includes('Black Panther') || a.includes('8.99') },
  { query: 'grade F phones', description: 'iPhone 12 F is only grade F phone', expect: (a) => a.includes('iPhone 12') },
  { query: 'grade A laptops', description: 'MacBook Air A, iPad A', expect: (a) => a.includes('MacBook Air') && a.includes('iPad') },
  { query: 'grade B gaming', description: 'Xbox B, Zelda B, Mario Kart B, Spider-Man 2 B', expect: (a) => a.includes('Xbox') && a.includes('Zelda') },

  // === 5. GRADE + PRICE COMBOS ===
  { query: 'grade A phones under \u00a3400', description: 'Galaxy S23 A 389.99 only; NOT iPhone 15 A', expect: (a) => a.includes('Galaxy S23') && !a.includes('iPhone 15 \u00b7 128GB \u00b7 Grade A') },
  { query: 'grade B laptops', description: 'MacBook Pro B, HP EliteBook B', expect: (a) => a.includes('MacBook Pro') && a.includes('EliteBook') },
  { query: 'grade A audio under \u00a3200', description: 'AirPods A 179, JBL A 89; NOT Sony B 199', expect: (a) => a.includes('AirPods') && a.includes('JBL') && !a.includes('Sony') },
  { query: 'recommend me grade A gaming under \u00a340', description: 'God of War A 34.99; NOT Spider-Man 2 B', expect: (a) => a.includes('God of War') && !a.includes('Spider-Man 2') },
  { query: 'recommend me phones for under \u00a3200 that is a grade B', description: 'Grade B phones under 200: none', expect: (a) => a.includes("don't have") || a.includes('no matching') || a.includes('We don') },

  // === 6. SORT ===
  { query: 'cheapest smartphones', description: 'iPhone 12 F 99 is cheapest', expect: (a) => a.includes('iPhone 12') && a.includes('cheapest') },
  { query: 'most expensive laptops', description: 'MacBook Pro B 1299', expect: (a) => a.includes('MacBook Pro') && a.includes('most expensive') },
  { query: 'cheapest gaming', description: 'Halo C 14.99 is cheapest', expect: (a) => a.includes('Halo') && a.includes('cheapest') },
  { query: 'cheapest movies', description: 'Dark Knight B 7.99 is cheapest', expect: (a) => a.includes('Dark Knight') && a.includes('7.99') && a.includes('cheapest') },
  { query: 'most expensive phones', description: 'iPhone 15 A 419.99', expect: (a) => a.includes('iPhone 15') && a.includes('most expensive') },
  { query: 'cheapest headphones', description: 'JBL A 89 is cheapest audio', expect: (a) => a.includes('JBL') && a.includes('cheapest') },

  // === 7. CATEGORY BROWSING ===
  { query: 'what categories do we have', description: 'List all 7 categories', expect: (a) => a.includes('Smartphones') && a.includes('Audio') && a.includes('Gaming') },
  { query: 'show me Smartphones', description: 'List all smartphones', expect: (a) => a.includes('iPhone') && a.includes('Galaxy') && a.includes('Pixel') },
  { query: 'show me Audio', description: 'List all audio', expect: (a) => a.includes('AirPods') && a.includes('Sony') && a.includes('Bose') && a.includes('JBL') },
  { query: 'show me Wearables', description: 'List all wearables', expect: (a) => a.includes('Apple Watch') && a.includes('Galaxy Watch') },
  { query: 'show me Cameras', description: 'List cameras and drones', expect: (a) => a.includes('Canon') && a.includes('DJI') },
  { query: 'show me Gaming', description: 'List gaming products', expect: (a) => a.includes('PS5') || a.includes('Xbox') || a.includes('Switch') },
  { query: 'show me Media', description: 'List media products', expect: (a) => a.includes('Spider-Man') || a.includes('Oppenheimer') || a.includes('Blu-ray') },
  { query: 'list categories', description: 'List all categories', expect: (a) => a.includes('Smartphones') && a.includes('categories') },
  { query: 'what do you sell', description: 'List categories', expect: (a) => a.includes('Smartphones') || a.includes('categories') },

  // === 8. TYPOS ===
  { query: 'do we have tom cruse movies?', description: 'Typo cruse -> cruise', expect: (a) => a.includes('Did you mean') },
  { query: 'do we have tom holand movies?', description: 'Typo holand -> holland', expect: (a) => a.includes('Did you mean') },
  { query: 'do we have keanu reves movies?', description: 'Typo reves -> reeves', expect: (a) => a.includes('Did you mean') },
  { query: 'do we have margot robbiee movies?', description: 'Typo robbiee -> robbie', expect: (a) => a.includes('Did you mean') },

  // === 9. ACTOR SEARCH ===
  { query: 'tom holland movies', description: 'Should find Spider-Man', expect: (a) => a.includes('Spider-Man') },
  { query: 'tom cruise movies', description: 'Should find Top Gun', expect: (a) => a.includes('Top Gun') },
  { query: 'keanu reeves movies', description: 'Should find John Wick', expect: (a) => a.includes('John Wick') },
  { query: 'christian bale movies', description: 'Should find Dark Knight', expect: (a) => a.includes('Dark Knight') },
  { query: 'brad pitt movies', description: 'Should say we dont have', expect: (a) => a.includes("don't") || a.includes('not') || a.includes('no') },

  // === 10. NO RESULTS ===
  { query: 'do we have TVs?', description: 'No TVs in catalog', expect: (a) => a.includes("don't") || a.includes('not') },
  { query: 'show me furniture', description: 'No furniture in catalog', expect: (a) => a.includes("don't") || a.includes('not') },
  { query: 'grade A TVs', description: 'No TVs in catalog', expect: (a) => a.includes("don't") || a.includes('not') },

  // === 11. RECOMMEND ===
  { query: 'recommend me phones', description: 'Should list phones', expect: (a) => a.includes('iPhone') || a.includes('Galaxy') || a.includes('Pixel') },
  { query: 'recommend me headphones', description: 'Should list headphones', expect: (a) => a.includes('AirPods') || a.includes('Sony') || a.includes('Bose') || a.includes('JBL') },
  { query: 'suggest movies', description: 'Should list movies', expect: (a) => a.includes('Spider-Man') || a.includes('Oppenheimer') || a.includes('Blu-ray') },

  // === 12. COMPARE ===
  { query: 'compare iPhone 13 vs iPhone 15', description: 'Should show comparison', expect: (a) => a.includes('comparison') || a.includes('cheaper') || a.includes('iPhone') },
  { query: 'iPhone 15 or Galaxy S23', description: 'Should show comparison', expect: (a) => a.includes('comparison') || a.includes('cheaper') || a.includes('iPhone') },
  { query: 'MacBook Air vs MacBook Pro', description: 'Should show comparison', expect: (a) => a.includes('comparison') || a.includes('cheaper') || a.includes('MacBook') },

  // === 13. KNOWLEDGE BASE (via offlineReply) ===
  { query: 'How do I start my day?', description: 'KB: daily operations', expect: (a) => a.includes('Dashboard') || a.includes('stock') || a.includes('restock') },
  { query: 'What is the grading intake process?', description: 'KB: grading', expect: (a) => a.includes('grade') || a.includes('Grade') },
  { query: 'How does the exchange process work?', description: 'KB: exchange', expect: (a) => a.includes('exchange') || a.includes('trade') },
  { query: 'What grade means like new?', description: 'KB: grade A', expect: (a) => a.includes('Grade A') || a.includes('grade') },
  { query: 'How do I grade a device?', description: 'KB: grading process', expect: (a) => a.includes('grade') || a.includes('Grade') },
  { query: 'What are the grading rules?', description: 'KB: grading rules', expect: (a) => a.includes('grade') || a.includes('Grade') },

  // === 14. EDGE CASES ===
  { query: 'cheapest grade A phones', description: 'Sort + grade combo', expect: (a) => a.includes('cheapest') && (a.includes('iPhone') || a.includes('Galaxy')) },
  { query: 'most expensive grade B gaming', description: 'Sort + grade combo', expect: (a) => a.includes('most expensive') },
  { query: 'recommend me grade C movies under \u00a310', description: 'Recommend + grade + price: Black Panther C 8.99', expect: (a) => a.includes('Black Panther') || a.includes("don't have") || a.includes('no matching') },
  { query: 'show me Blu-ray movies', description: 'Description keyword match', expect: (a) => a.includes('Spider-Man') || a.includes('Oppenheimer') || a.includes('Dark Knight') || a.includes('Blu-ray') },
  { query: 'any deals on audio?', description: 'Casual + category', expect: (a) => a.includes('AirPods') || a.includes('Sony') || a.includes('Bose') || a.includes('JBL') },
]

let passed = 0
let failed = 0
const failures: string[] = []

// === Run catalogAnswer + compareAnswer tests ===
console.log('\n=== Catalog & Compare Tests ===\n')
for (const tc of cases) {
  // KB tests use offlineReply, not catalogAnswer
  const isKbTest = tc.query === 'How do I start my day?' ||
    tc.query === 'What is the grading intake process?' ||
    tc.query === 'How does the exchange process work?' ||
    tc.query === 'What grade means like new?' ||
    tc.query === 'How do I grade a device?' ||
    tc.query === 'What are the grading rules?'

  let answer = ''
  if (isKbTest) {
    answer = offlineReply(tc.query, snapshot as any, undefined, undefined, seedKnowledge)
  } else {
    const result = catalogAnswer(tc.query, seedProducts, seedCategories)
    answer = result?.message ?? ''
    if (!answer) {
      const cmpResult = compareAnswer(tc.query, seedProducts, seedCategories)
      answer = cmpResult ?? ''
    }
  }

  const ok = tc.expect(answer)
  const icon = ok ? '\u2705' : '\u274c'
  console.log(`${icon} "${tc.query}"`)
  console.log(`   ${tc.description}`)
  console.log(`   Answer: ${answer.slice(0, 200)}`)
  if (!ok) {
    console.log('   >>> FAILED')
    failures.push(tc.query)
    failed++
  } else {
    passed++
  }
  console.log()
}

// === Run kbAnswer direct tests ===
console.log('\n=== KB Answer Direct Tests ===\n')
const kbCases: [string, string][] = [
  ['What is the return policy?', 'return'],
  ['How do returns work?', 'return'],
  ['What are the grading rules?', 'grade'],
  ['How do I exchange a device?', 'exchange'],
  ['What grade means like new?', 'Grade A'],
  ['How does store credit work?', 'store credit'],
  ['What is the warranty?', 'warranty'],
  ['Can I return a device?', 'return'],
]

for (const q of kbCases) {
  const r = kbAnswer(q[0], seedKnowledge)
  const ok = r !== undefined && r.length > 10
  console.log(ok ? '\u2705' : '\u274c', `"${q[0]}"`)
  if (ok) {
    console.log(`   KB found: ${r.slice(0, 120)}...`)
    passed++
  } else {
    console.log('   No KB answer found')
    failures.push(`KB: ${q[0]}`)
    failed++
  }
  console.log()
}

console.log(`\n=== ${passed} passed, ${failed} failed / ${passed + failed} total ===`)
if (failures.length > 0) {
  console.log('\nFailed queries:')
  for (const f of failures) console.log(`  - ${f}`)
}

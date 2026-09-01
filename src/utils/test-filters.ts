import { catalogAnswer, retrieveProducts } from './ai'
import { seedProducts, seedCategories } from '../store/seed'

const catName = new Map(seedCategories.map((c) => [c.id, c.name]))

interface TestCase {
  query: string
  expect: (answer: string) => boolean
  description: string
}

const cases: TestCase[] = [
  // PRICE RANGE
  {
    query: 'phones under £200',
    description: 'Galaxy S22 £179.99, iPhone 12 £99',
    expect: (a) => a.includes('Galaxy S22') && a.includes('iPhone 12'),
  },
  {
    query: 'laptops under £700',
    description: 'MacBook Air C £619, HP EliteBook £349; NOT MacBook Pro £1299 or Air A £769',
    expect: (a) => a.includes('MacBook Air') && a.includes('EliteBook') && !a.includes('MacBook Pro'),
  },
  {
    query: 'phones under £300',
    description: 'Galaxy S22 £179.99, iPhone 12 £99, Pixel 7 £229.99, iPhone 13 £269.99',
    expect: (a) => a.includes('Galaxy S22') && a.includes('Pixel 7') && a.includes('iPhone 13') && a.includes('iPhone 12'),
  },
  {
    query: 'gaming under £30',
    description: 'Halo £14.99, Odyssey £24.99, Elden Ring £27.99, Animal Crossing £29.99',
    expect: (a) => (a.includes('Halo') || a.includes('and 1 more')) && a.includes('Mario'),
  },
  {
    query: 'headphones under £180',
    description: 'Bose QC45 £169, AirPods £179; NOT Sony £199',
    expect: (a) => a.includes('Bose'),
  },

  // CATEGORY BROWSING
  {
    query: 'show me Smartphones',
    description: '7 smartphones',
    expect: (a) => a.includes('iPhone') && a.includes('Galaxy') && a.includes('Pixel'),
  },
  {
    query: 'show me Audio',
    description: '4 audio products',
    expect: (a) => a.includes('AirPods') && a.includes('Sony') && a.includes('Bose') && a.includes('JBL'),
  },
  {
    query: 'show me Wearables',
    description: '3 wearables',
    expect: (a) => a.includes('Apple Watch') && a.includes('Galaxy Watch'),
  },
  {
    query: 'show me Cameras',
    description: '2 cameras',
    expect: (a) => a.includes('Canon') && a.includes('DJI'),
  },

  // GRADE FILTERING
  {
    query: 'grade A phones',
    description: 'iPhone 15 A, Galaxy S23 A; NOT iPhone 13 B',
    expect: (a) => a.includes('iPhone 15') && a.includes('Galaxy S23') && !a.includes('iPhone 13'),
  },
  {
    query: 'grade B gaming',
    description: 'Xbox B, Zelda B, Mario Kart B, Spider-Man 2 B',
    expect: (a) => a.includes('Xbox') && a.includes('Zelda'),
  },
  {
    query: 'grade C movies',
    description: 'Black Panther GC is only grade C movie',
    expect: (a) => a.includes('Black Panther') || a.includes('8.99'),
  },
  {
    query: 'grade A laptops',
    description: 'MacBook Air A £769, iPad A £319',
    expect: (a) => a.includes('MacBook Air') && a.includes('iPad'),
  },
  {
    query: 'grade F phones',
    description: 'iPhone 12 F £99 = 1 phone',
    expect: (a) => a.includes('iPhone 12'),
  },

  // GRADE + PRICE COMBOS
  {
    query: 'grade A phones under £400',
    description: 'Galaxy S23 A £389.99 only; NOT iPhone 15 A (£419.99)',
    expect: (a) => a.includes('Galaxy S23') && !a.includes('iPhone 15 · 128GB · Grade A'),
  },
  {
    query: 'grade B laptops',
    description: 'MacBook Pro 14 B £1299, HP EliteBook B £349',
    expect: (a) => a.includes('MacBook Pro') && a.includes('EliteBook'),
  },
  {
    query: 'grade A audio under £200',
    description: 'AirPods A £179, JBL A £89; NOT Sony B £199',
    expect: (a) => a.includes('AirPods') && a.includes('JBL') && !a.includes('Sony'),
  },
  {
    query: 'recommend me grade A gaming under £40',
    description: 'God of War A £34.99; NOT Spider-Man 2 B',
    expect: (a) => a.includes('God of War') && !a.includes('Spider-Man 2'),
  },

  // SORT + CATEGORY
  {
    query: 'cheapest smartphones',
    description: 'iPhone 12 F £99 is cheapest',
    expect: (a) => a.includes('iPhone 12') && a.includes('cheapest'),
  },
  {
    query: 'most expensive laptops',
    description: 'MacBook Pro 14 B £1299',
    expect: (a) => a.includes('MacBook Pro') && a.includes('most expensive'),
  },
  {
    query: 'cheapest gaming',
    description: 'Halo Infinite C £14.99 is cheapest',
    expect: (a) => a.includes('Halo') && a.includes('cheapest'),
  },
  {
    query: 'cheapest movies',
    description: 'Dark Knight B £7.99 is cheapest movie',
    expect: (a) => a.includes('Dark Knight') && a.includes('7.99') && a.includes('cheapest'),
  },

  // RECOMMEND + FILTERS
  {
    query: 'recommend me phones for under £200 that is a grade B',
    description: 'Grade B phones under £200: none (Pixel 7 B is £229.99)',
    expect: (a) => a.includes("don't have") || a.includes('no matching') || a.includes('none'),
  },
  {
    query: 'recommend me phones under £300',
    description: 'Should list phones under £300',
    expect: (a) => a.includes('iPhone') || a.includes('Galaxy') || a.includes('Pixel'),
  },

  // EDGE CASES
  {
    query: 'most expensive phone',
    description: 'iPhone 15 A £419.99',
    expect: (a) => a.includes('iPhone 15') || a.includes('419'),
  },
  {
    query: 'cheapest laptop',
    description: 'HP EliteBook B £349',
    expect: (a) => a.includes('EliteBook') || a.includes('349'),
  },
  {
    query: 'best value headphones',
    description: 'Should return headphones sorted by price',
    expect: (a) => a.includes('Bose') || a.includes('JBL') || a.includes('Sony') || a.includes('AirPods'),
  },
]

let passed = 0
let failed = 0

for (const tc of cases) {
  const r = catalogAnswer(tc.query, seedProducts, seedCategories)
  const hits = retrieveProducts(seedProducts, seedCategories, tc.query, 10)
  const answer = r?.message ?? ''
  const ok = tc.expect(answer)
  const icon = ok ? '\u2705' : '\u274c'
  console.log(`${icon} "${tc.query}"`)
  console.log(`   Expected: ${tc.description}`)
  console.log(`   Answer: ${answer.slice(0, 250)}`)
  if (r?.correctedQuery) console.log(`   Corrected: ${r.correctedQuery}`)
  if (!ok) {
    console.log('   >>> FAILED')
    failed++
  } else {
    passed++
  }
  console.log()
}

console.log(`=== ${passed} passed, ${failed} failed / ${cases.length} total ===`)

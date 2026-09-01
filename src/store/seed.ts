import type { Category, Product, Customer, Sale, PaymentMethod, KnowledgeDoc, AiSkill, Till } from '../types'
import { uid } from '../utils/format'

const now = Date.now()
const DAY = 86400000

export const seedCategories: Category[] = [
  { id: 'cat-phones', name: 'Smartphones', color: '#0ea5e9' },
  { id: 'cat-computers', name: 'Laptops & Tablets', color: '#6366f1' },
  { id: 'cat-audio', name: 'Audio & Headphones', color: '#f59e0b' },
  { id: 'cat-wearables', name: 'Wearables', color: '#10b981' },
  { id: 'cat-gaming', name: 'Gaming', color: '#8b5cf6' },
  { id: 'cat-cameras', name: 'Cameras & Drones', color: '#ef4444' },
  { id: 'cat-movies', name: 'Media/Movies', color: '#e11d48' }
]

const emoji = (e: string) =>
  `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%23f1f5f9'/><text x='50' y='62' font-size='46' text-anchor='middle'>${e}</text></svg>`

/** Refurb condition blurb shown as the product description. */
const refurb = (grade: string, detail: string) => `Refurbished · Grade ${grade} · ${detail} · 12-mo warranty`

export const seedProducts: Product[] = [
  // ── Smartphones ────────────────────────────────────────────────────────────
  { id: uid(), sku: 'PH-001', name: 'iPhone 15 · 128GB', description: refurb('A', 'Unlocked · 100-pt inspection'), categoryId: 'cat-phones', grade: 'A', price: 419.99, cost: 260, stock: 12, lowStockThreshold: 4, image: emoji('📱'), createdAt: now - 60 * DAY },
  { id: uid(), sku: 'PH-002', name: 'iPhone 15 · 128GB', description: refurb('C', 'Unlocked · battery ≥ 80%'), categoryId: 'cat-phones', grade: 'C', price: 349.99, cost: 210, stock: 6, lowStockThreshold: 3, image: emoji('📱'), createdAt: now - 30 * DAY },
  { id: uid(), sku: 'PH-003', name: 'iPhone 13 · 128GB', description: refurb('B', 'Unlocked · light wear'), categoryId: 'cat-phones', grade: 'B', price: 269.99, cost: 160, stock: 9, lowStockThreshold: 3, image: emoji('📱'), createdAt: now - 120 * DAY },
  { id: uid(), sku: 'PH-004', name: 'Galaxy S23 · 256GB', description: refurb('A', 'Unlocked · like new'), categoryId: 'cat-phones', grade: 'A', price: 389.99, cost: 240, stock: 7, lowStockThreshold: 3, image: emoji('📱'), createdAt: now - 45 * DAY },
  { id: uid(), sku: 'PH-005', name: 'Galaxy S22 · 128GB', description: refurb('D', 'Unlocked · scuffs, works fine'), categoryId: 'cat-phones', grade: 'D', price: 179.99, cost: 100, stock: 3, lowStockThreshold: 2, image: emoji('📱'), createdAt: now - 200 * DAY },
  { id: uid(), sku: 'PH-006', name: 'Pixel 7 · 128GB', description: refurb('B', 'Unlocked · light wear'), categoryId: 'cat-phones', grade: 'B', price: 229.99, cost: 140, stock: 5, lowStockThreshold: 2, image: emoji('📱'), createdAt: now - 90 * DAY },
  { id: uid(), sku: 'PH-007', name: 'iPhone 12 · 64GB', description: refurb('F', 'For parts · not fully tested'), categoryId: 'cat-phones', grade: 'F', price: 99.0, cost: 50, stock: 4, lowStockThreshold: 2, image: emoji('📱'), createdAt: now - 300 * DAY },

  // ── Laptops & Tablets ──────────────────────────────────────────────────────
  { id: uid(), sku: 'CO-001', name: 'MacBook Air M2 · 13"', description: refurb('A', '8GB / 256GB · battery ≥ 90%'), categoryId: 'cat-computers', grade: 'A', price: 769.0, cost: 520, stock: 4, lowStockThreshold: 2, image: emoji('💻'), createdAt: now - 10 * DAY },
  { id: uid(), sku: 'CO-002', name: 'MacBook Air M2 · 13"', description: refurb('C', '8GB / 256GB · visible wear'), categoryId: 'cat-computers', grade: 'C', price: 619.0, cost: 400, stock: 2, lowStockThreshold: 1, image: emoji('💻'), createdAt: now - 60 * DAY },
  { id: uid(), sku: 'CO-003', name: 'MacBook Pro 14" · M3', description: refurb('B', '16GB / 512GB · light wear'), categoryId: 'cat-computers', grade: 'B', price: 1299.0, cost: 900, stock: 3, lowStockThreshold: 1, image: emoji('💻'), createdAt: now - 20 * DAY },
  { id: uid(), sku: 'CO-004', name: 'iPad 10th gen · 64GB', description: refurb('A', 'Wi-Fi · like new'), categoryId: 'cat-computers', grade: 'A', price: 319.0, cost: 200, stock: 8, lowStockThreshold: 3, image: emoji('📲'), createdAt: now - 40 * DAY },
  { id: uid(), sku: 'CO-005', name: 'HP EliteBook 840 G8', description: refurb('B', 'i5 · 16GB / 512GB · business grade'), categoryId: 'cat-computers', grade: 'B', price: 349.0, cost: 210, stock: 6, lowStockThreshold: 2, image: emoji('💻'), createdAt: now - 150 * DAY },

  // ── Audio & Headphones ─────────────────────────────────────────────────────
  { id: uid(), sku: 'AU-001', name: 'AirPods Pro 2', description: refurb('A', 'USB-C case · like new'), categoryId: 'cat-audio', grade: 'A', price: 179.0, cost: 110, stock: 15, lowStockThreshold: 5, image: emoji('🎧'), createdAt: now - 7 * DAY },
  { id: uid(), sku: 'AU-002', name: 'Sony WH-1000XM4', description: refurb('B', 'ANC · light wear'), categoryId: 'cat-audio', grade: 'B', price: 199.0, cost: 120, stock: 10, lowStockThreshold: 4, image: emoji('🎧'), createdAt: now - 80 * DAY },
  { id: uid(), sku: 'AU-003', name: 'Bose QC45', description: refurb('C', 'ANC · visible wear'), categoryId: 'cat-audio', grade: 'C', price: 169.0, cost: 95, stock: 4, lowStockThreshold: 2, image: emoji('🎧'), createdAt: now - 100 * DAY },
  { id: uid(), sku: 'AU-004', name: 'JBL Flip 6', description: refurb('A', 'Waterproof · like new'), categoryId: 'cat-audio', grade: 'A', price: 89.0, cost: 50, stock: 12, lowStockThreshold: 4, image: emoji('🔊'), createdAt: now - 70 * DAY },

  // ── Wearables ──────────────────────────────────────────────────────────────
  { id: uid(), sku: 'WE-001', name: 'Apple Watch S9 · 45mm', description: refurb('A', 'GPS + Cellular · like new'), categoryId: 'cat-wearables', grade: 'A', price: 279.0, cost: 170, stock: 6, lowStockThreshold: 2, image: emoji('⌚'), createdAt: now - 5 * DAY },
  { id: uid(), sku: 'WE-002', name: 'Apple Watch SE', description: refurb('B', '40mm GPS · light wear'), categoryId: 'cat-wearables', grade: 'B', price: 169.0, cost: 100, stock: 8, lowStockThreshold: 3, image: emoji('⌚'), createdAt: now - 90 * DAY },
  { id: uid(), sku: 'WE-003', name: 'Galaxy Watch 6 · 40mm', description: refurb('C', 'Bluetooth · visible wear'), categoryId: 'cat-wearables', grade: 'C', price: 129.0, cost: 70, stock: 5, lowStockThreshold: 2, image: emoji('⌚'), createdAt: now - 130 * DAY },

  // ── Gaming ─────────────────────────────────────────────────────────────────
  { id: uid(), sku: 'GA-001', name: 'PS5 Disc Edition', description: refurb('A', '1 controller · like new'), categoryId: 'cat-gaming', grade: 'A', price: 349.0, cost: 230, stock: 4, lowStockThreshold: 2, image: emoji('🎮'), createdAt: now - 15 * DAY },
  { id: uid(), sku: 'GA-002', name: 'Xbox Series S', description: refurb('B', '512GB · light wear'), categoryId: 'cat-gaming', grade: 'B', price: 189.0, cost: 110, stock: 7, lowStockThreshold: 2, image: emoji('🎮'), createdAt: now - 55 * DAY },
  { id: uid(), sku: 'GA-003', name: 'Nintendo Switch OLED', description: refurb('C', 'Joy-Cons · visible wear'), categoryId: 'cat-gaming', grade: 'C', price: 229.0, cost: 150, stock: 5, lowStockThreshold: 2, image: emoji('🕹️'), createdAt: now - 75 * DAY },

  // ── Video games (physical) ─────────────────────────────────────────────────
  { id: uid(), sku: 'GA-004', name: 'Zelda: Tears of the Kingdom', description: refurb('B', 'Switch · case & cart, light wear'), categoryId: 'cat-gaming', grade: 'B', price: 39.99, cost: 24, stock: 6, lowStockThreshold: 2, image: emoji('🎮'), createdAt: now - 25 * DAY },
  { id: uid(), sku: 'GA-005', name: 'Mario Kart 8 Deluxe', description: refurb('B', 'Switch · case & cart, light wear'), categoryId: 'cat-gaming', grade: 'B', price: 34.99, cost: 20, stock: 9, lowStockThreshold: 3, image: emoji('🎮'), createdAt: now - 40 * DAY },
  { id: uid(), sku: 'GA-006', name: 'Animal Crossing: New Horizons', description: refurb('C', 'Switch · cart tested, marks on case'), categoryId: 'cat-gaming', grade: 'C', price: 29.99, cost: 16, stock: 5, lowStockThreshold: 2, image: emoji('🎮'), createdAt: now - 65 * DAY },
  { id: uid(), sku: 'GA-007', name: 'Super Mario Odyssey', description: refurb('C', 'Switch · cart tested, case wear'), categoryId: 'cat-gaming', grade: 'C', price: 24.99, cost: 13, stock: 4, lowStockThreshold: 2, image: emoji('🎮'), createdAt: now - 85 * DAY },
  { id: uid(), sku: 'GA-008', name: 'God of War Ragnarök', description: refurb('A', 'PS5 · disc, like new'), categoryId: 'cat-gaming', grade: 'A', price: 34.99, cost: 20, stock: 7, lowStockThreshold: 2, image: emoji('💿'), createdAt: now - 12 * DAY },
  { id: uid(), sku: 'GA-009', name: 'Spider-Man 2', description: refurb('B', 'PS5 · disc, light wear'), categoryId: 'cat-gaming', grade: 'B', price: 29.99, cost: 17, stock: 8, lowStockThreshold: 3, image: emoji('💿'), createdAt: now - 35 * DAY },
  { id: uid(), sku: 'GA-010', name: 'Elden Ring', description: refurb('C', 'PS5 · disc, case wear'), categoryId: 'cat-gaming', grade: 'C', price: 27.99, cost: 15, stock: 5, lowStockThreshold: 2, image: emoji('💿'), createdAt: now - 95 * DAY },
  { id: uid(), sku: 'GA-011', name: 'Halo Infinite', description: refurb('C', 'Xbox · disc, case wear'), categoryId: 'cat-gaming', grade: 'C', price: 14.99, cost: 8, stock: 6, lowStockThreshold: 2, image: emoji('💿'), createdAt: now - 120 * DAY },

  // ── Cameras & Drones ───────────────────────────────────────────────────────
  { id: uid(), sku: 'CM-001', name: 'Canon EOS R50', description: refurb('A', 'Body + 18-45mm kit lens'), categoryId: 'cat-cameras', grade: 'A', price: 529.0, cost: 360, stock: 3, lowStockThreshold: 1, image: emoji('📷'), createdAt: now - 35 * DAY },
  { id: uid(), sku: 'CM-002', name: 'DJI Mini 3', description: refurb('B', 'RC-N1 remote · light wear'), categoryId: 'cat-cameras', grade: 'B', price: 339.0, cost: 220, stock: 2, lowStockThreshold: 1, image: emoji('🚁'), createdAt: now - 110 * DAY },

  // ── Media / Movies ────────────────────────────────────────────────────────
  { id: uid(), sku: 'MV-001', name: 'Spider-Man: No Way Home', description: 'Blu-ray · starring Tom Holland, Zendaya, Benedict Cumberbatch · multiverse superhero action · 2021 · Grade A', categoryId: 'cat-movies', grade: 'A', price: 14.99, cost: 7, stock: 8, lowStockThreshold: 3, image: emoji('🎬'), createdAt: now - 20 * DAY },
  { id: uid(), sku: 'MV-002', name: 'Oppenheimer', description: '4K UHD Blu-ray · starring Cillian Murphy, Emily Blunt, Robert Downey Jr. · historical drama · 2023 · Grade A', categoryId: 'cat-movies', grade: 'A', price: 19.99, cost: 10, stock: 5, lowStockThreshold: 2, image: emoji('🎬'), createdAt: now - 15 * DAY },
  { id: uid(), sku: 'MV-003', name: 'The Batman', description: 'Blu-ray · starring Robert Pattinson, Zoë Kravitz, Paul Dano · superhero noir · 2022 · Grade B', categoryId: 'cat-movies', grade: 'B', price: 12.99, cost: 6, stock: 6, lowStockThreshold: 2, image: emoji('🎬'), createdAt: now - 45 * DAY },
  { id: uid(), sku: 'MV-004', name: 'Dune: Part Two', description: '4K UHD Blu-ray · starring Timothée Chalamet, Zendaya, Austin Butler · sci-fi epic · 2024 · Grade A', categoryId: 'cat-movies', grade: 'A', price: 21.99, cost: 12, stock: 4, lowStockThreshold: 2, image: emoji('🎬'), createdAt: now - 10 * DAY },
  { id: uid(), sku: 'MV-005', name: 'Interstellar', description: 'Blu-ray · starring Matthew McConaughey, Anne Hathaway, Jessica Chastain · sci-fi drama · 2014 · Grade B', categoryId: 'cat-movies', grade: 'B', price: 9.99, cost: 4, stock: 10, lowStockThreshold: 3, image: emoji('🎬'), createdAt: now - 60 * DAY },
  { id: uid(), sku: 'MV-006', name: 'Barbie', description: 'Blu-ray · starring Margot Robbie, Ryan Gosling · comedy fantasy · 2023 · Grade A', categoryId: 'cat-movies', grade: 'A', price: 13.99, cost: 7, stock: 7, lowStockThreshold: 3, image: emoji('🎬'), createdAt: now - 30 * DAY },
  { id: uid(), sku: 'MV-007', name: 'John Wick: Chapter 4', description: '4K UHD Blu-ray · starring Keanu Reeves, Donnie Yen, Bill Skarsgård · action thriller · 2023 · Grade A', categoryId: 'cat-movies', grade: 'A', price: 18.99, cost: 9, stock: 5, lowStockThreshold: 2, image: emoji('🎬'), createdAt: now - 25 * DAY },
  { id: uid(), sku: 'MV-008', name: 'Everything Everywhere All at Once', description: 'Blu-ray · starring Michelle Yeoh, Ke Huy Quan, Stephanie Hsu · sci-fi action comedy · 2022 · Grade A', categoryId: 'cat-movies', grade: 'A', price: 11.99, cost: 5, stock: 6, lowStockThreshold: 2, image: emoji('🎬'), createdAt: now - 40 * DAY },
  { id: uid(), sku: 'MV-009', name: 'Top Gun: Maverick', description: 'Blu-ray · starring Tom Cruise, Miles Teller, Jennifer Connelly · action drama · 2022 · Grade B', categoryId: 'cat-movies', grade: 'B', price: 10.99, cost: 5, stock: 9, lowStockThreshold: 3, image: emoji('🎬'), createdAt: now - 55 * DAY },
  { id: uid(), sku: 'MV-010', name: 'Black Panther: Wakanda Forever', description: 'Blu-ray · starring Letitia Wright, Angela Bassett, Tenoch Huerta · superhero action · 2022 · Grade C', categoryId: 'cat-movies', grade: 'C', price: 8.99, cost: 3, stock: 4, lowStockThreshold: 2, image: emoji('🎬'), createdAt: now - 90 * DAY },
  { id: uid(), sku: 'MV-011', name: 'Glass Onion: A Knives Out Mystery', description: 'Blu-ray · starring Daniel Craig, Edward Norton, Janelle Monáe · mystery comedy · 2022 · Grade A', categoryId: 'cat-movies', grade: 'A', price: 12.99, cost: 6, stock: 5, lowStockThreshold: 2, image: emoji('🎬'), createdAt: now - 35 * DAY },
  { id: uid(), sku: 'MV-012', name: 'The Dark Knight', description: 'Blu-ray · starring Christian Bale, Heath Ledger, Aaron Eckhart · superhero crime drama · 2008 · Grade B', categoryId: 'cat-movies', grade: 'B', price: 7.99, cost: 3, stock: 12, lowStockThreshold: 4, image: emoji('🎬'), createdAt: now - 120 * DAY },
  { id: uid(), sku: 'MV-013', name: 'Guardians of the Galaxy Vol. 3', description: 'Blu-ray · starring Chris Pratt, Zoe Saldaña, Dave Bautista · sci-fi comedy action · 2023 · Grade A', categoryId: 'cat-movies', grade: 'A', price: 14.99, cost: 7, stock: 6, lowStockThreshold: 2, image: emoji('🎬'), createdAt: now - 18 * DAY },
  { id: uid(), sku: 'MV-014', name: 'Puss in Boots: The Last Wish', description: 'Blu-ray · starring Antonio Banderas, Salma Hayek, Florence Pugh · animated adventure · 2022 · Grade A', categoryId: 'cat-movies', grade: 'A', price: 11.99, cost: 5, stock: 8, lowStockThreshold: 3, image: emoji('🎬'), createdAt: now - 50 * DAY },
  { id: uid(), sku: 'MV-015', name: 'Killers of the Flower Moon', description: '4K UHD Blu-ray · starring Leonardo DiCaprio, Robert De Niro, Lily Gladstone · crime drama · 2023 · Grade A', categoryId: 'cat-movies', grade: 'A', price: 19.99, cost: 10, stock: 3, lowStockThreshold: 1, image: emoji('🎬'), createdAt: now - 8 * DAY }
].map((p: Product): Product => ({
  ...p,
  buyPrice: p.buyPrice ?? Math.round(p.cost * 0.9 * 100) / 100,
  exchangePrice: p.exchangePrice ?? Math.round(p.price * 0.85 * 100) / 100,
  requiresSerial:
    p.requiresSerial ??
    (p.categoryId === 'cat-phones' ||
      p.categoryId === 'cat-computers' ||
      p.categoryId === 'cat-wearables' ||
      p.categoryId === 'cat-cameras' ||
      (p.categoryId === 'cat-gaming' && /Console|OLED|Series|PS5|Xbox/.test(p.name)))
}))

/** Default tills — banking starts closed; staff must open a till before checkout. */
export const seedTills: Till[] = [
  { id: uid(), name: 'Till 1 · Front', status: 'closed', openingFloat: 0 },
  { id: uid(), name: 'Till 2 · Counter', status: 'closed', openingFloat: 0 }
]

export const seedCustomers: Customer[] = [
  { id: uid(), name: 'Walk-in Customer', phone: '', email: '', balance: 0, notes: '', createdAt: now },
  { id: uid(), name: 'Amelia Hart', phone: '+1 555-0142', email: 'amelia@example.com', balance: 0, notes: 'Trades in her phone each cycle · upgrades to latest Apple', createdAt: now },
  { id: uid(), name: 'Liam Chen', phone: '+1 555-0177', email: 'liam@example.com', balance: 14.75, notes: 'Budget buyer · repairs and flips older devices · pays by store credit', createdAt: now },
  { id: uid(), name: 'Sofia Reyes', phone: '+1 555-0193', email: 'sofia@example.com', balance: 0, notes: 'VIP · premium Apple gear, buys grade A/B only', createdAt: now },
  { id: uid(), name: 'Noah Patel', phone: '+1 555-0110', email: 'noah@example.com', balance: 6.2, notes: 'Audio & accessories · exchanges items often', createdAt: now }
]

/**
 * Per-customer buying personas (keyed by SKU). Used to generate realistic,
 * distinct purchase histories so the AI can answer "last purchase of <customer>"
 * and recommend products that match each customer's preferences.
 */
const CUSTOMER_PREFS: Record<string, string[]> = {
  'Amelia Hart': ['PH-001', 'PH-003', 'PH-004', 'CO-001', 'WE-001', 'GA-001', 'GA-008'],
  'Liam Chen': ['CO-005', 'PH-007', 'PH-005', 'AU-004', 'CO-002', 'CM-002', 'GA-011'],
  'Sofia Reyes': ['CO-003', 'PH-001', 'WE-001', 'AU-001', 'CO-004', 'CM-001', 'GA-009'],
  'Noah Patel': ['AU-004', 'GA-003', 'PH-006', 'AU-002', 'WE-003', 'GA-004', 'GA-005']
}

export const seedKnowledge: KnowledgeDoc[] = [
  {
    id: uid(),
    title: 'Store policies',
    content: `We sell refurbished electronics only — no new items. Every device is inspected, tested, and given a condition grade from A to F:
- Grade A: Excellent, like new
- Grade B: Very good, light wear
- Grade C: Good, visible wear, fully tested
- Grade D: Fair, noticeable marks, fully working
- Grade E: Poor, heavy wear, fully working
- Grade F: For parts, not fully tested

Buy: sell any device with a valid grade. We grade items on intake before they can be listed.
Sell: customers can buy any in-stock graded device from the POS.
Exchange: customers can trade in a working device and get store credit toward another item. Select the customer at checkout and choose Store Credit as the payment method — the trade-in value is added to their balance.

Returns: devices can be returned within 30 days with the original receipt. All sales include a 12-month warranty.`,
    updatedAt: now
  },
  {
    id: uid(),
    title: 'Daily operations',
    content: `Start of day: check the Dashboard for low-stock alerts and restock anything below its threshold using the Inventory page.

Grading intake: when a device comes in, test it (screen, battery, buttons, camera), assign a grade A-F, then add it as a product with that grade and a refurbished price.

Checkout: tap products to add them to the cart, adjust quantities, attach a customer if paying by store credit or processing an exchange, then choose a payment method and press Charge. A receipt prints automatically and can be reprinted from the Sales page.

End of day: review Sales for the day's revenue and tax collected. Reconcile cash drawer against the Cash payments shown in the report.`,
    updatedAt: now
  }
]

export const seedSkills: AiSkill[] = [
  {
    id: uid(),
    title: 'Banking Variance Analysis',
    enabled: true,
    content: JSON.stringify({
      description: 'Analyses cash variances at till close. Identifies which orders may have caused the discrepancy by examining refunds, change-given, buy-backs, and exchange transactions on the current till.',
      patterns: ['variance', 'short', 'over', 'up by', 'down by', 'cash discrepancy', 'cash is', 'cash seems', 'drawer', 'till is', 'till short', 'till over', 'counted', 'banking', 'reconcil'],
      categories: ['cash', 'refund', 'change', 'buy-back', 'exchange'],
      templates: {
        header: 'Banking analysis for {tillName} ({timeRange}):',
        summary: 'Expected cash: {openingFloat} (float) + {cashSalesTotal} (cash sales) = {expectedCash}.\nCounted: {countedCash} — {varianceDirection} {varianceAmount}.',
        noVariance: 'Your till ({tillName}) is balanced — no variance detected. Expected and counted cash both equal {expectedCash}.',
        refundLine: '• {receiptNo}: {itemName} — {amount} refunded in cash (reduces drawer)',
        changeLine: '• {receiptNo}: {itemName} — paid {paid} for {total} order ({change} change given)',
        buybackLine: '• {receiptNo}: Bought {itemName} from customer for {amount} (cash leaves drawer)',
        exchangeLine: '• {receiptNo}: Exchange — {itemName} traded in for {tradeValue} credit',
        mixedPaymentLine: '• {receiptNo}: {itemName} — paid {paid} via {paymentSummary} ({cashPortion} cash portion)',
        sectionRefunds: 'Cash refunds (reduce expected cash):',
        sectionChange: 'Change given on these orders:',
        sectionBuybacks: 'Store buy-backs (cash leaves drawer):',
        sectionExchanges: 'Exchange transactions:',
        sectionMixed: 'Split payments with cash component:',
        volumeNote: 'High cash volume ({txnCount} transactions totalling {cashTotal}) — variance may be from accumulated rounding across multiple orders rather than a single error.',
        recommendRecount: 'Recommendation: recount your notes carefully, especially {denomination} notes. Check if any note was counted twice or if change was under/over-given.',
        recommendCheckChange: 'Recommendation: verify the change given on the flagged orders above. Incorrect change is the most common cause of cash variance.'
      },
      systemPrompt: 'When a user asks about cash variance, drawer discrepancy, or till reconciliation, always list specific receipt numbers and amounts. Identify the most likely cause. Be concise and actionable.'
    }, null, 2),
    updatedAt: now
  }
]

export function buildSeedSales(products: Product[], customers: Customer[]): Sale[] {
  const sales: Sale[] = []
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
  const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

  const paymentPool: PaymentMethod[] = ['cash', 'card', 'upi', 'card', 'cash', 'upi', 'cash']

  const bySku = new Map(products.map((p) => [p.sku, p]))
  const namedCustomers = customers.filter((c) => c.name !== 'Walk-in Customer')

  const makeItems = (pool: Product[], itemCount: number) => {
    const chosen = new Set<string>()
    const items: Sale['items'] = []
    for (let j = 0; j < itemCount; j++) {
      const p = pick(pool)
      if (chosen.has(p.id)) continue
      chosen.add(p.id)
      items.push({ productId: p.id, name: p.name, price: p.price, qty: randInt(1, 3) })
    }
    return items
  }

  const pushSale = (items: Sale['items'], created: number, customerId?: string) => {
    if (items.length === 0) return
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0)
    const taxRate = 0.08
    const taxAmount = subtotal * taxRate
    const total = Math.round((subtotal + taxAmount) * 100) / 100
    const method = pick(paymentPool)
    const ts = new Date(created)
    ts.setMinutes(randInt(0, 59), randInt(0, 59), 0)
    sales.push({
      id: uid(),
      receiptNo: '',
      items,
      subtotal,
      discount: 0,
      taxRate,
      taxAmount,
      total,
      kind: 'sale',
      paymentMethod: method,
      customerId,
      cashReceived: method === 'cash' ? Math.ceil(total) : undefined,
      changeDue: method === 'cash' ? Math.round((Math.ceil(total) - total) * 100) / 100 : undefined,
      createdAt: ts.getTime()
    })
  }

  // Per-customer history: 10–14 purchases each, drawn mostly from their persona.
  for (const customer of namedCustomers) {
    const prefPool = (CUSTOMER_PREFS[customer.name] ?? [])
      .map((sku) => bySku.get(sku))
      .filter((p): p is Product => !!p)
    const randomPool = products.filter((p) => !prefPool.includes(p))
    const count = randInt(10, 14)
    for (let i = 0; i < count; i++) {
      const age = i === 0 ? 0 : (i / count) * 26 * 86400000
      const usePrefs = Math.random() < 0.75
      const pool = usePrefs && prefPool.length > 0 ? prefPool : randomPool
      const items = makeItems(pool, randInt(1, 4))
      pushSale(items, now - age - randInt(0, 20) * 3600000, customer.id)
    }
  }

  // Walk-in sales: no customer attached, fully random baskets.
  for (let i = 0; i < 25; i++) {
    const items = makeItems(products, randInt(1, 4))
    pushSale(items, now - randInt(0, 27) * 86400000 - randInt(0, 23) * 3600000)
  }

  const sorted = sales.sort((a, b) => a.createdAt - b.createdAt)
  sorted.forEach((s, i) => {
    s.receiptNo = String(1001 + i)
  })
  return sorted
}

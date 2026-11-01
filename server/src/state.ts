/**
 * Pure helpers that turn whatever the browser persisted into rows that are safe
 * to write with Prisma.
 *
 * The POS is an offline-first client: payloads can come from old backups, old
 * store versions, or have references to records the user deleted in another
 * tab. Prisma rejects the whole `createMany` batch for a single unknown field or
 * dangling foreign key, which used to make every later save fail silently.
 * Normalising here keeps one bad record from taking the whole store down.
 */

export type Obj = Record<string, unknown>

export interface NormalizedState {
  categories: Obj[]
  products: Obj[]
  customers: Obj[]
  sales: Obj[]
  vouchers: Obj[]
  knowledge: Obj[]
  skills: Obj[]
  tills: Obj[]
  savedCarts: Obj[]
  activeTillId: string | null
  settings: Obj | null
}

const DEFAULT_SETTINGS: Obj = {
  storeName: 'ReCEP',
  tagline: 'Buy · Sell · Exchange',
  currency: '$',
  taxRate: 0,
  receiptFooter: 'Thank you!',
  aiEnabled: true,
  browserModel: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
  kbEnabled: true,
  skillsEnabled: true,
}

export const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)

function text(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return fallback
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : fallback
}

function nullableNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function int(v: unknown, fallback = 0): number {
  return Math.trunc(num(v, fallback))
}

function nullableInt(v: unknown): number | null {
  const n = nullableNum(v)
  return n == null ? null : Math.trunc(n)
}

function bool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v
  if (v === 'true') return true
  if (v === 'false') return false
  return fallback
}

function nullableText(v: unknown): string | null {
  const s = text(v, '')
  return s === '' ? null : s
}

function timestamp(v: unknown, fallback = Date.now()): number {
  return Math.trunc(num(v, fallback))
}

function uniqueById(rows: Obj[], prefix: string): Obj[] {
  const seen = new Set<string>()
  const out: Obj[] = []
  rows.forEach((row, index) => {
    const id = text(row.id, '')
    if (!id || seen.has(id)) return
    seen.add(id)
    out.push({ ...row, id: id || `${prefix}-${index}` })
  })
  return out
}

function rows(v: unknown): Obj[] {
  return Array.isArray(v) ? v.filter(isObj) : []
}

export function normalizeSaleItems(v: unknown): Obj[] {
  return rows(v)
    .map((it) => ({
      productId: text(it.productId, ''),
      name: text(it.name, 'Item'),
      price: num(it.price),
      qty: Math.max(0, int(it.qty, 1)),
    }))
    .filter((it) => it.productId !== '')
}

function normalizePayments(v: unknown): Obj[] | null {
  if (!Array.isArray(v)) return null
  const out = rows(v)
    .map((p) => ({ method: text(p.method, 'cash'), amount: num(p.amount) }))
    .filter((p) => p.amount > 0)
  return out.length ? out : null
}

function normalizeSerials(v: unknown): Obj[] | null {
  if (!Array.isArray(v)) return null
  const out = rows(v)
    .map((s) => ({ productId: text(s.productId, ''), serial: text(s.serial, '') }))
    .filter((s) => s.productId !== '' && s.serial !== '')
  return out.length ? out : null
}

export function normalizeState(input: unknown): NormalizedState {
  const data = isObj(input) ? input : {}

  const categories = uniqueById(
    rows(data.categories).map((c) => ({
      id: text(c.id, ''),
      name: text(c.name, 'Uncategorised') || 'Uncategorised',
      color: text(c.color, '#64748b') || '#64748b',
    })),
    'cat'
  )
  const categoryIds = new Set(categories.map((c) => c.id as string))

  const products = uniqueById(
    rows(data.products).map((p) => ({
      id: text(p.id, ''),
      sku: text(p.sku, '') || `SKU-${text(p.id, '')}`,
      name: text(p.name, '') || 'Untitled product',
      description: text(p.description, ''),
      categoryId: categoryIds.has(text(p.categoryId, '')) ? text(p.categoryId, '') : null,
      grade: text(p.grade, 'A') || 'A',
      price: num(p.price),
      cost: num(p.cost),
      buyPrice: nullableNum(p.buyPrice),
      exchangePrice: nullableNum(p.exchangePrice),
      requiresSerial: bool(p.requiresSerial),
      stock: Math.max(0, int(p.stock)),
      lowStockThreshold: Math.max(0, int(p.lowStockThreshold)),
      image: text(p.image, ''),
      createdAt: timestamp(p.createdAt),
    })),
    'product'
  )

  const customers = uniqueById(
    rows(data.customers).map((c) => ({
      id: text(c.id, ''),
      name: text(c.name, '') || 'Walk-in Customer',
      phone: text(c.phone, ''),
      email: text(c.email, ''),
      balance: num(c.balance),
      notes: text(c.notes, ''),
      createdAt: timestamp(c.createdAt),
    })),
    'customer'
  )
  const customerIds = new Set(customers.map((c) => c.id as string))

  const usedReceipts = new Set<string>()
  let nextReceipt = rows(data.sales).reduce((max, s) => {
    const n = Number.parseInt(text(s.receiptNo, ''), 10)
    return Number.isFinite(n) ? Math.max(max, n) : max
  }, 1000) + 1

  const sales = uniqueById(
    rows(data.sales).map((s) => {
      const original = text(s.receiptNo, '').trim()
      let receiptNo = original || String(nextReceipt++)
      while (usedReceipts.has(receiptNo)) receiptNo = String(nextReceipt++)
      usedReceipts.add(receiptNo)
      const kind = text(s.kind, 'sale')
      return {
        id: text(s.id, ''),
        receiptNo,
        subtotal: num(s.subtotal),
        discount: num(s.discount),
        taxRate: num(s.taxRate),
        taxAmount: num(s.taxAmount),
        total: num(s.total),
        kind: ['sale', 'buy', 'exchange', 'refund'].includes(kind) ? kind : 'sale',
        paymentMethod: text(s.paymentMethod, 'cash') || 'cash',
        payments: normalizePayments(s.payments),
        serials: normalizeSerials(s.serials),
        customerId: customerIds.has(text(s.customerId, '')) ? text(s.customerId, '') : null,
        tillId: nullableText(s.tillId),
        cashReceived: nullableNum(s.cashReceived),
        changeDue: nullableNum(s.changeDue),
        refundedAt: nullableNum(s.refundedAt) == null ? null : Math.trunc(nullableNum(s.refundedAt) as number),
        originalSaleId: nullableText(s.originalSaleId),
        createdAt: timestamp(s.createdAt),
        items: normalizeSaleItems(s.items),
      }
    }),
    'sale'
  )

  const vouchers = uniqueById(
    rows(data.vouchers).map((v) => ({
      id: text(v.id, ''),
      code: text(v.code, '') || `GV-${text(v.id, '')}`,
      amount: num(v.amount),
      balance: num(v.balance),
      customerId: customerIds.has(text(v.customerId, '')) ? text(v.customerId, '') : null,
      createdAt: timestamp(v.createdAt),
    })),
    'voucher'
  )

  const knowledge = uniqueById(
    rows(data.knowledge).map((k) => ({
      id: text(k.id, ''),
      title: text(k.title, '') || 'Untitled document',
      content: text(k.content, ''),
      updatedAt: timestamp(k.updatedAt),
    })),
    'kb'
  )

  const skills = uniqueById(
    rows(data.skills).map((s) => ({
      id: text(s.id, ''),
      title: text(s.title, '') || 'Untitled skill',
      enabled: bool(s.enabled, true),
      content: text(s.content, ''),
      updatedAt: timestamp(s.updatedAt),
    })),
    'skill'
  )

  const tills = uniqueById(
    rows(data.tills).map((t) => {
      const status = text(t.status, 'closed')
      return {
        id: text(t.id, ''),
        name: text(t.name, '') || 'Till',
        status: status === 'open' ? 'open' : 'closed',
        openedAt: nullableInt(t.openedAt),
        openedBy: nullableText(t.openedBy),
        openingFloat: num(t.openingFloat),
        closedAt: nullableInt(t.closedAt),
        closedBy: nullableText(t.closedBy),
        expectedCash: nullableNum(t.expectedCash),
        countedCash: nullableNum(t.countedCash),
        variance: nullableNum(t.variance),
        shortageReason: nullableText(t.shortageReason),
        managerTag: nullableText(t.managerTag),
      }
    }),
    'till'
  )

  const savedCarts = uniqueById(
    rows(data.savedCarts).map((c) => ({
      id: text(c.id, ''),
      items: Array.isArray(c.items) ? c.items.filter(isObj) : [],
      customerId: customerIds.has(text(c.customerId, '')) ? text(c.customerId, '') : null,
      discount: num(c.discount),
      createdAt: timestamp(c.createdAt),
    })),
    'cart'
  )

  let settings: Obj | null = null
  const activeTillId = nullableText(data.activeTillId)
  if (isObj(data.settings) || activeTillId) {
    const s = isObj(data.settings) ? data.settings : {}
    settings = {
      storeName: text(s.storeName, '') || String(DEFAULT_SETTINGS.storeName),
      tagline: text(s.tagline, '') || String(DEFAULT_SETTINGS.tagline),
      currency: text(s.currency, '') || String(DEFAULT_SETTINGS.currency),
      taxRate: num(s.taxRate),
      receiptFooter: text(s.receiptFooter, String(DEFAULT_SETTINGS.receiptFooter)),
      aiEnabled: bool(s.aiEnabled, true),
      browserModel: text(s.browserModel, '') || String(DEFAULT_SETTINGS.browserModel),
      kbEnabled: bool(s.kbEnabled, true),
      skillsEnabled: bool(s.skillsEnabled, true),
      activeTillId,
    }
  }

  return { categories, products, customers, sales, vouchers, knowledge, skills, tills, savedCarts, activeTillId, settings }
}

/** Convert normalised numeric timestamps into the BigInt columns Prisma expects. */
export function toTableRows(state: NormalizedState) {
  return {
    categories: state.categories,
    products: state.products.map((p) => ({ ...p, createdAt: BigInt(p.createdAt as number) })),
    customers: state.customers.map((c) => ({ ...c, createdAt: BigInt(c.createdAt as number) })),
    sales: state.sales.map(({ items, ...sale }) => ({
      ...sale,
      createdAt: BigInt(sale.createdAt as number),
      refundedAt: sale.refundedAt == null ? null : BigInt(sale.refundedAt as number),
      items: items as Obj[],
    })),
    vouchers: state.vouchers.map((v) => ({ ...v, createdAt: BigInt(v.createdAt as number) })),
    knowledge: state.knowledge.map((k) => ({ ...k, updatedAt: BigInt(k.updatedAt as number) })),
    skills: state.skills.map((s) => ({ ...s, updatedAt: BigInt(s.updatedAt as number) })),
    tills: state.tills.map((t) => ({
      ...t,
      openedAt: t.openedAt == null ? null : BigInt(t.openedAt as number),
      closedAt: t.closedAt == null ? null : BigInt(t.closedAt as number),
    })),
    savedCarts: state.savedCarts.map((c) => ({ ...c, createdAt: BigInt(c.createdAt as number) })),
    settings: state.settings,
  }
}

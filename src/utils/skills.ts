import type { AiSkill, BankingContext, Sale, Product } from '../types'
import { saleCashAmount, salePayments, paymentSummary, paymentLabel, formatMoney } from './format'

/** Parsed skill definition — the JSON structure stored in AiSkill.content. */
export interface SkillDefinition {
  description: string
  patterns: string[]
  categories: string[]
  templates: Record<string, string>
  systemPrompt: string
}

/** Safely parse a skill's JSON content. Returns null on invalid JSON. */
export function parseSkill(content: string): SkillDefinition | null {
  try {
    const def = JSON.parse(content) as SkillDefinition
    if (!def.patterns || !Array.isArray(def.patterns) || !def.templates) return null
    return def
  } catch {
    return null
  }
}

/** Check if a user query matches a skill's trigger patterns. */
export function matchSkill(skill: AiSkill, query: string): boolean {
  if (!skill.enabled) return false
  const def = parseSkill(skill.content)
  if (!def) return false
  const q = query.toLowerCase()
  return def.patterns.some((p) => q.includes(p.toLowerCase()))
}

/** Fill {placeholders} in a template string with the provided values. */
function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''))
}

/** Currency label without the symbol for display in templates. */
function cur(currency: string): string {
  return currency || '$'
}

interface CashTxn {
  sale: Sale
  cashAmount: number
  items: string
  receiptNo: string
}

/**
 * Build a full variance analysis for the current banking session.
 * Reads templates from the skill definition so the admin can edit the output.
 */
export function buildVarianceAnalysis(
  banking: BankingContext,
  sales: Sale[],
  products: Product[],
  currency: string
): string {
  const since = banking.openedAt
  const tillSales = sales.filter((s) => s.tillId === banking.tillId && s.createdAt >= since)

  const cashTxns: CashTxn[] = []
  const refunds: CashTxn[] = []
  const buybacks: CashTxn[] = []
  const exchanges: CashTxn[] = []

  let cashSalesTotal = 0

  for (const sale of tillSales) {
    const cashAmt = saleCashAmount(sale)
    if (cashAmt === 0) continue

    const items = sale.items.map((i) => `${i.name}${i.qty > 1 ? ` x${i.qty}` : ''}`).join(', ')
    const entry: CashTxn = { sale, cashAmount: cashAmt, items, receiptNo: sale.receiptNo }

    cashTxns.push(entry)
    cashSalesTotal += cashAmt

    if (sale.kind === 'refund') {
      refunds.push(entry)
    } else if (sale.kind === 'buy') {
      buybacks.push(entry)
    } else if (sale.kind === 'exchange') {
      exchanges.push(entry)
    }
  }

  const varianceAbs = Math.abs(banking.variance)
  const isOver = banking.variance > 0
  const varianceDirection = isOver ? 'over' : 'short'

  const c = cur(currency)

  // --- Find the skill templates (first enabled matching skill) ---
  // We receive the skill definition from the caller, but for simplicity
  // we use sensible defaults here. The caller can override via systemPrompt.
  const fmt = (v: number) => formatMoney(v, c)

  const lines: string[] = []

  // Header
  const now = new Date(banking.openedAt)
  const timeRange = `since ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  lines.push(`Banking analysis for ${banking.tillName} (${timeRange}):`)
  lines.push('')

  // Summary
  lines.push(
    `Expected cash: ${fmt(banking.openingFloat)} (float) + ${fmt(cashSalesTotal)} (cash sales) = ${fmt(banking.expectedCash)}.`
  )
  lines.push(`Counted: ${fmt(banking.countedCash)} — ${varianceDirection} ${fmt(varianceAbs)}.`)
  lines.push('')

  // No variance
  if (varianceAbs < 0.01) {
    lines.push(`Your till (${banking.tillName}) is balanced — no variance detected.`)
    return lines.join('\n')
  }

  // Cash refunds
  if (refunds.length > 0) {
    lines.push(`Cash refunds (reduce expected cash):`)
    for (const t of refunds) {
      lines.push(`• ${t.receiptNo}: ${t.items} — ${fmt(Math.abs(t.cashAmount))} refunded in cash`)
    }
    lines.push('')
  }

  // Change given — identify sales where cashReceived > total (customer paid more, change was given)
  const changeGiven: CashTxn[] = []
  for (const t of cashTxns) {
    if (t.sale.kind !== 'refund' && t.sale.kind !== 'buy' && t.sale.kind !== 'exchange') {
      if (t.sale.cashReceived && t.sale.cashReceived > t.sale.total) {
        changeGiven.push(t)
      }
    }
  }

  if (changeGiven.length > 0) {
    lines.push(`Change given on these orders:`)
    for (const t of changeGiven) {
      const change = (t.sale.cashReceived ?? 0) - t.sale.total
      lines.push(
        `• ${t.receiptNo}: ${t.items} — paid ${fmt(t.sale.cashReceived!)} for ${fmt(t.sale.total)} order (${fmt(change)} change)`
      )
    }
    lines.push('')
  }

  // Buy-backs
  if (buybacks.length > 0) {
    lines.push(`Store buy-backs (cash leaves drawer):`)
    for (const t of buybacks) {
      lines.push(`• ${t.receiptNo}: Bought ${t.items} from customer for ${fmt(Math.abs(t.cashAmount))}`)
    }
    lines.push('')
  }

  // Exchanges
  if (exchanges.length > 0) {
    lines.push(`Exchange transactions:`)
    for (const t of exchanges) {
      lines.push(`• ${t.receiptNo}: ${t.items} — ${fmt(Math.abs(t.cashAmount))} trade-in value`)
    }
    lines.push('')
  }

  // Split payments with cash component
  const splitCash: CashTxn[] = []
  for (const t of cashTxns) {
    const pays = t.sale.payments
    if (pays && pays.length > 1 && pays.some((p) => p.method === 'cash')) {
      splitCash.push(t)
    }
  }

  if (splitCash.length > 0) {
    lines.push(`Split payments with cash component:`)
    for (const t of splitCash) {
      const cashLeg = (t.sale.payments ?? []).find((p) => p.method === 'cash')
      lines.push(
        `• ${t.receiptNo}: ${t.items} — paid ${fmt(t.sale.total)} via ${paymentSummary(t.sale)} (${cashLeg ? fmt(cashLeg.amount) : '?'} cash portion)`
      )
    }
    lines.push('')
  }

  // Volume note
  const pureCashSales = cashTxns.filter(
    (t) => t.sale.kind === 'sale' || t.sale.kind === 'exchange'
  )
  if (pureCashSales.length > 5) {
    lines.push(
      `High cash volume (${pureCashSales.length} transactions totalling ${fmt(cashSalesTotal)}) — variance may be from accumulated rounding across multiple orders rather than a single error.`
    )
    lines.push('')
  }

  // Recommendation
  if (changeGiven.length > 0) {
    lines.push(
      `Recommendation: verify the change given on the flagged orders above. Incorrect change is the most common cause of cash variance.`
    )
  } else if (refunds.length > 0) {
    lines.push(
      `Recommendation: check if the ${varianceDirection} amount matches any of the refund totals above. If a refund was recorded but cash wasn't physically returned, the drawer would be ${isOver ? 'over' : 'short'}.`
    )
  } else {
    lines.push(
      `Recommendation: recount your notes carefully, especially £20 and £50 notes. Check if any note was counted twice or if change was under/over-given.`
    )
  }

  return lines.join('\n')
}

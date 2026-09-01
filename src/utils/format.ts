import type { Sale, Till, PaymentSplit } from '../types'
import { PAYMENT_METHODS } from '../types'

export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** Tax rate is stored as a percentage (8) for new sales but as a decimal (0.08) in seed data — normalize for display. */
export function taxRatePercent(taxRate: number): number {
  return taxRate > 1 ? taxRate : Math.round(taxRate * 100 * 10) / 10
}

export function paymentLabel(method: string): string {
  return PAYMENT_METHODS.find((p) => p.id === method)?.label ?? method
}

/** The payment legs of a sale — the recorded split, or a single full-amount leg for simple sales. */
export function salePayments(sale: Sale): PaymentSplit[] {
  if (sale.payments?.length) return sale.payments
  return [{ method: sale.paymentMethod, amount: sale.total }]
}

/** Human-readable summary of a sale's payment breakdown, e.g. "Cash + Card". */
export function paymentSummary(sale: Sale): string {
  const pays = salePayments(sale)
  if (pays.length === 1) return paymentLabel(pays[0].method)
  return pays.map((p) => paymentLabel(p.method)).join(' + ')
}

/** Amount of a sale settled in cash (0 when paid by card/UPI/credit; negative for cash refunds). */
export function saleCashAmount(sale: Sale): number {
  const cash = salePayments(sale)
    .filter((p) => p.method === 'cash')
    .reduce((sum, p) => sum + p.amount, 0)
  return sale.kind === 'refund' ? -cash : cash
}

export function formatMoney(value: number, currency = '$'): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  return `${sign}${currency}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function formatDateTime(ts: number): string {
  return `${formatDate(ts)}, ${formatTime(ts)}`
}

export function isToday(ts: number): boolean {
  const d = new Date(ts)
  const n = new Date()
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  )
}

export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function startOfWeek(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d.getTime()
}

export function startOfMonth(ts: number): number {
  const d = new Date(ts)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function lastNDays(n: number): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (n - 1))
  return d.getTime()
}

export function daysBetween(a: number, b: number): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000)
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/** Counter cash expected in a till's drawer: opening float + all cash sales recorded on that till since it was opened. */
export function tillExpectedCash(till: Till, sales: Sale[]): number {
  const since = till.openedAt ?? 0
  const cashTotal = sales
    .filter((s) => s.tillId === till.id && s.createdAt >= since)
    .reduce((sum, s) => sum + saleCashAmount(s), 0)
  return Math.round((till.openingFloat + cashTotal) * 100) / 100
}

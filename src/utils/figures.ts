import type { Sale } from '../types'

export function transactionFigures(sales: Sale[]) {
  return sales.reduce((a, s) => {
    if (s.kind === 'refund') a.refunds += Math.abs(s.total)
    else if (s.kind === 'buy') a.buys += Math.abs(s.total)
    else if (s.kind === 'exchange') a.exchange += s.total
    else { a.sales += s.total; a.orders++ }
    return a
  }, { sales: 0, buys: 0, exchange: 0, refunds: 0, orders: 0 })
}

export function todaysTransactions(sales: Sale[], now = new Date()) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return sales.filter(s => s.createdAt >= start.getTime() && s.createdAt <= now.getTime())
}

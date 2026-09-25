import { useMemo, useState } from 'react'
import { Printer, TrendingUp, TrendingDown, Receipt } from 'lucide-react'
import { useStore } from '../store/useStore'
import { formatMoney, startOfDay, startOfWeek, startOfMonth, formatDateTime, paymentSummary } from '../utils/format'
import type { Sale } from '../types'
import Modal from '../components/Modal'
import ReceiptView from '../components/Receipt'

type Range = 'today' | 'week' | 'month' | 'all'
const PAYMENT_ICONS: Record<string, string> = { cash: '💵', card: '💳', upi: '📱', credit: '🏦' }

export default function Sales() {
  const sales = useStore((s) => s.sales)
  const customers = useStore((s) => s.customers)
  const settings = useStore((s) => s.settings)
  const cur = settings.currency

  const [range, setRange] = useState<Range>('today')
  const [method, setMethod] = useState('all')
  const [viewing, setViewing] = useState<Sale | null>(null)

  const filtered = useMemo(() => {
    const now = Date.now()
    let from = 0
    if (range === 'today') from = startOfDay(now)
    else if (range === 'week') from = startOfWeek(now)
    else if (range === 'month') from = startOfMonth(now)
    return sales.filter((s) => {
      if (s.createdAt < from) return false
      if (method !== 'all' && s.paymentMethod !== method) return false
      return true
    })
  }, [sales, range, method])

  const totals = useMemo(() => {
    const revenue = filtered.reduce((s, x) => s + x.total, 0)
    const subtotal = filtered.reduce((s, x) => s + x.subtotal, 0)
    const tax = filtered.reduce((s, x) => s + x.taxAmount, 0)
    const units = filtered.reduce((s, x) => s + x.items.reduce((n, it) => n + it.qty, 0), 0)
    const avg = filtered.length ? revenue / filtered.length : 0
    return { revenue, subtotal, tax, units, avg, count: filtered.length }
  }, [filtered])

  const topProducts = useMemo(() => {
    const m = new Map<string, { name: string; qty: number; revenue: number }>()
    for (const s of filtered)
      for (const it of s.items) {
        const e = m.get(it.productId) ?? { name: it.name, qty: 0, revenue: 0 }
        e.qty += it.qty
        e.revenue += it.qty * it.price
        m.set(it.productId, e)
      }
    return [...m.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  }, [filtered])

  const customerName = (id?: string) => {
    if (!id) return '—'
    return customers.find((c) => c.id === id)?.name ?? '—'
  }

  return (
    <div className="page">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon indigo"><TrendingUp size={22} /></div>
          <div>
            <div className="stat-label">Revenue</div>
            <div className="stat-value">{formatMoney(totals.revenue, cur)}</div>
            <div className="stat-hint">{totals.count} sales</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon cyan"><Receipt size={22} /></div>
          <div>
            <div className="stat-label">Avg. order</div>
            <div className="stat-value">{formatMoney(totals.avg, cur)}</div>
            <div className="stat-hint">Tax included</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><TrendingUp size={22} /></div>
          <div>
            <div className="stat-label">Units sold</div>
            <div className="stat-value">{totals.units}</div>
            <div className="stat-hint">{formatMoney(totals.subtotal, cur)} pre-tax</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><TrendingDown size={22} /></div>
          <div>
            <div className="stat-label">Tax collected</div>
            <div className="stat-value">{formatMoney(totals.tax, cur)}</div>
            <div className="stat-hint">At {settings.taxRate}%</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div className="segmented">
          {(['today', 'week', 'month', 'all'] as Range[]).map((r) => (
            <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>
              {r === 'all' ? 'All time' : r[0].toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
        <div className="segmented">
          {['all', 'cash', 'card', 'upi', 'credit'].map((m) => (
            <button key={m} className={method === m ? 'active' : ''} onClick={() => setMethod(m)}>
              {m === 'all' ? 'All methods' : PAYMENT_ICONS[m] + ' ' + m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="dash-grid">
        <div className="card dash-span-8">
          <div className="card-header">
            <div>
              <h3>Transactions</h3>
              <div className="sub">{totals.count} sales in view</div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Time</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Items</th>
                  <th>Payment</th>
                  <th className="num">Total</th>
                  <th className="num"></th>
                </tr>
              </thead>
              <tbody>
                {[...filtered].sort((a, b) => b.createdAt - a.createdAt).map((s) => (
                  <tr key={s.id} onClick={() => setViewing(s)} style={{ cursor: 'pointer' }}>
                    <td><b>#{s.receiptNo}</b></td>
                    <td>{formatDateTime(s.createdAt)}</td>
                    <td>{customerName(s.customerId)}</td>
                    <td>
                      <span className={`badge ${s.kind === 'buy' ? 'badge-purple' : s.kind === 'exchange' ? 'badge-blue' : s.kind === 'refund' ? 'badge-red' : 'badge-green'}`} style={{ textTransform: 'capitalize' }}>
                        {s.kind}
                      </span>
                    </td>
                    <td>{s.items.reduce((n, it) => n + it.qty, 0)}</td>
                    <td>
                      <span className="badge badge-gray">
                        {PAYMENT_ICONS[s.paymentMethod]} {paymentSummary(s)}
                      </span>
                    </td>
                    <td className="num" style={{ fontWeight: 700, color: s.total < 0 ? 'var(--danger)' : undefined }}>{formatMoney(s.total, cur)}</td>
                    <td className="num">
                      <button className="btn-icon btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setViewing(s) }}>
                        <Printer size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">
                        <div className="es-icon"><Receipt size={24} /></div>
                        <p>No transactions in this view yet — all buy, sell and exchange transactions appear here</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card dash-span-4">
          <div className="card-header">
            <div>
              <h3>Top products</h3>
              <div className="sub">By revenue in view</div>
            </div>
          </div>
          <div className="simple-list">
            {topProducts.length === 0 && (
              <div className="empty-state"><p>No data yet</p></div>
            )}
            {topProducts.map((tp, i) => (
              <div className="sl-row" key={tp.name}>
                <div className="sl-thumb" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 800 }}>
                  {i + 1}
                </div>
                <div className="sl-info">
                  <div className="sl-name">{tp.name}</div>
                  <div className="sl-sub">{tp.qty} units</div>
                </div>
                <div className="sl-right">
                  <div className="sl-value">{formatMoney(tp.revenue, cur)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={`Receipt #${viewing?.receiptNo ?? ''}`}
        footer={
          viewing && (
            <button className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={16} /> Print
            </button>
          )
        }
      >
        {viewing && (
          <div className="print-area">
            <ReceiptView sale={viewing} />
          </div>
        )}
      </Modal>
    </div>
  )
}

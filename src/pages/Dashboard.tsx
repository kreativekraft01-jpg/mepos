import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, ShoppingBag, Package, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react'
import StatCard from '../components/StatCard'
import { useStore } from '../store/useStore'
import { formatMoney, startOfDay, lastNDays } from '../utils/format'

export default function Dashboard() {
  const sales = useStore((s) => s.sales)
  const products = useStore((s) => s.products)
  const categories = useStore((s) => s.categories)
  const settings = useStore((s) => s.settings)
  const navigate = useNavigate()
  const cur = settings.currency

  const stats = useMemo(() => {
    const today = startOfDay(Date.now())
    const todaySales = sales.filter((s) => s.createdAt >= today)
    const revenue = todaySales.reduce((sum, s) => sum + s.total, 0)
    const orders = todaySales.length
    const lowStock = products.filter((p) => p.stock <= p.lowStockThreshold)

    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0)

    const itemCounts = new Map<string, number>()
    for (const s of sales) for (const it of s.items) itemCounts.set(it.productId, (itemCounts.get(it.productId) ?? 0) + it.qty)
    const topProductId = [...itemCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const topProduct = products.find((p) => p.id === topProductId)

    const days = 7
    const buckets: { label: string; total: number; count: number }[] = []
    for (let i = 0; i < days; i++) {
      const dayStart = lastNDays(days - i)
      const dayEnd = dayStart + 86400000
      const daySales = sales.filter((s) => s.createdAt >= dayStart && s.createdAt < dayEnd)
      const d = new Date(dayStart)
      buckets.push({
        label: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
        total: daySales.reduce((sum, s) => sum + s.total, 0),
        count: daySales.length
      })
    }

    const avgOrder = orders > 0 ? revenue / orders : 0
    const prevStart = lastNDays(days) - days * 86400000
    const prevTotal = sales
      .filter((s) => s.createdAt >= prevStart && s.createdAt < lastNDays(days))
      .reduce((sum, s) => sum + s.total, 0)
    const trend = prevTotal > 0 ? ((revenue - prevTotal) / prevTotal) * 100 : 0

    return {
      todaySales,
      revenue,
      orders,
      avgOrder,
      lowStock,
      totalRevenue,
      topProduct,
      buckets,
      trend
    }
  }, [sales, products])

  const maxBucket = Math.max(...stats.buckets.map((b) => b.total), 1)
  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="page">
      <div className="section-head">
        <div>
          <h2>Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'} 👋</h2>
          <div className="sub">{todayStr}</div>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          icon={<DollarSign size={22} />}
          color="indigo"
          label="Today's Revenue"
          value={formatMoney(stats.revenue, cur)}
          hint={stats.orders > 0 ? `${stats.orders} orders today` : 'No sales yet today'}
        />
        <StatCard
          icon={<TrendingUp size={22} />}
          color="green"
          label="Avg. Order"
          value={formatMoney(stats.avgOrder, cur)}
          hint={
            stats.trend >= 0
              ? `▲ ${Math.abs(stats.trend).toFixed(0)}% vs last week`
              : `▼ ${Math.abs(stats.trend).toFixed(0)}% vs last week`
          }
        />
        <StatCard
          icon={<ShoppingBag size={22} />}
          color="cyan"
          label="Total Revenue"
          value={formatMoney(stats.totalRevenue, cur)}
          hint={`${sales.length} lifetime sales`}
        />
        <StatCard
          icon={<Package size={22} />}
          color={stats.lowStock.length > 0 ? 'amber' : 'green'}
          label="Low Stock"
          value={stats.lowStock.length}
          hint={`${products.length} products in catalog`}
        />
      </div>

      <div className="dash-grid">
        <div className="card dash-span-8">
          <div className="card-header">
            <div>
              <h3>Revenue — last 7 days</h3>
              <div className="sub">Daily sales total</div>
            </div>
            <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => navigate('/sales')}>
              View reports <ArrowRight size={14} />
            </button>
          </div>
          <div className="card-body">
            <div className="chart-bars">
              {stats.buckets.map((b, i) => {
                const height = Math.max((b.total / maxBucket) * 100, b.total > 0 ? 6 : 2)
                const isToday = i === stats.buckets.length - 1
                return (
                  <div className="chart-col" key={i}>
                    <div
                      className={`chart-bar ${isToday ? 'today' : ''}`}
                      style={{ height: `${height}%` }}
                    >
                      <span className="tooltip">{formatMoney(b.total, cur)}</span>
                    </div>
                    <div className="chart-label">
                      {b.label
                        .split(' ')
                        .slice(0, 1)
                        .join('')
                        .slice(0, 3)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="card dash-span-4">
          <div className="card-header">
            <div>
              <h3>Low stock alerts</h3>
              <div className="sub">Restock soon</div>
            </div>
          </div>
          <div className="simple-list">
            {stats.lowStock.length === 0 && (
              <div className="empty-state">
                <div className="es-icon"><Package size={24} /></div>
                <p>All stock levels are healthy</p>
              </div>
            )}
            {stats.lowStock.slice(0, 6).map((p) => {
              const cat = categories.find((c) => c.id === p.categoryId)
              return (
                <div className="sl-row" key={p.id}>
                  <div className="sl-thumb">
                    {p.image.startsWith('data:') ? (
                      <img src={p.image} alt="" />
                    ) : (
                      <span style={{ fontSize: 18 }}>📦</span>
                    )}
                  </div>
                  <div className="sl-info">
                    <div className="sl-name">
                      {p.name}
                      {p.grade && <span className={`grade-badge grade-${p.grade.toLowerCase()}`}>{p.grade}</span>}
                    </div>
                    <div className="sl-sub">{cat?.name ?? 'Uncategorized'}</div>
                  </div>
                  <div className="sl-right">
                    <div className="sl-value" style={{ color: 'var(--danger)' }}>
                      {p.stock} left
                    </div>
                    <div className="sl-hint">threshold {p.lowStockThreshold}</div>
                  </div>
                </div>
              )
            })}
          </div>
          {stats.lowStock.length > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-soft btn-sm" onClick={() => navigate('/inventory')}>
                <AlertTriangle size={14} /> Open inventory
              </button>
            </div>
          )}
        </div>
      </div>

      {stats.topProduct && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3>⭐ Best seller</h3>
              <div className="sub">Most units sold across all time</div>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="sl-thumb" style={{ width: 52, height: 52, fontSize: 26 }}>
              {stats.topProduct.image.startsWith('data:') ? (
                <img src={stats.topProduct.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
              ) : (
                <span>🏆</span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{stats.topProduct.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
                {formatMoney(stats.topProduct.price, cur)} · {stats.topProduct.stock} in stock
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/pos')}>
              Sell now <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

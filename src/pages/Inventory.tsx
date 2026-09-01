import { useMemo, useState } from 'react'
import { Search, Package, AlertTriangle, CheckCircle2, Minus, Plus } from 'lucide-react'
import { useStore } from '../store/useStore'
import { formatMoney } from '../utils/format'
import type { Product } from '../types'
import Modal from '../components/Modal'

type Filter = 'all' | 'low' | 'out' | 'healthy'

export default function Inventory() {
  const products = useStore((s) => s.products)
  const categories = useStore((s) => s.categories)
  const updateProduct = useStore((s) => s.updateProduct)
  const pushToast = useStore((s) => s.pushToast)
  const cur = useStore((s) => s.settings.currency)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [restocking, setRestocking] = useState<Product | null>(null)

  const stats = useMemo(() => {
    const low = products.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold)
    const out = products.filter((p) => p.stock <= 0)
    const healthy = products.filter((p) => p.stock > p.lowStockThreshold)
    const stockValue = products.reduce((s, p) => s + p.stock * p.cost, 0)
    return { low, out, healthy, stockValue }
  }, [products])

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const q = query.trim().toLowerCase()
        const matchQ = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
        let matchF = true
        if (filter === 'low') matchF = p.stock > 0 && p.stock <= p.lowStockThreshold
        else if (filter === 'out') matchF = p.stock <= 0
        else if (filter === 'healthy') matchF = p.stock > p.lowStockThreshold
        return matchQ && matchF
      }),
    [products, query, filter]
  )

  const status = (p: Product) => {
    if (p.stock <= 0) return { label: 'Out of stock', cls: 'badge-red' }
    if (p.stock <= p.lowStockThreshold) return { label: 'Low', cls: 'badge-amber' }
    return { label: 'In stock', cls: 'badge-green' }
  }

  return (
    <div className="page">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle2 size={22} /></div>
          <div>
            <div className="stat-label">Healthy</div>
            <div className="stat-value">{stats.healthy.length}</div>
            <div className="stat-hint">Above threshold</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><AlertTriangle size={22} /></div>
          <div>
            <div className="stat-label">Low stock</div>
            <div className="stat-value">{stats.low.length}</div>
            <div className="stat-hint">Needs restock</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><Package size={22} /></div>
          <div>
            <div className="stat-label">Out of stock</div>
            <div className="stat-value">{stats.out.length}</div>
            <div className="stat-hint">Sold out</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon indigo"><Package size={22} /></div>
          <div>
            <div className="stat-label">Inventory value</div>
            <div className="stat-value">{formatMoney(stats.stockValue, cur)}</div>
            <div className="stat-hint">At cost</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search" style={{ flex: 1, minWidth: 220 }}>
          <Search size={16} />
          <input placeholder="Search inventory…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div className="segmented">
          {(['all', 'low', 'out', 'healthy'] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'low' ? 'Low' : f === 'out' ? 'Out' : 'Healthy'}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th className="num">Grade</th>
                <th className="num">Cost</th>
                <th className="num">Price</th>
                <th className="num">Stock</th>
                <th>Status</th>
                <th className="num">Stock value</th>
                <th className="num">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const st = status(p)
                const cat = categories.find((c) => c.id === p.categoryId)
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="product-cell">
                        <div className="product-thumb">
                          {p.image.startsWith('data:') ? <img src={p.image} alt="" /> : <span>📦</span>}
                        </div>
                        <div>
                          <div className="name">{p.name}</div>
                          <div className="sku">{p.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td>{cat?.name ?? '—'}</td>
                    <td className="num">
                      {p.grade ? <span className={`grade-badge grade-${p.grade.toLowerCase()}`}>{p.grade}</span> : '—'}
                    </td>
                    <td className="num" style={{ color: 'var(--text-faint)' }}>{formatMoney(p.cost, cur)}</td>
                    <td className="num">{formatMoney(p.price, cur)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{p.stock}</td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    <td className="num">{formatMoney(p.stock * p.cost, cur)}</td>
                    <td className="num">
                      <button className="btn btn-soft btn-sm" onClick={() => setRestocking(p)}>
                        <Plus size={13} /> Restock
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <div className="es-icon"><Search size={24} /></div>
                      <p>No inventory matches</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RestockModal product={restocking} onClose={() => setRestocking(null)} onRestock={(p, qty) => {
        updateProduct(p.id, { stock: p.stock + qty })
        pushToast('success', `${qty} × ${p.name} added to stock`)
        setRestocking(null)
      }} />
    </div>
  )
}

function RestockModal({
  product,
  onClose,
  onRestock
}: {
  product: Product | null
  onClose: () => void
  onRestock: (p: Product, qty: number) => void
}) {
  const [qty, setQty] = useState(0)
  const pushToast = useStore((s) => s.pushToast)

  if (!product) return null

  const confirm = () => {
    if (qty <= 0) return pushToast('error', 'Enter a quantity greater than 0')
    onRestock(product, qty)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Restock ${product.name}`}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={confirm}>
            <Plus size={15} /> Add stock
          </button>
        </>
      }
    >
      <div className="stat-card" style={{ marginBottom: 16, boxShadow: 'none', background: 'var(--surface-2)' }}>
        <div className="stat-icon indigo"><Package size={22} /></div>
        <div>
          <div className="stat-label">Current stock</div>
          <div className="stat-value">{product.stock}</div>
        </div>
      </div>
      <div className="field">
        <label>Quantity to add</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setQty((q) => Math.max(0, q - 5))}>
            <Minus size={16} />
          </button>
          <input
            className="input"
            type="number"
            min={0}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            style={{ textAlign: 'center', fontWeight: 700, fontSize: 16 }}
            autoFocus
          />
          <button className="btn btn-ghost btn-icon" onClick={() => setQty((q) => q + 5)}>
            <Plus size={16} />
          </button>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
        New total: <b style={{ color: 'var(--text)' }}>{product.stock + qty}</b>
      </div>
    </Modal>
  )
}

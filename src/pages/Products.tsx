import { useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Tags, ImageIcon } from 'lucide-react'
import { useStore } from '../store/useStore'
import { formatMoney } from '../utils/format'
import { REFURB_GRADES, type Product } from '../types'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'

const CATEGORY_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b']

export default function Products() {
  const products = useStore((s) => s.products)
  const categories = useStore((s) => s.categories)
  const deleteProduct = useStore((s) => s.deleteProduct)
  const pushToast = useStore((s) => s.pushToast)
  const cur = useStore((s) => s.settings.currency)

  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [catOpen, setCatOpen] = useState(false)

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const q = query.trim().toLowerCase()
        const matchQ = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
        const matchC = catFilter === 'all' || p.categoryId === catFilter
        return matchQ && matchC
      }),
    [products, query, catFilter]
  )

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—'

  return (
    <div className="page">
      <div className="section-head">
        <div>
          <h2>Products</h2>
          <div className="sub">{products.length} items · {categories.length} categories</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setCatOpen(true)}>
            <Tags size={16} /> Categories
          </button>
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Plus size={16} /> Add product
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search" style={{ flex: 1, minWidth: 220 }}>
          <Search size={16} />
          <input
            placeholder="Search by name or SKU…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <select className="select" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={{ width: 180 }}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th className="num">Grade</th>
                <th className="num">Price</th>
                <th className="num">Cost</th>
                <th className="num">Stock</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const cat = categories.find((c) => c.id === p.categoryId)
                const low = p.stock <= p.lowStockThreshold
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="product-cell">
                        <div className="product-thumb">
                          {p.image.startsWith('data:') ? <img src={p.image} alt="" /> : <ImageIcon size={16} />}
                        </div>
                        <div>
                          <div className="name">{p.name}</div>
                          <div className="sku">{p.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ background: `${cat?.color ?? '#888'}1a`, color: cat?.color ?? '#666' }}>
                        {catName(p.categoryId)}
                      </span>
                    </td>
                    <td className="num">
                      {p.grade ? <span className={`grade-badge grade-${p.grade.toLowerCase()}`}>{p.grade}</span> : '—'}
                    </td>
                    <td className="num">{formatMoney(p.price, cur)}</td>
                    <td className="num" style={{ color: 'var(--text-faint)' }}>{formatMoney(p.cost, cur)}</td>
                    <td className="num">
                      {low ? <span className="badge badge-amber">{p.stock}</span> : <span>{p.stock}</span>}
                    </td>
                    <td className="num">
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button className="btn-icon btn-ghost" onClick={() => setEditing(p)} title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button className="btn-icon btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setDeleting(p)} title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="es-icon"><Search size={24} /></div>
                      <p>No products found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <ProductModal
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete product"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            deleteProduct(deleting.id)
            pushToast('success', `${deleting.name} deleted`)
            setDeleting(null)
          }
        }}
      />

      <CategoryModal open={catOpen} onClose={() => setCatOpen(false)} />
    </div>
  )
}

function ProductModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const products = useStore((s) => s.products)
  const categories = useStore((s) => s.categories)
  const addProduct = useStore((s) => s.addProduct)
  const updateProduct = useStore((s) => s.updateProduct)
  const pushToast = useStore((s) => s.pushToast)

  const [form, setForm] = useState({
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    categoryId: product?.categoryId ?? categories[0]?.id ?? '',
    grade: product?.grade ?? 'A',
    price: product?.price ?? 0,
    cost: product?.cost ?? 0,
    stock: product?.stock ?? 0,
    lowStockThreshold: product?.lowStockThreshold ?? 10,
    image: product?.image ?? ''
  })
  const [error, setError] = useState('')

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }))

  const save = () => {
    if (!form.name.trim()) return setError('Product name is required')
    if (form.price < 0 || form.cost < 0 || form.stock < 0) return setError('Prices and stock cannot be negative')

    const finalSku = form.sku.trim() || `P-${Math.floor(1000 + Math.random() * 9000)}`
    const skuTaken = products.some((p) => p.sku.toLowerCase() === finalSku.toLowerCase() && p.id !== product?.id)
    if (skuTaken) return setError(`SKU "${finalSku}" is already in use`)

    const image = form.image.trim()
      ? form.image.startsWith('data:') || form.image.startsWith('http')
        ? form.image
        : form.image
      : emojiFor(form.name)

    if (product) {
      updateProduct(product.id, { ...form, sku: finalSku, image })
      pushToast('success', `${form.name} updated`)
    } else {
      addProduct({ ...form, sku: finalSku, image })
      pushToast('success', `${form.name} added to catalog`)
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={product ? 'Edit product' : 'Add product'}
      wide
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>{product ? 'Save changes' : 'Add product'}</button>
        </>
      }
    >
      {error && (
        <div style={{ background: 'var(--danger-soft)', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}
      <div className="form-row">
        <div className="field">
          <label>Product name <span className="req">*</span></label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. iPhone 15 · 128GB" autoFocus />
        </div>
        <div className="field">
          <label>SKU</label>
          <input className="input" value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="Auto-generated if empty" />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>Category</label>
          <select className="select" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Condition grade</label>
          <select className="select" value={form.grade} onChange={(e) => set('grade', e.target.value)}>
            {REFURB_GRADES.map((g) => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Image URL or emoji</label>
          <input className="input" value={form.image} onChange={(e) => set('image', e.target.value)} placeholder="Paste an image URL or leave for auto" />
        </div>
      </div>
      <div className="field">
        <label>Description</label>
        <textarea className="textarea" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Short description shown on receipts" />
      </div>
      <div className="form-grid-3">
        <div className="field">
          <label>Price ({useStore.getState().settings.currency})</label>
          <input className="input" type="number" min={0} step="0.01" value={form.price} onChange={(e) => set('price', Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Cost ({useStore.getState().settings.currency})</label>
          <input className="input" type="number" min={0} step="0.01" value={form.cost} onChange={(e) => set('cost', Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Stock</label>
          <input className="input" type="number" min={0} value={form.stock} onChange={(e) => set('stock', Number(e.target.value))} />
        </div>
      </div>
      <div className="field" style={{ maxWidth: 220 }}>
        <label>Low stock alert at</label>
        <input className="input" type="number" min={0} value={form.lowStockThreshold} onChange={(e) => set('lowStockThreshold', Number(e.target.value))} />
      </div>
    </Modal>
  )
}

function emojiFor(name: string): string {
  const n = name.toLowerCase()
  const map: Array<[RegExp, string]> = [
    [/iphone|phone|pixel|galaxy|samsung|huawei|oneplus|motorola|xiaomi/, '📱'],
    [/macbook|macbook air|macbook pro/, '💻'],
    [/laptop|chromebook|thinkpad|elitebook|surface|notebook/, '💻'],
    [/ipad|tablet/, '📲'],
    [/airpods|earbud|earphone|headphone|headset/, '🎧'],
    [/sony|wh-1000|bose|sennheiser|beats/, '🎧'],
    [/speaker|jbl|soundbar|bluetooth speaker/, '🔊'],
    [/watch|wearable|fitbit|garmin/, '⌚'],
    [/playstation|ps5|ps4|console|controller/, '🎮'],
    [/xbox/, '🎮'],
    [/switch|nintendo|wii|game boy/, '🕹️'],
    [/camera|canon|nikon|sony alpha|dslr|mirrorless/, '📷'],
    [/drone|dji|mini 3|mavic/, '🚁'],
    [/monitor|screen|display|tv/, '🖥️'],
    [/keyboard|mouse|charger|cable|adapter|case|accessory/, '🔌'],
    [/coffee|latte|espresso|cappuccino|mocha/, '☕'],
    [/tea|matcha/, '🍵'],
    [/juice|smoothie|orange|lemon|soda|drink|water|cola/, '🥤'],
    [/milk|yogurt|cream|cheese|butter/, '🥛'],
    [/bread|croissant|bagel|toast/, '🥐'],
    [/cake|cookie|muffin|brownie|donut|pie|cupcake/, '🧁'],
    [/chips|snack|popcorn|pretzel/, '🍿'],
    [/chocolate|granola|bar|candy/, '🍫'],
    [/apple/, '🍎'],
    [/banana/, '🍌'],
    [/berry|strawberry|blueberry/, '🍓'],
    [/tomato|vegetable|lettuce|cucumber|carrot/, '🥗'],
    [/avocado/, '🥑'],
    [/chicken|meat|steak|beef/, '🍗'],
    [/fish|salmon|seafood|shrimp/, '🐟'],
    [/egg/, '🥚'],
    [/soap|wash|cleaner|detergent/, '🧼'],
    [/paper|tissue|towel/, '🧻'],
    [/shampoo|soap|care|cream|lotion/, '🧴'],
    [/spice|salt|sugar|flour|rice/, '🧂'],
    [/pizza/, '🍕'],
    [/burger/, '🍔'],
    [/sandwich/, '🥪']
  ]
  for (const [re, em] of map) if (re.test(n)) return dataUri(em)
  return dataUri('🛒')
}

function dataUri(emo: string): string {
  return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%23f1f5f9'/><text x='50' y='62' font-size='46' text-anchor='middle'>${emo}</text></svg>`
}

function CategoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const categories = useStore((s) => s.categories)
  const addCategory = useStore((s) => s.addCategory)
  const updateCategory = useStore((s) => s.updateCategory)
  const deleteCategory = useStore((s) => s.deleteCategory)
  const pushToast = useStore((s) => s.pushToast)
  const productCount = useStore((s) => s.products)

  const [name, setName] = useState('')
  const [color, setColor] = useState(CATEGORY_COLORS[0])

  const add = () => {
    if (!name.trim()) return
    addCategory(name.trim(), color)
    pushToast('success', `Category "${name.trim()}" added`)
    setName('')
  }

  const remove = (id: string) => {
    deleteCategory(id)
    pushToast('info', 'Category removed, products moved to Uncategorized')
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage categories">
      <div className="form-row" style={{ marginBottom: 18 }}>
        <div className="field">
          <label>New category name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="e.g. Organic"
          />
        </div>
        <div className="field">
          <label>Color</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: c,
                  border: color === c ? '2px solid var(--text)' : '2px solid transparent',
                  transform: color === c ? 'scale(1.1)' : 'none'
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <button className="btn btn-primary btn-sm" onClick={add} style={{ marginBottom: 16 }}>
        <Plus size={14} /> Add category
      </button>

      <div className="simple-list" style={{ border: '1px solid var(--border)', borderRadius: 12, maxHeight: 320, overflowY: 'auto' }}>
        {categories.map((c) => (
          <div className="sl-row" key={c.id}>
            <span className="chip-dot" style={{ width: 12, height: 12, background: c.color, borderRadius: 4, flexShrink: 0 }} />
            <div className="sl-info">
              <div className="sl-name">{c.name}</div>
              <div className="sl-sub">{productCount.filter((p) => p.categoryId === c.id).length} products</div>
            </div>
            <input
              type="color"
              value={c.color}
              onChange={(e) => updateCategory(c.id, { color: e.target.value })}
              style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer' }}
              title="Change color"
            />
            <button className="btn-icon btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => remove(c.id)}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  )
}

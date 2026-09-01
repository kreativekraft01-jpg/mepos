import { useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Phone, Mail, Wallet, Users, ChevronDown, ChevronRight } from 'lucide-react'
import { useStore } from '../store/useStore'
import { formatMoney, formatDate, formatDateTime, paymentLabel, paymentSummary, taxRatePercent } from '../utils/format'
import type { Customer, Sale } from '../types'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Customers() {
  const customers = useStore((s) => s.customers)
  const sales = useStore((s) => s.sales)
  const deleteCustomer = useStore((s) => s.deleteCustomer)
  const pushToast = useStore((s) => s.pushToast)
  const cur = useStore((s) => s.settings.currency)

  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Customer | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Customer | null>(null)
  const [viewing, setViewing] = useState<Customer | null>(null)

  const stats = useMemo(() => {
    const totalDue = customers.reduce((s, c) => s + c.balance, 0)
    const totalSpent = sales.reduce((s, x) => s + x.total, 0)
    return { totalDue, totalSpent }
  }, [customers, sales])

  const filtered = useMemo(
    () =>
      customers.filter((c) => {
        const q = query.trim().toLowerCase()
        return (
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
        )
      }),
    [customers, query]
  )

  const customerSales = (id: string) => sales.filter((s) => s.customerId === id)

  return (
    <div className="page">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon indigo"><Wallet size={22} /></div>
          <div>
            <div className="stat-label">Customers</div>
            <div className="stat-value">{customers.length}</div>
            <div className="stat-hint">Saved accounts</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Wallet size={22} /></div>
          <div>
            <div className="stat-label">Lifetime spend</div>
            <div className="stat-value">{formatMoney(stats.totalSpent, cur)}</div>
            <div className="stat-hint">Across all sales</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><Wallet size={22} /></div>
          <div>
            <div className="stat-label">Balance due</div>
            <div className="stat-value">{formatMoney(stats.totalDue, cur)}</div>
            <div className="stat-hint">Store credit owed</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div className="search" style={{ flex: 1, minWidth: 220, maxWidth: 420 }}>
          <Search size={16} />
          <input placeholder="Search by name, phone or email…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: '100%' }} />
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          <Plus size={16} /> Add customer
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th className="num">Orders</th>
                <th className="num">Total spent</th>
                <th className="num">Balance</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const cs = customerSales(c.id)
                const spent = cs.reduce((s, x) => s + x.total, 0)
                return (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setViewing(c)}>
                    <td>
                      <div className="product-cell">
                        <div className="product-thumb" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 800 }}>
                          {c.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="name">{c.name}</div>
                          <div className="sku">Customer since {formatDate(c.createdAt)}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {c.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}><Phone size={12} style={{ color: 'var(--text-faint)' }} />{c.phone}</span>}
                        {c.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}><Mail size={12} style={{ color: 'var(--text-faint)' }} />{c.email}</span>}
                        {!c.phone && !c.email && <span style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>No contact</span>}
                      </div>
                    </td>
                    <td className="num">{cs.length}</td>
                    <td className="num">{formatMoney(spent, cur)}</td>
                    <td className="num">
                      {c.balance > 0 ? <span className="badge badge-amber">{formatMoney(c.balance, cur)}</span> : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                    </td>
                    <td className="num">
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button className="btn-icon btn-ghost" onClick={(e) => { e.stopPropagation(); setEditing(c) }}>
                          <Pencil size={15} />
                        </button>
                        <button className="btn-icon btn-ghost" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); setDeleting(c) }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <div className="es-icon"><Users size={24} /></div>
                      <p>No customers found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <CustomerModal customer={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete customer"
        message={`Delete "${deleting?.name}"? Their sales history is kept.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            deleteCustomer(deleting.id)
            pushToast('success', `${deleting.name} deleted`)
            setDeleting(null)
          }
        }}
      />

      <CustomerDetail customer={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}

function CustomerModal({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const addCustomer = useStore((s) => s.addCustomer)
  const updateCustomer = useStore((s) => s.updateCustomer)
  const pushToast = useStore((s) => s.pushToast)

  const [form, setForm] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    balance: customer?.balance ?? 0,
    notes: customer?.notes ?? ''
  })
  const [error, setError] = useState('')

  const save = () => {
    if (!form.name.trim()) return setError('Name is required')
    if (form.balance < 0) return setError('Balance cannot be negative')
    if (customer) {
      updateCustomer(customer.id, form)
      pushToast('success', `${form.name} updated`)
    } else {
      addCustomer(form)
      pushToast('success', `${form.name} added`)
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={customer ? 'Edit customer' : 'Add customer'}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>{customer ? 'Save changes' : 'Add customer'}</button>
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
          <label>Full name <span className="req">*</span></label>
          <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Jane Doe" autoFocus />
        </div>
        <div className="field">
          <label>Phone</label>
          <input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+1 555-0000" />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>Email</label>
          <input className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
        </div>
        <div className="field">
          <label>Opening balance</label>
          <input className="input" type="number" min={0} step="0.01" value={form.balance} onChange={(e) => setForm((f) => ({ ...f, balance: Number(e.target.value) }))} />
        </div>
      </div>
      <div className="field">
        <label>Notes</label>
        <textarea className="textarea" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Preferences, VIP status, etc." />
      </div>
    </Modal>
  )
}

function CustomerDetail({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const sales = useStore((s) => s.sales)
  const cur = useStore((s) => s.settings.currency)
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!customer) return null
  const cs = sales.filter((s) => s.customerId === customer.id).sort((a, b) => b.createdAt - a.createdAt)
  const spent = cs.reduce((s, x) => s + x.total, 0)

  return (
    <Modal open onClose={onClose} title={customer.name} wide>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
        <div className="product-thumb" style={{ width: 56, height: 56, background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: 24, fontWeight: 800 }}>
          {customer.name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{customer.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
            {customer.phone || 'No phone'} · {customer.email || 'No email'}
          </div>
          {customer.notes && <div style={{ fontSize: 12.5, color: 'var(--text-soft)', marginTop: 2 }}>📝 {customer.notes}</div>}
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600 }}>LIFETIME SPEND</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{formatMoney(spent, cur)}</div>
          {customer.balance > 0 && (
            <span className="badge badge-amber">Balance due {formatMoney(customer.balance, cur)}</span>
          )}
        </div>
      </div>

      <div className="section-head" style={{ marginBottom: 10 }}>
        <div>
          <h2 style={{ fontSize: 15 }}>Purchase history</h2>
          <div className="sub">{cs.length} orders · tap a row to see checkout details</div>
        </div>
      </div>

      {cs.length === 0 ? (
        <div className="empty-state">
          <div className="es-icon"><Wallet size={24} /></div>
          <p>No purchases yet — charge to this customer at checkout</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }} />
                <th>Receipt</th>
                <th>Date</th>
                <th>Payment</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {cs.map((s) => {
                const open = expanded === s.id
                return (
                  <SaleRow
                    key={s.id}
                    sale={s}
                    cur={cur}
                    open={open}
                    onToggle={() => setExpanded(open ? null : s.id)}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

function SaleRow({ sale, cur, open, onToggle }: { sale: Sale; cur: string; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={onToggle}>
        <td>
          <button className="btn-icon btn-ghost" onClick={(e) => { e.stopPropagation(); onToggle() }} aria-label="Toggle details">
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        </td>
        <td><b>#{sale.receiptNo}</b></td>
        <td>{formatDate(sale.createdAt)}</td>
        <td><span className="badge badge-gray">{paymentSummary(sale)}</span></td>
        <td className="num" style={{ fontWeight: 700 }}>{formatMoney(sale.total, cur)}</td>
      </tr>
      {open && (
        <tr className="detail-row">
          <td colSpan={5}>
            <SaleDetail sale={sale} cur={cur} />
          </td>
        </tr>
      )}
    </>
  )
}

function SaleDetail({ sale, cur }: { sale: Sale; cur: string }) {
  return (
    <div className="sale-detail">
      <div className="sale-detail-grid">
        <div>
          <div className="detail-label">Items</div>
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Qty</th>
                <th className="num">Price</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((it, i) => (
                <tr key={i}>
                  <td>{it.name}</td>
                  <td className="num">×{it.qty}</td>
                  <td className="num">{formatMoney(it.price, cur)}</td>
                  <td className="num">{formatMoney(it.price * it.qty, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sale-summary">
          <div className="detail-label">Summary</div>
          <div className="sum-row"><span>Subtotal</span><span>{formatMoney(sale.subtotal, cur)}</span></div>
          {sale.discount > 0 && (
            <div className="sum-row"><span>Discount</span><span style={{ color: 'var(--danger)' }}>−{formatMoney(sale.discount, cur)}</span></div>
          )}
          <div className="sum-row"><span>Tax ({taxRatePercent(sale.taxRate)}%)</span><span>{formatMoney(sale.taxAmount, cur)}</span></div>
          <div className="sum-row total"><span>Total</span><span>{formatMoney(sale.total, cur)}</span></div>
          <div className="detail-label" style={{ marginTop: 14 }}>Payment</div>
          <div className="sum-row"><span>Method</span><span>{paymentSummary(sale)}</span></div>
          {sale.payments && sale.payments.length > 1 && sale.payments.map((p) => (
            <div className="sum-row" key={p.method}><span>&nbsp;&nbsp;{paymentLabel(p.method)}</span><span>{formatMoney(p.amount, cur)}</span></div>
          ))}
          {sale.cashReceived != null && (
            <div className="sum-row"><span>Cash received</span><span>{formatMoney(sale.cashReceived, cur)}</span></div>
          )}
          {sale.changeDue != null && (
            <div className="sum-row"><span>Change</span><span>{formatMoney(sale.changeDue, cur)}</span></div>
          )}
          <div className="sum-row"><span>Receipt</span><span>#{sale.receiptNo}</span></div>
          <div className="sum-row"><span>Date</span><span>{formatDateTime(sale.createdAt)}</span></div>
        </div>
      </div>
    </div>
  )
}

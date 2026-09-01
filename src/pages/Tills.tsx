import { useMemo, useState } from 'react'
import { Landmark, Plus, Lock, Unlock, Trash2, CheckCircle2, AlertTriangle, User, Timer, Hash } from 'lucide-react'
import { useStore } from '../store/useStore'
import { formatMoney, formatDateTime, tillExpectedCash } from '../utils/format'
import type { Till } from '../types'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Tills() {
  const tills = useStore((s) => s.tills)
  const sales = useStore((s) => s.sales)
  const activeTillId = useStore((s) => s.activeTillId)
  const openTill = useStore((s) => s.openTill)
  const closeTill = useStore((s) => s.closeTill)
  const addTill = useStore((s) => s.addTill)
  const deleteTill = useStore((s) => s.deleteTill)
  const setActiveTill = useStore((s) => s.setActiveTill)
  const pushToast = useStore((s) => s.pushToast)
  const cur = useStore((s) => s.settings.currency)

  const [opening, setOpening] = useState<Till | null>(null)
  const [closing, setClosing] = useState<Till | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Till | null>(null)

  const openTills = tills.filter((t) => t.status === 'open')

  const stats = useMemo(() => {
    const expectedTotal = openTills.reduce((s, t) => s + tillExpectedCash(t, sales), 0)
    const cashToday = sales
      .filter((s) => s.paymentMethod === 'cash')
      .reduce((sum, s) => sum + s.total, 0)
    return { expectedTotal, cashToday }
  }, [openTills, sales])

  return (
    <div className="page">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><Landmark size={22} /></div>
          <div>
            <div className="stat-label">Tills</div>
            <div className="stat-value">{tills.length}</div>
            <div className="stat-hint">{openTills.length} with banking open</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><Timer size={22} /></div>
          <div>
            <div className="stat-label">Counter cash (open tills)</div>
            <div className="stat-value">{formatMoney(stats.expectedTotal, cur)}</div>
            <div className="stat-hint">Expected in drawers right now</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon indigo"><Unlock size={22} /></div>
          <div>
            <div className="stat-label">Cash sales today</div>
            <div className="stat-value">{formatMoney(stats.cashToday, cur)}</div>
            <div className="stat-hint">Recorded across all tills</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13.5, color: 'var(--text-soft)' }}>
          Staff must open banking on a till before accepting payments, and close it (with a cash tally) at end of day.
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus size={16} /> Add till
        </button>
      </div>

      <div className="till-grid">
        {tills.map((t) => (
          <TillCard
            key={t.id}
            till={t}
            active={activeTillId === t.id}
            expected={t.status === 'open' ? tillExpectedCash(t, sales) : t.expectedCash ?? 0}
            currency={cur}
            onOpen={() => setOpening(t)}
            onClose={() => setClosing(t)}
            onDelete={() => setDeleting(t)}
            onActivate={() => setActiveTill(t.id)}
          />
        ))}
        {tills.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <div className="es-icon"><Landmark size={24} /></div>
            <p>No tills yet — add one to start banking.</p>
          </div>
        )}
      </div>

      {opening && (
        <OpenTillModal
          till={opening}
          currency={cur}
          onClose={() => setOpening(null)}
          onConfirm={(openedBy, openingFloat) => {
            openTill(opening.id, openedBy, openingFloat)
            pushToast('success', `Banking opened on ${opening.name}`)
            setOpening(null)
          }}
        />
      )}

      {closing && (
        <CloseTillModal
          till={closing}
          expected={tillExpectedCash(closing, sales)}
          currency={cur}
          onClose={() => setClosing(null)}
          onConfirm={(input) => {
            const res = closeTill(closing.id, input)
            if (res.ok) {
              pushToast('success', `Banking closed on ${closing.name}`)
              setClosing(null)
            }
            return res
          }}
        />
      )}

      <AddTillModal open={adding} onClose={() => setAdding(false)} onConfirm={(name) => {
        addTill(name)
        pushToast('success', `Till "${name}" added`)
        setAdding(false)
      }} />

      <ConfirmDialog
        open={!!deleting}
        title="Delete till?"
        message={`Delete "${deleting?.name}"? This does not affect recorded sales, but the till can no longer be used for banking.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            deleteTill(deleting.id)
            pushToast('success', 'Till deleted')
            setDeleting(null)
          }
        }}
      />
    </div>
  )
}

function TillCard({
  till,
  active,
  expected,
  currency,
  onOpen,
  onClose,
  onDelete,
  onActivate
}: {
  till: Till
  active: boolean
  expected: number
  currency: string
  onOpen: () => void
  onClose: () => void
  onDelete: () => void
  onActivate: () => void
}) {
  const open = till.status === 'open'
  const short = (till.variance ?? 0) < 0

  return (
    <div className={`card till-card ${open ? 'open' : ''}`}>
      <div className="till-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className={`till-icon ${open ? 'green' : 'gray'}`}>
            {open ? <Unlock size={18} /> : <Lock size={18} />}
          </div>
          <div>
            <div className="till-name">
              {till.name}
              {active && <span className="badge badge-indigo">In use at POS</span>}
            </div>
            <div className="till-sub">
              {open
                ? `Banking open · ${till.openedBy ?? '—'} · ${formatDateTime(till.openedAt ?? Date.now())}`
                : till.closedAt
                  ? `Closed ${formatDateTime(till.closedAt)}${till.closedBy ? ` by ${till.closedBy}` : ''}`
                  : 'Banking closed'}
            </div>
          </div>
        </div>
        <span className={`badge ${open ? 'badge-green' : 'badge-gray'}`}>
          {open ? 'Open' : 'Closed'}
        </span>
      </div>

      <div className="till-stats">
        <div>
          <span className="ts-label">Opening float</span>
          <span className="ts-value">{formatMoney(till.openingFloat, currency)}</span>
        </div>
        <div>
          <span className="ts-label">Counter cash</span>
          <span className="ts-value">{formatMoney(expected, currency)}</span>
        </div>
        {till.countedCash !== undefined && (
          <div>
            <span className="ts-label">Counted</span>
            <span className="ts-value">{formatMoney(till.countedCash, currency)}</span>
          </div>
        )}
        {till.variance !== undefined && (
          <div>
            <span className="ts-label">Variance</span>
            <span className={`ts-value ${till.variance === 0 ? '' : short ? 'neg' : 'pos'}`}>
              {till.variance === 0 ? '✓ Tallied' : `${short ? 'Short' : 'Over'} ${formatMoney(Math.abs(till.variance), currency)}`}
            </span>
          </div>
        )}
      </div>

      {(till.variance ?? 0) !== 0 && till.shortageReason && (
        <div className={`till-note ${short ? 'neg' : 'pos'}`}>
          {short ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
          <span>
            <b>{short ? 'Manager override' : 'Overage'}</b> — {till.shortageReason}
            {till.managerTag ? ` · tagged by ${till.managerTag}` : ''}
          </span>
        </div>
      )}

      <div className="till-actions">
        {open ? (
          <>
            {!active && (
              <button className="btn btn-ghost btn-sm" onClick={onActivate}>
                <User size={14} /> Use this till
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={onClose}>
              <Lock size={14} /> Close banking
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-success btn-sm" onClick={onOpen}>
              <Unlock size={14} /> Open banking
            </button>
            <button className="btn-icon btn-ghost" onClick={onDelete} title="Delete till">
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function OpenTillModal({
  till,
  currency,
  onClose,
  onConfirm
}: {
  till: Till
  currency: string
  onClose: () => void
  onConfirm: (openedBy: string, openingFloat: number) => void
}) {
  const [openedBy, setOpenedBy] = useState('')
  const [openingFloat, setOpeningFloat] = useState(0)
  const [error, setError] = useState('')

  const save = () => {
    if (!openedBy.trim()) return setError('Enter the staff member opening banking')
    if (openingFloat < 0) return setError('Opening float can\'t be negative')
    onConfirm(openedBy.trim(), openingFloat)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Open banking — ${till.name}`}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" onClick={save}>
            <Unlock size={15} /> Open banking
          </button>
        </>
      }
    >
      {error && (
        <div style={{ background: 'var(--danger-soft)', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}
      <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 0 }}>
        Checkout is blocked on every till until banking is opened. Sales made on this till will count toward its counter cash at close.
      </p>
      <div className="form-row">
        <div className="field">
          <label>Opened by <span className="req">*</span></label>
          <input className="input" placeholder="Staff name" value={openedBy} onChange={(e) => setOpenedBy(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Opening float ({currency})</label>
          <input className="input" type="number" min={0} step="0.01" value={openingFloat || ''} placeholder="0.00" onChange={(e) => setOpeningFloat(Number(e.target.value) || 0)} />
        </div>
      </div>
    </Modal>
  )
}

export function CloseTillModal({
  till,
  expected,
  currency,
  onClose,
  onConfirm
}: {
  till: Till
  expected: number
  currency: string
  onClose: () => void
  onConfirm: (input: { countedCash: number; closedBy: string; managerTag?: string; shortageReason?: string }) => { ok: boolean; error?: string; variance?: number }
}) {
  const [countedCash, setCountedCash] = useState<number | undefined>()
  const [closedBy, setClosedBy] = useState('')
  const [managerTag, setManagerTag] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const counted = countedCash ?? 0
  const variance = Math.round((counted - expected) * 100) / 100
  const needsOverride = variance !== 0

  const save = () => {
    if (countedCash === undefined) return setError('Count the cash in the drawer first')
    if (!closedBy.trim()) return setError('Enter the staff member closing banking')
    if (needsOverride && (!managerTag.trim() || !reason.trim())) {
      return setError('Cash doesn\'t tally — enter the manager tag AND a reason to override')
    }
    const res = onConfirm({
      countedCash,
      closedBy: closedBy.trim(),
      managerTag: needsOverride ? managerTag.trim() : undefined,
      shortageReason: needsOverride ? reason.trim() : undefined
    })
    if (res.error) setError(res.error)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Close banking — ${till.name}`}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>
            <Lock size={15} /> Close banking
          </button>
        </>
      }
    >
      {error && (
        <div style={{ background: 'var(--danger-soft)', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div className="till-tally">
        <div>
          <span>Counter cash expected</span>
          <b>{formatMoney(expected, currency)}</b>
        </div>
        <div>
          <span>Your counted cash</span>
          <input
            className="input"
            type="number"
            min={0}
            step="0.01"
            value={countedCash ?? ''}
            placeholder="0.00"
            autoFocus
            onChange={(e) => setCountedCash(Number(e.target.value) || 0)}
          />
        </div>
        <div className={variance === 0 ? 'ok' : variance < 0 ? 'neg' : 'pos'}>
          <span>Variance</span>
          <b>
            {countedCash === undefined
              ? '—'
              : variance === 0
                ? '✓ Tallied'
                : `${variance < 0 ? 'Short' : 'Over'} ${formatMoney(Math.abs(variance), currency)}`}
          </b>
        </div>
      </div>

      <div className="field">
        <label>Closed by <span className="req">*</span></label>
        <input className="input" placeholder="Staff name" value={closedBy} onChange={(e) => setClosedBy(e.target.value)} />
      </div>

      {needsOverride && (
        <div style={{ background: 'var(--danger-soft)', color: '#b91c1c', border: '1px solid var(--danger-soft)', borderRadius: 12, padding: 14, marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 10 }}>
            <AlertTriangle size={16} /> Cash doesn't tally — manager approval required
          </div>
          <div className="field">
            <label>Manager tag <span className="req">*</span></label>
            <div className="input-group">
              <span className="prefix"><Hash size={13} /></span>
              <input className="input" placeholder="Manager name / ID" value={managerTag} onChange={(e) => setManagerTag(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Reason <span className="req">*</span></label>
            <textarea className="textarea" style={{ minHeight: 70 }} placeholder="e.g. gave wrong change to a customer, counted drawer twice…" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
      )}
    </Modal>
  )
}

function AddTillModal({
  open,
  onClose,
  onConfirm
}: {
  open: boolean
  onClose: () => void
  onConfirm: (name: string) => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const save = () => {
    if (!name.trim()) return setError('Give the till a name')
    onConfirm(name.trim())
    setName('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a till"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}><Plus size={15} /> Add till</button>
        </>
      }
    >
      {error && (
        <div style={{ background: 'var(--danger-soft)', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}
      <div className="field">
        <label>Till name <span className="req">*</span></label>
        <input className="input" placeholder="e.g. Till 1 · Front" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
    </Modal>
  )
}

import { useState, useRef } from 'react'
import { Save, RotateCcw, Store, Receipt, Bot, BookOpen, Zap, Plus, Pencil, Trash2, Download, Cpu, CheckCircle2, AlertTriangle, RefreshCw, HardDrive, Upload } from 'lucide-react'
import { useStore, DEFAULT_SETTINGS } from '../store/useStore'
import { useBrowserAi, isModelCached } from '../store/browserAi'
import { BROWSER_MODELS, browserModelLabel, isWebGpuSupported, normalizeModelId } from '../utils/browserLlm'
import { formatDate } from '../utils/format'
import { parseSkill } from '../utils/skills'
import { downloadBackup, restoreFromFile } from '../utils/backup'
import type { KnowledgeDoc, AiSkill } from '../types'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'

export default function SettingsPage() {
  const settings = useStore((s) => s.settings)
  const knowledge = useStore((s) => s.knowledge)
  const updateSettings = useStore((s) => s.updateSettings)
  const resetDemoData = useStore((s) => s.resetDemoData)
  const pushToast = useStore((s) => s.pushToast)

  const [form, setForm] = useState({ ...settings })
  const [confirmReset, setConfirmReset] = useState(false)
  const [docModal, setDocModal] = useState<KnowledgeDoc | 'new' | null>(null)
  const [deletingDoc, setDeletingDoc] = useState<KnowledgeDoc | null>(null)
  const [skillModal, setSkillModal] = useState<AiSkill | 'new' | null>(null)
  const [deletingSkill, setDeletingSkill] = useState<AiSkill | null>(null)

  const set = (k: string, v: string | number | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const save = () => {
    updateSettings({
      ...form,
      taxRate: Number(form.taxRate) || 0,
      browserModel: normalizeModelId(form.browserModel) || DEFAULT_SETTINGS.browserModel
    })
    pushToast('success', 'Settings saved')
  }

  const exportKnowledge = () => {
    const text = knowledge
      .map((d) => `# ${d.title}\n\n${d.content}`)
      .join('\n\n---\n\n')
    const blob = new Blob([text], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${form.storeName.replace(/\s+/g, '-').toLowerCase()}-knowledge-base.md`
    a.click()
    URL.revokeObjectURL(url)
    pushToast('success', 'Knowledge base exported')
  }

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="section-head">
        <div>
          <h2>Settings</h2>
          <div className="sub">Store details, local AI and knowledge base</div>
        </div>
        <button className="btn btn-primary" onClick={save}>
          <Save size={16} /> Save settings
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <Store size={18} style={{ color: 'var(--primary)' }} />
          <h3>Store information</h3>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="field">
              <label>Store name</label>
              <input className="input" value={form.storeName} onChange={(e) => set('storeName', e.target.value)} />
            </div>
            <div className="field">
              <label>Tagline</label>
              <input className="input" value={form.tagline} onChange={(e) => set('tagline', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>Currency symbol</label>
              <input className="input" value={form.currency} onChange={(e) => set('currency', e.target.value)} maxLength={3} />
            </div>
            <div className="field">
              <label>Tax rate (%)</label>
              <input className="input" type="number" min={0} max={100} step="0.5" value={form.taxRate} onChange={(e) => set('taxRate', Number(e.target.value))} />
            </div>
          </div>
          <div className="field">
            <label>Receipt footer</label>
            <input className="input" value={form.receiptFooter} onChange={(e) => set('receiptFooter', e.target.value)} />
          </div>
        </div>
      </div>

      <BrowserAICard form={form} set={set} />

      <KnowledgeBaseCard
        form={form}
        set={set}
        onAdd={() => setDocModal('new')}
        onEdit={(d) => setDocModal(d)}
        onDelete={(d) => setDeletingDoc(d)}
        onExport={exportKnowledge}
      />

      <SkillsCard
        form={form}
        set={set}
        onAdd={() => setSkillModal('new')}
        onEdit={(s) => setSkillModal(s)}
        onDelete={(s) => setDeletingSkill(s)}
      />

      <div className="card">
        <div className="card-header">
          <HardDrive size={18} style={{ color: 'var(--primary)' }} />
          <h3>Backup &amp; Restore</h3>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>Backup current store</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Download a JSON snapshot (products, customers, sales, knowledge base, skills, tills, settings). Keep it safe for future restore.</div>
            </div>
            <button className="btn btn-primary" onClick={() => { downloadBackup(); pushToast('success', 'Backup downloaded — keep this file safe') }}>
              <Download size={15} /> Download backup
            </button>
          </div>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>Restore from backup</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Upload a previously downloaded backup JSON. This will replace current products, knowledge base and settings.</div>
            </div>
            <RestoreBackupButton />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <Receipt size={18} style={{ color: 'var(--warning)' }} />
          <h3>Danger zone</h3>
        </div>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Reset demo data</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Restore products, customers, sample sales and the knowledge base to the original demo state.</div>
          </div>
          <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={15} /> Reset
          </button>
        </div>
      </div>

      {docModal && (
        <DocModal doc={docModal === 'new' ? null : docModal} onClose={() => setDocModal(null)} />
      )}

      {skillModal && (
        <SkillModal skill={skillModal === 'new' ? null : skillModal} onClose={() => setSkillModal(null)} />
      )}

      <ConfirmDialog
        open={!!deletingDoc}
        title="Delete knowledge document?"
        message={`Delete "${deletingDoc?.title}"? The assistant will no longer use it.`}
        onCancel={() => setDeletingDoc(null)}
        onConfirm={() => {
          if (deletingDoc) {
            useStore.getState().deleteKnowledgeDoc(deletingDoc.id)
            pushToast('success', 'Document deleted')
            setDeletingDoc(null)
          }
        }}
      />

      <ConfirmDialog
        open={!!deletingSkill}
        title="Delete AI skill?"
        message={`Delete "${deletingSkill?.title}"? The assistant will no longer use this skill.`}
        onCancel={() => setDeletingSkill(null)}
        onConfirm={() => {
          if (deletingSkill) {
            useStore.getState().deleteSkill(deletingSkill.id)
            pushToast('success', 'Skill deleted')
            setDeletingSkill(null)
          }
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        title="Reset demo data?"
        message="This replaces products, customers, sales and the knowledge base with fresh demo data. Your settings are kept."
        confirmLabel="Reset data"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetDemoData()
          pushToast('success', 'Demo data restored')
          setConfirmReset(false)
        }}
      />
    </div>
  )
}

function BrowserAICard({
  form,
  set
}: {
  form: { aiEnabled: boolean; browserModel: string }
  set: (k: string, v: string | boolean) => void
}) {
  const ai = useBrowserAi()
  const pushToast = useStore((s) => s.pushToast)
  const updateSettings = useStore((s) => s.updateSettings)
  const gpuOk = isWebGpuSupported()
  const modelId = form.browserModel
  const selected = BROWSER_MODELS.find((m) => m.id === modelId) ?? BROWSER_MODELS[2]
  const isLoadedModel = ai.modelId === modelId
  const cached = isModelCached(modelId, ai.downloadedModels)

  const download = () => {
    updateSettings({ browserModel: normalizeModelId(modelId) })
    ai.startLoad(modelId)
    pushToast('info', cached
      ? `Loading ${browserModelLabel(modelId)} from cache — this stays fast once it's been downloaded`
      : `First-time download of ${browserModelLabel(modelId)} started — keep this tab open`)
  }

  return (
    <div className="card">
      <div className="card-header">
        <Bot size={18} style={{ color: 'var(--primary)' }} />
        <h3>AI assistant (in-browser)</h3>
      </div>
      <div className="card-body">
        <label className="switch" style={{ marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={form.aiEnabled}
            onChange={(e) => {
              const v = e.target.checked
              set('aiEnabled', v)
              updateSettings({ aiEnabled: v })
            }}
          />
          <span className="track" />
          <span>Enable AI assistant (chat bubble, bottom right)</span>
        </label>

        <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginBottom: 18 }}>
          A free open-source model runs <b>entirely inside this browser</b> via WebLLM. No installs, no cloud, no accounts — your store data never leaves this device.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {gpuOk ? (
            <span className="badge badge-green"><CheckCircle2 size={13} /> WebGPU ready</span>
          ) : (
            <span className="badge badge-red"><Cpu size={13} /> WebGPU not available</span>
          )}
          {ai.status === 'ready' && isLoadedModel && (
            <span className="badge badge-green"><CheckCircle2 size={13} /> Model ready</span>
          )}
          {ai.status === 'error' && (
            <span className="badge badge-red"><AlertTriangle size={13} /> Load failed</span>
          )}
        </div>

        {!gpuOk && (
          <div
            style={{
              background: 'var(--danger-soft)',
              color: '#b91c1c',
              padding: '10px 14px',
              borderRadius: 10,
              marginBottom: 16,
              fontSize: 12.5,
              fontWeight: 600
            }}
          >
            WebGPU is required to run the model locally. Use a current version of <b>Chrome</b> or <b>Edge</b> and make sure hardware acceleration is enabled.
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-soft)', marginBottom: 8 }}>
            Model — pick one to run (first time downloads it, afterwards it loads from cache)
          </div>
          <div className="category-chips" style={{ gap: 8 }}>
            {BROWSER_MODELS.map((m) => (
              <button
                key={m.id}
                className={`chip ${modelId === m.id ? 'active' : ''}`}
                onClick={() => {
                  set('browserModel', m.id)
                  updateSettings({ browserModel: m.id })
                }}
                title={`${m.note} · ${isModelCached(m.id, ai.downloadedModels) ? 'cached — loads from cache' : `download ${m.size}`} · needs ${m.memory} memory`}
              >
                <span className="chip-dot" style={{ background: m.light ? 'var(--success)' : 'var(--info)' }} />
                {m.label}
                <span style={{ opacity: 0.75 }}>· {m.size}{isModelCached(m.id, ai.downloadedModels) ? ' · cached' : ''}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <button
            className="btn btn-primary"
            onClick={download}
            disabled={ai.status === 'loading' || (ai.status === 'ready' && isLoadedModel)}
          >
            {ai.status === 'loading' ? (
              <RefreshCw size={15} className="spin" />
            ) : (
              <Download size={15} />
            )}
            {ai.status === 'ready' && isLoadedModel
              ? 'Model ready'
              : ai.status === 'loading'
                ? `Loading… ${ai.progress}%`
                : cached
                  ? `Load from cache & run ${selected?.label}`
                  : `Download & run ${selected?.label}`}
          </button>
          {ai.status === 'ready' && isLoadedModel && (
            <span style={{ fontSize: 12.5, color: 'var(--success)' }}>
              {selected?.label} ready · answers use the knowledge base on-device
            </span>
          )}
          {cached && ai.status !== 'ready' && (
            <span style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
              Already downloaded in this browser — loads from cache, not re-downloaded.
            </span>
          )}
        </div>

        {ai.status === 'loading' && (
          <div style={{ marginBottom: 14 }}>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${ai.progress}%` }} /></div>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>{ai.message}</p>
          </div>
        )}

        {ai.status === 'error' && (
          <div
            style={{
              background: 'var(--danger-soft)',
              color: '#b91c1c',
              padding: '10px 14px',
              borderRadius: 10,
              marginBottom: 14,
              fontSize: 12.5,
              fontWeight: 600
            }}
          >
            Could not load the model: {ai.error || 'unknown error'}. Try reloading the page, or pick a lighter model above.
          </div>
        )}

        <div
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 14,
            fontSize: 12.5
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>How it works</div>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, color: 'var(--text-soft)' }}>
            <li>The model downloads once (per model), then loads from browser cache.</li>
            <li>Everything — model, your store data, the knowledge base — runs on this device.</li>
            <li>Works fully offline after the first download.</li>
            <li>If no model is loaded yet, the assistant answers from built-in knowledge.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function KnowledgeBaseCard({
  form,
  set,
  onAdd,
  onEdit,
  onDelete,
  onExport
}: {
  form: { kbEnabled: boolean }
  set: (k: string, v: boolean) => void
  onAdd: () => void
  onEdit: (d: KnowledgeDoc) => void
  onDelete: (d: KnowledgeDoc) => void
  onExport: () => void
}) {
  const knowledge = useStore((s) => s.knowledge)
  const updateSettings = useStore((s) => s.updateSettings)
  const totalWords = knowledge.reduce((n, d) => n + d.content.split(/\s+/).filter(Boolean).length, 0)

  return (
    <div className="card">
      <div className="card-header">
        <BookOpen size={18} style={{ color: 'var(--primary)' }} />
        <h3>Knowledge base — guide AI replies</h3>
      </div>
      <div className="card-body">
        <label className="switch" style={{ marginBottom: 14 }}>
          <input
            type="checkbox"
            checked={form.kbEnabled}
            onChange={(e) => {
              const v = e.target.checked
              set('kbEnabled', v)
              updateSettings({ kbEnabled: v })
            }}
          />
          <span className="track" />
          <span>Use the knowledge base when answering</span>
        </label>
        <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginBottom: 16 }}>
          Add store policies, procedures and FAQs. Ask Agent X about your saved documents. It retrieves relevant content locally and uses it to answer with sources. Changes apply to new replies immediately. Store data stays on this device.
        </p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button className="btn btn-primary btn-sm" onClick={onAdd}>
            <Plus size={14} /> Add document
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onExport}>
            <Download size={14} /> Export (.md)
          </button>
        </div>

        <div className="simple-list" style={{ border: '1px solid var(--border)', borderRadius: 12 }}>
          {knowledge.length === 0 && (
            <div className="empty-state">
              <div className="es-icon"><BookOpen size={24} /></div>
              <p>No documents yet — add your first one</p>
            </div>
          )}
          {knowledge.map((d) => (
            <div className="sl-row" key={d.id}>
              <div className="sl-thumb" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                <BookOpen size={17} />
              </div>
              <div className="sl-info">
                <div className="sl-name">{d.title}</div>
                <div className="sl-sub">
                  {d.content.split(/\s+/).filter(Boolean).length} words · updated {formatDate(d.updatedAt)}
                </div>
              </div>
              <button className="btn-icon btn-ghost" onClick={() => onEdit(d)} aria-label={`Edit ${d.title}`}>
                <Pencil size={15} />
              </button>
              <button className="btn-icon btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => onDelete(d)} aria-label={`Delete ${d.title}`}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        {knowledge.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-faint)' }}>
            {knowledge.length} documents · {totalWords.toLocaleString()} words available to the assistant
          </div>
        )}
      </div>
    </div>
  )
}

function DocModal({ doc, onClose }: { doc: KnowledgeDoc | null; onClose: () => void }) {
  const addKnowledgeDoc = useStore((s) => s.addKnowledgeDoc)
  const updateKnowledgeDoc = useStore((s) => s.updateKnowledgeDoc)
  const pushToast = useStore((s) => s.pushToast)

  const [title, setTitle] = useState(doc?.title ?? '')
  const [content, setContent] = useState(doc?.content ?? '')
  const [error, setError] = useState('')

  const save = () => {
    if (!title.trim()) return setError('Give the document a title')
    if (!content.trim()) return setError('Add the facts or instructions the assistant should use')
    if (doc) {
      updateKnowledgeDoc(doc.id, { title: title.trim(), content: content.trim() })
      pushToast('success', 'Document updated — available to new replies immediately')
    } else {
      addKnowledgeDoc(title.trim(), content.trim())
      pushToast('success', 'Document added to the knowledge base')
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={doc ? 'Edit document' : 'New knowledge document'}
      wide
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>{doc ? 'Save changes' : 'Add document'}</button>
        </>
      }
    >
      {error && (
        <div style={{ background: 'var(--danger-soft)', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}
      <div className="field">
        <label htmlFor="knowledge-title">Title <span className="req">*</span></label>
        <input id="knowledge-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Store policies" autoFocus />
      </div>
      <div className="field">
        <label htmlFor="knowledge-content">Content <span className="req">*</span></label>
        <textarea
          id="knowledge-content"
          className="textarea"
          style={{ minHeight: 220 }}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write everything the AI should know… policies, menu, procedures, FAQs. Use plain text or bullet points."
        />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
        {content.trim().split(/\s+/).filter(Boolean).length} words — saved locally in this browser.
      </div>
    </Modal>
  )
}

function SkillsCard({
  form,
  set,
  onAdd,
  onEdit,
  onDelete
}: {
  form: { skillsEnabled: boolean }
  set: (k: string, v: boolean) => void
  onAdd: () => void
  onEdit: (s: AiSkill) => void
  onDelete: (s: AiSkill) => void
}) {
  const skills = useStore((s) => s.skills)
  const toggleSkill = useStore((s) => s.toggleSkill)
  const updateSettings = useStore((s) => s.updateSettings)

  const totalWords = skills.reduce((n, s) => {
    const def = parseSkill(s.content)
    return n + (s.title.split(/\s+/).filter(Boolean).length + (def?.description?.split(/\s+/).filter(Boolean).length ?? 0))
  }, 0)

  return (
    <div className="card">
      <div className="card-header">
        <Zap size={18} style={{ color: 'var(--primary)' }} />
        <h3>AI Skills — deterministic answers</h3>
      </div>
      <div className="card-body">
        <label className="switch" style={{ marginBottom: 14 }}>
          <input
            type="checkbox"
            checked={form.skillsEnabled}
            onChange={(e) => {
              const v = e.target.checked
              set('skillsEnabled', v)
              updateSettings({ skillsEnabled: v })
            }}
          />
          <span className="track" />
          <span>Enable AI skills (pattern-matched, instant answers)</span>
        </label>
        <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginBottom: 16 }}>
          Skills are pattern-matched rules that answer specific questions instantly — no LLM needed. Edit the JSON content to change triggers, templates, and response format.
        </p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button className="btn btn-primary btn-sm" onClick={onAdd}>
            <Plus size={14} /> Add skill
          </button>
        </div>

        <div className="simple-list" style={{ border: '1px solid var(--border)', borderRadius: 12 }}>
          {skills.length === 0 && (
            <div className="empty-state">
              <div className="es-icon"><Zap size={24} /></div>
              <p>No skills yet — add your first one</p>
            </div>
          )}
          {skills.map((s) => {
            const def = parseSkill(s.content)
            const isValid = def !== null
            const patternCount = def?.patterns?.length ?? 0
            const templateCount = def?.templates ? Object.keys(def.templates).length : 0

            return (
              <div className="sl-row" key={s.id}>
                <div className="sl-thumb" style={{ background: isValid ? 'var(--primary-soft)' : 'var(--danger-soft)', color: isValid ? 'var(--primary)' : 'var(--danger)' }}>
                  <Zap size={17} />
                </div>
                <div className="sl-info" style={{ flex: 1 }}>
                  <div className="sl-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {s.title}
                    {!isValid && (
                      <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 700 }}>INVALID JSON</span>
                    )}
                  </div>
                  <div className="sl-sub">
                    {isValid ? `${patternCount} patterns · ${templateCount} templates` : 'Fix JSON to enable'} · updated {formatDate(s.updatedAt)}
                  </div>
                </div>
                <label className="switch" style={{ margin: '0 8px' }}>
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={() => toggleSkill(s.id)}
                  />
                  <span className="track" />
                </label>
                <button className="btn-icon btn-ghost" onClick={() => onEdit(s)}>
                  <Pencil size={15} />
                </button>
                <button className="btn-icon btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => onDelete(s)}>
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })}
        </div>
        {skills.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-faint)' }}>
            {skills.length} skill{skills.length !== 1 ? 's' : ''} · {skills.filter((s) => s.enabled).length} active
          </div>
        )}
      </div>
    </div>
  )
}

function RestoreBackupButton() {
  const pushToast = useStore((s) => s.pushToast)
  const inputRef = useRef<HTMLInputElement>(null)
  const [confirmFile, setConfirmFile] = useState<File | null>(null)
  const onPick = () => inputRef.current?.click()
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setConfirmFile(f)
    e.target.value = ''
  }
  const doRestore = async () => {
    if (!confirmFile) return
    const res = await restoreFromFile(confirmFile)
    if (res.ok) {
      pushToast('success', 'Backup restored — reload to see all changes')
      setConfirmFile(null)
    } else {
      pushToast('error', res.error ?? 'Restore failed')
      setConfirmFile(null)
    }
  }
  return (
    <>
      <input ref={inputRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={onFile} />
      <button className="btn btn-ghost" onClick={onPick}>
        <Upload size={15} /> Upload backup
      </button>
      <ConfirmDialog
        open={!!confirmFile}
        title="Restore backup?"
        message={`Restore "${confirmFile?.name}"? This will overwrite current products, customers, knowledge base and settings. This cannot be undone — consider downloading a fresh backup first.`}
        confirmLabel="Restore"
        onCancel={() => setConfirmFile(null)}
        onConfirm={doRestore}
      />
    </>
  )
}

function SkillModal({ skill, onClose }: { skill: AiSkill | null; onClose: () => void }) {
  const addSkill = useStore((s) => s.addSkill)
  const updateSkill = useStore((s) => s.updateSkill)
  const pushToast = useStore((s) => s.pushToast)

  const [title, setTitle] = useState(skill?.title ?? '')
  const [content, setContent] = useState(skill?.content ?? '')
  const [error, setError] = useState('')

  const parsed = (() => {
    try { return JSON.parse(content) } catch { return null }
  })()

  const patternCount = parsed?.patterns?.length ?? 0
  const templateCount = parsed?.templates ? Object.keys(parsed.templates).length : 0

  const save = () => {
    if (!title.trim()) return setError('Give the skill a title')
    try {
      const def = JSON.parse(content)
      if (!def.patterns || !Array.isArray(def.patterns) || def.patterns.length === 0) {
        return setError('JSON must include a "patterns" array with at least one trigger word')
      }
      if (!def.templates || typeof def.templates !== 'object') {
        return setError('JSON must include a "templates" object with response templates')
      }
    } catch {
      return setError('Content must be valid JSON')
    }

    if (skill) {
      updateSkill(skill.id, { title: title.trim(), content: content.trim() })
      pushToast('success', 'Skill updated')
    } else {
      addSkill(title.trim(), content.trim())
      pushToast('success', 'Skill added')
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={skill ? 'Edit skill' : 'New AI skill'}
      wide
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>{skill ? 'Save changes' : 'Add skill'}</button>
        </>
      }
    >
      {error && (
        <div style={{ background: 'var(--danger-soft)', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}
      <div className="field">
        <label>Title <span className="req">*</span></label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Banking Variance Analysis" autoFocus />
      </div>
      <div className="field">
        <label>Content (JSON) <span className="req">*</span></label>
        <textarea
          className="textarea"
          style={{ minHeight: 300, fontFamily: 'monospace', fontSize: 12.5, lineHeight: 1.6 }}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={'{\n  "description": "What this skill does...",\n  "patterns": ["trigger word", "another trigger"],\n  "categories": ["cash", "refund"],\n  "templates": {\n    "summary": "Your till ({tillName})...",\n    "refundLine": "• {receiptNo}: {itemName}..."\n  },\n  "systemPrompt": "Extra instructions for the LLM..."\n}'}
        />
      </div>
      <div style={{ fontSize: 12, color: parsed ? 'var(--success)' : 'var(--danger)', fontWeight: 600, display: 'flex', gap: 12 }}>
        {parsed ? (
          <>
            <span>✓ Valid JSON</span>
            <span>· {patternCount} pattern{patternCount !== 1 ? 's' : ''}</span>
            <span>· {templateCount} template{templateCount !== 1 ? 's' : ''}</span>
          </>
        ) : (
          <span>✗ Invalid JSON — fix syntax to save</span>
        )}
      </div>
    </Modal>
  )
}

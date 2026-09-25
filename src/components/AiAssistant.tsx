import { useNavigate } from 'react-router-dom'
import { productToTransactionItem } from '../app/data/bridge'
import { previousInventoryQuestion } from '../utils/inventoryLanguage'
import { answerFromKnowledge } from '../utils/knowledgeAi'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Wifi, WifiOff, Loader2, RefreshCw, Cpu, Trash2, ArrowUp, Square, ShieldCheck, BookOpen, Maximize2, Minimize2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useBrowserAi } from '../store/browserAi'
import AgentX from './AgentX'
import type { AgentState } from './AgentX'
import {
  buildSnapshot,
  buildAssistantSystemPrompt,
  catalogAnswer,
  offlineReply,
  resolveFollowUp,
  type AiMessage
} from '../utils/ai'
import { buildKnowledgeContext } from '../utils/rag'
import {
  retrieveEvidence,
  decideAnswer,
  validateAnswer,
  buildEvidencePrompt
} from '../utils/pipeline'
import { browserModelLabel } from '../utils/browserLlm'

const SUGGESTIONS = ["Today's sales", 'Low stock', 'Grade A phones under 400', 'Explain cash variance']

export default function AiAssistant() {
  const enabled = useStore((s) => s.settings.aiEnabled)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<AiMessage[]>([])

  if (!enabled) return null

  return (
    <>
      <button className="ai-fab" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label="AI assistant">
        <span className="agent-x-avatar agent-x-avatar--fab">
          <AgentX size={32} state="idle" />
        </span>
        {!open && <span className="ai-badge" />}
      </button>
      {open && (
        <AssistantPanel
          onClose={() => setOpen(false)}
          messages={messages}
          setMessages={setMessages}
        />
      )}
    </>
  )
}

function AssistantPanel({
  onClose,
  messages,
  setMessages
}: {
  onClose: () => void
  messages: AiMessage[]
  setMessages: React.Dispatch<React.SetStateAction<AiMessage[]>>
}) {
  const navigate = useNavigate()
  const cart = useStore((s) => s.cart)
  const settings = useStore((s) => s.settings)
  const products = useStore((s) => s.products)
  const sales = useStore((s) => s.sales)
  const customers = useStore((s) => s.customers)
  const categories = useStore((s) => s.categories)
  const knowledge = useStore((s) => s.knowledge)
  const skills = useStore((s) => s.skills)
  const bankingContext = useStore((s) => s.bankingContext)
  const attachedCustomerId = useStore((s) => s.customerId)

  const attachedCustomer = useMemo(
    () => (attachedCustomerId ? customers.find((c) => c.id === attachedCustomerId) : undefined),
    [attachedCustomerId, customers]
  )

  const ai = useBrowserAi()
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [phase, setPhase] = useState<'retrieving' | 'composing' | 'checking'>('retrieving')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const [note, setNote] = useState('')
  const [pendingCorrection, setPendingCorrection] = useState<string | undefined>()
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRequest = useRef<AbortController | null>(null)
  const [clock, setClock] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60000)
    return () => { window.clearInterval(timer); activeRequest.current?.abort() }
  }, [])
  const stop = useCallback(() => {
    activeRequest.current?.abort()
    activeRequest.current = null
    setTyping(false)
  }, [])

  const snapshot = useMemo(
    () => buildSnapshot(products, sales, customers, settings),
    [products, sales, customers, settings, clock]
  )

  const modelId = settings.browserModel

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: messages.length || typing ? scrollRef.current.scrollHeight : 0, behavior: 'smooth' })
  }, [messages, typing, ai.progress])

  const ready = ai.status === 'ready' && ai.modelId === modelId

  // Agent X state: map UI state to character animation state
  const lastMsg = messages[messages.length - 1]
  const lastWasError = lastMsg?.role === 'assistant' && note.length > 0
  const agentState: AgentState = typing ? (phase === 'composing' ? 'answering' : 'thinking') : lastWasError ? 'error' : 'idle'

  const clearChat = useCallback(() => {
    stop()
    setPendingCorrection(undefined)
    setMessages([])
    setNote('')
    setInput('')
    setTyping(false)
  }, [setMessages, stop])

  const send = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim()
      if (!content || typing) return
      const controller = new AbortController()
      activeRequest.current = controller
      setNote('')
      setInput('')
      setTyping(true)
      setPhase('retrieving')

      const lastUser = previousInventoryQuestion(messages)
      let resolved = resolveFollowUp(content, lastUser, products.flatMap((p) => [p.name, p.sku]).concat(categories.map(c => c.name)))

      if (pendingCorrection && /^\s*(yes|yeah|yep|ok|okay|sure|y|ya)\s*[!.?]?\s*$/i.test(content)) {
        resolved = `do we have ${pendingCorrection}?`
      }
      setMessages((m) => [...m, { role: 'user', content, resolvedQuery: resolved }])
      setPendingCorrection(undefined)

      const kbEnabled = settings.kbEnabled && knowledge.length > 0
      const kbContext = kbEnabled ? buildKnowledgeContext(knowledge, resolved) : ''

      // ── Step 1: Retrieve all evidence in parallel ───────────────────────────
      const evidence = retrieveEvidence(resolved, {
        products,
        categories,
        customers,
        sales,
        currency: settings.currency,
        attachedCustomerId,
        knowledge,
        kbEnabled,
        skills,
        skillsEnabled: settings.skillsEnabled,
        bankingContext: bankingContext ?? undefined,
        snapshot
      })

      // ── Step 2: Fuse & decide ───────────────────────────────────────────────
      const decision = decideAnswer(evidence)
      const answerProducts = decision.winner === 'catalog' || decision.winner === 'compare'
        ? evidence.catalog.hits.filter(p => decision.answer?.split('\n').some(line => line.includes(p.name) && (!/grade [a-f]/i.test(line) || line.toLowerCase().includes(`grade ${p.grade.toLowerCase()}`)))).slice(0, 4)
        : []

      if (decision.winner === 'kb') {
        try {
          const result = await answerFromKnowledge(evidence, ready ? (history, signal) => ai.chat(modelId, history, {
            signal, onProgress: () => { if (!controller.signal.aborted) setPhase('composing') }
          }) : undefined, controller.signal, messages, next => { if (!controller.signal.aborted) setPhase(next) })
          if (controller.signal.aborted) return
          setMessages(m => [...m, { role: 'assistant', content: result.content, sources: result.sources }])
          setNote(result.note)
        } catch (error) {
          if (!controller.signal.aborted) setNote('Could not read the knowledge base. Please try again.')
        } finally {
          if (activeRequest.current === controller) {
            activeRequest.current = null
            setTyping(false)
          }
        }
        return
      }

      // ── Step 3a: Deterministic answer (high confidence) ─────────────────────
      if (decision.answer) {
        setTyping(false)
        if (evidence.catalog.answer?.correctedQuery) setPendingCorrection(evidence.catalog.answer.correctedQuery)
        setMessages((m) => [...m, { role: 'assistant', content: decision.answer!, products: answerProducts, sources: evidence.sources }])
        return
      }

      // ── Step 3b: Offline fallback (model not loaded) ────────────────────────
      if (!ready) {
        setTyping(false)
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: validateAnswer(offlineReply(resolved, snapshot, evidence.customer.ctx ?? undefined, evidence.customer.attachedName, settings.kbEnabled ? knowledge : [], products, categories), evidence) }
        ])
        if (ai.status === 'error') {
          setNote(`The local model failed to load — answered from built-in knowledge. (${ai.error || 'unknown error'})`)
        } else if (ai.status === 'loading') {
          setNote('The model is still loading — answering from built-in knowledge for now.')
        }
        return
      }

      // ── Step 3c: LLM with full fused context ────────────────────────────────
      const evidencePrompt = buildEvidencePrompt(evidence, snapshot, kbContext, decision.winner)
      const history: AiMessage[] = [
        {
          role: 'system',
          content: buildAssistantSystemPrompt(
            snapshot,
            kbContext,
            evidencePrompt,
            evidence.customer.attachedName,
            evidence.catalog.hits
          )
        },
        ...messages.slice(-12).map(({ role, content }) => ({ role, content })),
        { role: 'user', content: resolved }
      ]

      try {
        const answer = await ai.chat(modelId, history, {
          signal: controller.signal,
          onProgress: () => { if (!controller.signal.aborted) setPhase('composing') }
        })
        if (controller.signal.aborted) return
        setPhase('checking')
        const validated = validateAnswer(answer, evidence)
        setMessages((m) => [...m, { role: 'assistant', content: validated }])
      } catch (err) {
        if (controller.signal.aborted) return
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: validateAnswer(offlineReply(resolved, snapshot, evidence.customer.ctx ?? undefined, evidence.customer.attachedName, settings.kbEnabled ? knowledge : [], products, categories), evidence) }
        ])
        setNote(`Local model error (${(err as Error).message}) — answered from built-in knowledge.`)
      } finally {
        if (activeRequest.current === controller) {
          activeRequest.current = null
          setTyping(false)
        }
      }
    },
    [input, typing, ready, settings.kbEnabled, settings.skillsEnabled, settings.currency, knowledge, skills, bankingContext, customers, sales, products, categories, snapshot, messages, ai, modelId, attachedCustomerId, attachedCustomer, pendingCorrection]
  )

  const statusLine =
    ai.status === 'unsupported'
      ? { icon: <Cpu size={12} />, text: 'WebGPU not available — use Chrome/Edge' }
      : ai.status === 'loading'
        ? { icon: <Loader2 size={12} className="spin" />, text: `Loading model… ${ai.progress}%` }
        : ai.status === 'ready'
          ? { icon: <Wifi size={12} />, text: `In-browser · ${browserModelLabel(ai.modelId ?? modelId)}` }
          : ai.status === 'error'
            ? { icon: <WifiOff size={12} />, text: 'Model failed — local answers' }
            : { icon: <WifiOff size={12} />, text: 'Model not loaded — local answers' }

  return (
    <div className={`ai-panel ax-modern ${expanded ? 'ax-expanded' : ''}`} role="dialog" aria-label="Agent X assistant" onKeyDown={e => { if (e.key === 'Escape') onClose() }}>
      <div className={`ai-panel-header ${typing ? 'agent-x-thinking' : ''}`}>
        <div className="agent-x-avatar agent-x-avatar--header">
          <AgentX size={48} state={agentState} />
        </div>
        <div style={{ flex: 1 }}>
          <h3>Agent X <span className="ax-header-tag">ASSISTANT</span></h3>
          <p title={statusLine.text} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span className={`ax-status-dot ${typing ? 'is-active' : ''}`} /> {typing ? (phase === 'composing' ? 'Writing a response' : phase === 'checking' ? 'Checking sources' : 'Finding relevant context') : ready ? 'Local AI ready' : ai.status === 'loading' ? 'Loading local AI…' : 'Store knowledge ready'}
          </p>
        </div>
        <button className="btn-icon ax-expand" onClick={() => setExpanded(v => !v)} aria-label={expanded ? 'Collapse assistant' : 'Expand assistant'}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
        {ai.status === 'error' && (
          <button className="btn-icon" onClick={() => ai.startLoad(modelId)} aria-label="Reload model" title="Reload model">
            <RefreshCw size={16} />
          </button>
        )}
        <button className="btn-icon" onClick={clearChat} aria-label="Clear chat" title="Clear chat" disabled={messages.length === 0}>
          <Trash2 size={16} />
        </button>
        <button className="btn-icon" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      {ai.status === 'loading' && (
        <div className="ai-progress">
          <div className="progress-track"><div className="progress-fill" style={{ width: `${ai.progress}%` }} /></div>
          <p>{ai.message}</p>
        </div>
      )}

      {(ai.status === 'idle' || ai.status === 'error' || (ai.status === 'ready' && !ready)) && (
        <div className="ai-model-choice">
          <span>Store lookups are ready. Optional AI loads {browserModelLabel(modelId)} on this device.</span>
          <button onClick={() => ai.startLoad(modelId)}>Load local AI</button>
        </div>
      )}
      <div className="ai-messages" ref={scrollRef} role="log" aria-live="polite">
        {messages.length === 0 && <div className="ax-welcome">
          <AgentX size={72} />
          <span className="ax-eyebrow">A LITTLE HELP. A CLEARER DAY.</span>
          <h2>What can I help<br />you with?</h2>
          <p>Explore your store, understand a policy,<br />or find the right product.</p>
          <div className="ax-capabilities"><span><BookOpen size={13} /> Your documents</span><span><ShieldCheck size={13} /> On-device</span></div>
        </div>}
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role === 'assistant' ? 'assistant' : 'user'}`} style={m.role === 'assistant' ? { display: 'flex', gap: 8, alignItems: 'flex-start' } : undefined}>
            {m.role === 'assistant' && (
              <div className="agent-x-msg-dot">
                <AgentX size={22} state="idle" />
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <span className="ax-answer-text">{m.content}</span>
              {m.products?.map(p => (
                <div className="ai-product-card" key={p.id}>
                  <strong>{p.name}</strong>
                  <small>{settings.currency}{p.price.toFixed(2)} · Grade {p.grade} · {p.stock} in stock</small>
                  <button disabled={!products.some(current => current.id === p.id && current.stock > cart.filter(row => row.productId === p.id && row.type === 'sell').reduce((sum, row) => sum + row.qty, 0))} onClick={() => {
                    const current = useStore.getState().products.find(product => product.id === p.id)
                    if (!current || current.stock <= 0) return
                    navigate('/', { state: { assistantCartItem: productToTransactionItem(current, categories, 'sell') } })
                  }}>Add to Cart</button>
                </div>
              ))}
              {m.sources?.map((source, index) => (
                <details key={index} className="ai-source"><summary>Source [{index + 1}]: {source.title}</summary><p>{source.text}</p></details>
              ))}
            </div>
          </div>
        ))}
        {typing && (
          <div className="ax-orb-response" role="status" aria-live="polite">
            <AgentX size={144} state={agentState} />
            <span className="ax-orb-caption">{phase === 'checking' ? 'Checking sources' : 'Thinking'}</span>
          </div>
        )}
        {note && <div className="ai-msg error">{note}</div>}
      </div>

      <div className={`ai-suggestions ${messages.length ? 'ax-compact-suggestions' : ''}`}>
        {SUGGESTIONS.map((s) => (
          <button key={s} disabled={typing} onClick={() => send(s)}>{s}</button>
        ))}
      </div>

      <div className="ai-input">
        <textarea
          ref={inputRef}
          rows={2}
          aria-label="Message Agent X"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
          placeholder="Ask anything about your store…"
        />
        {typing && <button className="ax-stop" onClick={stop} aria-label="Stop generating" title="Stop generating"><Square size={16} fill="currentColor" /></button>}
        <button hidden={typing} className="send" aria-label="Send message" onClick={() => send()} disabled={typing || !input.trim()}>
          <ArrowUp size={19} />
        </button>
      </div>
      <div className="ax-footer"><span><ShieldCheck size={12} /> Private by design</span><span>Enter to send · Shift + Enter for a new line</span></div>
    </div>
  )
}

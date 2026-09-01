import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, Send, X, Wifi, WifiOff, Loader2, RefreshCw, Cpu, Trash2 } from 'lucide-react'
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

const SUGGESTIONS: string[] = []

export default function AiAssistant() {
  const enabled = useStore((s) => s.settings.aiEnabled)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<AiMessage[]>([])

  if (!enabled) return null

  return (
    <>
      <button className="ai-fab" onClick={() => setOpen((o) => !o)} aria-label="AI assistant">
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
  const [note, setNote] = useState('')
  const [pendingCorrection, setPendingCorrection] = useState<string | undefined>()
  const scrollRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  const snapshot = useMemo(
    () => buildSnapshot(products, sales, customers, settings),
    [products, sales, customers, settings]
  )

  const modelId = settings.browserModel

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    if (
      ai.status === 'idle' ||
      (ai.status === 'ready' && ai.modelId !== modelId) ||
      ai.status === 'error'
    ) {
      ai.startLoad(modelId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, typing, ai.progress])

  const ready = ai.status === 'ready' && ai.modelId === modelId

  // Agent X state: map UI state to character animation state
  const lastMsg = messages[messages.length - 1]
  const lastWasError = lastMsg?.role === 'assistant' && note.length > 0
  const agentState: AgentState = typing ? 'thinking' : lastWasError ? 'error' : 'idle'

  const clearChat = useCallback(() => {
    setMessages([])
    setNote('')
    setInput('')
    setTyping(false)
  }, [setMessages])

  const send = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim()
      if (!content || typing) return
      setNote('')
      setInput('')
      setMessages((m) => [...m, { role: 'user', content }])
      setTyping(true)

      const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content
      const resolved = resolveFollowUp(content, lastUser, products.map((p) => p.name))

      // Handle typo correction confirmation — if user confirms, re-run with corrected query
      if (pendingCorrection && /^\s*(yes|yeah|yep|ok|okay|sure|y|ya)\s*[!.?]?\s*$/i.test(content)) {
        // Wrap corrected query in a proper question so catalogAnswer can detect intent
        const corrected = catalogAnswer(`do we have ${pendingCorrection}?`, products, categories)
        setPendingCorrection(undefined)
        if (corrected) {
          setTyping(false)
          setMessages((m) => [...m, { role: 'assistant', content: corrected.message }])
          return
        }
      }
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

      // ── Step 3a: Deterministic answer (high confidence) ─────────────────────
      if (decision.answer) {
        setTyping(false)
        if (evidence.catalog.answer?.correctedQuery) setPendingCorrection(evidence.catalog.answer.correctedQuery)
        setMessages((m) => [...m, { role: 'assistant', content: decision.answer! }])
        return
      }

      // ── Step 3b: Offline fallback (model not loaded) ────────────────────────
      if (!ready) {
        setTyping(false)
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: offlineReply(resolved, snapshot, evidence.customer.ctx ?? undefined, evidence.customer.attachedName, knowledge) }
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
        ...messages,
        { role: 'user', content: resolved }
      ]

      try {
        const answer = await ai.chat(modelId, history)
        const validated = validateAnswer(answer, evidence)
        setMessages((m) => [...m, { role: 'assistant', content: validated }])
      } catch (err) {
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: offlineReply(content, snapshot, evidence.customer.ctx ?? undefined, evidence.customer.attachedName, knowledge) }
        ])
        setNote(`Local model error (${(err as Error).message}) — answered from built-in knowledge.`)
      } finally {
        setTyping(false)
      }
    },
    [input, typing, ready, settings.kbEnabled, settings.skillsEnabled, settings.currency, knowledge, skills, bankingContext, customers, sales, products, categories, snapshot, messages, ai, modelId, attachedCustomerId, attachedCustomer]
  )

  const statusLine =
    ai.status === 'unsupported'
      ? { icon: <Cpu size={12} />, text: 'WebGPU not available — use Chrome/Edge' }
      : ai.status === 'loading'
        ? { icon: <Loader2 size={12} className="spin" />, text: `Loading model… ${ai.progress}%` }
        : ai.status === 'ready'
          ? { icon: <Wifi size={12} />, text: `In-browser · ${browserModelLabel(modelId)}` }
          : ai.status === 'error'
            ? { icon: <WifiOff size={12} />, text: 'Model failed — local answers' }
            : { icon: <WifiOff size={12} />, text: 'Model not loaded — local answers' }

  return (
    <div className="ai-panel">
      <div className={`ai-panel-header ${typing ? 'agent-x-thinking' : ''}`}>
        <div className="agent-x-avatar agent-x-avatar--header">
          <AgentX size={48} state={agentState} />
        </div>
        <div style={{ flex: 1 }}>
          <h3>Agent X</h3>
          <p style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {statusLine.icon} {statusLine.text}
          </p>
        </div>
        {(ai.status === 'ready' || ai.status === 'error') && (
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

      <div className="ai-messages" ref={scrollRef}>
        <div className="ai-msg assistant" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div className="agent-x-msg-dot">
            <AgentX size={14} state="idle" />
          </div>
          <span>Hey! I'm <b>Agent X</b> — your private, in-browser assistant. Ask me anything about sales, stock, customers, or store policies.</span>
        </div>
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role === 'assistant' ? 'assistant' : 'user'}`} style={m.role === 'assistant' ? { display: 'flex', gap: 8, alignItems: 'flex-start' } : undefined}>
            {m.role === 'assistant' && (
              <div className="agent-x-msg-dot">
                <AgentX size={14} state={typing ? 'thinking' : 'idle'} />
              </div>
            )}
            <span>{m.content}</span>
          </div>
        ))}
        {typing && (
          <div className="ai-msg assistant typing" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="agent-x-msg-dot">
              <AgentX size={14} state="thinking" />
            </div>
            <span>Agent X is analysing…</span>
          </div>
        )}
        {note && <div className="ai-msg error">{note}</div>}
      </div>

      <div className="ai-suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)}>{s}</button>
        ))}
      </div>

      <div className="ai-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask Agent X about the store…"
        />
        <button className="send" onClick={() => send()} disabled={typing || !input.trim()}>
          <Send size={17} />
        </button>
      </div>
    </div>
  )
}

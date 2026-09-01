import { create } from 'zustand'
import {
  loadBrowserModel,
  browserChat,
  isWebGpuSupported
} from '../utils/browserLlm'
import type { AiMessage } from '../utils/ai'

export type BrowserAiStatus = 'unsupported' | 'idle' | 'loading' | 'ready' | 'error'

interface BrowserAiState {
  status: BrowserAiStatus
  progress: number
  message: string
  error: string
  modelId: string | null
  startLoad: (modelId: string) => Promise<void>
  chat: (modelId: string, messages: AiMessage[]) => Promise<string>
  reset: () => void
}

export const useBrowserAi = create<BrowserAiState>((set, get) => ({
  status: isWebGpuSupported() ? 'idle' : 'unsupported',
  progress: 0,
  message: '',
  error: '',
  modelId: null,

  startLoad: async (modelId) => {
    const st = get()
    if (st.status === 'ready' && st.modelId === modelId) return
    if (st.status === 'loading') return

    set({ status: 'loading', progress: 0, message: 'Preparing…', error: '', modelId })

    try {
      await loadBrowserModel(modelId, (p, text) => {
        const t = text || ''
        const pct = Math.max(0, Math.min(100, Math.round(p * 100)))
        set({ progress: pct, message: t.length > 100 ? `${t.slice(0, 100)}…` : t })
      })
      set({ status: 'ready', progress: 100, message: 'Model ready', error: '' })
    } catch (err) {
      set({ status: 'error', progress: 0, message: '', error: (err as Error).message })
    }
  },

  chat: async (modelId, messages) => {
    return browserChat(modelId, messages)
  },

  reset: () =>
    set({
      status: isWebGpuSupported() ? 'idle' : 'unsupported',
      progress: 0,
      message: '',
      error: '',
      modelId: null
    })
}))

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  loadBrowserModel,
  browserChat,
  isWebGpuSupported,
  normalizeModelId
} from '../utils/browserLlm'
import type { AiMessage } from '../utils/ai'

export type BrowserAiStatus = 'unsupported' | 'idle' | 'loading' | 'ready' | 'error'

interface BrowserAiState {
  status: BrowserAiStatus
  progress: number
  message: string
  error: string
  modelId: string | null
  /** Model ids that have been loaded at least once — their weights are cached in the browser, so re-loads are fast. */
  downloadedModels: string[]
  startLoad: (modelId: string) => Promise<void>
  chat: (modelId: string, messages: AiMessage[], opts?: { signal?: AbortSignal; onProgress?: (text: string) => void }) => Promise<string>
  reset: () => void
}

/** True when the given model has been loaded before, so we can say "load from cache" instead of "download". */
export function isModelCached(modelId: string, downloadedModels: string[]): boolean {
  const n = normalizeModelId(modelId)
  return downloadedModels.includes(n)
}

export const useBrowserAi = create<BrowserAiState>()(
  persist(
    (set, get) => ({
      status: isWebGpuSupported() ? 'idle' : 'unsupported',
      progress: 0,
      message: '',
      error: '',
      modelId: null,
      downloadedModels: [],

      startLoad: async (modelId) => {
        const st = get()
        if (st.status === 'ready' && st.modelId === modelId) return
        if (st.status === 'loading') return

        const cached = isModelCached(modelId, st.downloadedModels)
        set({
          status: 'loading',
          progress: 0,
          message: cached ? 'Loading model from cache…' : 'Downloading model… (first time, keep this tab open)',
          error: '',
          modelId
        })

        try {
          await loadBrowserModel(modelId, (p, text) => {
            const t = text || ''
            const pct = Math.max(0, Math.min(100, Math.round(p * 100)))
            set({ progress: pct, message: t.length > 100 ? `${t.slice(0, 100)}…` : t })
          })
          set((s) => ({
            status: 'ready',
            progress: 100,
            message: 'Model ready',
            error: '',
            downloadedModels: s.downloadedModels.includes(normalizeModelId(modelId))
              ? s.downloadedModels
              : [...s.downloadedModels, normalizeModelId(modelId)]
          }))
        } catch (err) {
          set({ status: 'error', progress: 0, message: '', error: (err as Error).message })
        }
      },

      chat: async (modelId, messages, opts) => {
        return browserChat(modelId, messages, opts)
      },

      reset: () =>
        set({
          status: isWebGpuSupported() ? 'idle' : 'unsupported',
          progress: 0,
          message: '',
          error: '',
          modelId: null
        })
    }),
    {
      name: 'mepos-browser-ai',
      // Only the cache-records survive a page reload; runtime status/engine are in memory.
      partialize: (s) => ({ downloadedModels: s.downloadedModels })
    }
  )
)

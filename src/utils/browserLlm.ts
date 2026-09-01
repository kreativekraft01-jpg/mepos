import type { MLCEngine } from '@mlc-ai/web-llm'
import type { AiMessage } from './ai'

export interface BrowserModelOption {
  id: string
  label: string
  size: string
  memory: string
  note: string
  light?: boolean
}

export const BROWSER_MODELS: BrowserModelOption[] = [
  {
    id: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
    label: 'SmolLM2 360M',
    size: '~270 MB',
    memory: '~380 MB',
    note: 'Lightest',
    light: true
  },
  {
    id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 0.5B',
    size: '~400 MB',
    memory: '~950 MB',
    note: 'Very light',
    light: true
  },
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 1.5B',
    size: '~1.1 GB',
    memory: '~1.6 GB',
    note: 'Recommended',
    light: true
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 1B',
    size: '~800 MB',
    memory: '~880 MB',
    note: 'Smart & small'
  },
  {
    id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 3B',
    size: '~2.4 GB',
    memory: '~2.5 GB',
    note: 'Best answers'
  }
]

export const DEFAULT_BROWSER_MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC'

/** Strips any accidental repo/prefix from a model id (older builds saved "mlc-ai/…"). */
export function normalizeModelId(id: string): string {
  return (id ?? '').trim().replace(/^mlc-ai\//, '')
}

/** Validates a model id against the models this package ships. */
export function isKnownBrowserModel(id: string): boolean {
  return BROWSER_MODELS.some((m) => m.id === normalizeModelId(id))
}

export function browserModelLabel(id: string): string {
  const n = normalizeModelId(id)
  return BROWSER_MODELS.find((m) => m.id === n)?.label ?? n.split('/').pop() ?? n
}

export function isWebGpuSupported(): boolean {
  if (typeof navigator === 'undefined') return false
  return !!(navigator as Navigator & { gpu?: unknown }).gpu
}

let engine: MLCEngine | null = null
let engineModelId: string | null = null
let loadPromise: Promise<MLCEngine> | null = null
let webllmPromise: Promise<typeof import('@mlc-ai/web-llm')> | null = null

/** Lazy-loads the WebLLM runtime so the ~6 MB library only downloads when the AI is used. */
function getWebLLM(): Promise<typeof import('@mlc-ai/web-llm')> {
  if (!webllmPromise) webllmPromise = import('@mlc-ai/web-llm')
  return webllmPromise
}

export function currentEngineModel(): string | null {
  return engineModelId
}

/** Loads (and caches) the model in the browser. First run downloads, then loads from cache. */
export async function loadBrowserModel(
  rawModelId: string,
  onProgress?: (progress: number, text: string) => void
): Promise<MLCEngine> {
  const modelId = normalizeModelId(rawModelId)
  if (engine && engineModelId === modelId) return engine
  if (loadPromise) return loadPromise

  if (engine) {
    try {
      await engine.unload()
    } catch {
      /* ignore */
    }
    engine = null
    engineModelId = null
  }

  const { CreateMLCEngine } = await getWebLLM()

  loadPromise = CreateMLCEngine(modelId, {
    logLevel: 'WARN',
    initProgressCallback: (report: { progress: number; text: string }) => {
      onProgress?.(report.progress, report.text)
    }
  })
    .then((eng) => {
      engine = eng
      engineModelId = modelId
      return eng
    })
    .finally(() => {
      loadPromise = null
    })

  return loadPromise
}

export async function browserChat(
  rawModelId: string,
  messages: AiMessage[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const modelId = normalizeModelId(rawModelId)
  const eng = await loadBrowserModel(modelId)
  const completion = await eng.chat.completions.create({
    messages: messages as unknown as Parameters<typeof eng.chat.completions.create>[0]['messages'],
    temperature: opts?.temperature ?? 0.3,
    max_tokens: opts?.maxTokens ?? 450,
    stream: false
  } as never)

  const content = completion.choices?.[0]?.message?.content
  if (!content) throw new Error('Model returned an empty response')
  return content.trim()
}

export function resetBrowserModel(): void {
  engine = null
  engineModelId = null
  loadPromise = null
}

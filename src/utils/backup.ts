import { useStore, DEFAULT_SETTINGS } from '../store/useStore'
import { STORE_VERSION } from '../store/useStore'

export interface BackupPayload {
  app: string
  version: number
  storeVersion: number
  exportedAt: string
  data: {
    categories: unknown[]
    products: unknown[]
    customers: unknown[]
    sales: unknown[]
    vouchers: unknown[]
    knowledge: unknown[]
    skills: unknown[]
    tills: unknown[]
    activeTillId?: string
    savedCarts: unknown[]
    settings: unknown
  }
}

export function createBackupPayload(): BackupPayload {
  const s = useStore.getState()
  return {
    app: 'nova-pos',
    version: 1,
    storeVersion: STORE_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      categories: s.categories,
      products: s.products,
      customers: s.customers,
      sales: s.sales,
      vouchers: s.vouchers,
      knowledge: s.knowledge,
      skills: s.skills,
      tills: s.tills,
      activeTillId: s.activeTillId,
      savedCarts: s.savedCarts,
      settings: s.settings,
    },
  }
}

export function downloadBackup() {
  const payload = createBackupPayload()
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  const storeName = (payload.data.settings as { storeName?: string })?.storeName ?? 'nova-pos'
  const safe = storeName.replace(/\s+/g, '-').toLowerCase()
  a.href = url
  a.download = `${safe}-backup-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function validateBackupPayload(obj: unknown): obj is BackupPayload {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  if (o.app !== 'nova-pos') return false
  if (!o.data || typeof o.data !== 'object') return false
  const d = o.data as Record<string, unknown>
  return Array.isArray(d.categories) && Array.isArray(d.products) && Array.isArray(d.knowledge) && !!d.settings
}

export async function restoreFromFile(file: File): Promise<{ ok: boolean; error?: string }> {
  try {
    const text = await file.text()
    const parsed = JSON.parse(text)
    if (!validateBackupPayload(parsed)) return { ok: false, error: 'Invalid backup file — not a nova-pos backup' }
    const data = parsed.data as BackupPayload['data'] & { settings: Record<string, unknown> }
    // Merge settings with defaults to handle upgrades
    const settings = { ...DEFAULT_SETTINGS, ...(data.settings as object) }
    useStore.setState({
      categories: data.categories as never,
      products: data.products as never,
      customers: data.customers as never,
      sales: data.sales as never,
      vouchers: data.vouchers as never,
      knowledge: data.knowledge as never,
      skills: data.skills as never,
      tills: data.tills as never,
      activeTillId: data.activeTillId as never,
      savedCarts: (data.savedCarts ?? []) as never,
      settings: settings as never,
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

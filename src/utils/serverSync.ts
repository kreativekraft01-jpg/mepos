import { useStore, DEFAULT_SETTINGS } from '../store/useStore'
import { useAuthStore } from '../store/authStore'
import { seedCategories, seedProducts, seedCustomers, seedKnowledge, seedSkills, seedTills } from '../store/seed'

/**
 * Server synchronisation.
 *
 * Two bugs made edits appear to vanish in the Render deployment:
 *  1. Sync only initialised on first mount. If the app loaded on /#/login there
 *     was no token yet, the probe returned 401 and sync never started again —
 *     so a whole logged-in session was never written to Postgres.
 *  2. `saveToServer` silently dropped writes while another request was in
 *     flight, and ignored non-2xx responses. Rapid edits (or one failed save)
 *     were lost with no retry.
 *
 * This controller subscribes to the auth token, queues/coalesces writes instead
 * of dropping them, retries failures, and keeps a "dirty" flag so edits made
 * before login are pushed instead of being overwritten by the older server copy.
 */

export const SNAPSHOT_KEYS = [
  'categories',
  'products',
  'customers',
  'sales',
  'vouchers',
  'knowledge',
  'skills',
  'tills',
  'activeTillId',
  'savedCarts',
  'settings',
] as const

const ARRAY_KEYS = [
  'categories',
  'products',
  'customers',
  'sales',
  'vouchers',
  'knowledge',
  'skills',
  'tills',
  'savedCarts',
] as const

export type Snapshot = Record<string, unknown> & {
  categories: unknown[]
  products: unknown[]
  customers: unknown[]
  sales: unknown[]
  vouchers: unknown[]
  knowledge: unknown[]
  skills: unknown[]
  tills: unknown[]
  savedCarts: unknown[]
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

/** Build the exact payload we send to `PUT /api/state` from the store. */
export function snapshotOf(state: Record<string, unknown>): Snapshot {
  const out: Record<string, unknown> = {}
  for (const key of SNAPSHOT_KEYS) out[key] = state[key]
  for (const key of ARRAY_KEYS) if (!Array.isArray(out[key])) out[key] = []
  return out as Snapshot
}

/** Minimal validation — a snapshot without a products array is not our state. */
export function isValidSnapshot(data: unknown): data is Snapshot {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  return Array.isArray((data as Record<string, unknown>).products)
}

/** Snapshot fields that should be applied to the local store after a pull. */
export function storePatchFromSnapshot(data: Snapshot): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const key of SNAPSHOT_KEYS) patch[key] = data[key]
  for (const key of ARRAY_KEYS) if (!Array.isArray(patch[key])) patch[key] = []
  return patch
}

export const DIRTY_KEY = 'mepos-sync-dirty'
export const BASELINE_KEY = 'mepos-sync-baseline'

function readDirty(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(DIRTY_KEY) === '1'
  } catch {
    return false
  }
}

function writeDirty(dirty: boolean) {
  try {
    if (typeof localStorage === 'undefined') return
    if (dirty) localStorage.setItem(DIRTY_KEY, '1')
    else localStorage.removeItem(DIRTY_KEY)
  } catch {
    /* storage blocked — in-memory flag still works */
  }
}

function readBaseline(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(BASELINE_KEY)
  } catch {
    return null
  }
}

function writeBaseline(value: string) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(BASELINE_KEY, value)
  } catch {
    /* ignore */
  }
}

/** Stable content key: ids/timestamps change per page load and do not signal an edit. */
function contentKey(value: unknown): string {
  return (
    JSON.stringify(value, (key, v) =>
      key === 'id' || key === 'createdAt' || key === 'updatedAt' || key === 'openedAt' || key === 'closedAt'
        ? undefined
        : v
    ) ?? ''
  )
}

/** Fingerprint of the synced data (ignores ids/timestamps). */
export function fingerprint(snapshot: Snapshot): string {
  const text = contentKey(snapshot)
  let hash = 5381
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0
  return `${text.length}:${hash.toString(16)}`
}

/**
 * True when the local store is still the untouched demo seed — a brand-new
 * device that should adopt the server copy instead of overwriting it.
 */
export function isPristineStore(snapshot: Snapshot): boolean {
  if (!snapshot.settings) return false
  const userSettings = ['storeName', 'tagline', 'currency', 'taxRate', 'receiptFooter', 'aiEnabled', 'kbEnabled', 'skillsEnabled'] as const
  for (const key of userSettings) {
    if (JSON.stringify((snapshot.settings as Record<string, unknown>)[key]) !== JSON.stringify(DEFAULT_SETTINGS[key])) return false
  }
  const same = (local: unknown, seed: unknown) => contentKey(local) === contentKey(seed)
  return (
    same(snapshot.categories, seedCategories) &&
    same(snapshot.products, seedProducts) &&
    same(snapshot.customers, seedCustomers) &&
    same(snapshot.knowledge, seedKnowledge) &&
    same(snapshot.skills, seedSkills) &&
    same(snapshot.tills, seedTills) &&
    Array.isArray(snapshot.vouchers) &&
    snapshot.vouchers.length === 0 &&
    Array.isArray(snapshot.savedCarts) &&
    snapshot.savedCarts.length === 0 &&
    snapshot.activeTillId == null
  )
}

/**
 * Decide whether the local copy must be pushed at startup.
 *
 * - A stored dirty flag always wins.
 * - With a baseline, any content change since the last sync is unsaved work.
 * - Without a baseline (first load after upgrading from an older client) a
 *   pristine demo store adopts the server copy; a store with real local edits
 *   is pushed so the data users reported as "not saving" is not overwritten.
 */
export function needsPushOnStart(options: { snapshot: Snapshot; baseline: string | null; dirty: boolean }): boolean {
  if (options.dirty) return true
  if (options.baseline != null) return fingerprint(options.snapshot) !== options.baseline
  return !isPristineStore(options.snapshot)
}

export interface SyncDeps {
  stateUrl: string
  fetchImpl?: typeof fetch
  getToken?: () => string | null
  subscribeAuth?: (fn: (token: string | null) => void) => () => void
  getSnapshot?: () => Snapshot
  applySnapshot?: (snapshot: Snapshot) => void
  subscribeStore?: (fn: () => void) => () => void
  isDirty?: () => boolean
  setDirty?: (dirty: boolean) => void
  debounceMs?: number
  retryMs?: number
  schedule?: (fn: () => void, ms: number) => unknown
  cancel?: (handle: unknown) => void
  onError?: (message: string | null) => void
  onStatus?: (status: SyncStatus) => void
}

/** Coalescing, retrying state sync. Exported so the behaviour can be unit-tested. */
export class ServerSync {
  private readonly deps: Required<Omit<SyncDeps, 'onError' | 'onStatus'>> & Pick<SyncDeps, 'onError' | 'onStatus'>
  private started = false
  private active = false
  private loading = false
  private applying = false
  private inFlight = false
  private pending = false
  private version = 0
  private token: string | null = null
  private timer: unknown = null
  private status: SyncStatus = 'idle'
  private dirty: boolean
  private unsubStore: (() => void) | null = null
  private unsubAuth: (() => void) | null = null

  constructor(deps: SyncDeps) {
    this.dirty = (deps.isDirty ?? readDirty)()
    this.deps = {
      stateUrl: deps.stateUrl,
      fetchImpl: deps.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args)),
      getToken: deps.getToken ?? (() => null),
      subscribeAuth: deps.subscribeAuth ?? (() => () => {}),
      getSnapshot: deps.getSnapshot ?? (() => snapshotOf({})),
      applySnapshot: deps.applySnapshot ?? (() => {}),
      subscribeStore: deps.subscribeStore ?? (() => () => {}),
      isDirty: deps.isDirty ?? readDirty,
      setDirty: deps.setDirty ?? writeDirty,
      debounceMs: deps.debounceMs ?? 800,
      retryMs: deps.retryMs ?? 5000,
      schedule: deps.schedule ?? ((fn, ms) => setTimeout(fn, ms)),
      cancel: deps.cancel ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)),
      onError: deps.onError,
      onStatus: deps.onStatus,
    }
  }

  getStatus(): SyncStatus {
    return this.status
  }

  isActive(): boolean {
    return this.active
  }

  isDirty(): boolean {
    return this.dirty
  }

  start(): void {
    if (this.started) return
    this.started = true
    // Track every edit, even before login, so it can be pushed on sign-in.
    this.unsubStore = this.deps.subscribeStore(() => this.handleStoreChange())
    this.unsubAuth = this.deps.subscribeAuth((token) => this.handleTokenChange(token))
    this.handleTokenChange(this.deps.getToken())
  }

  stop(): void {
    this.started = false
    this.active = false
    this.cancelScheduled()
    this.unsubStore?.()
    this.unsubAuth?.()
    this.unsubStore = null
    this.unsubAuth = null
  }

  private handleStoreChange(): void {
    if (this.applying) return
    this.version += 1
    this.setDirty(true)
    if (this.active) this.scheduleSave(this.deps.debounceMs)
  }

  private handleTokenChange(token: string | null): void {
    const previous = this.token
    this.token = token
    if (!token) {
      this.cancelScheduled()
      // Best effort: push pending edits with the token we still hold.
      if (this.dirty && previous) void this.save(previous)
      this.active = false
      this.setStatus('idle')
      return
    }
    if (this.active) return
    void this.reload()
  }

  /** Pull the server copy, apply it when safe, otherwise push local state. */
  async reload(): Promise<boolean> {
    const token = this.token
    if (!token || this.loading) return false
    this.loading = true
    this.active = false
    this.setStatus('syncing')
    try {
      const res = await this.deps.fetchImpl(this.deps.stateUrl, {
        method: 'GET',
        headers: { ...this.auth(token) },
      })
      if (!res.ok) {
        if (res.status === 401) {
          this.active = false
          this.setStatus('offline')
          this.deps.onError?.('Session expired — sign in again to sync changes.')
          return false
        }
        // Server hiccup (e.g. Render cold start): keep accepting local edits and
        // retry the pull shortly instead of disabling sync for the session.
        this.active = true
        this.setStatus('offline')
        this.deps.onError?.('Could not load server data — retrying.')
        if (this.dirty) this.scheduleSave(this.deps.debounceMs)
        else this.scheduleReload()
        return false
      }
      const json = (await res.json().catch(() => null)) as { data?: unknown } | null
      const remote = json?.data
      this.active = true

      if (isValidSnapshot(remote) && !this.dirty) {
        // Server is authoritative on a clean device.
        this.applying = true
        try {
          this.deps.applySnapshot(remote)
        } finally {
          this.applying = false
        }
        this.setDirty(false)
        this.setStatus('synced')
        this.deps.onError?.(null)
        return true
      }

      // No server data yet, or this device has unsaved edits: push local state.
      this.setStatus('syncing')
      const ok = await this.save(token)
      if (ok) this.deps.onError?.(null)
      return ok
    } catch {
      // Offline / cold start: keep sync enabled so edits retry on the next save.
      this.active = true
      this.setStatus('offline')
      this.deps.onError?.('Cannot reach the server — changes are kept on this device and will retry.')
      if (this.dirty) this.scheduleSave(this.deps.debounceMs)
      else this.scheduleReload()
      return false
    } finally {
      this.loading = false
    }
  }

  private auth(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}` }
  }

  private scheduleSave(ms: number): void {
    this.cancelScheduled()
    this.timer = this.deps.schedule(() => {
      this.timer = null
      void this.save()
    }, ms)
  }

  private scheduleReload(): void {
    this.cancelScheduled()
    this.timer = this.deps.schedule(() => {
      this.timer = null
      void this.reload()
    }, this.deps.retryMs)
  }

  private cancelScheduled(): void {
    if (this.timer != null) {
      this.deps.cancel(this.timer)
      this.timer = null
    }
  }

  /** Save now (used by tests and explicit flushes). Never drops a concurrent edit. */
  async save(overrideToken?: string): Promise<boolean> {
    const token = overrideToken ?? this.token
    if (!token || !this.active) return false
    if (this.inFlight) {
      this.pending = true
      return false
    }
    this.inFlight = true
    const versionAtSave = this.version
    try {
      const res = await this.deps.fetchImpl(this.deps.stateUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...this.auth(token) },
        body: JSON.stringify(this.deps.getSnapshot()),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`Save failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`)
      }
      // Only mark clean if nothing changed while the request was in flight.
      if (this.version === versionAtSave) {
        this.dirty = false
        this.deps.setDirty(false)
      } else {
        this.pending = true
      }
      this.setStatus('synced')
      return true
    } catch (error) {
      this.dirty = true
      this.deps.setDirty(true)
      this.setStatus('error')
      this.deps.onError?.((error as Error).message || 'Could not save to the server — retrying.')
      if (this.active) this.scheduleSave(this.deps.retryMs)
      return false
    } finally {
      this.inFlight = false
      if (this.pending) {
        this.pending = false
        if (this.active) this.scheduleSave(this.deps.debounceMs)
      }
    }
  }

  /** Force an immediate save, waiting for any in-flight request first. */
  async flush(): Promise<boolean> {
    this.cancelScheduled()
    this.pending = true
    const deadline = Date.now() + 5000
    while (this.inFlight && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    this.pending = false
    return this.save()
  }

  private setStatus(status: SyncStatus): void {
    this.status = status
    this.deps.onStatus?.(status)
  }

  private setDirty(dirty: boolean): void {
    this.dirty = dirty
    this.deps.setDirty(dirty)
  }
}

function envApiBase(): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env
    return env?.VITE_API_URL ?? ''
  } catch {
    return ''
  }
}

function stateUrlFor(base: string): string {
  return `${base}/api/state`.replace('//api', '/api')
}

const API = envApiBase()

const statusListeners = new Set<(status: SyncStatus) => void>()
function notifyStatus(status: SyncStatus) {
  for (const listener of statusListeners) listener(status)
}

/** Subscribe to sync status for the small "saved / saving / offline" badge. */
export function subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
  statusListeners.add(listener)
  return () => {
    statusListeners.delete(listener)
  }
}

let lastError = ''
let lastErrorAt = 0
function reportError(message: string | null) {
  if (!message) {
    lastError = ''
    return
  }
  // Do not spam a toast on every retry.
  if (message === lastError && Date.now() - lastErrorAt < 30000) return
  lastError = message
  lastErrorAt = Date.now()
  try {
    useStore.getState().pushToast('error', message)
  } catch {
    /* no store in a non-browser context */
  }
}

const localSnapshot = () => snapshotOf(useStore.getState() as unknown as Record<string, unknown>)

const initialDirty = needsPushOnStart({
  snapshot: localSnapshot(),
  baseline: readBaseline(),
  dirty: readDirty(),
})

const singleton = new ServerSync({
  stateUrl: stateUrlFor(API),
  getToken: () => useAuthStore.getState().token,
  subscribeAuth: (fn) =>
    useAuthStore.subscribe((state, previous) => {
      if (state.token !== previous.token) fn(state.token)
    }),
  getSnapshot: localSnapshot,
  applySnapshot: (snapshot) => useStore.setState(storePatchFromSnapshot(snapshot) as never),
  // Ignore non-persisted state changes (toasts, cart, current page) so a mere
  // notification does not mark the whole store as having unsaved edits.
  subscribeStore: (fn) =>
    useStore.subscribe((state, previous) => {
      if (SNAPSHOT_KEYS.some((key) => state[key] !== previous[key])) fn()
    }),
  isDirty: () => initialDirty,
  setDirty: (dirty) => {
    writeDirty(dirty)
    // Remember exactly what the server has so the next load can tell whether
    // local edits were never pushed.
    if (!dirty) writeBaseline(fingerprint(localSnapshot()))
  },
  onError: reportError,
  onStatus: notifyStatus,
})

/** Call once from App. Safe to call more than once. */
export function initServerSync(): void {
  singleton.start()
}

/** Pull the latest server state (used after login). */
export function loadFromServer(): Promise<boolean> {
  return singleton.reload()
}

/** Force a save now; resolves to false when offline or unauthenticated. */
export async function saveToServer(): Promise<boolean> {
  return singleton.flush()
}

export function getSyncStatus(): SyncStatus {
  return singleton.getStatus()
}

export function hasPendingSync(): boolean {
  return singleton.isDirty()
}

/** Test hook: the controller used by the app. */
export function getServerSync(): ServerSync {
  return singleton
}

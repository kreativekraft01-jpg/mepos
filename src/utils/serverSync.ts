import { useStore } from '../store/useStore'
import { authHeaders } from '../store/authStore'

const API = ((import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL as string | undefined) || ''
const STATE_URL = `${API}/api/state`.replace('//api', '/api')

let initialized = false
let saving = false

export async function loadFromServer(): Promise<boolean> {
  try {
    const res = await fetch(STATE_URL, { method: 'GET', headers: { ...authHeaders() } })
    if (!res.ok) return false
    const json = await res.json()
    const data = json?.data
    if (!data || typeof data !== 'object') return false
    // Basic validation
    if (!Array.isArray((data as Record<string, unknown>).products)) return false
    // Apply to store — merge, keep ready flag
    useStore.setState({
      categories: (data as Record<string, unknown>).categories as never,
      products: (data as Record<string, unknown>).products as never,
      customers: (data as Record<string, unknown>).customers as never,
      sales: (data as Record<string, unknown>).sales as never,
      vouchers: ((data as Record<string, unknown>).vouchers ?? []) as never,
      knowledge: (data as Record<string, unknown>).knowledge as never,
      skills: (data as Record<string, unknown>).skills as never,
      tills: (data as Record<string, unknown>).tills as never,
      activeTillId: (data as Record<string, unknown>).activeTillId as never,
      savedCarts: ((data as Record<string, unknown>).savedCarts ?? []) as never,
      settings: (data as Record<string, unknown>).settings as never,
    })
    return true
  } catch {
    return false
  }
}

export async function saveToServer() {
  if (saving) return
  saving = true
  try {
    const s = useStore.getState()
    const payload = {
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
    }
    await fetch(STATE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
  } catch {
    // silent — localStorage persist still keeps data
  } finally {
    saving = false
  }
}

// Call once from App to enable server sync when API is reachable
export function initServerSync() {
  if (initialized) return
  initialized = true
  // Detect if server API exists (Render dynamic mode). If not reachable or 401, stay in local-only mode until login.
  fetch(STATE_URL, { method: 'GET', headers: { ...authHeaders() } }).then(async (res) => {
    if (!res.ok) return
    const json = await res.json().catch(() => null)
    if (json?.data) await loadFromServer()
    // Subscribe to changes -> debounced save
    let timeout: ReturnType<typeof setTimeout> | null = null
    let first = true
    useStore.subscribe((state, prev) => {
      // Ignore toasts/ready/bankingContext changes to avoid spam
      const keys: (keyof typeof state)[] = ['categories','products','customers','sales','vouchers','knowledge','skills','tills','activeTillId','savedCarts','settings']
      const changed = keys.some(k => (state as unknown as Record<string, unknown>)[k as string] !== (prev as unknown as Record<string, unknown>)[k as string])
      if (!changed) return
      if (first) { first = false; return } // skip the initial load-triggered change
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => { void saveToServer() }, 800)
    })
  }).catch(() => {
    // No server — stay local
  })
}

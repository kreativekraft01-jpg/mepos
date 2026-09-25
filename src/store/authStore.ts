import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  username: string | null
  setAuth: (token: string, username: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      username: null,
      setAuth: (token, username) => set({ token, username }),
      logout: () => set({ token: null, username: null }),
    }),
    { name: 'mepos-auth' }
  )
)

export function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function loginRequest(username: string, password: string): Promise<{ ok: boolean; token?: string; error?: string }> {
  const API = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL || ''
  const url = `${API}/api/auth/login`.replace('//api', '/api')
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error || 'Login failed' }
    const token = (data as { token?: string }).token
    if (!token) return { ok: false, error: 'No token returned' }
    useAuthStore.getState().setAuth(token, username)
    return { ok: true, token }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function verifyToken(): Promise<boolean> {
  const token = useAuthStore.getState().token
  if (!token) return false
  const API = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL || ''
  const url = `${API}/api/auth/me`.replace('//api', '/api')
  try {
    const res = await fetch(url, { headers: authHeaders() })
    return res.ok
  } catch {
    return false
  }
}

import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import { useAuthStore, verifyToken } from './store/authStore'
import { initServerSync } from './utils/serverSync'
import MEPoSApp from './app/App'
import Login from './pages/Login'
import Layout from './components/Layout'
import Toasts from './components/Toasts'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Inventory from './pages/Inventory'
import Sales from './pages/Sales'
import Customers from './pages/Customers'
import Tills from './pages/Tills'
import SettingsPage from './pages/Settings'
import AiAssistant from './components/AiAssistant'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const [checking, setChecking] = useState(true)
  const [ok, setOk] = useState(false)
  useEffect(() => {
    let cancelled = false
    // If no token, check if server actually requires auth — probe /api/health, then /api/state without token
    // If server is fallback (no DB) and no token, allow through for local dev; otherwise require login
    if (!token) {
      // Try to see if server is in dynamic mode — if /api/state returns 401, auth is required
      const API = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL || ''
      const url = `${API}/api/state`.replace('//api', '/api')
      fetch(url, { method: 'GET' }).then((res) => {
        if (cancelled) return
        if (res.status === 401) { setOk(false); setChecking(false) }
        else { setOk(true); setChecking(false) } // no auth required (local fallback without DB or server not reachable)
      }).catch(() => { if (!cancelled) { setOk(true); setChecking(false) } })
      return
    }
    verifyToken().then((valid) => {
      if (!cancelled) { setOk(valid); setChecking(false) }
    })
  }, [token])
  if (checking) return <div className="splash"><div className="splash-logo">$</div><div className="splash-title">Checking auth…</div></div>
  if (!ok) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const ready = useStore((s) => s.ready)
  useEffect(() => { initServerSync() }, [])

  if (!ready) {
    return (
      <div className="splash">
        <div className="splash-logo">$</div>
        <div className="splash-title">MEPoS</div>
        <div className="splash-sub">Loading workspace…</div>
      </div>
    )
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><MEPoSApp /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="sales" element={<Sales />} />
          <Route path="customers" element={<Customers />} />
          <Route path="tills" element={<Tills />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toasts />
      <AiAssistant />
    </HashRouter>
  )
}

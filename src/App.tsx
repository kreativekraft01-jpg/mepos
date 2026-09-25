import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import { initServerSync } from './utils/serverSync'
import MEPoSApp from './app/App'
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
        <Route path="/" element={<MEPoSApp />} />
        <Route path="/admin" element={<Layout />}>
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

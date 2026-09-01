import { useMemo } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Receipt,
  Users,
  Settings,
  Sparkles,
  Landmark
} from 'lucide-react'
import { useStore } from '../store/useStore'

const NAV_MAIN = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/sales', label: 'Sales', icon: Receipt, end: false }
]

const NAV_STOCK = [
  { to: '/admin/products', label: 'Products', icon: Package, end: false },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes, end: false },
  { to: '/admin/customers', label: 'Customers', icon: Users, end: false }
]

function NavSection({ items, badgeCount }: { items: typeof NAV_MAIN; badgeCount?: number }) {
  return (
    <>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <item.icon size={18} strokeWidth={2.2} />
          <span>{item.label}</span>
          {item.to === '/pos' && badgeCount && badgeCount > 0 ? (
            <span className="nav-badge">{badgeCount}</span>
          ) : null}
        </NavLink>
      ))}
    </>
  )
}

export default function Layout() {
  const storeName = useStore((s) => s.settings.storeName)
  const tagline = useStore((s) => s.settings.tagline)
  const cartCount = useStore((s) => s.cart.reduce((n, c) => n + c.qty, 0))
  const lowStockCount = useStore((s) => s.products.filter((p) => p.stock <= p.lowStockThreshold).length)
  const location = useLocation()
  const navigate = useNavigate()

  const title = useMemo(() => {
    const map: Record<string, [string, string]> = {
      '/admin': ['Dashboard', 'Overview of your store today'],
      '/admin/sales': ['Sales & Reports', 'Transactions and analytics'],
      '/admin/products': ['Products', 'Your catalog and categories'],
      '/admin/inventory': ['Inventory', 'Stock levels and alerts'],
      '/admin/customers': ['Customers', 'People and their balances'],
      '/admin/tills': ['Banking & Tills', 'Open and close till banking'],
      '/admin/settings': ['Settings', 'Store and AI configuration']
    }
    return map[location.pathname] ?? ['Back Office', '']
  }, [location.pathname])

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">$</div>
          <div>
            <div className="brand-name">{storeName}</div>
            <div className="brand-tag">{tagline}</div>
          </div>
        </div>

        <div className="nav-section">Main</div>
        <NavSection items={NAV_MAIN} badgeCount={cartCount} />

        <div className="nav-section">Manage</div>
        <NavSection items={NAV_STOCK} />

        <div className="nav-section">System</div>
        <NavLink to="/admin/tills" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Landmark size={18} strokeWidth={2.2} />
          <span>Banking & Tills</span>
        </NavLink>
        <NavLink to="/admin/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Settings size={18} strokeWidth={2.2} />
          <span>Settings</span>
        </NavLink>
        <NavLink to="/" className="nav-item">
          <ShoppingCart size={18} strokeWidth={2.2} />
          <span>MEPoS Floor</span>
        </NavLink>
        <NavLink to="/admin/settings" className="nav-item">
          <Sparkles size={18} strokeWidth={2.2} />
          <span>AI Assistant</span>
        </NavLink>

        <div className="sidebar-footer">
          <span className="dot" />
          <span className="sf-text">
            {lowStockCount > 0 ? `${lowStockCount} low-stock item${lowStockCount > 1 ? 's' : ''}` : 'All stock healthy'}
          </span>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{title[0]}</h1>
            <p>{title[1]}</p>
          </div>
          <div className="topbar-actions">
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              <ShoppingCart size={16} />
              Open MEPoS
            </button>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  )
}

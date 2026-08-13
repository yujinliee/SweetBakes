import './AdminSidebar.css'

const adminNavItems = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: 'dashboard' },
  { label: 'Orders', href: '/admin/orders', icon: 'orders' },
  { label: 'Products', href: '/admin/products', icon: 'products' },
  { label: 'Inventory', href: '/admin/inventory', icon: 'inventory' },
  { label: 'Custom Orders', href: '/admin/custom-orders', icon: 'custom' },
  { label: 'Customers', href: '/admin/customers', icon: 'customers' },
  { label: 'Settings', href: '/admin/settings', icon: 'settings' },
]

const iconPaths = {
  dashboard: 'M4 5h7v6H4V5Zm9 0h7v4h-7V5ZM4 13h7v6H4v-6Zm9-2h7v8h-7v-8Z',
  orders: 'M7 4h10l2 3v13H5V7l2-3Zm0 3h10M8 11h8M8 15h6',
  products: 'M4 8 12 4l8 4-8 4-8-4Zm0 4 8 4 8-4M4 16l8 4 8-4',
  inventory: 'M5 5h14v14H5V5Zm3 4h8M8 13h8',
  custom: 'M5 5h14v10H8l-3 3V5Zm4 4h6M9 12h4',
  customers: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-1a2.5 2.5 0 1 0 0-5M4 19a5 5 0 0 1 10 0M14 19a4 4 0 0 1 6 0',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v3M12 18v3M4.8 4.8l2.1 2.1M17.1 17.1l2.1 2.1M3 12h3M18 12h3M4.8 19.2l2.1-2.1M17.1 6.9l2.1-2.1',
}

function SidebarIcon({ name }) {
  return (
    <svg className="admin-sidebar-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={iconPaths[name]}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AdminSidebar({ currentPath, onNavigate, onLogout }) {
  return (
    <aside className="admin-sidebar" aria-label="Admin navigation">
      <a
        className="admin-sidebar-brand"
        href="/admin/dashboard"
        onClick={(event) => {
          event.preventDefault()
          onNavigate?.('/admin/dashboard')
        }}
      >
        <span>Sweet Bakes</span>
        <small>Admin</small>
      </a>

      <nav className="admin-sidebar-nav">
        {adminNavItems.map((item) => (
          <a
            className={currentPath === item.href ? 'admin-sidebar-link admin-sidebar-link--active' : 'admin-sidebar-link'}
            href={item.href}
            key={item.href}
            onClick={(event) => {
              event.preventDefault()
              onNavigate?.(item.href)
            }}
          >
            <SidebarIcon name={item.icon} />
            {item.label}
          </a>
        ))}
      </nav>

      <button className="admin-sidebar-logout" type="button" onClick={onLogout}>
        <SidebarIcon name="settings" />
        Logout
      </button>
    </aside>
  )
}

export default AdminSidebar

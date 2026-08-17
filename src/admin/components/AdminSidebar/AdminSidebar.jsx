import './AdminSidebar.css'
import footerLogo from '../../../assets/landingpage/sweetbakes_footer.svg'

const adminNavItems = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: 'dashboard' },
  { label: 'Orders', href: '/admin/orders', icon: 'orders' },
  { label: 'Products', href: '/admin/products', icon: 'products' },
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

function AdminSidebar({ currentPath, isCollapsed, onNavigate, onLogout, onToggleCollapse }) {
  return (
    <aside
      className={`admin-sidebar${isCollapsed ? ' admin-sidebar--collapsed' : ''}`}
      aria-label="Admin navigation"
    >
      <div className="admin-sidebar-brand-row">
        <button
          className="admin-sidebar-logo"
          type="button"
          aria-label={isCollapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'}
          aria-expanded={!isCollapsed}
          onClick={onToggleCollapse}
        >
          <span className="admin-sidebar-logo-visual" aria-hidden="true">
            <img
              className="admin-sidebar-logo-mark"
              src={footerLogo}
              alt=""
              aria-hidden="true"
            />
            <svg className="admin-sidebar-logo-hover-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4.5 5.5h15v13h-15v-13Zm5.6 0v13M8.6 8.8l-2.5 2.7 2.5 2.7"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="admin-sidebar-logo-text">SweetBakes</span>
        </button>

        {!isCollapsed && (
          <button
            className="admin-sidebar-collapse-btn"
            type="button"
            aria-label={isCollapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'}
            onClick={onToggleCollapse}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4.5 5.5h15v13h-15v-13Zm5.6 0v13M8.6 8.8l-2.5 2.7 2.5 2.7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      <nav className="admin-sidebar-nav">
        {adminNavItems.map((item) => (
          <a
            className={currentPath === item.href ? 'admin-sidebar-link admin-sidebar-link--active' : 'admin-sidebar-link'}
            data-tooltip={item.label}
            href={item.href}
            key={item.href}
            onClick={(event) => {
              event.preventDefault()
              onNavigate?.(item.href)
            }}
          >
            <SidebarIcon name={item.icon} />
            <span className="admin-sidebar-label">{item.label}</span>
          </a>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <button
          className="admin-sidebar-logout"
          type="button"
          data-tooltip="Logout"
          onClick={onLogout}
        >
          <SidebarIcon name="settings" />
          <span className="admin-sidebar-label">Logout</span>
        </button>
      </div>
    </aside>
  )
}

export default AdminSidebar

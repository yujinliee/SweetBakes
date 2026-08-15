import './AdminTopbar.css'

const pageLabels = {
  '/admin': 'Dashboard',
  '/admin/dashboard': 'Dashboard',
  '/admin/orders': 'Orders',
  '/admin/products': 'Products',
  '/admin/inventory': 'Inventory',
  '/admin/custom-orders': 'Custom Orders',
  '/admin/customers': 'Customers',
  '/admin/settings': 'Settings',
}

function AdminTopbar({ currentPath = window.location.pathname }) {
  const currentLabel = pageLabels[currentPath] || 'Dashboard'

  return (
    <header className="admin-topbar">
      <div className="admin-topbar-context" aria-label="Current page context">
        <span>Admin</span>
        <span className="admin-topbar-context-separator">/</span>
        <strong>{currentLabel}</strong>
      </div>
    </header>
  )
}

export default AdminTopbar

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

function AdminTopbar({ currentPath }) {
  const pageLabel = pageLabels[currentPath] || 'Dashboard'

  return (
    <header className="admin-topbar">
      <div>
        <p>Admin / {pageLabel}</p>
        <h1>Sweet Bakes Management</h1>
      </div>
      <div className="admin-topbar-profile" aria-label="Current admin">
        <span aria-hidden="true">SB</span>
        <div>
          <strong>Admin</strong>
          <small>Staff</small>
        </div>
      </div>
    </header>
  )
}

export default AdminTopbar

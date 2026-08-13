import AdminSidebar from '../AdminSidebar/AdminSidebar.jsx'
import AdminTopbar from '../AdminTopbar/AdminTopbar.jsx'
import { clearAdminAuthenticated } from '../../auth/adminAuth.js'
import './AdminLayout.css'

function AdminLayout({ children, onNavigate }) {
  const handleLogout = () => {
    clearAdminAuthenticated()
    onNavigate?.('/admin/login')
  }

  return (
    <div className="admin-shell">
      <AdminSidebar
        currentPath={window.location.pathname}
        onLogout={handleLogout}
        onNavigate={onNavigate}
      />
      <div className="admin-workspace">
        <AdminTopbar currentPath={window.location.pathname} />
        <main className="admin-main">{children}</main>
      </div>
    </div>
  )
}

export default AdminLayout

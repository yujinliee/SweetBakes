import { useEffect, useState } from 'react'
import AdminSidebar from '../AdminSidebar/AdminSidebar.jsx'
import AdminTopbar from '../AdminTopbar/AdminTopbar.jsx'
import { signOutAdmin } from '../../auth/adminAuth.js'
import './AdminLayout.css'

const adminSidebarCollapsedStorageKey = 'adminSidebarCollapsed'

function AdminLayout({ children, currentPath, onNavigate }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.sessionStorage.getItem(adminSidebarCollapsedStorageKey) === 'true'
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(adminSidebarCollapsedStorageKey, String(isSidebarCollapsed))
    }
  }, [isSidebarCollapsed])

  const handleLogout = async () => {
    await signOutAdmin()
    onNavigate?.('/login', { replace: true })
  }

  const handleToggleCollapse = () => {
    setIsSidebarCollapsed((current) => !current)
  }

  return (
    <div className={`admin-shell${isSidebarCollapsed ? ' admin-shell--sidebar-collapsed' : ''}`}>
      <AdminSidebar
        isCollapsed={isSidebarCollapsed}
        currentPath={currentPath}
        onLogout={handleLogout}
        onNavigate={onNavigate}
        onToggleCollapse={handleToggleCollapse}
      />
      <div className="admin-workspace">
        <AdminTopbar currentPath={currentPath} />
        <main className="admin-main">{children}</main>
      </div>
    </div>
  )
}

export default AdminLayout

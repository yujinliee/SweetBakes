import AdminLogin from './auth/AdminLogin.jsx'
import ProtectedAdminRoute from './auth/ProtectedAdminRoute.jsx'
import AdminLayout from './components/AdminLayout/AdminLayout.jsx'
import Customers from './pages/Customers/Customers.jsx'
import CustomOrders from './pages/CustomOrders/CustomOrders.jsx'
import Dashboard from './pages/Dashboard/Dashboard.jsx'
import Inventory from './pages/Inventory/Inventory.jsx'
import Orders from './pages/Orders/Orders.jsx'
import Products from './pages/Products/Products.jsx'
import Settings from './pages/Settings/Settings.jsx'

const adminPageMap = {
  '/admin': Dashboard,
  '/admin/dashboard': Dashboard,
  '/admin/orders': Orders,
  '/admin/products': Products,
  '/admin/inventory': Inventory,
  '/admin/custom-orders': CustomOrders,
  '/admin/customers': Customers,
  '/admin/settings': Settings,
}

function AdminRoutes({ onNavigate }) {
  if (window.location.pathname === '/admin/login') {
    return <AdminLogin onNavigate={onNavigate} />
  }

  const Page = adminPageMap[window.location.pathname] || Dashboard

  return (
    <ProtectedAdminRoute onNavigate={onNavigate}>
      <AdminLayout onNavigate={onNavigate}>
        <Page />
      </AdminLayout>
    </ProtectedAdminRoute>
  )
}

export default AdminRoutes

import { Component } from 'react'
import ProtectedAdminRoute from './auth/ProtectedAdminRoute.jsx'
import AdminLayout from './components/AdminLayout/AdminLayout.jsx'
import Availability from './pages/Availability/Availability.jsx'
import Customers from './pages/Customers/Customers.jsx'
import Dashboard from './pages/Dashboard/Dashboard.jsx'
import Inventory from './pages/Inventory/Inventory.jsx'
import Messages from './pages/Messages/Messages.jsx'
import Orders from './pages/Orders/Orders.jsx'
import Products from './pages/Products/Products.jsx'
import Settings from './pages/Settings/Settings.jsx'
import { ADMIN_DASHBOARD_ROUTE } from './adminRouteConstants.js'

const PRODUCTS_CATEGORY_MAP = {
  '/admin/products/cakes': 'Cakes',
  '/admin/products/cupcakes': 'Cupcakes',
  '/admin/products/party-packages': 'Party Packages',
  '/admin/products/sweet-treats': 'Sweet Treats',
}

const adminPageMap = {
  '/admin': Dashboard,
  [ADMIN_DASHBOARD_ROUTE]: Dashboard,
  '/admin/orders': Orders,
  '/admin/messages': Messages,
  '/admin/products': Products,
  '/admin/inventory': Inventory,
  '/admin/availability': Availability,
  '/admin/customers': Customers,
  '/admin/settings': Settings,
}

class AdminPageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    if (import.meta.env.DEV) {
      console.error('[ADMIN ROUTES] Admin page render failed:', error)
    }
  }

  componentDidUpdate(previousProps) {
    if (previousProps.currentPath !== this.props.currentPath && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return <p>Unable to load this Admin page. Please try another Admin section.</p>
    }

    return this.props.children
  }
}

function AdminRoutes({ currentPath, onNavigate }) {
  let Page = adminPageMap[currentPath] || Dashboard
  let pageProps = {}

  if (currentPath === '/admin/products') {
    Page = Products
    pageProps = { category: 'Cakes' }
  } else if (PRODUCTS_CATEGORY_MAP[currentPath]) {
    Page = Products
    pageProps = { category: PRODUCTS_CATEGORY_MAP[currentPath] }
  }

  return (
    <ProtectedAdminRoute onNavigate={onNavigate}>
      <AdminLayout currentPath={currentPath} onNavigate={onNavigate}>
        <AdminPageErrorBoundary currentPath={currentPath}>
          <Page key={pageProps.category || undefined} {...pageProps} />
        </AdminPageErrorBoundary>
      </AdminLayout>
    </ProtectedAdminRoute>
  )
}

export default AdminRoutes

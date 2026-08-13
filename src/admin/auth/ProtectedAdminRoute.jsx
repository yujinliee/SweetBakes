import { useEffect } from 'react'
import { isAdminAuthenticated } from './adminAuth.js'

function ProtectedAdminRoute({ children, onNavigate }) {
  const isAuthenticated = isAdminAuthenticated()

  useEffect(() => {
    if (!isAuthenticated) {
      onNavigate?.('/admin/login')
    }
  }, [isAuthenticated, onNavigate])

  if (!isAuthenticated) {
    return null
  }

  return children
}

export default ProtectedAdminRoute

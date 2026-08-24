import { useEffect, useState } from 'react'
import { getAdminAuthStatus } from './adminAuth.js'

const logAdminGuardDebug = (...values) => {
  if (import.meta.env.DEV) {
    console.log('[ADMIN GUARD]', ...values)
  }
}

const logNavigationDebug = (...values) => {
  if (import.meta.env.DEV) {
    console.log('[NAVIGATION]', ...values)
  }
}

function ProtectedAdminRoute({ children, onNavigate }) {
  const [authState, setAuthState] = useState({
    status: 'loading',
  })

  useEffect(() => {
    let isMounted = true

    const verifyAdminAccess = async () => {
      let nextStatus

      try {
        logAdminGuardDebug('pathname:', window.location.pathname)
        logAdminGuardDebug('loading:', true)
        const status = await getAdminAuthStatus()
        logAdminGuardDebug('session:', status.isAuthenticated)
        logAdminGuardDebug('role:', status.role || null)
        nextStatus = status.status === 'admin'
          ? 'admin'
          : status.status === 'unauthorized'
            ? 'unauthorized'
            : 'unauthenticated'
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[ADMIN GUARD] auth check failed:', error)
        }
        nextStatus = 'unauthenticated'
      }

      if (!isMounted) {
        return
      }

      setAuthState({ status: nextStatus })
      logAdminGuardDebug('loading:', false)
      logAdminGuardDebug('resolved status:', nextStatus)

      if (nextStatus === 'unauthenticated' || nextStatus === 'unauthorized') {
        logAdminGuardDebug('redirecting to:', '/login')
        logNavigationDebug('from admin guard ->', '/login')
        onNavigate?.('/login', { replace: true })
      }
    }

    verifyAdminAccess()

    return () => {
      isMounted = false
    }
  }, [onNavigate])

  if (authState.status === 'loading') {
    return <p>Loading admin session...</p>
  }

  if (authState.status !== 'admin') {
    return <p>Checking admin access...</p>
  }

  return children
}

export default ProtectedAdminRoute

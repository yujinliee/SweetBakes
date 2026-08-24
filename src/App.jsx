import { useCallback, useEffect, useState } from 'react'
import AdminRoutes from './admin/AdminRoutes.jsx'
import AuthCallbackPage from './auth/AuthCallbackPage.jsx'
import {
  clearAuthReturnTo,
  consumeAuthReturnTo,
  getCustomerAuthReturnPath,
  isCustomerCustomizationRoute,
  setAuthReturnTo,
} from './auth/authReturnTo.js'
import { getCustomerAuthStatus } from './auth/customerAuth.js'
import CartPage from './cartpage/CartPage.jsx'
import CustomizationPage from './customization/CustomizationPage.jsx'
import LandingPage from './landingpage/LandingPage.jsx'
import LoginPage from './loginpage/LoginPage.jsx'
import MyOrdersPage from './myorders/MyOrdersPage.jsx'
import ProfilePage from './profilepage/ProfilePage.jsx'
import RegisterPage from './registerpage/RegisterPage.jsx'
import { supabase } from './lib/supabase.js'

const customerAuthStorageKey = 'sweetbakes_customer_authenticated'

const getCurrentLocationKey = () =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`

const getPathnameFromLocationKey = (currentLocationKey) => currentLocationKey.split(/[?#]/)[0]

const getCustomerAuthenticated = () =>
  window.localStorage.getItem(customerAuthStorageKey) === 'true'

const scrollToPageTop = () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: 'instant',
  })
}

const logNavigationDebug = (...values) => {
  if (import.meta.env.DEV) {
    console.log('[NAVIGATION]', ...values)
  }
}

function App() {
  const [locationKey, setLocationKey] = useState(getCurrentLocationKey)
  const [isCustomerAuthenticated, setIsCustomerAuthenticated] = useState(getCustomerAuthenticated)
  const [customerRouteCheckedKey, setCustomerRouteCheckedKey] = useState('')

  useEffect(() => {
    const syncLocation = () => setLocationKey(getCurrentLocationKey())

    window.addEventListener('popstate', syncLocation)

    return () => {
      window.removeEventListener('popstate', syncLocation)
    }
  }, [])

  useEffect(() => {
    scrollToPageTop()
  }, [locationKey])

  const navigate = useCallback((href, options = {}) => {
    let nextUrl = new URL(href, window.location.origin)
    let nextLocationKey = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
    const isSamePage = nextLocationKey === getCurrentLocationKey()

    if (isCustomerCustomizationRoute(nextLocationKey) && !getCustomerAuthenticated()) {
      const returnTo = setAuthReturnTo(nextLocationKey)
      nextUrl = new URL(`/login?redirect=${encodeURIComponent(returnTo || nextLocationKey)}`, window.location.origin)
      nextLocationKey = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
    }

    logNavigationDebug('from:', getCurrentLocationKey())
    logNavigationDebug('to:', nextLocationKey)
    logNavigationDebug('options:', options)

    // Same-page scroll request (e.g. Location/Contact while already on Home):
    // glide straight to the section — no history entry, no top reset, no remount.
    if (isSamePage && options.scrollTo) {
      setLocationKey(nextLocationKey)
      document.getElementById(options.scrollTo)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
      return
    }

    const nextHistoryState = options.scrollTo ? { scrollTo: options.scrollTo } : {}

    if (!isSamePage && options.replace) {
      window.history.replaceState(nextHistoryState, '', nextLocationKey)
    } else if (!isSamePage) {
      window.history.pushState(nextHistoryState, '', nextLocationKey)
    }

    setLocationKey(nextLocationKey)
    scrollToPageTop()
  }, [])

  useEffect(() => {
    if (!isCustomerCustomizationRoute(locationKey)) {
      setCustomerRouteCheckedKey('')
      return undefined
    }

    let isMounted = true

    if (import.meta.env.DEV) {
      console.log('[AUTH GUARD]', {
        pathname: getPathnameFromLocationKey(locationKey),
        authLoading: true,
        userId: undefined,
        role: null,
      })
    }

    getCustomerAuthStatus().then((authStatus) => {
      if (!isMounted) return

      if (import.meta.env.DEV) {
        console.log('[AUTH GUARD]', {
          pathname: getPathnameFromLocationKey(locationKey),
          authLoading: false,
          userId: authStatus.user?.id,
          role: authStatus.role,
        })
      }

      if (authStatus.status === 'customer') {
        window.localStorage.setItem(customerAuthStorageKey, 'true')
        setIsCustomerAuthenticated(true)
        setCustomerRouteCheckedKey(locationKey)
      } else if (authStatus.status === 'admin') {
        clearAuthReturnTo()
        navigate('/admin/dashboard', { replace: true })
      } else {
        setAuthReturnTo(locationKey)
        navigate(`/login?redirect=${encodeURIComponent(locationKey)}`, { replace: true })
      }
    })

    return () => {
      isMounted = false
    }
  }, [locationKey, navigate])

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        clearAuthReturnTo()
        window.localStorage.removeItem(customerAuthStorageKey)
        setIsCustomerAuthenticated(false)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const handleCustomerLogin = (targetHref = '/', options = {}) => {
    window.localStorage.setItem(customerAuthStorageKey, 'true')
    setIsCustomerAuthenticated(true)

    const savedReturnTo = consumeAuthReturnTo()
    const safeTargetHref = getCustomerAuthReturnPath(targetHref)
    navigate(savedReturnTo || safeTargetHref || '/', options)

  }

  const handleCustomerLogout = () => {
    clearAuthReturnTo()
    window.localStorage.removeItem(customerAuthStorageKey)
    setIsCustomerAuthenticated(false)
  }

  const currentPathname = getPathnameFromLocationKey(locationKey)

  if (isCustomerCustomizationRoute(locationKey) && customerRouteCheckedKey !== locationKey) {
    return null
  }

  const page =
    currentPathname.startsWith('/admin') ? (
      <AdminRoutes currentPath={currentPathname} onNavigate={navigate} />
    ) : currentPathname === '/cakes' || currentPathname === '/cake' ? (
      <CustomizationPage
        initialProduct="cakes"
        onNavigate={navigate}
        onCustomerLogout={handleCustomerLogout}
        isCustomerAuthenticated={isCustomerAuthenticated}
        key={locationKey}
      />
    ) : currentPathname === '/cupcakes' ? (
      <CustomizationPage
        initialProduct="cupcakes"
        onNavigate={navigate}
        onCustomerLogout={handleCustomerLogout}
        isCustomerAuthenticated={isCustomerAuthenticated}
        key={locationKey}
      />
    ) : currentPathname === '/customize' ? (
      <CustomizationPage
        onNavigate={navigate}
        onCustomerLogout={handleCustomerLogout}
        isCustomerAuthenticated={isCustomerAuthenticated}
        key={locationKey}
      />
    ) : currentPathname === '/login' ? (
      <LoginPage
        onNavigate={navigate}
        onCustomerLogin={handleCustomerLogin}
        onCustomerLogout={handleCustomerLogout}
        isCustomerAuthenticated={isCustomerAuthenticated}
        key={locationKey}
      />
    ) : currentPathname === '/register' ? (
      <RegisterPage
        onNavigate={navigate}
        onCustomerLogin={handleCustomerLogin}
        onCustomerLogout={handleCustomerLogout}
        isCustomerAuthenticated={isCustomerAuthenticated}
        key={locationKey}
      />
    ) : currentPathname === '/auth/callback' ? (
      <AuthCallbackPage
        onNavigate={navigate}
        onCustomerLogin={handleCustomerLogin}
        key={locationKey}
      />
    ) : currentPathname === '/profile' ? (
      <ProfilePage
        onNavigate={navigate}
        onCustomerLogout={handleCustomerLogout}
        isCustomerAuthenticated={isCustomerAuthenticated}
        key={locationKey}
      />
    ) : currentPathname === '/my-orders' ? (
      <MyOrdersPage
        onNavigate={navigate}
        onCustomerLogout={handleCustomerLogout}
        isCustomerAuthenticated={isCustomerAuthenticated}
        key={locationKey}
      />
    ) : currentPathname === '/cart' ? (
      <CartPage
        onNavigate={navigate}
        onCustomerLogout={handleCustomerLogout}
        isCustomerAuthenticated={isCustomerAuthenticated}
        key={locationKey}
      />
    ) : (
      <LandingPage
        onNavigate={navigate}
        onCustomerLogout={handleCustomerLogout}
        isCustomerAuthenticated={isCustomerAuthenticated}
        key={locationKey}
      />
    )

  return (
    <>
      {page}
    </>
  )
}

export default App

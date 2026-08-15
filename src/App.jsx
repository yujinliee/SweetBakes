import { useEffect, useState } from 'react'
import AdminRoutes from './admin/AdminRoutes.jsx'
import OrderTrackingDrawer from './components/OrderTrackingDrawer.jsx'
import CustomizationPage from './customization/CustomizationPage.jsx'
import LandingPage from './landingpage/LandingPage.jsx'
import LoginPage from './loginpage/LoginPage.jsx'
import RegisterPage from './registerpage/RegisterPage.jsx'

const latestRequestStorageKey = 'sweetbakes_latest_request'
const customerAuthStorageKey = 'sweetbakes_customer_authenticated'

const getCurrentLocationKey = () =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`

const getCustomerAuthenticated = () =>
  window.localStorage.getItem(customerAuthStorageKey) === 'true'

const scrollToPageTop = () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: 'instant',
  })
}

function App() {
  const [locationKey, setLocationKey] = useState(getCurrentLocationKey)
  const [latestRequest, setLatestRequest] = useState(
    () => window.localStorage.getItem(latestRequestStorageKey) || '',
  )
  const [isCustomerAuthenticated, setIsCustomerAuthenticated] = useState(getCustomerAuthenticated)
  const [trackingDrawer, setTrackingDrawer] = useState({
    isOpen: false,
    requestNumber: '',
  })

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

  const navigate = (href) => {
    const nextUrl = new URL(href, window.location.origin)
    const nextLocationKey = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`

    if (nextLocationKey !== getCurrentLocationKey()) {
      window.history.pushState({}, '', nextLocationKey)
    }

    setLocationKey(nextLocationKey)
    scrollToPageTop()
  }

  const openTrackOrder = (requestNumber = '') => {
    setTrackingDrawer({
      isOpen: true,
      requestNumber: requestNumber || latestRequest,
    })
  }

  const saveLatestRequest = (requestNumber) => {
    window.localStorage.setItem(latestRequestStorageKey, requestNumber)
    setLatestRequest(requestNumber)
  }

  const handleCustomerLogin = () => {
    window.localStorage.setItem(customerAuthStorageKey, 'true')
    setIsCustomerAuthenticated(true)
    navigate('/')
  }

  const closeTrackOrder = () => {
    setTrackingDrawer((current) => ({
      ...current,
      isOpen: false,
    }))
  }

  const page =
    window.location.pathname.startsWith('/admin') ? (
      <AdminRoutes onNavigate={navigate} />
    ) : window.location.pathname === '/cakes' ? (
      <CustomizationPage
        initialProduct="cakes"
        latestRequest={latestRequest}
        onRequestSubmitted={saveLatestRequest}
        onTrackOrder={openTrackOrder}
        onNavigate={navigate}
        isCustomerAuthenticated={isCustomerAuthenticated}
        key={locationKey}
      />
    ) : window.location.pathname === '/cupcakes' ? (
      <CustomizationPage
        initialProduct="cupcakes"
        latestRequest={latestRequest}
        onRequestSubmitted={saveLatestRequest}
        onTrackOrder={openTrackOrder}
        onNavigate={navigate}
        isCustomerAuthenticated={isCustomerAuthenticated}
        key={locationKey}
      />
    ) : window.location.pathname === '/customize' ? (
      <CustomizationPage
        latestRequest={latestRequest}
        onRequestSubmitted={saveLatestRequest}
        onTrackOrder={openTrackOrder}
        onNavigate={navigate}
        isCustomerAuthenticated={isCustomerAuthenticated}
        key={locationKey}
      />
    ) : window.location.pathname === '/login' ? (
      <LoginPage
        latestRequest={latestRequest}
        onTrackOrder={openTrackOrder}
        onNavigate={navigate}
        onCustomerLogin={handleCustomerLogin}
        isCustomerAuthenticated={isCustomerAuthenticated}
        key={locationKey}
      />
    ) : window.location.pathname === '/register' ? (
      <RegisterPage
        latestRequest={latestRequest}
        onTrackOrder={openTrackOrder}
        onNavigate={navigate}
        isCustomerAuthenticated={isCustomerAuthenticated}
        key={locationKey}
      />
    ) : (
      <LandingPage
        latestRequest={latestRequest}
        onTrackOrder={openTrackOrder}
        onNavigate={navigate}
        isCustomerAuthenticated={isCustomerAuthenticated}
        key={locationKey}
      />
    )

  return (
    <>
      {page}
      {trackingDrawer.isOpen && !window.location.pathname.startsWith('/admin') ? (
        <OrderTrackingDrawer
          key={trackingDrawer.requestNumber || 'track-order'}
          initialRequestNumber={trackingDrawer.requestNumber}
          onClose={closeTrackOrder}
        />
      ) : null}
    </>
  )
}

export default App

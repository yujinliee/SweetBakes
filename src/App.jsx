import { useEffect, useState } from 'react'
import AdminRoutes from './admin/AdminRoutes.jsx'
import OrderTrackingDrawer from './components/OrderTrackingDrawer.jsx'
import CustomizationPage from './customization/CustomizationPage.jsx'
import LandingPage from './landingpage/LandingPage.jsx'

const latestRequestStorageKey = 'sweetbakes_latest_request'

const getCurrentLocationKey = () =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`

function App() {
  const [locationKey, setLocationKey] = useState(getCurrentLocationKey)
  const [latestRequest, setLatestRequest] = useState(
    () => window.localStorage.getItem(latestRequestStorageKey) || '',
  )
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

  const navigate = (href) => {
    const nextUrl = new URL(href, window.location.origin)
    const nextLocationKey = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`

    if (nextLocationKey !== getCurrentLocationKey()) {
      window.history.pushState({}, '', nextLocationKey)
    }

    setLocationKey(nextLocationKey)
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

  const closeTrackOrder = () => {
    setTrackingDrawer((current) => ({
      ...current,
      isOpen: false,
    }))
  }

  const page =
    window.location.pathname.startsWith('/admin') ? (
      <AdminRoutes onNavigate={navigate} key={locationKey} />
    ) : window.location.pathname === '/cakes' ? (
      <CustomizationPage
        initialProduct="cakes"
        latestRequest={latestRequest}
        onRequestSubmitted={saveLatestRequest}
        onTrackOrder={openTrackOrder}
        onNavigate={navigate}
        key={locationKey}
      />
    ) : window.location.pathname === '/cupcakes' ? (
      <CustomizationPage
        initialProduct="cupcakes"
        latestRequest={latestRequest}
        onRequestSubmitted={saveLatestRequest}
        onTrackOrder={openTrackOrder}
        onNavigate={navigate}
        key={locationKey}
      />
    ) : window.location.pathname === '/customize' ? (
      <CustomizationPage
        latestRequest={latestRequest}
        onRequestSubmitted={saveLatestRequest}
        onTrackOrder={openTrackOrder}
        onNavigate={navigate}
        key={locationKey}
      />
    ) : (
      <LandingPage
        latestRequest={latestRequest}
        onTrackOrder={openTrackOrder}
        onNavigate={navigate}
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

import { useState } from 'react'
import OrderTrackingDrawer from './components/OrderTrackingDrawer.jsx'
import LandingPage from './landingpage/LandingPage.jsx'
import CakePage from './cakepage/CakePage.jsx'

const latestRequestStorageKey = 'sweetbakes_latest_request'

function App() {
  const [latestRequest, setLatestRequest] = useState(
    () => window.localStorage.getItem(latestRequestStorageKey) || '',
  )
  const [trackingDrawer, setTrackingDrawer] = useState({
    isOpen: false,
    requestNumber: '',
  })

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
    window.location.pathname === '/cakes' ? (
      <CakePage
        latestRequest={latestRequest}
        onRequestSubmitted={saveLatestRequest}
        onTrackOrder={openTrackOrder}
      />
    ) : (
      <LandingPage latestRequest={latestRequest} onTrackOrder={openTrackOrder} />
    )

  return (
    <>
      {page}
      {trackingDrawer.isOpen ? (
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

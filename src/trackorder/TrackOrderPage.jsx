import { useEffect } from 'react'
import LandingPage from '../landingpage/LandingPage.jsx'
import { useTrackOrder } from './trackOrderContext.js'

// Preserve emailed/bookmarked links; all ordinary entry points open the shared drawer directly.
export default function TrackOrderPage(props) {
  const openTrackOrderDrawer = useTrackOrder()
  useEffect(() => {
    openTrackOrderDrawer({
      orderNumber: window.history.state?.orderNumber || '',
      email: window.history.state?.guestEmail || '',
    })
  }, [openTrackOrderDrawer])
  return <LandingPage {...props} />
}

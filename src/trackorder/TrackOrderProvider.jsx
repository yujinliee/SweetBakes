import { useCallback, useState } from 'react'
import { TrackOrderContext } from './trackOrderContext.js'
import TrackOrderDrawer from './TrackOrderDrawer.jsx'

export default function TrackOrderProvider({ children }) {
  const [request, setRequest] = useState(null)
  const openTrackOrderDrawer = useCallback((values = {}) => setRequest({ ...values }), [])
  return <TrackOrderContext.Provider value={openTrackOrderDrawer}>
    {children}
    {request ? <TrackOrderDrawer initialValues={request} onClose={() => setRequest(null)} /> : null}
  </TrackOrderContext.Provider>
}

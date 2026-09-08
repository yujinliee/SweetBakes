import { createContext, useContext } from 'react'

export const TrackOrderContext = createContext(null)
export const useTrackOrder = () => useContext(TrackOrderContext)

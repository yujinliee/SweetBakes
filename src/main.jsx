import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import TrackOrderProvider from './trackorder/TrackOrderProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TrackOrderProvider><App /></TrackOrderProvider>
  </StrictMode>,
)

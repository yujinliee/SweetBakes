import { useEffect, useRef, useState } from 'react'
import './toastNotification.css'

export function ToastNotification({
  message,
  nonce,
  onClose,
  autoHideAfter = 3000,
  exitDuration = 220,
}) {
  const [isClosing, setIsClosing] = useState(false)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const hideTimer = window.setTimeout(() => {
      setIsClosing(true)
    }, autoHideAfter)

    const closeTimer = window.setTimeout(() => {
      onCloseRef.current?.()
    }, autoHideAfter + exitDuration)

    return () => {
      window.clearTimeout(hideTimer)
      window.clearTimeout(closeTimer)
    }
  }, [nonce, autoHideAfter, exitDuration])

  return (
    <div
      className={`sb-toast${isClosing ? ' sb-toast--closing' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="sb-toast-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M20 6 9 17l-5-5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="sb-toast-message">{message}</span>
    </div>
  )
}
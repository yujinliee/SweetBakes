import { useEffect, useRef } from 'react'
import { formatPhoneDisplay } from '../utils/phoneNumber.js'
import './deleteConfirmModal.css'

function buildPreviewLines(address) {
  const primary = [address.apartment_unit, address.address].filter(Boolean).join(', ')
  const location = [address.barangay, address.city_municipality].filter(Boolean).join(', ')
  const region = [address.province, address.postal_code].filter(Boolean).join(', ')
  const phone = address.phone_number ? formatPhoneDisplay(address.phone_number) : ''

  return [primary, location, region].filter(Boolean).concat(phone ? [phone] : [])
}

function DeleteAddressModal({ address, isDeleting, onCancel, onConfirm }) {
  const overlayRef = useRef(null)
  const dialogRef = useRef(null)
  const confirmButtonRef = useRef(null)
  const onCancelRef = useRef(onCancel)
  const isDeletingRef = useRef(isDeleting)

  useEffect(() => {
    onCancelRef.current = onCancel
    isDeletingRef.current = isDeleting
  })

  useEffect(() => {
    if (!address) return undefined

    const previouslyFocused = document.activeElement
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : ''

    confirmButtonRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!isDeletingRef.current) onCancelRef.current()
        return
      }

      if (event.key === 'Tab') {
        const dialog = dialogRef.current
        if (!dialog) return

        const focusable = dialog.querySelectorAll(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )

        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault()
            last.focus()
          }
        } else if (document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight

      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [address])

  if (!address) return null

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget && !isDeletingRef.current) onCancelRef.current()
  }

  return (
    <div className="delete-modal-overlay" ref={overlayRef} role="presentation" onClick={handleOverlayClick}>
      <section
        ref={dialogRef}
        className="delete-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-address-title"
        aria-describedby="delete-address-description"
      >
        <div className="delete-modal-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M10 11v6M14 11v6"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h2 id="delete-address-title">Delete Address?</h2>

        <p id="delete-address-description" className="delete-modal-description">
          Are you sure you want to delete this saved address?
          <br />
          This action cannot be undone.
        </p>

        <div className="delete-modal-preview" role="img" aria-label="Address to delete">
          {buildPreviewLines(address).map((line, index) => (
            <p className="delete-modal-preview-line" key={`${index}-${line}`}>
              {index === 0 ? <strong>{line}</strong> : line}
            </p>
          ))}
        </div>

        <div className="delete-modal-actions">
          <button className="delete-modal-cancel" type="button" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            className="delete-modal-confirm"
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Address'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default DeleteAddressModal
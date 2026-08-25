import './OrderRequestSuccessModal.css'

const CONFETTI_PIECES = [
  { x: '7%', y: '4%', rotate: '-18deg', delay: '0ms', color: '#9d62d9' },
  { x: '18%', y: '12%', rotate: '24deg', delay: '70ms', color: '#f0b2bd' },
  { x: '29%', y: '2%', rotate: '-34deg', delay: '140ms', color: '#e6c38a' },
  { x: '42%', y: '14%', rotate: '30deg', delay: '40ms', color: '#e6c38a' },
  { x: '57%', y: '6%', rotate: '-22deg', delay: '110ms', color: '#9d62d9' },
  { x: '71%', y: '13%', rotate: '18deg', delay: '180ms', color: '#f0b2bd' },
  { x: '84%', y: '3%', rotate: '34deg', delay: '100ms', color: '#e6c38a' },
  { x: '94%', y: '18%', rotate: '-30deg', delay: '160ms', color: '#9d62d9' },
  { x: '3%', y: '48%', rotate: '22deg', delay: '220ms', color: '#f0b2bd' },
  { x: '97%', y: '55%', rotate: '-18deg', delay: '260ms', color: '#e6c38a' },
  { x: '13%', y: '72%', rotate: '-28deg', delay: '190ms', color: '#9d62d9' },
  { x: '88%', y: '76%', rotate: '26deg', delay: '240ms', color: '#f0b2bd' },
]

function OrderRequestSuccessModal({
  request,
  productType,
  onClose,
  onNavigate,
  title = 'Request Submitted Successfully',
  description,
  primaryLabel = 'View Order',
  onPrimary,
}) {
  const viewOrder = () => {
    if (onPrimary) {
      onPrimary()
      return
    }

    const orderPath = request?.orderId
      ? `/my-orders?order=${encodeURIComponent(request.orderId)}`
      : '/my-orders'

    if (onNavigate) {
      onNavigate(orderPath)
      return
    }

    window.location.href = orderPath
  }

  return (
    <div className="order-success-overlay" role="presentation">
      <div className="order-success-confetti" aria-hidden="true">
        {CONFETTI_PIECES.map((piece, index) => (
          <span
            className="order-success-confetti-piece"
            key={index}
            style={{
              '--confetti-x': piece.x,
              '--confetti-y': piece.y,
              '--confetti-rotate': piece.rotate,
              '--confetti-delay': piece.delay,
              '--confetti-color': piece.color,
            }}
          />
        ))}
      </div>

      <section
        className="order-success-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-success-title"
      >
        <button className="order-success-close" type="button" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6 18 18M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <div className="order-success-content">
          <div className="order-success-icon" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path
                d="m6.5 12.3 3.4 3.4 7.6-8"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 id="order-success-title">{title}</h2>
          <p className="order-success-description">
            {description || (
              <>
                We&apos;ve received your {productType} request. Our team will review your customization
                details and send your quotation once it&apos;s ready.
              </>
            )}
          </p>
          <button className="order-success-button" type="button" onClick={viewOrder}>
            {primaryLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

export default OrderRequestSuccessModal

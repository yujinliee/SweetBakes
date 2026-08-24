const formatSubmittedOn = (submittedAt) => {
  const submittedDate = new Date(submittedAt)
  const date = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(submittedDate)
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(submittedDate)

  return `${date} - ${time}`
}

function CupcakeSuccessModal({ request }) {
  const goHome = () => {
    window.location.href = '/'
  }

  return (
    <div className="cake-success-overlay" role="presentation">
      <section
        className="cake-success-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cupcake-success-title"
      >
        <div className="cake-success-intro">
          <div className="cake-success-icon" aria-hidden="true">
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
          <h2 id="cupcake-success-title">Request Submitted Successfully</h2>
          <p className="cake-success-subtitle">Thank you for choosing Sweet Bakes!</p>
          <p className="cake-success-description">
            We&apos;ve received your custom cupcake request. Our team will review your
            customization details and send you a quotation once it&apos;s ready.
          </p>
        </div>

        <div className="cake-success-divider" aria-hidden="true" />

        <dl className="cake-success-details">
          <div>
            <dt>Order ID</dt>
            <dd>{request.requestNumber}</dd>
          </div>
          <div>
            <dt>Submitted On</dt>
            <dd>{formatSubmittedOn(request.submittedAt)}</dd>
          </div>
        </dl>

        <div className="cake-success-actions">
          <button className="cake-success-button cake-success-button--secondary" type="button" onClick={goHome}>
            Back to Home
          </button>
        </div>
      </section>
    </div>
  )
}

export default CupcakeSuccessModal

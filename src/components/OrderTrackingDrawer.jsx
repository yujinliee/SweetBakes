import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const requestsStorageKey = 'sweetbakes:cake-requests'

const statusSteps = [
  'Pending Review',
  'Quotation Sent',
  'Awaiting Payment',
  'Payment Verified',
  'Preparing Cake',
  'Ready for Pickup / Delivery',
  'Completed',
]

const flavorLabels = {
  chocolate: 'Chocolate',
  redvelvet: 'Red Velvet',
}

const layerLabels = {
  1: '1 Layer',
  2: '2 Layers',
  3: '3 Layers',
}

const quantityLabels = {
  6: '6 pcs',
  12: '12 pcs',
  18: '18 pcs',
  24: '24 pcs',
}

const packageLabels = {
  packageA: 'Package A',
  packageB: 'Package B',
  packageC: 'Package C',
}

const formatDate = (value) => {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function getSavedRequests() {
  try {
    return JSON.parse(window.localStorage.getItem(requestsStorageKey)) || []
  } catch {
    return []
  }
}

function OrderTrackingDrawer({ initialRequestNumber = '', onClose }) {
  const savedRequests = useMemo(() => getSavedRequests(), [])
  const closeTimerRef = useRef(null)
  const closeRequestedRef = useRef(false)
  const findSavedRequest = (value) => {
    const normalizedValue = value.trim().toUpperCase()

    return savedRequests.find(
      (savedRequest) => savedRequest.requestNumber.toUpperCase() === normalizedValue,
    )
  }
  const [requestNumber, setRequestNumber] = useState(initialRequestNumber)
  const [hasSearched, setHasSearched] = useState(Boolean(initialRequestNumber))
  const [matchedRequest, setMatchedRequest] = useState(
    initialRequestNumber ? findSavedRequest(initialRequestNumber) || null : null,
  )
  const [isClosing, setIsClosing] = useState(false)
  const [activeTrackTab, setActiveTrackTab] = useState('status')

  const findRequest = (value) => {
    setMatchedRequest(findSavedRequest(value) || null)
    setHasSearched(true)
    setActiveTrackTab('status')
  }

  const requestClose = useCallback(() => {
    if (closeRequestedRef.current) {
      return
    }

    closeRequestedRef.current = true
    setIsClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      onClose()
    }, 280)
  }, [onClose])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        requestClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current)
      }
    }
  }, [requestClose])

  const theme =
    matchedRequest?.designDetails?.theme === 'Other'
      ? matchedRequest.designDetails.otherTheme
      : matchedRequest?.designDetails?.theme
  const isCupcakeRequest = matchedRequest?.productType === 'Cupcakes'
  const isPackageRequest = matchedRequest?.productType === 'Party Package'
  const packageCakeTheme =
    matchedRequest?.packageCustomization?.packageCakeTheme === 'Other'
      ? matchedRequest.packageCustomization.packageCakeOtherTheme
      : matchedRequest?.packageCustomization?.packageCakeTheme
  const packageCupcakeTheme =
    matchedRequest?.packageCustomization?.packageCupcakeTheme === 'Other'
      ? matchedRequest.packageCustomization.packageCupcakeOtherTheme
      : matchedRequest?.packageCustomization?.packageCupcakeTheme
  const currentStatus = matchedRequest?.status || 'Pending Review'
  const currentStatusIndex = Math.max(statusSteps.indexOf(currentStatus), 0)

  return (
    <div
      className={`order-track-overlay${isClosing ? ' order-track-overlay--closing' : ''}`}
      onMouseDown={requestClose}
    >
      <aside
        className={`order-track-drawer${isClosing ? ' order-track-drawer--closing' : ''}`}
        aria-label="Track my order"
        aria-modal="true"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="order-track-header">
          <div>
            <h2>Track My Order</h2>
            <p>Enter your Request Number to view the latest status of your custom order.</p>
          </div>
          <button type="button" aria-label="Close track order" onClick={requestClose}>
            ×
          </button>
        </header>

        <form
          className="order-track-search"
          onSubmit={(event) => {
            event.preventDefault()
            findRequest(requestNumber)
          }}
        >
          <span className="order-track-search-label">Request Number</span>
          <div className="order-track-search-control">
            <input
              type="text"
              aria-label="Request Number"
              placeholder="Enter your request number"
              value={requestNumber}
              onChange={(event) => setRequestNumber(event.target.value.toUpperCase())}
            />
            <button type="submit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="m21 21-4.35-4.35m2.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Track
            </button>
          </div>
        </form>

        {matchedRequest ? (
          <div className="order-track-result">
            <div className="order-track-tabs" role="tablist" aria-label="Track order sections">
              <button
                className={activeTrackTab === 'status' ? 'order-track-tab--active' : ''}
                type="button"
                role="tab"
                aria-selected={activeTrackTab === 'status'}
                onClick={() => setActiveTrackTab('status')}
              >
                Order Status
              </button>
              <button
                className={activeTrackTab === 'details' ? 'order-track-tab--active' : ''}
                type="button"
                role="tab"
                aria-selected={activeTrackTab === 'details'}
                onClick={() => setActiveTrackTab('details')}
              >
                Order Details
              </button>
            </div>

            {activeTrackTab === 'status' ? (
              <section className="order-track-timeline">
                <h3>Order Status</h3>
                <ol>
                  {statusSteps.map((status, index) => (
                    <li
                      className={`order-track-step${
                        index < currentStatusIndex ? ' order-track-step--complete' : ''
                      }${index === currentStatusIndex ? ' order-track-step--current' : ''}`}
                      key={status}
                    >
                      <span className="order-track-step-marker" aria-hidden="true">
                        {index < currentStatusIndex ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path
                              d="m5 12 4 4 10-10"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </span>
                      <span className="order-track-step-content">
                        <span>{status}</span>
                        {index === currentStatusIndex ? (
                          <span className="order-track-step-helper">
                            We're reviewing your customization request.
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : (
              <>
                <section className="order-track-summary">
                  <h3>Order Summary</h3>
                  <dl>
                    {isPackageRequest ? (
                      <>
                        <div>
                          <dt>Product Type</dt>
                          <dd>Party Package</dd>
                        </div>
                        <div>
                          <dt>Package</dt>
                          <dd>
                            {packageLabels[matchedRequest.packageSelection.selectedPackage]}
                          </dd>
                        </div>
                        <div>
                          <dt>Cake</dt>
                          <dd>
                            {[
                              flavorLabels[
                                matchedRequest.packageCustomization.packageCakeFlavor
                              ],
                              matchedRequest.packageCustomization.packageCakeSize
                                ? `${matchedRequest.packageCustomization.packageCakeSize}"`
                                : '',
                              layerLabels[
                                matchedRequest.packageCustomization.packageCakeLayers
                              ],
                              packageCakeTheme,
                            ]
                              .filter(Boolean)
                              .join(' / ')}
                          </dd>
                        </div>
                        <div>
                          <dt>Cupcakes</dt>
                          <dd>
                            {[
                              flavorLabels[
                                matchedRequest.packageCustomization.packageCupcakeFlavor
                              ],
                              matchedRequest.packageSelection.cupcakeQuantity
                                ? `${matchedRequest.packageSelection.cupcakeQuantity} pcs`
                                : '',
                              packageCupcakeTheme,
                            ]
                              .filter(Boolean)
                              .join(' / ')}
                          </dd>
                        </div>
                      </>
                    ) : isCupcakeRequest ? (
                      <div>
                        <dt>Product Type</dt>
                        <dd>Cupcakes</dd>
                      </div>
                    ) : null}
                    {!isPackageRequest && matchedRequest.selections.flavor ? (
                      <div>
                        <dt>Flavor</dt>
                        <dd>{flavorLabels[matchedRequest.selections.flavor]}</dd>
                      </div>
                    ) : null}
                    {!isPackageRequest && isCupcakeRequest && matchedRequest.selections.quantity ? (
                      <div>
                        <dt>Quantity</dt>
                        <dd>{quantityLabels[matchedRequest.selections.quantity]}</dd>
                      </div>
                    ) : null}
                    {!isPackageRequest && !isCupcakeRequest && matchedRequest.selections.size ? (
                      <div>
                        <dt>Size</dt>
                        <dd>{matchedRequest.selections.size}&quot;</dd>
                      </div>
                    ) : null}
                    {!isPackageRequest && !isCupcakeRequest && matchedRequest.selections.layers ? (
                      <div>
                        <dt>Layers</dt>
                        <dd>{layerLabels[matchedRequest.selections.layers]}</dd>
                      </div>
                    ) : null}
                    {!isPackageRequest && theme ? (
                      <div>
                        <dt>Theme</dt>
                        <dd>{theme}</dd>
                      </div>
                    ) : null}
                  </dl>
                </section>

                <section className="order-track-summary">
                  <h3>Order Information</h3>
                  <dl>
                    <div>
                      <dt>Request Number</dt>
                      <dd>{matchedRequest.requestNumber}</dd>
                    </div>
                    <div>
                      <dt>Submitted Date</dt>
                      <dd>{formatDate(matchedRequest.submittedAt)}</dd>
                    </div>
                    {matchedRequest.customerInfo.preferredDate ? (
                      <div>
                        <dt>Preferred Date</dt>
                        <dd>{formatDate(matchedRequest.customerInfo.preferredDate)}</dd>
                      </div>
                    ) : null}
                    {matchedRequest.customerInfo.fulfillment ? (
                      <div>
                        <dt>Order Method</dt>
                        <dd>{matchedRequest.customerInfo.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</dd>
                      </div>
                    ) : null}
                  </dl>
                </section>
              </>
            )}
          </div>
        ) : null}

        {hasSearched && !matchedRequest ? (
          <div className="order-track-empty">
            <div aria-hidden="true">?</div>
            <h3>No order found</h3>
            <p>We couldn&apos;t find an order with that Request Number.</p>
            <p>Please check your Request Number and try again.</p>
          </div>
        ) : null}
      </aside>
    </div>
  )
}

export default OrderTrackingDrawer

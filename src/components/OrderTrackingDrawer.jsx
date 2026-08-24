import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCustomCakeOrderByNumber } from '../cakepage/services/customCakeOrderService.js'
import { supabase } from '../lib/supabase.js'
import { ORDER_PROGRESS_STAGES, getOrderProgressLabel } from '../services/orderStatusDisplay.js'

const statusSteps = ORDER_PROGRESS_STAGES

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

const mapSupabaseOrderToTrackedRequest = (order) => {
  if (!order) {
    return null
  }

  const customCakeItem =
    (order.order_items || []).find(
      (item) => item.customization_data?.request_type === 'custom_cake',
    ) || order.order_items?.[0]
  const customization = customCakeItem?.customization_data || {}
  const selections = {
    flavor: customization.flavor || '',
    size: customization.size || '',
    layers: customization.layers ? String(customization.layers) : '',
  }

  return {
    requestNumber: order.order_number,
    submittedAt: order.created_at,
    status: getOrderProgressLabel(order),
    total: order.total,
    selections,
    designDetails: {
      theme: customization.original_theme || customization.theme || '',
      otherTheme: customization.original_theme === 'Other' ? customization.theme || '' : '',
      message: customization.cake_message || '',
      instructions: customization.special_instructions || '',
      referenceImages: customization.reference_images || [],
    },
    customerInfo: {
      customerFirstName: order.first_name || '',
      customerLastName: order.last_name || '',
      contactNumber: order.contact_number || '',
      email: order.email || '',
      fulfillment: order.order_method || '',
      province: order.province || '',
      city: order.city_municipality || '',
      barangay: order.barangay || '',
      address: order.address || '',
      apartment: order.apartment_unit || '',
      deliverDifferentRecipient: Boolean(order.different_recipient),
      recipientFirstName: order.recipient_name || '',
      recipientLastName: '',
      recipientContact: order.recipient_contact || '',
      deliveryAddress: order.address || '',
      landmark: order.landmark || '',
      preferredPickupTime: order.order_method === 'pickup' ? order.preferred_time || '' : '',
      preferredDeliveryTime: order.order_method === 'delivery' ? order.preferred_time || '' : '',
      preferredDate: order.preferred_date || '',
    },
  }
}

function OrderTrackingDrawer({ initialRequestNumber = '', onClose, onRequestSignIn }) {
  const closeTimerRef = useRef(null)
  const closeRequestedRef = useRef(false)
  const [requestNumber, setRequestNumber] = useState(initialRequestNumber)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authResolved, setAuthResolved] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [matchedRequest, setMatchedRequest] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [isClosing, setIsClosing] = useState(false)
  const [activeTrackTab, setActiveTrackTab] = useState('status')

  useEffect(() => {
    let isActive = true
    async function resolveCustomerSession() {
      const { data, error } = await supabase.auth.getUser()
      let isCustomer = false

      if (!error && data?.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle()
        isCustomer = !profileError && profile?.role === 'customer'
      }

      if (isActive) {
        setIsAuthenticated(isCustomer)
        setAuthResolved(true)
      }
    }

    resolveCustomerSession()
    return () => {
      isActive = false
    }
  }, [])

  const findRequest = useCallback(async (value) => {
    const normalizedValue = String(value || '').trim()

    if (!normalizedValue) {
      setMatchedRequest(null)
      setHasSearched(true)
      return
    }

    if (authResolved && !isAuthenticated) {
      return
    }

    setIsSearching(true)
    setSearchError('')
    setActiveTrackTab('status')

    try {
      const supabaseOrder = await fetchCustomCakeOrderByNumber(normalizedValue)
      setMatchedRequest(mapSupabaseOrderToTrackedRequest(supabaseOrder))
    } catch (error) {
      console.error('[TRACK ORDER]', error)
      setMatchedRequest(null)
      setSearchError('Unable to load the latest order status. Please try again.')
    } finally {
      setHasSearched(true)
      setIsSearching(false)
    }
  }, [authResolved, isAuthenticated])

  useEffect(() => {
    if (!initialRequestNumber || !isAuthenticated) return undefined

    const timeoutId = window.setTimeout(() => {
      findRequest(initialRequestNumber)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [findRequest, initialRequestNumber, isAuthenticated])

  const currentStatus = matchedRequest?.status || 'Pending Review'
  const timelineSteps =
    currentStatus === 'Request Not Accepted'
      ? ['Pending', 'Request Not Accepted']
      : statusSteps
  const currentStatusIndex = Math.max(timelineSteps.indexOf(currentStatus), 0)
  const hasFinalPrice = !(currentStatus === 'Pending Review' && Number(matchedRequest?.total) === 0)
  const finalPrice = Number(matchedRequest?.total)
  const finalPriceLabel =
    hasFinalPrice && Number.isFinite(finalPrice)
      ? new Intl.NumberFormat('en-PH', {
          style: 'currency',
          currency: 'PHP',
          maximumFractionDigits: 0,
        }).format(finalPrice)
      : 'Price Pending'

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

        {authResolved && isAuthenticated ? (
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
                {isSearching ? 'Tracking...' : 'Track'}
              </button>
            </div>
          </form>
        ) : null}
        {authResolved && !isAuthenticated ? (
          <div className="order-track-auth-notice">
            <p>Sign in to track your custom cake request.</p>
            <button
              type="button"
              className="order-track-sign-in"
              onClick={() => onRequestSignIn?.(requestNumber)}
            >
              Sign In to Track
            </button>
          </div>
        ) : null}
        {searchError ? (
          <p className="cake-field-error">* {searchError}</p>
        ) : null}

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
                  {timelineSteps.map((status, index) => (
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
                            {currentStatus === 'Accepted / Awaiting Downpayment'
                              ? `Your request has been approved. Final Price: ${finalPriceLabel}.`
                              : currentStatus === 'Request Not Accepted'
                                ? 'Your custom cake request was not accepted.'
                                : "We're reviewing your customization request."}
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
                    <div>
                      <dt>Final Price</dt>
                      <dd>{finalPriceLabel}</dd>
                    </div>
                  </dl>
                </section>
              </>
            )}
          </div>
        ) : null}

        {hasSearched && !matchedRequest && !searchError ? (
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

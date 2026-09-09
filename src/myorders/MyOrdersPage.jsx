import { useEffect, useLayoutEffect, useState } from 'react'
import { ADMIN_DASHBOARD_ROUTE } from '../admin/adminRouteConstants.js'
import { SiteFooter, SiteTopbar } from '../landingpage/LandingPage.jsx'
import { getOrderProgressStage, getOrderProgressStages, getOrderProgressLabel, isRegularProgressOrder } from '../services/orderStatusDisplay.js'
import { supabase } from '../lib/supabase.js'
import { clearCart, removeCartQuantity } from '../cartStore.js'
import PaymentReturnStatus from '../cartpage/PaymentReturnStatus.jsx'
import PaymentSuccessModal from '../components/PaymentSuccessModal.jsx'
import { CART_PAYMENT_RETURN_STORAGE_KEY, loadConfirmedItems, isVerifiedPayment as isPaymentVerified, logPaymentReturn, shouldConsumePaymentReturn } from '../cartpage/paymentConfirmation.js'
import { fetchCustomerReviews } from '../services/orderReviewService.js'
import OrderReviewModal from './OrderReviewModal.jsx'
import { ORDER_TABS, EMPTY_MESSAGES, attachOrderReviews, getOrderTabCounts, matchesOrderTab, isAwaitingPrice, historyStatus, itemDescription, referenceImages, getHistoryItems } from './orderHistory.js'
import { attachCatalogImages, itemImage, itemFallback } from './orderHistoryImages.js'
import './MyOrdersPage.css'

const ORDER_SELECT = `id, order_number, customer_id, first_name, last_name, email, order_method, province, city_municipality, barangay, postal_code, address, apartment_unit, landmark, different_recipient, recipient_name, recipient_contact, preferred_date, preferred_time, subtotal, delivery_fee, total, required_down_payment, order_status, payment_status, payment_method, created_at, updated_at`
const ORDER_ITEM_SELECT = `id, order_id, product_id, product_name, product_type, variant_name, quantity, subtotal, unit_price, customization_data`
const PRICE_ITEM_SELECT = 'id, order_id, description, amount, sort_order'
const REFERENCE_BUCKET = 'custom-order-references'

const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(Number(value) || 0)
const formatDate = (value) => { if (!value) return 'Not scheduled'; const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? 'Not scheduled' : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) }
const formatStatus = (value) => { const normalized = String(value || '').trim(); return normalized ? normalized.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Pending' }
const formatTime = (value) => value ? new Date(`1970-01-01T${value}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Not specified'

function isCustomOrder(order) { return (order?.order_items || []).some((item) => item.customization_data?.request_type) }
function removePurchasedCartItems(order) { (order?.order_items || []).forEach((item) => removeCartQuantity(item.product_name, item.quantity)) }
function getCustomizationFields(value) {
  if (!value || typeof value !== 'object') return []
  const hidden = new Set(['request_type', 'reference_images', 'is_custom'])
  return Object.entries(value).filter(([key, entry]) => !hidden.has(key) && entry !== null && entry !== '' && !(Array.isArray(entry) && entry.length === 0) && !/image|url|path/i.test(key)).map(([key, entry]) => ({ label: key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), value: Array.isArray(entry) ? entry.filter(Boolean).join(', ') : typeof entry === 'object' ? getCustomizationFields(entry).map((field) => field.label + ': ' + field.value).join('; ') : String(entry) })).filter((field) => field.value)
}

function StatusProgress({ order }) {
  const stage = getOrderProgressStage({ orderStatus: order.order_status, paymentStatus: order.payment_status, isRegularOrder: isRegularProgressOrder(order) })
  const isTerminal = ['cancelled', 'rejected'].includes(String(order.order_status || '').toLowerCase())
  return <div className="my-orders-progress" aria-label={`Order status: ${getOrderProgressLabel(order)}`}>
    {isTerminal ? <div className="my-orders-terminal-status">{formatStatus(order.order_status)}</div> : getOrderProgressStages(order).map((label, index) => <div className={`my-orders-progress-step ${index <= stage ? 'is-complete' : ''} ${index === stage ? 'is-current' : ''}`} key={label}><span>{index < stage ? '✓' : index + 1}</span><strong>{label}</strong></div>)}
  </div>
}

function PaymentPanel({ order, downPayment }) {
  const [isCreatingPayment, setIsCreatingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const eligible = String(order.order_status || '').toLowerCase() === 'confirmed' && String(order.payment_status || '').toLowerCase() === 'pending' && Number(downPayment) > 0
  const handlePayDownPayment = async () => {
    if (isCreatingPayment || !eligible) return
    setIsCreatingPayment(true)
    setPaymentError('')
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const session = sessionData?.session
      console.log('[PAYMENT SESSION CHECK]', { hasSession: Boolean(session), userId: session?.user?.id ?? null })
      if (sessionError || !session?.access_token) {
        setPaymentError('Authentication is required. Please sign in again.')
        return
      }
      console.log('[XENDIT ORDER ID]', { orderId: order?.id, orderNumber: order?.order_number })
      const invokeResult = await supabase.functions.invoke('create-xendit-payment', {
        body: { orderId: order.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const invokeError = invokeResult.error
      const invokeData = invokeResult.data
      if (invokeError) {
        const response = invokeError.context
        if (response instanceof Response) {
          try {
            console.error('[XENDIT PAYMENT RESPONSE]', await response.clone().json())
          } catch {
            try { console.error('[XENDIT PAYMENT RESPONSE]', await response.clone().text()) } catch { /* no diagnostic body */ }
          }
        }
        throw invokeError
      }
      if (!invokeData?.paymentUrl || typeof invokeData.paymentUrl !== 'string') throw new Error('Payment service returned no checkout URL.')
      window.location.assign(invokeData.paymentUrl)
    } catch (error) {
      console.error('[XENDIT PAYMENT]', error)
      setPaymentError('Unable to start payment. Please try again.')
    } finally {
      setIsCreatingPayment(false)
    }
  }
  return eligible ? <div className="my-orders-detail-payment-action"><button type="button" className="my-orders-pay-button" onClick={handlePayDownPayment} disabled={isCreatingPayment}>{isCreatingPayment ? 'Creating Payment...' : `Pay Down Payment: ${formatCurrency(downPayment)}`}</button>{paymentError ? <p className="my-orders-payment-error" role="alert">{paymentError}</p> : null}</div> : null
}

function RegularPaymentPanel({ order }) {
  const [isCreatingPayment, setIsCreatingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const eligible = String(order.order_status || '').toLowerCase() === 'pending'
    && ['unpaid', 'pending'].includes(String(order.payment_status || '').toLowerCase())
    && Number(order.total) > 0

  const handlePayNow = async () => {
    if (isCreatingPayment || !eligible) return
    setIsCreatingPayment(true)
    setPaymentError('')
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const session = sessionData?.session
      if (sessionError || !session?.access_token) throw new Error('Authentication is required.')
      const { data, error } = await supabase.functions.invoke('create-xendit-payment', {
        body: { orderId: order.id, paymentType: 'regular' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (error || !data?.paymentUrl) throw error || new Error('Payment service returned no checkout URL.')
      window.location.assign(data.paymentUrl)
    } catch (error) {
      console.error('[XENDIT REGULAR PAYMENT]', error)
      setPaymentError('Unable to start payment. Please try again.')
    } finally {
      setIsCreatingPayment(false)
    }
  }

  return eligible ? <div className="my-orders-detail-payment-action"><button type="button" className="my-orders-pay-button" onClick={handlePayNow} disabled={isCreatingPayment}>{isCreatingPayment ? 'Creating Payment...' : 'Pay Now'}</button>{paymentError ? <p className="my-orders-payment-error" role="alert">{paymentError}</p> : null}</div> : null
}

function PaymentReturnNotice({ order, paymentReturn, onRetry }) {
  if (!paymentReturn || paymentReturn.orderId !== order.id) return null
  if (['checking', 'error', 'timeout'].includes(paymentReturn.status)) return <PaymentReturnStatus state={paymentReturn} onRetry={onRetry} />
  const amount = formatCurrency(isCustomOrder(order) ? order.required_down_payment : order.total)
  if (paymentReturn.status === 'verified') {
    return <section className="my-orders-payment-return my-orders-payment-return--success" role="status"><span className="my-orders-payment-return-icon" aria-hidden="true">✓</span><div><strong>Payment Successful</strong><p>Payment Verified</p><span>Thank you! We received your {amount}{isCustomOrder(order) ? ' down payment' : ' payment'}.</span><small>Order {order.order_number || 'Order'}</small></div></section>
  }
  if (paymentReturn.status === 'timeout') {
    return <section className="my-orders-payment-return" role="status"><strong>Confirming your payment...</strong><p>We&apos;re still confirming your payment. Please check My Orders or Track Order shortly.</p></section>
  }
  if (paymentReturn.status === 'cancelled') {
    return <section className="my-orders-payment-return" role="status"><strong>Payment was not completed</strong><p>Your payment status remains pending. You can try again when you are ready.</p></section>
  }
  return <section className="my-orders-payment-return" role="status"><strong>Confirming your payment...</strong><p>We’re waiting for payment verification from Xendit.</p></section>
}

function OrderDetails({ order, onClose, onImageOpen, paymentReturn, onPaymentRetry }) {
  useLayoutEffect(() => {
    const root = document.documentElement
    const body = document.body
    const { scrollX, scrollY } = window
    const scrollbarWidth = window.innerWidth - root.clientWidth
    const previousStyles = []
    const setStyle = (element, property, value) => {
      previousStyles.push([element, property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)])
      element.style.setProperty(property, value)
    }
    const bodyPadding = parseFloat(window.getComputedStyle(body).paddingRight) || 0
    setStyle(root, 'overflow', 'hidden')
    setStyle(body, 'overflow', 'hidden')
    setStyle(body, 'position', 'fixed')
    setStyle(body, 'top', `-${scrollY}px`)
    setStyle(body, 'left', `-${scrollX}px`)
    setStyle(body, 'width', '100%')
    setStyle(body, 'box-sizing', 'border-box')
    if (scrollbarWidth > 0) setStyle(body, 'padding-right', `${bodyPadding + scrollbarWidth}px`)

    return () => {
      previousStyles.reverse().forEach(([element, property, value, priority]) => {
        if (value) element.style.setProperty(property, value, priority)
        else element.style.removeProperty(property)
      })
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' })
    }
  }, [])

  const items = order.order_items || []
  const priceItems = order.price_items || []
  const finalPrice = priceItems.length ? priceItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) : Number(order.total) || 0
  const downPayment = Number(order.required_down_payment) || finalPrice * 0.5
  const referenceImages = items.flatMap((item) => (Array.isArray(item.customization_data?.reference_images) ? item.customization_data.reference_images : [])).filter((image) => image.signed_url || image.url)
  const isDelivery = String(order.order_method || '').toLowerCase() === 'delivery'
  const address = [order.address, [order.barangay, order.city_municipality].filter(Boolean).join(', '), [order.province, order.postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return <div className="my-orders-detail-backdrop" role="presentation" onMouseDown={onClose}><article className="my-orders-detail" role="dialog" aria-modal="true" aria-labelledby="my-orders-detail-title" onMouseDown={(event) => event.stopPropagation()}>
    <header className="my-orders-detail-header"><div><p>Order ID</p><h2 id="my-orders-detail-title">{order.order_number || 'Order'}</h2></div><button type="button" onClick={onClose} aria-label="Close order details">×</button></header>
    <div className="my-orders-detail-scroll">
      <section className="my-orders-detail-card"><h3>Order Status</h3><StatusProgress order={order} /></section>
      <section className="my-orders-detail-card my-orders-information"><h3>Order Information</h3>
        <div className="my-orders-detail-products">{items.map((item) => <div className="my-orders-detail-product" key={item.id}>
          <OrderThumbnail item={item} />
          <div className="my-orders-detail-product-info">
            <h4>{item.product_name || 'Custom order'}</h4>
            <p>{itemDescription(item) || (item.product_type ? formatStatus(item.product_type) : 'Sweet Treats')}</p>
            <p><strong>Qty:</strong> {item.quantity}</p>
            <p>{isDelivery ? 'Delivery' : 'Store Pickup'}</p>
            {getCustomizationFields(item.customization_data).length ? <dl className="my-orders-detail-customization">{getCustomizationFields(item.customization_data).map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl> : null}
          </div>
          <div className="my-orders-detail-meta">
            {order.payment_status ? <span className={`my-orders-detail-paid${isPaymentVerified(order.payment_status) ? '' : ' my-orders-detail-paid--unverified'}`}>{String(order.payment_status).toLowerCase() === 'paid' ? 'Paid' : isPaymentVerified(order.payment_status) && isCustomOrder(order) ? 'Down Payment Verified' : formatStatus(order.payment_status)}</span> : null}
            <strong className="my-orders-detail-price">{isAwaitingPrice(order) ? 'Awaiting Price' : formatCurrency(items.length === 1 ? finalPrice : item.subtotal ?? Number(item.unit_price) * Number(item.quantity))}</strong>
          </div>
        </div>)}</div>
        {items.length > 1 ? <div className="my-orders-detail-total"><span>Order Total</span><strong className="my-orders-detail-price">{isAwaitingPrice(order) ? 'Awaiting Price' : formatCurrency(finalPrice)}</strong></div> : null}
        {referenceImages.length ? <div className="my-orders-detail-references"><h4>Reference Images</h4><div className="my-orders-reference-images">{referenceImages.map((image, index) => <button type="button" key={image.path || image.signed_url || index} onClick={() => onImageOpen(image.signed_url || image.url)}><img src={image.signed_url || image.url} alt={image.name || 'Order reference'} /></button>)}</div></div> : null}
        <PaymentReturnNotice order={order} paymentReturn={paymentReturn} onRetry={onPaymentRetry} />
        {isCustomOrder(order) ? <PaymentPanel order={order} downPayment={downPayment} /> : <RegularPaymentPanel order={order} />}
      </section>
      <section className="my-orders-detail-card"><h3>Fulfillment Details</h3><dl className="my-orders-detail-fulfillment"><div><dt>Preferred Date</dt><dd>{formatDate(order.preferred_date)}</dd></div><div><dt>Preferred Time</dt><dd>{formatTime(order.preferred_time)}</dd></div><div className="my-orders-detail-wide"><dt>Order Method</dt><dd>{isDelivery ? 'Delivery' : 'Store Pickup'}</dd></div>{isDelivery ? <><div className="my-orders-detail-wide"><dt>Delivery Address</dt><dd>{address || 'Not provided'}</dd></div>{order.different_recipient ? <div className="my-orders-detail-wide"><dt>Recipient</dt><dd>{order.recipient_name || 'Not provided'} {order.recipient_contact || ''}</dd></div> : null}</> : <div className="my-orders-detail-wide"><dt>Pickup Location</dt><dd>Sweet Bakes store pickup</dd></div>}</dl></section>
    </div>
  </article></div>
}

function OrderThumbnail({ item }) {
  const [failedSources, setFailedSources] = useState([])
  const source = [itemImage(item), item.history_image, itemFallback(item)].find((url) => url && !failedSources.includes(url))
  return <div className="my-orders-thumbnail">{source ? <img src={source} alt="" loading="lazy" onError={() => setFailedSources((current) => [...current, source])} /> : <span aria-hidden="true">SB</span>}</div>
}

function OrderHistoryCard({ order, onSelect, onReview }) {
  const items = getHistoryItems(order)
  return <article className="my-orders-card my-orders-history-card" aria-label={'Order ' + (order.order_number || '')}>
    <header className="my-orders-history-header">
      <span className={'my-orders-status my-orders-status--' + order.order_status}>{historyStatus(order)}</span>
      <div className="my-orders-card-actions">{order.review ? <span className="my-orders-reviewed">Reviewed</span> : null}<button type="button" className="my-orders-view-details" onClick={() => onSelect(order)} aria-label={'View details for ' + (order.order_number || 'order')}>View Details <span aria-hidden="true">&rarr;</span></button></div>
    </header>
    <div className="my-orders-history-body">
      <div className="my-orders-products">{items.length ? items.map((item) => <div className="my-orders-product" key={item.id}>
        <OrderThumbnail item={item} />
        <div className="my-orders-product-info"><h2>{item.product_name || 'Custom order'}</h2>
          {itemDescription(item) ? <p>{itemDescription(item)}</p> : null}
          <div className="my-orders-product-metadata">
          <p><span className="my-orders-detail-label">Qty:</span> <span className="my-orders-detail-value">{item.quantity}</span></p>
          {order.preferred_date ? <p><span className="my-orders-detail-label">Preferred Date:</span> <span className="my-orders-detail-value">{formatDate(order.preferred_date)}</span></p> : null}
          <p><span className="my-orders-detail-label">Order ID:</span> <span className="my-orders-detail-value">{item.orderNumber || 'Unavailable'}</span></p>
          </div>
        </div>
      </div>) : <div className="my-orders-product-info"><p>Product details unavailable.</p></div>}</div>
      {onReview ? <div className="my-orders-review-column"><strong className="my-orders-product-price" aria-label="Order total">{isAwaitingPrice(order) ? 'Awaiting Price' : formatCurrency(order.total)}</strong><button type="button" className="my-orders-review-button" onClick={() => onReview(order)} aria-label={'Review order ' + (order.order_number || '')}>Review</button></div> : <strong className="my-orders-product-price" aria-label="Order total">{isAwaitingPrice(order) ? 'Awaiting Price' : formatCurrency(order.total)}</strong>}
    </div>
  </article>
}

function MyOrdersPage({ onNavigate, onCustomerLogout, isCustomerAuthenticated = false }) {
  const [orders, setOrders] = useState([]); const [selectedOrder, setSelectedOrder] = useState(null); const [previewImage, setPreviewImage] = useState(''); const [isLoading, setIsLoading] = useState(true); const [error, setError] = useState(''); const [verifiedRegularOrder, setVerifiedRegularOrder] = useState(null); const [paymentReturn, setPaymentReturn] = useState(() => { const params = new URLSearchParams(window.location.search); const payment = params.get('payment'); const orderId = params.get('order'); if (!orderId || !['success', 'cancelled'].includes(payment)) return null; return { orderId, status: payment === 'success' ? 'checking' : 'cancelled' } })
  useEffect(() => {
    if (!paymentReturn || !shouldConsumePaymentReturn(paymentReturn.status)) return
    const url = new URL(window.location.href)
    url.searchParams.delete('payment')
    url.searchParams.delete('order')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    if (paymentReturn.status === 'cancelled') {
      try {
        const receipt = JSON.parse(window.localStorage.getItem(CART_PAYMENT_RETURN_STORAGE_KEY) || 'null')
        if (receipt?.orderId === paymentReturn.orderId) window.localStorage.removeItem(CART_PAYMENT_RETURN_STORAGE_KEY)
      } catch { /* Ignore malformed transient state. */ }
    }
  }, [paymentReturn])
  const [activeTab, setActiveTab] = useState('All')
  const [reviewOrder, setReviewOrder] = useState(null)
  const [reviewMessage, setReviewMessage] = useState('')
  const handleReviewSubmitted = (review) => {
    setOrders((current) => current.map((order) => order.id === review.order_id ? { ...order, review } : order))
    setReviewOrder(null)
    setReviewMessage('Review submitted.')
  }
  const tabCounts = getOrderTabCounts(orders)
  const visibleOrders = orders.filter((order) => matchesOrderTab(order, activeTab))
  const handleSelectOrder = (order) => { setSelectedOrder({ ...order, price_items: [] }) }
  useEffect(() => {
    let isMounted = true
    let channel = null
    let customerId = null
    let refreshTimer = null
    let loading = false
    let refreshQueued = false
    let initialLoad = true
    const scheduleRefresh = () => {
      if (!isMounted) return
      if (loading) { refreshQueued = true; return }
      window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => { refreshTimer = null; loadOrders() }, 150)
    }
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (customerId && session?.user?.id !== customerId) {
        isMounted = false
        window.clearTimeout(refreshTimer)
        if (channel) supabase.removeChannel(channel)
        channel = null
        setOrders([])
      }
    })
    async function loadOrders() {
      if (!isMounted) return
      if (loading) { refreshQueued = true; return }
      loading = true
      try { if (initialLoad) setIsLoading(true); setError(''); const { data: sessionData, error: sessionError } = await supabase.auth.getSession(); const user = sessionData?.session?.user || null; if (sessionError || !user) { onNavigate?.('/login?redirect=/my-orders', { replace: true }); return }; const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(); if (profileError) throw profileError; if (profile?.role === 'admin') { onNavigate?.(ADMIN_DASHBOARD_ROUTE, { replace: true }); return }; if (profile?.role !== 'customer') { await supabase.auth.signOut(); onNavigate?.('/login', { replace: true }); return }
      if (!isMounted) return
      if (!channel) {
        customerId = user.id
        await supabase.realtime.setAuth(sessionData.session.access_token)
        if (!isMounted) return
        channel = supabase.channel('customer-orders:' + user.id, { config: { private: true } })
          .on('broadcast', { event: 'orders_changed' }, scheduleRefresh)
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') scheduleRefresh()
            if (isMounted && ['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) {
              console.error('[MY ORDERS] Realtime connection unavailable:', status)
            }
          })
      }
      const { data: orderRows, error: ordersError } = await supabase.from('orders').select(ORDER_SELECT).eq('customer_id', user.id).order('created_at', { ascending: false }); if (ordersError) throw ordersError; const orderIds = (orderRows || []).map((order) => order.id).filter(Boolean); let items = []
      if (orderIds.length) { const itemsResult = await supabase.from('order_items').select(ORDER_ITEM_SELECT).in('order_id', orderIds); if (itemsResult.error) throw itemsResult.error; items = itemsResult.data || [] }
      items = await attachCatalogImages(items)
      const itemsByOrderId = items.reduce((groups, item) => { (groups[item.order_id] ||= []).push(item); return groups }, {})
      const paths = items.flatMap(referenceImages).map((image) => image?.path).filter(Boolean); const signed = paths.length ? await supabase.storage.from(REFERENCE_BUCKET).createSignedUrls([...new Set(paths)], 60 * 60) : { data: [], error: null }; if (signed.error) console.warn('[MY ORDERS] reference image URLs:', signed.error)
      const urls = (signed.data || []).reduce((map, entry) => { if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl; return map }, {})
      const nextOrders = (orderRows || []).map((order) => ({ ...order, order_items: (itemsByOrderId[order.id] || []).map((item) => ({ ...item, customization_data: item.customization_data ? { ...item.customization_data, reference_images: referenceImages(item).map((image) => ({ ...image, signed_url: image.path ? urls[image.path] || '' : '' })) } : item.customization_data })) }))
      nextOrders.filter((order) => !isCustomOrder(order)).forEach((order) => {
        console.info('[MY ORDERS SWEET TREATS]', {
          orderId: order.id,
          orderNumber: order.order_number ?? null,
          customerId: order.customer_id,
        })
      })
      const reviews = await fetchCustomerReviews(user.id)
      if (isMounted) setOrders((current) => {
        // A refresh started before submission must not erase a just-saved review.
        const saved = new Map(current.filter((order) => order.review).map((order) => [order.id, order.review]))
        return attachOrderReviews(nextOrders, reviews).map((order) => ({ ...order, review: order.review || saved.get(order.id) || null }))
      })
    } catch (loadError) { console.error('[MY ORDERS] load error:', loadError); if (isMounted) setError('Unable to load your orders. Please try again.') } finally {
      loading = false
      initialLoad = false
      if (isMounted) setIsLoading(false)
      if (refreshQueued) { refreshQueued = false; scheduleRefresh() }
    } }
    loadOrders()
    return () => {
      isMounted = false
      window.clearTimeout(refreshTimer)
      authSubscription.unsubscribe()
      if (channel) supabase.removeChannel(channel)
    }
  }, [onNavigate])
  useEffect(() => {
    if (!paymentReturn?.orderId || !orders.length || paymentReturn.status === 'verified') return undefined
    const returnedOrder = orders.find((order) => order.id === paymentReturn.orderId)
    if (!returnedOrder || selectedOrder?.id === returnedOrder.id) return undefined
    const selectionTimer = window.setTimeout(() => handleSelectOrder(returnedOrder), 0)
    return () => window.clearTimeout(selectionTimer)
  }, [orders, paymentReturn?.orderId, paymentReturn?.status, selectedOrder?.id])
  useEffect(() => {
    if (!paymentReturn?.orderId || paymentReturn.status !== 'checking') return undefined
    logPaymentReturn('detected success URL', { isCustomerAuthenticated: true })
    logPaymentReturn('verification started', { phase: 'owned-order' })
    let isMounted = true
    const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))
    async function refreshPaymentStatus() {
      for (let attempt = 0; attempt < 8 && isMounted; attempt += 1) {
        if (attempt > 0) await wait(1500)
        const { data: sessionData } = await supabase.auth.getSession()
        const userId = sessionData?.session?.user?.id
        if (!userId) throw Object.assign(new Error(), { code: 'SESSION_REQUIRED' })
        const { data: freshOrder, error: refreshError } = await supabase.from('orders').select(ORDER_SELECT).eq('id', paymentReturn.orderId).eq('customer_id', userId).maybeSingle()
        logPaymentReturn('verification result', { attempt: attempt + 1, phase: 'owned-order', outcome: refreshError ? 'request-error' : freshOrder ? 'response' : 'not-found', paymentStatus: freshOrder?.payment_status })
        if (refreshError) throw refreshError
        if (!isMounted) return
        if (!freshOrder) break
        setOrders((current) => current.map((order) => order.id === freshOrder.id ? { ...order, ...freshOrder } : order))
        setSelectedOrder((current) => current?.id === freshOrder.id ? { ...current, ...freshOrder } : current)
        if (isPaymentVerified(freshOrder.payment_status)) {
          let confirmedItems
          try { confirmedItems = await loadConfirmedItems(supabase, freshOrder.id) } catch (error) { logPaymentReturn('details-error', { errorCode: error.code }); throw error }
          const verifiedOrder = { ...freshOrder, order_items: await attachCatalogImages(confirmedItems) }
          if (!isMounted) return
          if (isCustomOrder(verifiedOrder)) removePurchasedCartItems(verifiedOrder)
          else {
            let receipt = null
            try { receipt = JSON.parse(window.localStorage.getItem(CART_PAYMENT_RETURN_STORAGE_KEY) || 'null') } catch { /* Invalid context is not payment proof. */ }
            logPaymentReturn('verification result', { phase: 'context', contextFound: receipt?.orderId === freshOrder.id, hasGuestEmail: Boolean(receipt?.guestEmail) })
            if (receipt?.orderId === freshOrder.id && !receipt.guestEmail) {
              clearCart()
              window.localStorage.removeItem(CART_PAYMENT_RETURN_STORAGE_KEY)
              setSelectedOrder(null)
              setVerifiedRegularOrder(verifiedOrder)
            } else {
              logPaymentReturn('context-error', { errorCode: 'INVALID_RETURN_CONTEXT' })
              setPaymentReturn((current) => ({ ...current, status: 'error', stage: 'context' }))
              return
            }
          }
          setPaymentReturn((current) => current ? { ...current, status: 'verified' } : current)
          return
        }
      }
      if (isMounted) { logPaymentReturn('verification timeout', { phase: 'owned-order' }); setPaymentReturn((current) => current ? { ...current, status: 'timeout' } : current) }
    }
    refreshPaymentStatus().catch((error) => { if (isMounted) { logPaymentReturn('verification-error', { errorCode: error.code, httpStatus: error.context?.status }); setPaymentReturn((current) => current ? { ...current, status: 'error', stage: 'verification' } : current) } })
    return () => { isMounted = false }
  }, [paymentReturn?.orderId, paymentReturn?.status])
  useEffect(() => {
    if (!selectedOrder?.id) return undefined
    let isMounted = true
    supabase.from('order_price_breakdown_items').select(PRICE_ITEM_SELECT).eq('order_id', selectedOrder.id).order('sort_order', { ascending: true }).then(({ data: breakdownItems, error: breakdownErrorResponse }) => {
      console.log('[MY ORDERS BREAKDOWN]', { orderId: selectedOrder.id, breakdownItems, breakdownError: breakdownErrorResponse })
      if (!isMounted) return
      if (breakdownErrorResponse) {
        console.error('[MY ORDERS BREAKDOWN] fetch error:', breakdownErrorResponse)
        return
      }
      setSelectedOrder((current) => current?.id === selectedOrder.id ? { ...current, price_items: breakdownItems || [] } : current)
    })
    return () => { isMounted = false }
  }, [selectedOrder?.id])
  return <div className="my-orders-page"><SiteTopbar forceScrolled homeHref="/" locationHref="/#location" contactHref="#contact" onNavigate={onNavigate} onCustomerLogout={onCustomerLogout} isCustomerAuthenticated={isCustomerAuthenticated} /><main className="my-orders-content"><section className="my-orders-shell" aria-labelledby="my-orders-title"><div className="my-orders-heading"><p className="my-orders-eyebrow">Sweet Bakes Account</p><h1 id="my-orders-title">My Orders</h1></div><nav className="my-orders-tabs" aria-label="Filter orders by status">{ORDER_TABS.map((tab) => <button type="button" key={tab} className={activeTab === tab ? 'is-active' : ''} aria-pressed={activeTab === tab} aria-controls="my-orders-results" onClick={() => setActiveTab(tab)}>{tab}<span className="my-orders-tab-count">{tabCounts[tab]}</span></button>)}</nav>
      {['checking', 'error', 'timeout'].includes(paymentReturn?.status) ? <PaymentReturnStatus state={paymentReturn} onRetry={() => setPaymentReturn((current) => ({ ...current, status: 'checking' }))} /> : null}
      {reviewMessage ? <p role="status" className="my-orders-review-success">{reviewMessage}</p> : null}<div id="my-orders-results" aria-live="polite" aria-busy={isLoading}>
        {isLoading ? <div className="my-orders-card my-orders-state">Loading orders...</div> : error ? <div className="my-orders-card my-orders-state my-orders-state--error" role="alert">{error}</div> : visibleOrders.length === 0 ? <div className="my-orders-card my-orders-empty"><p>{EMPTY_MESSAGES[activeTab]}</p></div> : <>
          {activeTab === 'To Receive' ? <p className="my-orders-tab-note">Ready for store pickup.</p> : null}
          <div className="my-orders-list">{visibleOrders.map((order) => <OrderHistoryCard key={order.id} order={order} onSelect={handleSelectOrder} onReview={activeTab === 'To Review' ? setReviewOrder : undefined} />)}</div>
        </>}
      </div></section></main><SiteFooter />{reviewOrder ? <OrderReviewModal key={reviewOrder.id} order={reviewOrder} onSubmitted={handleReviewSubmitted} onClose={() => setReviewOrder(null)} /> : null}{selectedOrder ? <OrderDetails order={selectedOrder} paymentReturn={paymentReturn} onPaymentRetry={() => setPaymentReturn((current) => ({ ...current, status: 'checking' }))} onClose={() => setSelectedOrder(null)} onImageOpen={setPreviewImage} /> : null}{previewImage ? <div className="my-orders-image-backdrop" role="presentation" onClick={() => setPreviewImage('')}><img src={previewImage} alt="Larger order reference" /></div> : null}{verifiedRegularOrder ? <PaymentSuccessModal order={verifiedRegularOrder} onClose={() => setVerifiedRegularOrder(null)} onPrimary={() => { setVerifiedRegularOrder(null); setActiveTab('All'); handleSelectOrder(verifiedRegularOrder) }} onContinue={() => { setVerifiedRegularOrder(null); onNavigate?.('/#sweet-treats') }} /> : null}</div>
}
export default MyOrdersPage

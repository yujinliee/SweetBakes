import { useEffect, useState } from 'react'
import { ADMIN_DASHBOARD_ROUTE } from '../admin/adminRouteConstants.js'
import { SiteFooter, SiteTopbar } from '../landingpage/LandingPage.jsx'
import { getOrderProgressStage, ORDER_PROGRESS_STAGES } from '../services/orderStatusDisplay.js'
import { supabase } from '../lib/supabase.js'
import { removeCartQuantity } from '../cartStore.js'
import './MyOrdersPage.css'

const ORDER_SELECT = `id, order_number, first_name, last_name, email, order_method, province, city_municipality, barangay, postal_code, address, apartment_unit, landmark, different_recipient, recipient_name, recipient_contact, preferred_date, preferred_time, subtotal, delivery_fee, total, required_down_payment, order_status, payment_status, payment_method, created_at, updated_at`
const ORDER_ITEM_SELECT = `id, order_id, product_name, product_type, variant_name, quantity, subtotal, unit_price, customization_data`
const PRICE_ITEM_SELECT = 'id, order_id, description, amount, sort_order'
const REFERENCE_BUCKET = 'custom-order-references'

const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(Number(value) || 0)
const formatDate = (value) => { if (!value) return 'Not scheduled'; const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? 'Not scheduled' : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) }
const formatStatus = (value) => { const normalized = String(value || '').trim(); return normalized ? normalized.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Pending' }
const formatTime = (value) => value ? new Date(`1970-01-01T${value}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Not specified'
const isPaymentVerified = (status) => ['paid', 'verified', 'payment_verified'].includes(String(status || '').toLowerCase())

function getItemSummary(items = []) { const first = items[0]; return items.length > 1 ? `${first?.product_name || 'Order'} + ${items.length - 1} more` : first?.product_name || 'Custom order' }
function isCustomOrder(order) { return (order?.order_items || []).some((item) => item.customization_data?.request_type) }
function removePurchasedCartItems(order) { (order?.order_items || []).forEach((item) => removeCartQuantity(item.product_name, item.quantity)) }
function getCustomizationFields(value) {
  if (!value || typeof value !== 'object') return []
  const hidden = new Set(['request_type', 'reference_images', 'is_custom'])
  return Object.entries(value).filter(([key, entry]) => !hidden.has(key) && entry !== null && entry !== '' && !(Array.isArray(entry) && entry.length === 0)).map(([key, entry]) => ({ label: key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), value: Array.isArray(entry) ? entry.filter(Boolean).join(', ') : String(entry) }))
}

function StatusProgress({ order }) {
  const stage = getOrderProgressStage({ orderStatus: order.order_status, paymentStatus: order.payment_status })
  const isTerminal = ['cancelled', 'rejected'].includes(String(order.order_status || '').toLowerCase())
  return <div className="my-orders-progress" aria-label={`Order status: ${formatStatus(order.order_status)}`}>
    {isTerminal ? <div className="my-orders-terminal-status">{formatStatus(order.order_status)}</div> : ORDER_PROGRESS_STAGES.map((label, index) => <div className={`my-orders-progress-step ${index <= stage ? 'is-complete' : ''} ${index === stage ? 'is-current' : ''}`} key={label}><span>{index < stage ? '✓' : index + 1}</span><strong>{label}</strong></div>)}
  </div>
}

function PaymentPanel({ order, downPayment }) {
  const [isCreatingPayment, setIsCreatingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const pendingReview = String(order.order_status || '').toLowerCase() === 'pending'
  const verified = isPaymentVerified(order.payment_status)
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
  return <section className="my-orders-detail-card my-orders-payment-card"><h3>Payment</h3>{pendingReview ? <><strong>Quotation / Price Review Pending</strong><p>No payment is required until Sweet Bakes reviews your request.</p></> : verified ? <><strong>Down Payment Verified</strong><dl><div><dt>Amount Paid</dt><dd>{formatCurrency(downPayment)}</dd></div><div><dt>Payment Status</dt><dd>{formatStatus(order.payment_status)}</dd></div></dl></> : <><strong>Required Down Payment</strong><div className="my-orders-amount-due">{formatCurrency(downPayment)}</div><span className="my-orders-payment-note">Payment Status: {formatStatus(order.payment_status || 'pending')}</span>{eligible ? <button type="button" className="my-orders-pay-button" onClick={handlePayDownPayment} disabled={isCreatingPayment}>{isCreatingPayment ? 'Creating Payment...' : 'Pay Down Payment'}</button> : null}{paymentError ? <p className="my-orders-payment-error" role="alert">{paymentError}</p> : null}</>}</section>
}

function RegularPaymentPanel({ order }) {
  const [isCreatingPayment, setIsCreatingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const verified = isPaymentVerified(order.payment_status)
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

  return <section className="my-orders-detail-card my-orders-payment-card"><h3>Payment</h3>{verified ? <><strong>Payment Verified</strong><dl><div><dt>Amount Paid</dt><dd>{formatCurrency(order.total)}</dd></div><div><dt>Payment Status</dt><dd>{formatStatus(order.payment_status)}</dd></div></dl></> : <><strong>Payment Pending</strong><div className="my-orders-amount-due">{formatCurrency(order.total)}</div><span className="my-orders-payment-note">Payment Status: {formatStatus(order.payment_status || 'unpaid')}</span>{eligible ? <button type="button" className="my-orders-pay-button" onClick={handlePayNow} disabled={isCreatingPayment}>{isCreatingPayment ? 'Creating Payment...' : 'Pay Now'}</button> : null}{paymentError ? <p className="my-orders-payment-error" role="alert">{paymentError}</p> : null}</>}</section>
}

function PaymentReturnNotice({ order, paymentReturn }) {
  if (!paymentReturn || paymentReturn.orderId !== order.id) return null
  const amount = formatCurrency(isCustomOrder(order) ? order.required_down_payment : order.total)
  if (paymentReturn.status === 'verified') {
    return <section className="my-orders-payment-return my-orders-payment-return--success" role="status"><span className="my-orders-payment-return-icon" aria-hidden="true">✓</span><div><strong>Payment Successful</strong><p>Payment Verified</p><span>Thank you! We received your {amount} down payment.</span><small>Order {order.order_number || 'Order'}</small></div></section>
  }
  if (paymentReturn.status === 'timeout') {
    return <section className="my-orders-payment-return" role="status"><strong>Payment received. We're confirming your payment...</strong><p>Your payment is being verified. You can safely check My Orders again shortly.</p></section>
  }
  if (paymentReturn.status === 'cancelled') {
    return <section className="my-orders-payment-return" role="status"><strong>Payment was not completed</strong><p>Your payment status remains pending. You can try again when you are ready.</p></section>
  }
  return <section className="my-orders-payment-return" role="status"><strong>Payment received. We're confirming your payment...</strong><p>We’re waiting for payment verification from Xendit.</p></section>
}

function OrderDetails({ order, onClose, onImageOpen, breakdownError, paymentReturn }) {
  const items = order.order_items || []
  const priceItems = order.price_items || []
  const finalPrice = priceItems.length ? priceItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) : Number(order.total) || 0
  const downPayment = Number(order.required_down_payment) || finalPrice * 0.5
  const customizationFields = items.flatMap((item) => getCustomizationFields(item.customization_data).map((field) => ({ ...field, item: item.product_name })))
  const referenceImages = items.flatMap((item) => (Array.isArray(item.customization_data?.reference_images) ? item.customization_data.reference_images : [])).filter((image) => image.signed_url || image.url)
  const isDelivery = String(order.order_method || '').toLowerCase() === 'delivery'
  const address = [order.address, [order.barangay, order.city_municipality].filter(Boolean).join(', '), [order.province, order.postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return <div className="my-orders-detail-backdrop" role="presentation" onMouseDown={onClose}><article className="my-orders-detail" role="dialog" aria-modal="true" aria-labelledby="my-orders-detail-title" onMouseDown={(event) => event.stopPropagation()}>
    <header className="my-orders-detail-header"><div><p>Order Details</p><h2 id="my-orders-detail-title">{order.order_number || 'Order'}</h2><span>{getItemSummary(items)}</span></div><button type="button" onClick={onClose} aria-label="Close order details">×</button></header>
    <div className="my-orders-detail-scroll"><section className="my-orders-detail-card my-orders-detail-overview"><div><dt>Product</dt><dd>{getItemSummary(items)}</dd></div><div><dt>Preferred Date</dt><dd>{formatDate(order.preferred_date)}</dd></div><div><dt>Method</dt><dd>{formatStatus(order.order_method)}</dd></div><div><dt>Current Status</dt><dd>{formatStatus(order.order_status)}</dd></div></section>
      <section className="my-orders-detail-card"><h3>Order Status</h3><StatusProgress order={order} /></section>
      <section className="my-orders-detail-card"><h3>Order Details / Customization</h3>{customizationFields.length ? <dl className="my-orders-customization-list">{customizationFields.map((field, index) => <div key={`${field.label}-${index}`}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl> : <p className="my-orders-muted">No additional customization details.</p>}</section>
      {referenceImages.length ? <section className="my-orders-detail-card"><h3>Reference Images</h3><div className="my-orders-reference-images">{referenceImages.map((image, index) => <button type="button" key={image.path || image.signed_url || index} onClick={() => onImageOpen(image.signed_url || image.url)}><img src={image.signed_url || image.url} alt={image.name || 'Order reference'} /></button>)}</div></section> : null}
      <section className="my-orders-detail-card"><h3>Price Breakdown</h3>{breakdownError ? <p className="my-orders-muted my-orders-breakdown-error">Unable to load the itemized pricing for this order.</p> : priceItems.length ? <dl className="my-orders-price-list">{priceItems.map((item) => <div key={item.id}><dt>{item.description}</dt><dd>{formatCurrency(item.amount)}</dd></div>)}<div className="is-total"><dt>Final Price</dt><dd>{formatCurrency(finalPrice)}</dd></div><div><dt>Required Down Payment (50%)</dt><dd>{formatCurrency(downPayment)}</dd></div></dl> : <div className="my-orders-price-list"><div className="is-total"><dt>Final Price</dt><dd>{formatCurrency(finalPrice)}</dd></div>{String(order.order_status || '').toLowerCase() === 'pending' ? <p className="my-orders-muted">Itemized pricing will appear after your request is reviewed.</p> : <p className="my-orders-muted">No itemized pricing has been recorded for this order.</p>}</div>}</section>
      <PaymentReturnNotice order={order} paymentReturn={paymentReturn} />
      {isCustomOrder(order) ? <PaymentPanel order={order} downPayment={downPayment} /> : <RegularPaymentPanel order={order} />}
      <section className="my-orders-detail-card"><h3>Fulfillment Details</h3><dl className="my-orders-customization-list"><div><dt>Preferred Date</dt><dd>{formatDate(order.preferred_date)}</dd></div><div><dt>Preferred Time</dt><dd>{formatTime(order.preferred_time)}</dd></div>{isDelivery ? <><div><dt>Delivery Address</dt><dd>{address || 'Not provided'}</dd></div>{order.different_recipient ? <div><dt>Recipient</dt><dd>{order.recipient_name || 'Not provided'}{order.recipient_contact ? ` · ${order.recipient_contact}` : ''}</dd></div> : null}</> : <div><dt>Pickup</dt><dd>Sweet Bakes store pickup</dd></div>}</dl></section>
    </div>
  </article></div>
}

function MyOrdersPage({ onNavigate, onCustomerLogout, isCustomerAuthenticated = false }) {
  const [orders, setOrders] = useState([]); const [selectedOrder, setSelectedOrder] = useState(null); const [breakdownError, setBreakdownError] = useState(''); const [previewImage, setPreviewImage] = useState(''); const [isLoading, setIsLoading] = useState(true); const [error, setError] = useState(''); const [paymentReturn, setPaymentReturn] = useState(() => { const params = new URLSearchParams(window.location.search); const payment = params.get('payment'); const orderId = params.get('order'); if (!orderId || !['success', 'cancelled'].includes(payment)) return null; window.history.replaceState(window.history.state, '', '/my-orders'); return { orderId, status: payment === 'success' ? 'checking' : 'cancelled' } })
  const handleSelectOrder = (order) => { setBreakdownError(''); setSelectedOrder({ ...order, price_items: [] }) }
  useEffect(() => { let isMounted = true; async function loadOrders() { try { setIsLoading(true); setError(''); const { data: sessionData, error: sessionError } = await supabase.auth.getSession(); const user = sessionData?.session?.user || null; if (sessionError || !user) { onNavigate?.('/login?redirect=/my-orders', { replace: true }); return }; const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(); if (profileError) throw profileError; if (profile?.role === 'admin') { onNavigate?.(ADMIN_DASHBOARD_ROUTE, { replace: true }); return }; if (profile?.role !== 'customer') { await supabase.auth.signOut(); onNavigate?.('/login', { replace: true }); return }
      const { data: orderRows, error: ordersError } = await supabase.from('orders').select(ORDER_SELECT).eq('customer_id', user.id).order('created_at', { ascending: false }); if (ordersError) throw ordersError; const orderIds = (orderRows || []).map((order) => order.id).filter(Boolean); let items = []
      if (orderIds.length) { const itemsResult = await supabase.from('order_items').select(ORDER_ITEM_SELECT).in('order_id', orderIds); if (itemsResult.error) throw itemsResult.error; items = itemsResult.data || [] }
      const itemsByOrderId = items.reduce((groups, item) => { (groups[item.order_id] ||= []).push(item); return groups }, {})
      const paths = items.flatMap((item) => item.customization_data?.reference_images || []).map((image) => image?.path).filter(Boolean); const signed = paths.length ? await supabase.storage.from(REFERENCE_BUCKET).createSignedUrls([...new Set(paths)], 60 * 60) : { data: [], error: null }; if (signed.error) console.warn('[MY ORDERS] reference image URLs:', signed.error)
      const urls = (signed.data || []).reduce((map, entry) => { if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl; return map }, {})
      const nextOrders = (orderRows || []).map((order) => ({ ...order, order_items: (itemsByOrderId[order.id] || []).map((item) => ({ ...item, customization_data: item.customization_data ? { ...item.customization_data, reference_images: (item.customization_data.reference_images || []).map((image) => ({ ...image, signed_url: image.path ? urls[image.path] || '' : '' })) } : item.customization_data })) }))
      if (isMounted) setOrders(nextOrders)
    } catch (loadError) { console.error('[MY ORDERS] load error:', loadError); if (isMounted) setError('Unable to load your orders. Please try again.') } finally { if (isMounted) setIsLoading(false) } } loadOrders(); return () => { isMounted = false } }, [onNavigate])
  useEffect(() => {
    if (!paymentReturn?.orderId || !orders.length) return undefined
    const returnedOrder = orders.find((order) => order.id === paymentReturn.orderId)
    if (!returnedOrder || selectedOrder?.id === returnedOrder.id) return undefined
    const selectionTimer = window.setTimeout(() => handleSelectOrder(returnedOrder), 0)
    return () => window.clearTimeout(selectionTimer)
  }, [orders, paymentReturn?.orderId, selectedOrder?.id])
  useEffect(() => {
    if (!paymentReturn?.orderId || paymentReturn.status !== 'checking') return undefined
    let isMounted = true
    const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))
    async function refreshPaymentStatus() {
      for (let attempt = 0; attempt < 8 && isMounted; attempt += 1) {
        if (attempt > 0) await wait(1500)
        const { data: sessionData } = await supabase.auth.getSession()
        const userId = sessionData?.session?.user?.id
        if (!userId) break
        const { data: freshOrder, error: refreshError } = await supabase.from('orders').select(ORDER_SELECT).eq('id', paymentReturn.orderId).eq('customer_id', userId).maybeSingle()
        if (refreshError) { console.error('[MY ORDERS PAYMENT REFRESH]', refreshError); continue }
        if (!freshOrder) break
        setOrders((current) => current.map((order) => order.id === freshOrder.id ? { ...order, ...freshOrder } : order))
        setSelectedOrder((current) => current?.id === freshOrder.id ? { ...current, ...freshOrder } : current)
        if (isPaymentVerified(freshOrder.payment_status)) {
          removePurchasedCartItems({ ...freshOrder, order_items: orders.find((order) => order.id === freshOrder.id)?.order_items || [] })
          setPaymentReturn((current) => current ? { ...current, status: 'verified' } : current)
          return
        }
      }
      if (isMounted) setPaymentReturn((current) => current ? { ...current, status: 'timeout' } : current)
    }
    refreshPaymentStatus()
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
        setBreakdownError(breakdownErrorResponse.message || 'Unable to load price breakdown.')
        return
      }
      setSelectedOrder((current) => current?.id === selectedOrder.id ? { ...current, price_items: breakdownItems || [] } : current)
    })
    return () => { isMounted = false }
  }, [selectedOrder?.id])
  return <div className="my-orders-page"><SiteTopbar forceScrolled homeHref="/" locationHref="/#location" contactHref="/#contact" onNavigate={onNavigate} onCustomerLogout={onCustomerLogout} isCustomerAuthenticated={isCustomerAuthenticated} /><main className="my-orders-content"><section className="my-orders-shell" aria-labelledby="my-orders-title"><div className="my-orders-heading"><p className="my-orders-eyebrow">Sweet Bakes Account</p><h1 id="my-orders-title">My Orders</h1></div>{isLoading ? <div className="my-orders-card my-orders-state">Loading orders...</div> : error ? <div className="my-orders-card my-orders-state my-orders-state--error">{error}</div> : orders.length === 0 ? <div className="my-orders-card my-orders-empty"><h2>No orders yet</h2><p>Your Sweet Bakes orders will appear here once you submit a request.</p></div> : <div className="my-orders-list">{orders.map((order) => <button type="button" className="my-orders-card my-orders-item" key={order.id} onClick={() => handleSelectOrder(order)}><span className="my-orders-item-header"><span><span className="my-orders-number">{order.order_number || 'Order'}</span><strong>{getItemSummary(order.order_items)}</strong></span><span className="my-orders-status">{formatStatus(order.order_status)}</span></span><dl className="my-orders-details"><div><dt>Order Date</dt><dd>{formatDate(order.created_at)}</dd></div><div><dt>Preferred Date</dt><dd>{formatDate(order.preferred_date)}</dd></div><div><dt>Method</dt><dd>{formatStatus(order.order_method)}</dd></div><div><dt>Total</dt><dd>{formatCurrency(order.total)}</dd></div></dl><span className="my-orders-view-details">View Details <span aria-hidden="true">→</span></span></button>)}</div>}</section></main><SiteFooter />{selectedOrder ? <OrderDetails order={selectedOrder} paymentReturn={paymentReturn} breakdownError={breakdownError} onClose={() => setSelectedOrder(null)} onImageOpen={setPreviewImage} /> : null}{previewImage ? <div className="my-orders-image-backdrop" role="presentation" onClick={() => setPreviewImage('')}><img src={previewImage} alt="Larger order reference" /></div> : null}</div>
}
export default MyOrdersPage

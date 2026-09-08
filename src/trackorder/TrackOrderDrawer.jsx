import { useLayoutEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { getOrderProgressStage, getOrderProgressStages, getOrderProgressLabel, isRegularProgressOrder } from '../services/orderStatusDisplay.js'
import { itemFallback, itemImage } from '../myorders/orderHistoryImages.js'
import '../myorders/MyOrdersPage.css'
import './TrackOrderPage.css'
import './TrackOrderDrawer.css'

const NOT_FOUND = "We couldn't find an order matching that Order ID and email."
const currency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0)
const dateLabel = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not scheduled'
const timeLabel = (value) => value ? new Date(`1970-01-01T${value}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Not specified'

function Thumbnail({ item }) {
  const [failed, setFailed] = useState(false)
  // The secure lookup omits product IDs. Reuse static catalog fallbacks without extra queries.
  const source = itemImage(item) || itemFallback({ ...item, product_slug: String(item.product_name || '').trim().toLowerCase().replace(/\s+/g, '-') })
  return <div className="my-orders-thumbnail">{!failed && source ? <img src={source} alt="" onError={() => setFailed(true)} /> : <span aria-hidden="true">SB</span>}</div>
}

function Result({ order, onReset }) {
  const stage = getOrderProgressStage({ orderStatus: order.order_status, paymentStatus: order.payment_status, isRegularOrder: isRegularProgressOrder(order) })
  const delivery = order.order_method === 'delivery'
  return <>
    <button type="button" className="track-order-secondary-button track-drawer-back" onClick={onReset}>&larr; Track Another Order</button>
    <section className="my-orders-detail-card"><h3>Order Status</h3>
      <div className="my-orders-progress" aria-label={`Order status: ${getOrderProgressLabel(order)}`}>
        {stage === null ? <div className="my-orders-terminal-status">{getOrderProgressLabel(order)}</div> : getOrderProgressStages(order).map((label, index) => <div key={label} className={`my-orders-progress-step ${index <= stage ? 'is-complete' : ''} ${index === stage ? 'is-current' : ''}`}><span>{index < stage ? '\u2713' : index + 1}</span><strong>{label}</strong></div>)}
      </div>
    </section>
    <section className="my-orders-detail-card"><h3>Order Information</h3><div className="my-orders-detail-products">
      {(order.order_items || []).map((item, index) => <div className="my-orders-detail-product" key={`${item.product_name}-${index}`}>
        <Thumbnail item={item} />
        <div className="my-orders-detail-product-info"><h4>{item.product_name || 'Sweet treat'}</h4>{item.variant_name ? <p>{item.variant_name}</p> : null}<p><strong>Qty:</strong> {item.quantity}</p><p>{delivery ? 'Delivery' : 'Store Pickup'}</p></div>
        <strong className="my-orders-detail-price">{currency(item.subtotal ?? Number(item.unit_price) * Number(item.quantity))}</strong>
      </div>)}
    </div><div className="my-orders-detail-total"><span>Order Total</span><strong className="my-orders-detail-price">{currency(order.total)}</strong></div>
      <p className="track-drawer-payment">Payment: {String(order.payment_status || 'pending').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}</p>
    </section>
    <section className="my-orders-detail-card"><h3>Fulfillment Details</h3><dl className="my-orders-detail-fulfillment">
      <div><dt>Preferred Date</dt><dd>{dateLabel(order.preferred_date)}</dd></div><div><dt>Preferred Time</dt><dd>{timeLabel(order.preferred_time)}</dd></div>
      <div className="my-orders-detail-wide"><dt>Order Method</dt><dd>{delivery ? 'Delivery' : 'Store Pickup'}</dd></div>
      {!delivery ? <div className="my-orders-detail-wide"><dt>Pickup Location</dt><dd>Sweet Bakes store pickup</dd></div> : null}
    </dl></section>
  </>
}

export default function TrackOrderDrawer({ initialValues, onClose }) {
  const dialogRef = useRef(null)
  const busy = useRef(false)
  const alive = useRef(true)
  const [orderNumber, setOrderNumber] = useState(initialValues.orderNumber || '')
  const [email, setEmail] = useState(initialValues.email || '')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useLayoutEffect(() => {
    alive.current = true
    const dialog = dialogRef.current
    const root = document.documentElement
    const body = document.body
    const { scrollX, scrollY } = window
    const gap = window.innerWidth - root.clientWidth
    const previous = []
    const set = (element, property, value) => {
      previous.push([element, property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)])
      element.style.setProperty(property, value)
    }
    // Reserve the root scrollbar's existing space for both normal-flow content
    // and viewport-fixed elements (including the navbar). Body padding alone
    // cannot compensate fixed elements when the layout viewport expands.
    if (gap > 0 && getComputedStyle(root).scrollbarGutter === 'auto') {
      set(root, 'scrollbar-gutter', 'stable')
    }
    set(root, 'overflow', 'hidden'); set(body, 'overflow', 'hidden')
    set(body, 'position', 'fixed'); set(body, 'top', `-${scrollY}px`); set(body, 'left', `-${scrollX}px`)
    set(body, 'width', '100%'); set(body, 'box-sizing', 'border-box')
    dialog.showModal()
    dialog.querySelector('input')?.focus()
    return () => {
      alive.current = false
      dialog.close()
      previous.reverse().forEach(([element, property, value, priority]) => {
        if (value) element.style.setProperty(property, value, priority)
        else element.style.removeProperty(property)
      })
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' })
    }
  }, [])
  const submit = async (event) => {
    event.preventDefault()
    if (busy.current) return
    setError('')
    if (!orderNumber.trim() || !email.trim()) { setError(NOT_FOUND); return }
    busy.current = true; setLoading(true)
    try {
      const { data, error: lookupError } = await supabase.rpc('track_guest_order', { p_order_number: orderNumber.trim().toUpperCase(), p_email: email.trim().toLowerCase() })
      if (!alive.current) return
      if (lookupError || !data) setError(NOT_FOUND)
      else setResult(data)
    } catch {
      if (alive.current) setError(NOT_FOUND)
    } finally {
      busy.current = false
      if (alive.current) setLoading(false)
    }
  }
  return <dialog ref={dialogRef} className="track-drawer-root" aria-labelledby="track-drawer-title" onCancel={onClose}>
    <div className="my-orders-detail-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <article className={`my-orders-detail track-drawer-panel${result ? '' : ' track-drawer-panel--form'}`}>
        <header className="my-orders-detail-header"><div><h2 id="track-drawer-title">{result ? 'Track Order' : 'Track Your Order'}</h2>{result ? <span>Order ID: {result.order_number}</span> : null}</div><button type="button" onClick={onClose} aria-label="Close order tracking">&times;</button></header>
        <div className="my-orders-detail-scroll">
          {result ? <Result order={result} onReset={() => { setResult(null); setError(''); setOrderNumber(''); setEmail('') }} /> : <section className="track-order-form-panel track-drawer-form">
            <h3 className="track-drawer-form-title">Find Your Order</h3>
            <p className="track-order-intro">Enter your order ID and email address to track your order</p>
            <form onSubmit={submit} noValidate>
              <div className="track-drawer-field"><label htmlFor="drawer-order-id">Order ID</label><input id="drawer-order-id" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder="SB-20260908-0042" autoComplete="off" disabled={loading} /></div>
              <div className="track-drawer-field"><label htmlFor="drawer-order-email">Email Address</label><input id="drawer-order-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="john.doe@example.com" autoComplete="email" disabled={loading} /></div>
              {error ? <p className="track-order-error" role="alert">{error}</p> : null}<button className="track-order-primary-button" disabled={loading}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>{loading ? 'Tracking...' : 'Track Order'}</button>
            </form></section>}
        </div>
      </article>
    </div>
  </dialog>
}

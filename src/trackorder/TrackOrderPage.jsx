import { useState } from 'react'
import { SiteFooter, SiteTopbar } from '../landingpage/LandingPage.jsx'
import { supabase } from '../lib/supabase.js'
import { getOrderProgressStage, ORDER_PROGRESS_STAGES } from '../services/orderStatusDisplay.js'
import './TrackOrderPage.css'

const NOT_FOUND_MESSAGE = "We couldn't find an order matching those details."

const formatStatus = (value) => {
  const normalized = String(value || '').trim()
  return normalized ? normalized.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Pending'
}

const formatCurrency = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
}).format(Number(value) || 0)

const formatDate = (value) => {
  if (!value) return 'Not scheduled'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? 'Not scheduled' : date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const formatTime = (value) => {
  if (!value) return 'Not specified'
  const date = new Date(`1970-01-01T${value}`)
  return Number.isNaN(date.getTime()) ? 'Not specified' : date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

const isTerminal = (status) => ['cancelled', 'rejected'].includes(String(status || '').toLowerCase())

function StatusProgress({ order }) {
  const stage = getOrderProgressStage({ orderStatus: order.order_status, paymentStatus: order.payment_status })
  if (isTerminal(order.order_status)) {
    return <div className="track-order-terminal">{formatStatus(order.order_status)}</div>
  }

  return (
    <div className="track-order-progress" aria-label={`Order progress: ${formatStatus(order.order_status)}`}>
      {ORDER_PROGRESS_STAGES.map((label, index) => (
        <div className={`track-order-progress-step ${index <= stage ? 'is-complete' : ''} ${index === stage ? 'is-current' : ''}`} key={label}>
          <span>{index < stage ? '✓' : index + 1}</span>
          <strong>{label}</strong>
        </div>
      ))}
    </div>
  )
}

function TrackingResult({ order, onReset }) {
  return (
    <section className="track-order-result" aria-live="polite">
      <div className="track-order-result-heading">
        <div>
          <p className="track-order-eyebrow">Order tracking</p>
          <h1>Order #{order.order_number}</h1>
        </div>
        <button className="track-order-secondary-button" type="button" onClick={onReset}>Track another order</button>
      </div>
      <div className="track-order-status-row">
        <div><span>Status</span><strong>{formatStatus(order.order_status)}</strong></div>
        <div><span>Payment</span><strong>{formatStatus(order.payment_status)}</strong></div>
      </div>
      <StatusProgress order={order} />
      <div className="track-order-items">
        <h2>Items</h2>
        {order.order_items.map((item, index) => (
          <div className="track-order-item" key={`${item.product_name}-${index}`}>
            <div>
              <strong>{item.product_name || 'Sweet treat'}</strong>
              {item.variant_name ? <span>{item.variant_name}</span> : null}
              <span>Qty: {item.quantity}</span>
            </div>
            <strong>{formatCurrency(item.subtotal ?? Number(item.unit_price || 0) * Number(item.quantity || 0))}</strong>
          </div>
        ))}
      </div>
      <dl className="track-order-details">
        <div><dt>Order Method</dt><dd>{formatStatus(order.order_method)}</dd></div>
        <div><dt>Preferred Date</dt><dd>{formatDate(order.preferred_date)}</dd></div>
        <div><dt>Preferred Time</dt><dd>{formatTime(order.preferred_time)}</dd></div>
        <div><dt>Order Total</dt><dd>{formatCurrency(order.total)}</dd></div>
      </dl>
    </section>
  )
}

function TrackOrderPage({ onNavigate, onCustomerLogout, isCustomerAuthenticated = false }) {
  const [orderNumber, setOrderNumber] = useState(() => window.history.state?.orderNumber || '')
  const [email, setEmail] = useState('')
  const [result, setResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const normalizedOrderNumber = orderNumber.trim().toUpperCase()
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedOrderNumber || !normalizedEmail) {
      setErrorMessage(NOT_FOUND_MESSAGE)
      return
    }

    setIsLoading(true)
    setErrorMessage('')
    setResult(null)
    try {
      const { data, error } = await supabase.rpc('track_guest_order', {
        p_order_number: normalizedOrderNumber,
        p_email: normalizedEmail,
      })
      if (error || !data) {
        setErrorMessage(NOT_FOUND_MESSAGE)
        return
      }
      setResult(data)
    } catch {
      setErrorMessage(NOT_FOUND_MESSAGE)
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => {
    setResult(null)
    setErrorMessage('')
  }

  return (
    <div className="track-order-page">
      <SiteTopbar forceScrolled onNavigate={onNavigate} isCustomerAuthenticated={isCustomerAuthenticated} onCustomerLogout={onCustomerLogout} />
      <main className="track-order-content">
        {result ? <TrackingResult order={result} onReset={reset} /> : (
          <section className="track-order-form-panel">
            <p className="track-order-eyebrow">Sweet Bakes</p>
            <h1>Track your order</h1>
            <p className="track-order-intro">Enter the Order ID and email address used at checkout.</p>
            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="track-order-number">Order ID</label>
              <input id="track-order-number" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder="SB-20260908-0026" autoComplete="off" />
              <label htmlFor="track-order-email">Email Address</label>
              <input id="track-order-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" />
              {errorMessage ? <p className="track-order-error" role="alert">{errorMessage}</p> : null}
              <button className="track-order-primary-button" type="submit" disabled={isLoading}>{isLoading ? 'Checking...' : 'Track Order'}</button>
            </form>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}

export default TrackOrderPage

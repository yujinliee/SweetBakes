import { useLayoutEffect, useRef } from 'react'
import { itemImage, itemFallback } from '../myorders/orderHistoryImages.js'
import { formatDisplayTime } from './timeUtils.js'
import './PaymentSuccessModal.css'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value))
export default function PaymentSuccessModal({ order, guest = false, onClose, onPrimary, onContinue }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  const delivery = order.order_method === 'delivery'
  const address = [order.apartment_unit, order.address, order.barangay, order.city_municipality, order.province, order.postal_code].filter(Boolean).join(', ')
  return <dialog ref={ref} className="payment-success-modal" aria-labelledby="payment-success-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <button type="button" className="payment-success-close" aria-label="Close confirmation" onClick={onClose}>×</button>
    <span className="payment-success-check" aria-hidden="true">✓</span>
    <h2 id="payment-success-title">Payment Successful</h2>
    <p>{guest ? 'Your payment has been confirmed.' : 'Your payment has been confirmed. You can follow the order status in My Orders.'}</p>
    <div className="payment-success-reference"><span>Order ID</span><strong>{order.order_number || order.id}</strong></div>
    {guest ? <p className="payment-success-note">Save your Order ID. You&apos;ll need it together with your email address to track your order.</p> : null}
    <h3>Order Items</h3>
    <ul className="payment-success-items">{order.order_items.map((item, index) => <li key={item.id || index}>
      <img alt="" src={itemImage(item) || itemFallback({ ...item, product_slug: item.product_slug || String(item.product_name || '').toLowerCase().replace(/\s+/g, '-') })} onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} />
      <div><strong>{item.product_name}</strong>{item.variant_name ? <span>{item.variant_name}</span> : null}<span>Qty: {item.quantity} · {money(item.unit_price)} each</span></div>
      <strong>{money(item.subtotal ?? Number(item.unit_price) * Number(item.quantity))}</strong>
    </li>)}</ul>
    <h3>Order Details</h3>
    <dl><div><dt>Payment Status</dt><dd>Paid</dd></div><div><dt>Order Method</dt><dd>{delivery ? 'Delivery' : 'Store Pickup'}</dd></div>
      <div><dt>Preferred Date</dt><dd>{order.preferred_date ? new Date(`${order.preferred_date}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not specified'}</dd></div>
      <div><dt>Preferred Time</dt><dd>{formatDisplayTime(order.preferred_time, 'Not specified')}</dd></div>
      <div className="payment-success-wide"><dt>{delivery ? 'Delivery Information' : 'Pickup Information'}</dt><dd>{delivery ? address || 'Delivery to the address provided at checkout.' : 'Sweet Bakes store pickup'}</dd></div>
      {delivery && order.landmark ? <div><dt>Landmark</dt><dd>{order.landmark}</dd></div> : null}
    </dl>
    <div className="payment-success-total"><span>Total</span><strong>{money(order.total)}</strong></div>
    <div className="payment-success-actions"><button type="button" onClick={onPrimary}>{guest ? 'Track Order' : 'View My Orders'}</button><button type="button" onClick={onContinue}>Continue Shopping</button></div>
  </dialog>
}

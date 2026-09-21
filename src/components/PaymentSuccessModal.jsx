import { useLayoutEffect, useRef } from 'react'
import './PaymentSuccessModal.css'

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
  return <dialog ref={ref} className="payment-success-modal" aria-labelledby="payment-success-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <button type="button" className="payment-success-close" aria-label="Close confirmation" onClick={onClose}>×</button>
    <span className="payment-success-check" aria-hidden="true">✓</span>
    <h2 id="payment-success-title">Payment Successful</h2>
    <p>{guest ? 'Your payment has been confirmed.' : 'Your payment has been confirmed. You can follow the order status in My Orders.'}</p>
    <div className="payment-success-reference"><span>Order ID</span><strong>{order.order_number || order.id}</strong></div>
    {guest ? <p className="payment-success-note">Save your Order ID. You&apos;ll need it together with your email address to track your order.</p> : null}
    <div className="payment-success-actions"><button type="button" onClick={onPrimary}>{guest ? 'Track Order' : 'View My Orders'}</button><button type="button" onClick={onContinue}>Continue Shopping</button></div>
  </dialog>
}

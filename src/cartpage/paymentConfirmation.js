export const CART_PAYMENT_RETURN_STORAGE_KEY = 'sweetbakes:cart-payment-return-v1'
export const isVerifiedPayment = (status) => ['paid', 'verified', 'payment_verified'].includes(String(status || '').toLowerCase())

// Keep these diagnostics development-only and restricted to non-sensitive fields.
export function logPaymentReturn(event, { attempt, phase, outcome, contextFound, hasGuestEmail, isCustomerAuthenticated, httpStatus, paymentStatus, errorCode } = {}) {
  if (!import.meta.env?.DEV) return
  const knownStatuses = ['paid', 'verified', 'payment_verified', 'unpaid', 'pending', 'failed', 'cancelled', 'refunded']
  console.info(`[PAYMENT RETURN] ${event}`, {
    attempt, phase, outcome, contextFound, hasGuestEmail, isCustomerAuthenticated, httpStatus,
    errorCode: typeof errorCode === 'string' && /^[A-Z0-9_]{1,64}$/.test(errorCode) ? errorCode : undefined,
    paymentStatus: paymentStatus === undefined ? undefined : knownStatuses.includes(paymentStatus) ? paymentStatus : 'unrecognized',
  })
}

export function savePaymentReturnContext(storage, { orderId, guestEmail }) {
  const value = JSON.stringify({ orderId, ...(guestEmail ? { guestEmail } : {}) })
  storage.setItem(CART_PAYMENT_RETURN_STORAGE_KEY, value)
  if (storage.getItem(CART_PAYMENT_RETURN_STORAGE_KEY) !== value) {
    throw new Error('Unable to retain payment return context. Please try again.')
  }
  logPaymentReturn('context-saved', { contextFound: true, hasGuestEmail: Boolean(guestEmail) })
}

// Timeout is unresolved, not a consumed payment return. Keep context and URL so
// refreshing can safely verify the same order again without creating a payment.
export const shouldConsumePaymentReturn = (status) => ['verified', 'cancelled'].includes(status)

export async function loadGuestConfirmation(client, receipt, status) {
  if (status?.orderId !== receipt.orderId || !isVerifiedPayment(status.paymentStatus) || !status.orderNumber) {
    logPaymentReturn('details-error', { outcome: 'invalid-status-reference' })
    return null
  }
  const { data, error } = await client.rpc('track_guest_order', {
    p_order_number: status.orderNumber,
    p_email: receipt.guestEmail.trim().toLowerCase(),
  })
  const outcome = error ? 'lookup-error' : data?.order_number !== status.orderNumber ? 'order-mismatch'
    : !isVerifiedPayment(data?.payment_status) ? 'unverified-details'
      : !Array.isArray(data?.order_items) || !data.order_items.length ? 'missing-items' : 'confirmed'
  logPaymentReturn(outcome === 'confirmed' ? 'details-loaded' : 'details-error', { outcome, paymentStatus: data?.payment_status, errorCode: error?.code })
  if (outcome !== 'confirmed') return null
  return data
}

export async function loadConfirmedItems(client, orderId) {
  const { data, error } = await client.from('order_items')
    .select('id, order_id, product_id, product_name, product_type, variant_name, quantity, subtotal, unit_price, customization_data')
    .eq('order_id', orderId)
  if (error || !data?.length) throw new Error('Order details are not available yet.')
  return data
}

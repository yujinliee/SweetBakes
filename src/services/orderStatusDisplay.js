export const ORDER_PROGRESS_STAGES = [
  'Pending Review',
  'Payment Pending',
  'Payment Verified',
  'Preparing Cake',
  'Ready for Pickup / Delivery',
  'Completed',
]

export function getOrderProgressStage({ orderStatus, paymentStatus } = {}) {
  const status = String(orderStatus || '').toLowerCase()
  const payment = String(paymentStatus || '').toLowerCase()

  if (status === 'cancelled' || status === 'rejected') return null
  if (status === 'completed') return 5
  if (status === 'ready') return 4
  if (status === 'preparing') return 3
  if (status === 'confirmed' && ['paid', 'verified', 'payment_verified'].includes(payment)) return 2
  if (status === 'confirmed') return 1
  return 0
}

export function getOrderProgressLabel(order = {}) {
  const stage = getOrderProgressStage({
    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
  })

  if (stage === null) {
    return String(order.order_status || '').toLowerCase() === 'rejected' ? 'Rejected' : 'Cancelled'
  }

  return ORDER_PROGRESS_STAGES[stage]
}

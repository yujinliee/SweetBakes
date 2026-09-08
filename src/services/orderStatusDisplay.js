export const ORDER_PROGRESS_STAGES = [
  'Pending Review',
  'Payment Pending',
  'Payment Verified',
  'Preparing Cake',
  'Ready for Pickup / Delivery',
  'Completed',
]

export function getOrderProgressStage({ orderStatus, paymentStatus, isRegularOrder = false } = {}) {
  const status = String(orderStatus || '').toLowerCase()
  const payment = String(paymentStatus || '').toLowerCase()

  if (status === 'cancelled' || status === 'rejected') return null
  if (status === 'completed') return 5
  if (status === 'ready') return 4
  if (status === 'preparing') return 3
  // Payment verification does not imply bakery acceptance or preparation.
  if ((status === 'confirmed' || isRegularOrder) && ['paid', 'verified', 'payment_verified'].includes(payment)) return 2
  if (status === 'confirmed') return 1
  if (status === 'pending' && isRegularOrder && ['unpaid', 'pending', 'partial', 'failed'].includes(payment)) return 1
  return 0
}

export function isRegularProgressOrder(order = {}) {
  return !order.isCustomized && !(order.order_items || []).some((item) =>
    item.customization_data?.request_type || item.customization_data?.is_custom)
}

export function getOrderProgressStages(order = {}) {
  const stages = [...ORDER_PROGRESS_STAGES]
  if (isRegularProgressOrder(order)) stages[3] = 'Preparing Order'
  if (order.order_method === 'pickup') stages[4] = 'Ready for Pickup'
  if (order.order_method === 'delivery') stages[4] = 'Ready for Delivery'
  return stages
}

export function getOrderProgressLabel(order = {}) {
  const stage = getOrderProgressStage({
    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
    isRegularOrder: isRegularProgressOrder(order),
  })

  if (stage === null) {
    return String(order.order_status || '').toLowerCase() === 'rejected' ? 'Rejected' : 'Cancelled'
  }

  return getOrderProgressStages(order)[stage]
}

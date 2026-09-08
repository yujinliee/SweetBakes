import { getOrderProgressLabel } from '../services/orderStatusDisplay.js'

const normalize = (value) => String(value || '').trim().toLowerCase()
// Bind at render time so payment refreshes also use the latest parent number.
export function getHistoryItems(order) {
  return (order.order_items || []).map((item) => ({
    ...item,
    orderNumber: order.order_number ?? null,
  }))
}
export const ORDER_TABS = ['All', 'To Pay', 'To Process', 'To Ship', 'To Receive', 'To Review']
export const EMPTY_MESSAGES = {
  All: 'No orders yet. Your Sweet Bakes orders will appear here.',
  'To Pay': 'No orders requiring payment.',
  'To Process': 'No paid orders awaiting processing or being prepared.',
  'To Ship': 'No orders ready for delivery.',
  'To Receive': 'No orders ready for store pickup.',
  'To Review': 'No orders to review yet.',
}

export const isCustomHistoryOrder = (order) => (order.order_items || []).some((item) =>
  Boolean(item.customization_data?.request_type || item.customization_data?.is_custom))

export const isAwaitingPrice = (order) => isCustomHistoryOrder(order)
  && normalize(order.order_status) === 'pending' && Number(order.total) === 0

export function requiresPayment(order) {
  if (['cancelled', 'rejected', 'completed'].includes(normalize(order.order_status))) return false
  // A custom request is not payable until the bakery has quoted and confirmed it.
  if (isCustomHistoryOrder(order) && normalize(order.order_status) === 'pending') return false
  return Number(order.total) > 0 && ['unpaid', 'pending', 'partial', 'failed'].includes(normalize(order.payment_status))
}

export function matchesOrderTab(order, tab) {
  const status = normalize(order.order_status)
  if (tab === 'All') return true
  if (tab === 'To Pay') return requiresPayment(order)
  if (tab === 'To Process') {
    if (requiresPayment(order) || normalize(order.payment_status) === 'refunded') return false
    return ['confirmed', 'preparing'].includes(status)
      || (status === 'pending' && normalize(order.payment_status) === 'paid')
  }
  // The schema records readiness and method, but has no dispatched status.
  if (tab === 'To Ship') return status === 'ready' && normalize(order.order_method) === 'delivery'
  if (tab === 'To Receive') return status === 'ready' && normalize(order.order_method) === 'pickup'
  if (tab === 'To Review') return status === 'completed' && normalize(order.payment_status) === 'paid'
    && Boolean(order.customer_id) && !order.review
  return false
}

export function attachOrderReviews(orders, reviews) {
  const byOrder = new Map(reviews.map((review) => [review.order_id, review]))
  return orders.map((order) => ({ ...order, review: byOrder.get(order.id) || null }))
}

export function getOrderTabCounts(orders) {
  return Object.fromEntries(ORDER_TABS.map((tab) => [tab,
    orders.reduce((count, order) => count + Number(matchesOrderTab(order, tab)), 0),
  ]))
}

export function historyStatus(order) {
  if (!isCustomHistoryOrder(order)) return getOrderProgressLabel(order)
  const status = normalize(order.order_status)
  if (status === 'ready') return normalize(order.order_method) === 'delivery' ? 'Ready for Delivery' : 'Ready for Pickup'
  return (status || 'pending').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function referenceImages(item) {
  const data = item.customization_data || {}
  const images = [data.reference_images, data.package_customization?.packageReferenceImages]
    .flatMap((entries) => Array.isArray(entries) ? entries : [])
  return images.filter((image) => image && typeof image === 'object')
}

export function itemDescription(item) {
  const data = item.customization_data || {}
  const packageData = data.package_customization || {}
  const selection = data.package_selection || {}
  const scalar = (value) => ['string', 'number'].includes(typeof value) ? String(value).trim() : ''
  const flavor = scalar(data.flavor || packageData.packageCakeFlavor)
  const size = scalar(data.size || packageData.packageCakeSize)
  const layers = scalar(data.layers || packageData.packageCakeLayers)
  const parts = [scalar(item.variant_name), flavor, size, layers && `${layers} ${Number(layers) === 1 ? 'layer' : 'layers'}`,
    selection.cakeQuantity && `${scalar(selection.cakeQuantity)} cake(s)`,
    selection.cupcakeQuantity && `${scalar(selection.cupcakeQuantity)} cupcakes`]
  return [...new Set(parts.filter(Boolean))].join(' · ')
}

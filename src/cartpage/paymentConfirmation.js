export const CART_PAYMENT_RETURN_STORAGE_KEY = 'sweetbakes:cart-payment-return-v1'
export const isVerifiedPayment = (status) => ['paid', 'verified', 'payment_verified'].includes(String(status || '').toLowerCase())

export async function loadGuestConfirmation(client, receipt, status) {
  if (status?.orderId !== receipt.orderId || !isVerifiedPayment(status.paymentStatus) || !status.orderNumber) return null
  const { data, error } = await client.rpc('track_guest_order', {
    p_order_number: status.orderNumber,
    p_email: receipt.guestEmail.trim().toLowerCase(),
  })
  if (error || data?.order_number !== status.orderNumber || !isVerifiedPayment(data?.payment_status)
    || !Array.isArray(data?.order_items) || !data.order_items.length) return null
  return data
}

export async function loadConfirmedItems(client, orderId) {
  const { data, error } = await client.from('order_items')
    .select('id, order_id, product_id, product_name, product_type, variant_name, quantity, subtotal, unit_price, customization_data')
    .eq('order_id', orderId)
  if (error || !data?.length) throw new Error('Order details are not available yet.')
  return data
}

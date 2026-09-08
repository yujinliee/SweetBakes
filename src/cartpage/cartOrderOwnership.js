export async function getCheckoutSession(client) {
  const { data, error } = await client.auth.getSession()
  if (error) throw new Error('Unable to verify your checkout session. Please try again.')
  const session = data?.session || null
  if (!session) return null
  if (!session.user?.id || !session.access_token) {
    throw new Error('Unable to verify your checkout session. Please sign in again.')
  }
  const { data: verified, error: verificationError } = await client.auth.getUser(session.access_token)
  if (verificationError || verified?.user?.id !== session.user.id) {
    throw new Error('Unable to verify your checkout session. Please sign in again.')
  }
  return session
}

export function reusableCartOrder(pendingOrder, customerId) {
  return pendingOrder?.customerId === customerId ? pendingOrder.orderId : null
}

export async function getCartOrderReference(client, orderId, session, guestEmail) {
  if (session) {
    const { data: order, error } = await client.from('orders')
      .select('id, customer_id, order_number')
      .eq('id', orderId)
      .eq('customer_id', session.user.id)
      .maybeSingle()
    if (error || !order) throw new Error('Unable to verify your order. Please try again.')
    return {
      orderId: order.id,
      customerId: order.customer_id,
      orderNumber: order.order_number,
      isGuest: false,
    }
  }

  // The server verifies the guest email, NULL owner and recent order age.
  // Never substitute a guest lookup for a failed authenticated lookup.
  const { data, error } = await client.functions.invoke('create-cart-xendit-payment', {
    body: { orderId, statusOnly: true, guestEmail },
  })
  if (error || !guestEmail?.trim() || data?.orderId !== orderId || typeof data?.paymentStatus !== 'string') {
    throw new Error('Unable to verify your order. Please try again.')
  }
  return {
    orderId: data.orderId,
    // The deployed legacy response omits ownership metadata. A successful guest
    // lookup proves a NULL owner on the server; do not infer it from local storage.
    customerId: Object.hasOwn(data, 'customerId') ? data.customerId : null,
    orderNumber: data.orderNumber ?? null,
    isGuest: true,
  }
}

export function assertCartOrderReference(reference, orderId, customerId) {
  if (reference?.orderId !== orderId || reference?.customerId !== customerId) {
    throw new Error('Unable to verify order ownership. Please try again.')
  }
  if (customerId !== null && (typeof reference.orderNumber !== 'string' || !reference.orderNumber.trim())) {
    throw new Error('Your order is missing its order number. Please contact Sweet Bakes before retrying payment.')
  }
  return reference
}

// A guest API key is not a customer JWT. Do not inherit a restored account's
// Authorization header for an order created as a guest. The server still checks
// the order ID, checkout email, NULL ownership and age on every request.
export async function requestGuestPaymentStatus({ url, apiKey, receipt, fetchImpl = fetch }) {
  const response = await fetchImpl(`${url}/functions/v1/create-cart-xendit-payment`, {
    method: 'POST', credentials: 'omit',
    headers: { apikey: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: receipt.orderId, guestEmail: receipt.guestEmail, statusOnly: true }),
  })
  let data
  try { data = await response.json() } catch {
    throw Object.assign(new Error('Invalid verification response.'), { httpStatus: response.status, code: 'INVALID_JSON' })
  }
  if (!response.ok) throw Object.assign(new Error('Payment verification request failed.'), { httpStatus: response.status, code: data?.code })
  return { data, error: null }
}
import { createClient } from '@supabase/supabase-js'

export function createGuestOrderClient(url, apiKey) {
  return createClient(url, apiKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

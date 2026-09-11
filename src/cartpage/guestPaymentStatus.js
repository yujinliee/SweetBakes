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

// Guest order confirmation reads intentionally bypass the shared authenticated
// Supabase client: a guest order must never be fetched under a restored
// account's Authorization header, even after login. This is a bare REST call to
// the track_guest_order RPC using only the anonymous API key. It creates no
// GoTrue/Supabase client at all, so it cannot produce a second auth storage key
// or trigger the "Multiple GoTrueClient instances" warning. The server still
// enforces order-number + email match, NULL ownership and order age.
export function createGuestRpcClient(url, apiKey, { fetchImpl = fetch } = {}) {
  return {
    async rpc(name, body) {
      const response = await fetchImpl(`${url}/rest/v1/rpc/${name}`, {
        method: 'POST', credentials: 'omit',
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      let data = null
      let error = null
      try {
        const parsed = await response.json()
        if (response.ok) data = parsed
        else error = { ...parsed, status: response.status }
      } catch {
        error = { message: 'Guest order lookup failed.', code: null, status: response.status }
      }
      return { data, error }
    },
  }
}

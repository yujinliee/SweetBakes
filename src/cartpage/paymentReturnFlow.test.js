import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { setImmediate } from 'node:timers'
import { CART_PAYMENT_RETURN_STORAGE_KEY, loadGuestConfirmation, shouldConsumePaymentReturn } from './paymentConfirmation.js'

// Execute the actual return effects with a deterministic clock and mocked network.
// This verifies control flow; it does not substitute for a live Xendit/browser test.
const source = readFileSync(new URL('./CartPage.jsx', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
const start = source.indexOf("  useEffect(() => {\n    if (guestPaymentStatus !== 'success')")
const end = source.indexOf('  useEffect(() => {\n    if (!isCustomerAuthenticated)', start)
assert.ok(start >= 0 && end > start, 'Cart return effects must be present')
const effectsSource = source.slice(start, end)
const receipt = { orderId: 'order-1', guestEmail: 'guest@example.com' }
const order = { order_number: 'SB-1', payment_status: 'paid', total: 120, order_items: [{ product_name: 'Flan', quantity: 1, unit_price: 120, subtotal: 120 }] }

function harness({ statuses = ['paid'], payment = 'success', saved = receipt, details = order, storage = new Map() } = {}) {
  if (saved) storage.set(CART_PAYMENT_RETURN_STORAGE_KEY, JSON.stringify(saved))
  const timers = new Map(), logs = [], actions = []
  let nextTimer = 0, calls = 0, verified = false, timedOut = false, confirmedOrder
  const window = {
    localStorage: { getItem: (key) => storage.get(key) ?? null, removeItem: (key) => storage.delete(key) },
    location: { href: `https://example.com/cart?payment=${payment}` },
    history: { state: null, replaceState: (_state, _title, url) => { window.location.href = new URL(url, window.location.href).href } },
    setTimeout: (callback) => { timers.set(++nextTimer, callback); return nextTimer },
    clearTimeout: (id) => timers.delete(id),
  }
  const supabase = {
    functions: { invoke: async (name, { body }) => {
      assert.equal(name, 'create-cart-xendit-payment')
      assert.deepEqual(body, { ...receipt, statusOnly: true })
      const paymentStatus = statuses[Math.min(calls++, statuses.length - 1)]
      return { data: { orderId: receipt.orderId, orderNumber: 'SB-1', paymentStatus } }
    } },
    rpc: async () => ({ data: details }),
  }
  function effects() {
    const callbacks = []
    const scope = {
      window, URL, supabase, CART_PAYMENT_RETURN_STORAGE_KEY, loadGuestConfirmation, shouldConsumePaymentReturn,
      guestPaymentStatus: new URL(window.location.href).searchParams.get('payment'), isCustomerAuthenticated: false,
      guestPaymentVerified: verified, useEffect: (callback) => callbacks.push(callback),
      logPaymentReturn: (event) => logs.push(event), setGuestTrackingEmail() {},
      setGuestPaymentTimedOut: (value) => { timedOut = value },
      setGuestPaymentVerified: (value) => { verified = value; actions.push('modal') },
      setConfirmedOrder: (value) => { confirmedOrder = value; actions.push('details') },
      clearCart: () => actions.push('clear'),
    }
    new Function(...Object.keys(scope), effectsSource)(...Object.values(scope))
    return callbacks
  }
  return {
    storage, logs, actions, window,
    async run() {
      const cleanup = effects()[0]()
      await new Promise(setImmediate)
      for (let count = 0; timers.size && count < 20; count++) {
        const [id, callback] = timers.entries().next().value
        timers.delete(id); callback(); await new Promise(setImmediate)
      }
      assert.equal(timers.size, 0, 'polling must remain bounded')
      effects()[1]()
      cleanup?.()
      return { verified, timedOut, confirmedOrder, calls }
    },
  }
}

test('return detection starts verification; paid details precede cart clearing and modal state', async () => {
  const flow = harness()
  const result = await flow.run()
  assert.ok(flow.logs.includes('detected success URL'))
  assert.ok(flow.logs.includes('verification started'))
  assert.deepEqual(flow.actions, ['details', 'clear', 'modal'])
  assert.deepEqual(result.confirmedOrder, order)
  assert.equal(flow.storage.has(CART_PAYMENT_RETURN_STORAGE_KEY), false)
  assert.equal(new URL(flow.window.location.href).searchParams.has('payment'), false)
})

test('pending webhook retries within the existing bound and succeeds when paid', async () => {
  const flow = harness({ statuses: ['pending', 'pending', 'paid'] })
  assert.equal((await flow.run()).calls, 3)
  assert.deepEqual(flow.actions, ['details', 'clear', 'modal'])
})

test('timeout preserves context and URL; refreshed return can verify a subsequently paid order', async () => {
  const flow = harness({ statuses: ['pending'] })
  const result = await flow.run()
  assert.equal(result.calls, 8)
  assert.equal(result.timedOut, true)
  assert.deepEqual(flow.actions, [])
  assert.ok(flow.logs.includes('verification timeout'))
  assert.equal(flow.storage.has(CART_PAYMENT_RETURN_STORAGE_KEY), true)
  assert.equal(new URL(flow.window.location.href).searchParams.get('payment'), 'success')
  const retry = harness({ storage: flow.storage, saved: null })
  assert.equal((await retry.run()).verified, true)
})

test('cancelled or missing-context return never polls or clears the cart', async () => {
  for (const options of [{ payment: 'cancelled' }, { saved: null }]) {
    const flow = harness(options)
    assert.equal((await flow.run()).calls, 0)
    assert.deepEqual(flow.actions, [])
  }
})

test('paid status with unavailable canonical details does not clear cart or show modal', async () => {
  const flow = harness({ details: null })
  assert.equal((await flow.run()).timedOut, true)
  assert.deepEqual(flow.actions, [])
  assert.equal(flow.storage.has(CART_PAYMENT_RETURN_STORAGE_KEY), true)
})

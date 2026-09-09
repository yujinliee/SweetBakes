import test from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers'
import { startPaymentReturn } from './paymentReturnController.js'
import { CART_PAYMENT_RETURN_STORAGE_KEY, loadGuestConfirmation } from './paymentConfirmation.js'
import { requestGuestPaymentStatus } from './guestPaymentStatus.js'
import { readFileSync } from 'node:fs'

const receipt = { orderId: 'order-1', guestEmail: 'guest@example.com' }
const order = { order_number: 'SB-1', payment_status: 'paid', total: 120, order_items: [{ product_name: 'Flan', quantity: 1, unit_price: 120, subtotal: 120 }] }
const paid = { data: { orderId: receipt.orderId, orderNumber: order.order_number, paymentStatus: 'paid' } }
function harness({ saved = receipt, responses = [paid], details = order, storage = new Map() } = {}) {
  if (saved) storage.set(CART_PAYMENT_RETURN_STORAGE_KEY, JSON.stringify(saved))
  const timers = new Map(), states = [], actions = [], ids = [], logs = []
  let calls = 0, nextId = 0, confirmation, cart = ['Flan'], modal = false
  const options = {
    storage: { getItem: (key) => storage.get(key) ?? null },
    verify: async (context) => {
      ids.push(context.orderId)
      const response = responses[Math.min(calls++, responses.length - 1)]
      if (response instanceof Error) throw response
      return response
    },
    loadDetails: async (context, status) => loadGuestConfirmation({ rpc: async () => ({ data: details }) }, context, status),
    onState: (state) => states.push(state),
    onConfirmed: (value) => {
      confirmation = value; actions.push('confirmation')
      cart = []; actions.push('clear')
      modal = true; actions.push('modal')
      storage.delete(CART_PAYMENT_RETURN_STORAGE_KEY)
    },
    log: (event, data) => logs.push({ event, data }),
    schedule: (fn) => { timers.set(++nextId, fn); return nextId }, unschedule: (id) => timers.delete(id),
  }
  return {
    storage, states, actions, ids, logs, options,
    async drain() {
      for (let count = 0; timers.size && count < 20; count++) {
        const [id, callback] = timers.entries().next().value
        timers.delete(id); callback(); await new Promise(setImmediate)
      }
      assert.equal(timers.size, 0)
      return { calls, confirmation, cart, modal }
    },
    start() { return startPaymentReturn(options) },
  }
}

test('A/E: paid guest return stores canonical confirmation before clearing, keeping modal open', async () => {
  const flow = harness(); flow.start(); const result = await flow.drain()
  assert.deepEqual(flow.actions, ['confirmation', 'clear', 'modal'])
  assert.equal(result.confirmation, order); assert.deepEqual(result.cart, []); assert.equal(result.modal, true)
  assert.equal(flow.storage.size, 0)
})
test('B: missing or malformed context produces context-error with no payment request', async () => {
  for (const saved of [null, {}, { orderId: 'order-1', guestEmail: '' }]) {
    const flow = harness({ saved }); flow.start(); const result = await flow.drain()
    assert.equal(result.calls, 0); assert.equal(flow.states.at(-1).stage, 'context')
    assert.deepEqual(result.cart, ['Flan']); assert.equal(result.modal, false)
  }
})
test('C: thrown verification error is technical error, not pending timeout', async () => {
  const flow = harness({ responses: [Object.assign(new Error(), { httpStatus: 401, code: 'AUTH_REQUIRED' })] })
  flow.start(); const result = await flow.drain()
  assert.deepEqual(flow.states.at(-1), { status: 'error', stage: 'verification' })
  assert.equal(result.calls, 1); assert.equal(flow.storage.size, 1); assert.deepEqual(flow.actions, [])
  assert.equal(flow.logs.at(-1).data.httpStatus, 401)
})
test('D: pending status uses eight attempts and retains context on timeout', async () => {
  const flow = harness({ responses: [{ data: { ...paid.data, paymentStatus: 'pending' } }] })
  flow.start(); assert.equal((await flow.drain()).calls, 8)
  assert.equal(flow.states.at(-1).status, 'timeout'); assert.equal(flow.storage.size, 1)
  assert.deepEqual(flow.actions, [])
})
test('F: Try Again invokes only verification for the same saved order', async () => {
  const flow = harness({ responses: [new Error(), paid] })
  const stop = flow.start(); await flow.drain(); stop()
  flow.start(); assert.equal((await flow.drain()).modal, true)
  assert.deepEqual(flow.ids, ['order-1', 'order-1'])
})
test('deployed v7 paid response without orderNumber reproduces the details breakpoint', async () => {
  const flow = harness({ responses: [{ data: { orderId: receipt.orderId, paymentStatus: 'paid' } }] })
  flow.start(); await flow.drain()
  assert.equal(flow.states.at(-1).stage, 'details'); assert.equal(flow.storage.size, 1)
  assert.deepEqual(flow.actions, [])
})
test('cleanup prevents abandoned StrictMode setup from polling or showing success', async () => {
  const flow = harness(); flow.start()(); flow.start(); await flow.drain()
  assert.equal(flow.ids.length, 1); assert.deepEqual(flow.actions, ['confirmation', 'clear', 'modal'])
})
test('cleanup during an in-flight verification suppresses confirmation', async () => {
  const flow = harness(); let resolve
  flow.options.verify = () => new Promise((done) => { resolve = done })
  const stop = flow.start(); await flow.drain(); stop(); resolve(paid); await new Promise(setImmediate)
  assert.deepEqual(flow.actions, []); assert.equal(flow.storage.size, 1)
})
test('guest status transport uses API key and secure context, never account/anon Bearer', async () => {
  const response = await requestGuestPaymentStatus({ url: 'https://example.com', apiKey: 'test-key', receipt,
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://example.com/functions/v1/create-cart-xendit-payment')
      assert.equal(new Headers(init.headers).has('Authorization'), false)
      assert.equal(init.headers.apikey, 'test-key')
      assert.deepEqual(JSON.parse(init.body), { ...receipt, statusOnly: true })
      return new Response(JSON.stringify(paid.data), { status: 200 })
    },
  })
  assert.deepEqual(response, { ...paid, error: null })
})
test('HTTP authorization rejection is surfaced without logging provider body', async () => {
  await assert.rejects(requestGuestPaymentStatus({ url: 'https://example.com', apiKey: 'test-key', receipt,
    fetchImpl: async () => new Response(JSON.stringify({ error: 'private detail', code: 'AUTH_REQUIRED' }), { status: 401 }),
  }), (error) => error.httpStatus === 401 && error.code === 'AUTH_REQUIRED' && !error.message.includes('private detail'))
})

test('Cart effect ignores cached auth flag for guest context and does not start on cancellation', () => {
  const source = readFileSync(new URL('./CartPage.jsx', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
  const start = source.indexOf("  useEffect(() => {\n    if (guestPaymentStatus !== 'success')")
  const end = source.indexOf('  useEffect(() => {\n    if (!shouldConsumePaymentReturn', start)
  assert.ok(start >= 0 && end > start)
  for (const payment of ['success', 'cancelled']) {
    let started = 0
    const scope = {
      guestPaymentStatus: payment, verificationAttempt: 0, isCustomerAuthenticated: true,
      window: { localStorage: {} }, useEffect: (callback) => callback(), logPaymentReturn() {},
      startPaymentReturn: () => { started++ }, setPaymentReturnState() {},
    }
    new Function(...Object.keys(scope), source.slice(start, end).replaceAll('import.meta.env', '({})'))(...Object.values(scope))
    assert.equal(started, payment === 'success' ? 1 : 0)
  }
})

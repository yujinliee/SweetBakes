import test from 'node:test'
import assert from 'node:assert/strict'
import { CART_PAYMENT_RETURN_STORAGE_KEY, isVerifiedPayment, loadGuestConfirmation, loadConfirmedItems, savePaymentReturnContext, shouldConsumePaymentReturn } from './paymentConfirmation.js'

const receipt = { orderId: 'order-1', guestEmail: 'Guest@Example.com' }
const status = { orderId: 'order-1', orderNumber: 'SB-1', paymentStatus: 'paid' }
const order = { order_number: 'SB-1', payment_status: 'paid', total: 333, order_items: [{ product_name: 'Flan', quantity: 2, unit_price: 120, subtotal: 240 }, { product_name: 'Puto', quantity: 1, unit_price: 93, subtotal: 93 }] }

test('save-before-redirect writes and reads back only the existing minimum context', () => {
  const values = new Map()
  const storage = { setItem: (key, value) => values.set(key, value), getItem: (key) => values.get(key) }
  savePaymentReturnContext(storage, { ...receipt, total: 999, token: 'must-not-be-saved' })
  assert.deepEqual(JSON.parse(values.get(CART_PAYMENT_RETURN_STORAGE_KEY)), receipt)
  savePaymentReturnContext(storage, { orderId: receipt.orderId })
  assert.deepEqual(JSON.parse(values.get(CART_PAYMENT_RETURN_STORAGE_KEY)), { orderId: receipt.orderId })
})

test('storage failure prevents the save-before-redirect operation from succeeding', () => {
  assert.throws(() => savePaymentReturnContext({ setItem() {}, getItem() { return null } }, receipt), /Unable to retain/)
  assert.throws(() => savePaymentReturnContext({ setItem() { throw new Error('Storage denied') } }, receipt), /Storage denied/)
})

test('timeout and checking preserve return context; only verified or explicit cancel consumes it', () => {
  for (const state of ['checking', 'success', 'timeout', 'failed', undefined]) assert.equal(shouldConsumePaymentReturn(state), false)
  for (const state of ['verified', 'cancelled']) assert.equal(shouldConsumePaymentReturn(state), true)
})

test('only existing verified payment statuses qualify', () => {
  for (const value of ['paid', 'verified', 'payment_verified']) assert.equal(isVerifiedPayment(value), true)
  for (const value of ['success', 'pending', 'unpaid', 'cancelled', 'failed', undefined]) assert.equal(isVerifiedPayment(value), false)
})
test('guest confirmation uses canonical multi-item snapshot and total without a cart', async () => {
  const client = { rpc: async (name, args) => {
    assert.equal(name, 'track_guest_order')
    assert.deepEqual(args, { p_order_number: 'SB-1', p_email: 'guest@example.com' })
    return { data: order }
  } }
  assert.deepEqual(await loadGuestConfirmation(client, receipt, status), order)
})
test('unverified, cancelled, missing and mismatched return contexts cannot load success', async () => {
  const client = { rpc: () => assert.fail('lookup must not run') }
  for (const change of [{ paymentStatus: 'pending' }, { paymentStatus: 'cancelled' }, { orderId: 'other' }, { orderNumber: null }]) {
    assert.equal(await loadGuestConfirmation(client, receipt, { ...status, ...change }), null)
  }
})
test('delayed canonical status only yields a confirmation after paid', async () => {
  let paid = false
  const client = { rpc: async () => ({ data: { ...order, payment_status: paid ? 'paid' : 'pending' } }) }
  assert.equal(await loadGuestConfirmation(client, receipt, status), null)
  paid = true
  assert.deepEqual(await loadGuestConfirmation(client, receipt, status), order)
})
test('lookup failures and missing items do not create a success receipt', async () => {
  for (const response of [{ error: new Error() }, { data: { ...order, order_number: 'other' } }, { data: { ...order, order_items: [] } }]) {
    assert.equal(await loadGuestConfirmation({ rpc: async () => response }, receipt, status), null)
  }
})
test('authenticated items are explicitly loaded for the verified order in one query', async () => {
  const client = { from: (table) => {
    assert.equal(table, 'order_items')
    return { select: () => ({ eq: async (field, id) => {
      assert.equal(field, 'order_id'); assert.equal(id, 'order-1')
      return { data: order.order_items }
    } }) }
  } }
  assert.deepEqual(await loadConfirmedItems(client, 'order-1'), order.order_items)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { isVerifiedPayment, loadGuestConfirmation, loadConfirmedItems } from './paymentConfirmation.js'

const receipt = { orderId: 'order-1', guestEmail: 'Guest@Example.com' }
const status = { orderId: 'order-1', orderNumber: 'SB-1', paymentStatus: 'paid' }
const order = { order_number: 'SB-1', payment_status: 'paid', total: 333, order_items: [{ product_name: 'Flan', quantity: 2, unit_price: 120, subtotal: 240 }, { product_name: 'Puto', quantity: 1, unit_price: 93, subtotal: 93 }] }

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

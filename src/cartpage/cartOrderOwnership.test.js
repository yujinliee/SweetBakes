import test from 'node:test'
import assert from 'node:assert/strict'
import { getCheckoutSession, reusableCartOrder, getCartOrderReference, assertCartOrderReference } from './cartOrderOwnership.js'

const client = (session, sessionError = null, userId = session?.user?.id) => ({
  auth: {
    getSession: async () => ({ data: { session }, error: sessionError }),
    getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }),
  },
})

test('guest checkout keeps a null owner and accepts a server-issued order number', async () => {
  assert.equal(await getCheckoutSession(client(null)), null)
  const receipt = { orderId: 'guest-order', customerId: null, orderNumber: 'SB-20260908-0026' }
  assert.equal(assertCartOrderReference(receipt, 'guest-order', null), receipt)
  assert.equal(reusableCartOrder({ orderId: receipt.orderId, customerId: null }, null), receipt.orderId)
})

test('authenticated checkout uses a verified session and checks the stored owner', async () => {
  const session = { user: { id: 'customer-a' }, access_token: 'test-token' }
  assert.equal(await getCheckoutSession(client(session)), session)
  const receipt = { orderId: 'customer-order', customerId: session.user.id, orderNumber: 'SB-20260908-0027' }
  assert.equal(assertCartOrderReference(receipt, receipt.orderId, session.user.id), receipt)
  assert.throws(() => assertCartOrderReference({ ...receipt, customerId: null }, receipt.orderId, session.user.id), /ownership/)
})

test('session errors and invalid sessions never fall through to guest creation', async () => {
  await assert.rejects(getCheckoutSession(client(null, new Error('offline'))), /session/)
  await assert.rejects(getCheckoutSession(client({ user: { id: 'a' } })), /session/)
  await assert.rejects(getCheckoutSession(client({ user: { id: 'a' }, access_token: 'test-token' }, null, 'b')), /session/)
})

test('payment retries never reuse orders across guest/login/logout/account changes', () => {
  const guest = { orderId: 'guest-order', customerId: null }
  const customer = { orderId: 'customer-order', customerId: 'a' }
  assert.equal(reusableCartOrder(guest, 'a'), null)
  assert.equal(reusableCartOrder(customer, null), null)
  assert.equal(reusableCartOrder(customer, 'b'), null)
  assert.equal(reusableCartOrder(customer, 'a'), customer.orderId)
})

test('missing order numbers and incorrect order references cannot be presented as valid receipts', () => {
  for (const orderNumber of [null, undefined, '', '   ']) {
    assert.throws(() => assertCartOrderReference({ orderId: 'order', customerId: 'a', orderNumber }, 'order', 'a'), /order number/)
  }
  assert.throws(() => assertCartOrderReference({ orderId: 'other', customerId: null, orderNumber: 'SB-20260908-0026' }, 'order', null), /ownership/)
})

test('logged-in verification normalizes the canonical row without guest/payment metadata', async () => {
  const calls = []
  const query = {
    select(fields) { calls.push(['select', fields]); return this },
    eq(field, value) { calls.push([field, value]); return this },
    async maybeSingle() { return { data: { id: 'order', customer_id: 'a', order_number: 'SB-20260908-0031' }, error: null } },
  }
  const db = { from(table) { assert.equal(table, 'orders'); return query } }
  const reference = await getCartOrderReference(db, 'order', { user: { id: 'a' } }, 'stale-guest@example.invalid')
  assert.deepEqual(reference, { orderId: 'order', customerId: 'a', orderNumber: 'SB-20260908-0031', isGuest: false })
  assert.equal(assertCartOrderReference(reference, 'order', 'a'), reference)
  assert.deepEqual(calls, [['select', 'id, customer_id, order_number'], ['id', 'order'], ['customer_id', 'a']])
  query.maybeSingle = async () => ({ data: null, error: null })
  await assert.rejects(getCartOrderReference(db, 'order', { user: { id: 'a' } }, 'guest@example.invalid'), /verify/)
})

test('deployed guest status response passes only after secure server verification', async () => {
  const db = { functions: { async invoke(name, options) {
    assert.equal(name, 'create-cart-xendit-payment')
    assert.deepEqual(options.body, { orderId: 'guest-order', statusOnly: true, guestEmail: 'guest@example.invalid' })
    return { data: { orderId: 'guest-order', paymentStatus: 'unpaid' }, error: null }
  } } }
  const reference = await getCartOrderReference(db, 'guest-order', null, 'guest@example.invalid')
  assert.deepEqual(reference, { orderId: 'guest-order', customerId: null, orderNumber: null, isGuest: true })
  assert.equal(assertCartOrderReference(reference, 'guest-order', null), reference)
  for (const response of [
    { data: null, error: new Error('Guest verification denied') },
    { data: { orderId: 'other-order', paymentStatus: 'unpaid' }, error: null },
    { data: { orderId: 'guest-order' }, error: null },
  ]) {
    db.functions.invoke = async () => response
    await assert.rejects(getCartOrderReference(db, 'guest-order', null, 'guest@example.invalid'), /verify/)
  }
})

test('legacy status payload reproduces the original undefined-owner mismatch', () => {
  assert.throws(() => assertCartOrderReference({ orderId: 'order', paymentStatus: 'unpaid' }, 'order', 'a'), /ownership/)
})

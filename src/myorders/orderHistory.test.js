import test from 'node:test'
import assert from 'node:assert/strict'
import { ORDER_TABS, attachOrderReviews, getOrderTabCounts, matchesOrderTab, requiresPayment, isAwaitingPrice, historyStatus, referenceImages, itemDescription, getHistoryItems } from './orderHistory.js'

test('all product rows use the latest parent order number, never item identifiers', () => {
  const items = ['custom_cake', 'cupcake', 'party_package', 'regular_cake', 'ube'].map((product_type, index) => ({
    id: `item-${index}`, product_id: `product-${index}`, product_type, orderNumber: 'stale-item-number',
  }))
  const parent = { order_number: 'SB-20260908-0026', order_items: items }
  assert.deepEqual(getHistoryItems(parent).map((item) => item.orderNumber), items.map(() => parent.order_number))
  assert.equal(getHistoryItems({ ...parent, order_number: 'SB-20260908-0027' })[0].orderNumber, 'SB-20260908-0027')
  for (const order_number of [null, undefined, '']) {
    assert.ok(getHistoryItems({ ...parent, order_number }).every((item) => !item.orderNumber))
  }
  assert.equal(items[0].orderNumber, 'stale-item-number')
})

const order = (overrides = {}) => ({ customer_id: 'customer', order_status: 'pending', payment_status: 'unpaid', total: 850, order_items: [{ product_name: 'Ube', quantity: 1 }], ...overrides })

test('all counts follow the visible-order predicate, including zero and lifecycle updates', () => {
  assert.deepEqual(Object.values(getOrderTabCounts([])), [0, 0, 0, 0, 0, 0])
  let orders = [order({ id: 'one', order_method: 'pickup' })]
  assert.deepEqual(Object.values(getOrderTabCounts(orders)), [1, 1, 0, 0, 0, 0])
  orders = [{ ...orders[0], payment_status: 'paid' }]
  assert.deepEqual(Object.values(getOrderTabCounts(orders)), [1, 0, 1, 0, 0, 0])
  orders = [{ ...orders[0], order_status: 'preparing' }]
  assert.deepEqual(Object.values(getOrderTabCounts(orders)), [1, 0, 1, 0, 0, 0])
  orders = [{ ...orders[0], order_status: 'ready' }]
  assert.deepEqual(Object.values(getOrderTabCounts(orders)), [1, 0, 0, 0, 1, 0])
  orders = [{ ...orders[0], order_method: 'delivery' }]
  assert.deepEqual(Object.values(getOrderTabCounts(orders)), [1, 0, 0, 1, 0, 0])
  orders = [{ ...orders[0], order_status: 'completed' }]
  // Completed, paid, unreviewed orders remain reviewable.
  assert.deepEqual(Object.values(getOrderTabCounts(orders)), [1, 0, 0, 0, 0, 1])
  orders.push(order({ id: 'two' }))
  for (const tab of ORDER_TABS) {
    assert.equal(getOrderTabCounts(orders)[tab], orders.filter((entry) => matchesOrderTab(entry, tab)).length)
  }
  orders = orders.filter((entry) => entry.id !== 'two')
  assert.equal(getOrderTabCounts(orders)['To Pay'], 0)
})

test('custom quotations across cake, cupcake and package do not request payment', () => {
  for (const request_type of ['custom_cake', 'custom_cupcake', 'custom_party_package']) {
    const request = order({ total: 0, order_items: [{ customization_data: { request_type } }] })
    assert.equal(isAwaitingPrice(request), true)
    assert.equal(matchesOrderTab(request, 'To Pay'), false)
    assert.equal(matchesOrderTab(request, 'To Ship'), false)
    assert.equal(matchesOrderTab(request, 'To Process'), false)
    const confirmed = { ...request, total: 1500, order_status: 'confirmed', payment_status: 'pending' }
    assert.equal(matchesOrderTab(confirmed, 'To Pay'), true)
    assert.equal(isAwaitingPrice(confirmed), false)
  }
})

test('unpaid regular orders and outstanding payments filter without changing totals', () => {
  for (const payment_status of ['unpaid', 'pending', 'partial', 'failed']) {
    assert.equal(requiresPayment(order({ payment_status })), true)
  }
  for (const payment_status of ['paid', 'refunded']) {
    assert.equal(requiresPayment(order({ payment_status })), false)
  }
  assert.equal(matchesOrderTab(order({ payment_status: 'paid' }), 'To Ship'), false)
  assert.equal(matchesOrderTab(order({ payment_status: 'paid' }), 'To Process'), true)
  for (const order_status of ['cancelled', 'rejected', 'completed']) {
    const closed = order({ order_status })
    assert.equal(matchesOrderTab(closed, 'All'), true)
    assert.equal(matchesOrderTab(closed, 'To Pay'), false)
    assert.equal(matchesOrderTab(closed, 'To Ship'), false)
    assert.equal(matchesOrderTab(closed, 'To Process'), false)
  }
})

test('shared ready state keeps pickup and delivery labels accurate', () => {
  for (const [order_method, label] of [['pickup', 'Ready for Pickup'], ['delivery', 'Ready for Delivery']]) {
    const ready = order({ order_status: 'ready', order_method, payment_status: 'paid' })
    assert.equal(matchesOrderTab(ready, 'To Receive'), order_method === 'pickup')
    assert.equal(matchesOrderTab(ready, 'To Ship'), order_method === 'delivery')
    assert.equal(matchesOrderTab(ready, 'To Process'), false)
    assert.equal(historyStatus(ready), label)
  }
  assert.equal(matchesOrderTab(order({ order_status: 'preparing' }), 'To Receive'), false)
  assert.equal(matchesOrderTab(order({ order_status: 'completed', payment_status: 'paid' }), 'To Review'), true)
})

test('processing tab follows payment and preparation without changing badges', () => {
  assert.deepEqual(ORDER_TABS, ['All', 'To Pay', 'To Process', 'To Ship', 'To Receive', 'To Review'])
  for (const [order_status, label] of [['pending', 'Payment Verified'], ['confirmed', 'Payment Verified'], ['preparing', 'Preparing Order']]) {
    const paid = order({ order_status, payment_status: 'paid' })
    assert.equal(historyStatus(paid), label)
    assert.equal(matchesOrderTab(paid, 'To Process'), true)
    assert.equal(matchesOrderTab(paid, 'To Ship'), false)
    assert.equal(matchesOrderTab(paid, 'To Pay'), false)
    for (const payment_status of ['unpaid', 'pending', 'partial', 'failed']) {
      const outstanding = { ...paid, payment_status }
      assert.equal(matchesOrderTab(outstanding, 'To Pay'), true)
      assert.equal(matchesOrderTab(outstanding, 'To Process'), false)
    }
    assert.equal(matchesOrderTab({ ...paid, payment_status: 'refunded' }, 'To Process'), false)
  }
})

test('nested package references and concise customization are supported', () => {
  const item = { customization_data: { package_selection: { cakeQuantity: 1, cupcakeQuantity: 12 }, package_customization: { packageCakeFlavor: 'Chocolate', packageCakeLayers: 2, packageReferenceImages: [{ path: 'customer/reference.png' }] } } }
  assert.deepEqual(referenceImages(item), [{ path: 'customer/reference.png' }])
  assert.match(itemDescription(item), /Chocolate/)
  assert.match(itemDescription(item), /12 cupcakes/)
  assert.doesNotMatch(itemDescription(item), /object Object|reference.png/)
  assert.deepEqual(referenceImages({ customization_data: { reference_images: 'invalid' } }), [])
})

test('saved reviews leave All intact and remove only reviewed orders from To Review', () => {
  const completed = order({ id: 'completed', order_status: 'completed', payment_status: 'paid' })
  const before = [completed, order({ id: 'processing', payment_status: 'paid' })]
  assert.equal(getOrderTabCounts(before)['To Review'], 1)
  const after = attachOrderReviews(before, [{ id: 'review', order_id: 'completed', rating: 5 }])
  assert.equal(getOrderTabCounts(after)['To Review'], 0)
  assert.equal(getOrderTabCounts(after).All, 2)
  assert.equal(getOrderTabCounts(after)['To Process'], 1)
  assert.equal(after[0].review.rating, 5)
  assert.equal(before[0].review, undefined)
  for (const overrides of [{ customer_id: null }, { payment_status: 'unpaid' }, { order_status: 'cancelled' }]) {
    assert.equal(matchesOrderTab({ ...completed, ...overrides }, 'To Review'), false)
  }
  for (const request_type of ['custom_cake', 'custom_cupcake', 'custom_party_package']) {
    assert.equal(matchesOrderTab({ ...completed, order_items: [{ customization_data: { request_type } }] }, 'To Review'), true)
  }
})

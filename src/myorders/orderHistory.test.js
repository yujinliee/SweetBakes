import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesOrderTab, requiresPayment, isAwaitingPrice, historyStatus, referenceImages, itemDescription, getHistoryItems } from './orderHistory.js'

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

const order = (overrides = {}) => ({ order_status: 'pending', payment_status: 'unpaid', total: 850, order_items: [{ product_name: 'Ube', quantity: 1 }], ...overrides })

test('custom quotations across cake, cupcake and package do not request payment', () => {
  for (const request_type of ['custom_cake', 'custom_cupcake', 'custom_party_package']) {
    const request = order({ total: 0, order_items: [{ customization_data: { request_type } }] })
    assert.equal(isAwaitingPrice(request), true)
    assert.equal(matchesOrderTab(request, 'To Pay'), false)
    assert.equal(matchesOrderTab(request, 'To Ship'), true)
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
  assert.equal(matchesOrderTab(order({ payment_status: 'paid' }), 'To Ship'), true)
  for (const order_status of ['cancelled', 'rejected', 'completed']) {
    const closed = order({ order_status })
    assert.equal(matchesOrderTab(closed, 'All'), true)
    assert.equal(matchesOrderTab(closed, 'To Pay'), false)
    assert.equal(matchesOrderTab(closed, 'To Ship'), false)
  }
})

test('shared ready state keeps pickup and delivery labels accurate', () => {
  for (const [order_method, label] of [['pickup', 'Ready for Pickup'], ['delivery', 'Ready for Delivery']]) {
    const ready = order({ order_status: 'ready', order_method, payment_status: 'paid' })
    assert.equal(matchesOrderTab(ready, 'To Receive'), true)
    assert.equal(matchesOrderTab(ready, 'To Ship'), false)
    assert.equal(historyStatus(ready), label)
  }
  assert.equal(matchesOrderTab(order({ order_status: 'preparing' }), 'To Receive'), false)
  assert.equal(matchesOrderTab(order({ order_status: 'completed' }), 'To Review'), false)
})

test('nested package references and concise customization are supported', () => {
  const item = { customization_data: { package_selection: { cakeQuantity: 1, cupcakeQuantity: 12 }, package_customization: { packageCakeFlavor: 'Chocolate', packageCakeLayers: 2, packageReferenceImages: [{ path: 'customer/reference.png' }] } } }
  assert.deepEqual(referenceImages(item), [{ path: 'customer/reference.png' }])
  assert.match(itemDescription(item), /Chocolate/)
  assert.match(itemDescription(item), /12 cupcakes/)
  assert.doesNotMatch(itemDescription(item), /object Object|reference.png/)
  assert.deepEqual(referenceImages({ customization_data: { reference_images: 'invalid' } }), [])
})

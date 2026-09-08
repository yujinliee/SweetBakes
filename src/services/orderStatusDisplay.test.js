import test from 'node:test'
import assert from 'node:assert/strict'
import { getOrderProgressStage, getOrderProgressLabel, getOrderProgressStages } from './orderStatusDisplay.js'
import { historyStatus } from '../myorders/orderHistory.js'

const regular = (order_status, payment_status = 'paid', order_method = 'pickup') => ({
  order_status, payment_status, order_method,
  order_items: [{ product_name: 'Leche Flan', quantity: 1 }],
})

test('paid pending regular order acknowledges payment without advancing fulfillment', () => {
  const order = regular('pending')
  assert.equal(getOrderProgressStage({ orderStatus: 'pending', paymentStatus: 'paid', isRegularOrder: true }), 2)
  assert.equal(getOrderProgressLabel(order), 'Payment Verified')
  assert.equal(historyStatus(order), 'Payment Verified')
  assert.equal(order.order_status, 'pending')
})

test('regular orders awaiting full payment show Payment Pending', () => {
  for (const payment of ['unpaid', 'pending', 'partial', 'failed']) {
    assert.equal(getOrderProgressLabel(regular('pending', payment)), 'Payment Pending')
  }
})

test('acceptance is separate from the explicit Start Preparing action', () => {
  assert.equal(getOrderProgressLabel(regular('confirmed')), 'Payment Verified')
  assert.equal(getOrderProgressLabel(regular('preparing')), 'Preparing Order')
  assert.equal(getOrderProgressLabel(regular('ready')), 'Ready for Pickup')
  assert.equal(getOrderProgressLabel(regular('ready', 'paid', 'delivery')), 'Ready for Delivery')
  assert.equal(getOrderProgressLabel(regular('completed')), 'Completed')
})

test('terminal states and later fulfillment milestones take precedence over payment', () => {
  for (const payment of ['paid', 'pending', 'refunded']) {
    for (const [status, label] of [['cancelled', 'Cancelled'], ['rejected', 'Rejected'], ['completed', 'Completed'], ['preparing', 'Preparing Order']]) {
      assert.equal(getOrderProgressLabel(regular(status, payment)), label)
    }
    assert.equal(getOrderProgressStage({ orderStatus: 'cancelled', paymentStatus: payment, isRegularOrder: true }), null)
  }
})

test('custom review and existing guest-tracking calls retain their stage semantics', () => {
  for (const request_type of ['custom_cake', 'custom_cupcake', 'custom_party_package']) {
    const order = { ...regular('pending', 'unpaid'), order_items: [{ customization_data: { request_type } }] }
    assert.equal(getOrderProgressLabel(order), 'Pending Review')
    assert.equal(getOrderProgressLabel({ ...order, order_status: 'confirmed', payment_status: 'pending' }), 'Payment Pending')
    assert.equal(getOrderProgressLabel({ ...order, order_status: 'confirmed', payment_status: 'paid' }), 'Payment Verified')
    assert.equal(getOrderProgressStages(order)[3], 'Preparing Cake')
  }
  assert.equal(getOrderProgressStage({ orderStatus: 'pending', paymentStatus: 'paid' }), 0)
})

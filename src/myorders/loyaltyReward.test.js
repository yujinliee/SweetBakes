import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LOYALTY_DOWN_PAYMENT_PERCENT,
  isLoyaltyEligible,
  calculateLoyaltyReward,
  clientAmountMatchesServer,
  getCustomDownPaymentState,
} from './loyaltyReward.js'

const customOrder = (overrides = {}) => ({
  id: 'order-1',
  order_number: 'SB-20260911-0001',
  total: 3000,
  required_down_payment: 1500,
  payment_status: 'pending',
  order_status: 'confirmed',
  amount_paid: 0,
  loyalty_reward_applied: false,
  loyalty_discount_percent: 0,
  loyalty_discount_amount: 0,
  payment_amount_due: null,
  ...overrides,
})

test('A. customer with 0 completed orders has no reward and pays the full required down payment', () => {
  assert.equal(isLoyaltyEligible(0), false)
  const reward = calculateLoyaltyReward(1500, 0)
  assert.equal(reward.eligible, false)
  assert.equal(reward.discountAmount, 0)
  assert.equal(reward.payableAmount, 1500)
  assert.equal(getCustomDownPaymentState(customOrder(), 0).payableAmount, 1500)
})

test('B. customer with exactly 1 completed order has no reward', () => {
  assert.equal(isLoyaltyEligible(1), false)
  const reward = calculateLoyaltyReward(1500, 1)
  assert.equal(reward.eligible, false)
  assert.equal(reward.discountAmount, 0)
  assert.equal(reward.payableAmount, 1500)
})

test('C. customer with 2 completed orders becomes eligible for the 20% reward', () => {
  assert.equal(isLoyaltyEligible(2), true)
  const reward = calculateLoyaltyReward(1500, 2)
  assert.equal(reward.eligible, true)
  assert.equal(reward.percent, LOYALTY_DOWN_PAYMENT_PERCENT)
  assert.equal(reward.discountAmount, 300)
  assert.equal(reward.payableAmount, 1200)
})

test('D. PHP 1,500 down payment discounts PHP 300 leaving PHP 1,200 payable', () => {
  const reward = calculateLoyaltyReward(1500, 3)
  assert.deepEqual(
    { discountAmount: reward.discountAmount, payableAmount: reward.payableAmount, original: reward.originalDownPayment },
    { discountAmount: 300, payableAmount: 1200, original: 1500 },
  )
})

test('odd amounts round to two decimals (PHP 924 down payment)', () => {
  const reward = calculateLoyaltyReward(924, 2)
  assert.equal(reward.discountAmount, 184.8)
  assert.equal(reward.payableAmount, 739.2)
  assert.equal(reward.originalDownPayment, 924)
})

test('E. a tampered client amount is rejected when it differs from the server payable', () => {
  assert.deepEqual(clientAmountMatchesServer(100, 1200), { provided: true, matches: false })
  assert.deepEqual(clientAmountMatchesServer(0, 1200), { provided: true, matches: false })
  assert.deepEqual(clientAmountMatchesServer('not-a-number', 1200), { provided: true, matches: false })
  assert.deepEqual(clientAmountMatchesServer(1200, 1200), { provided: true, matches: true })
  assert.deepEqual(clientAmountMatchesServer(null, 1200), { provided: false, matches: true })
})

test('F. a successful PHP 1,200 Xendit payment records the actual amount and keeps the original down payment', () => {
  const paid = customOrder({
    payment_status: 'paid',
    amount_paid: 1200,
    loyalty_reward_applied: true,
    loyalty_discount_percent: 20,
    loyalty_discount_amount: 300,
    payment_amount_due: 1200,
  })
  const state = getCustomDownPaymentState(paid, 2)
  assert.equal(state.paid, true)
  assert.equal(state.originalDownPayment, 1500)
  assert.equal(state.discountAmount, 300)
  assert.equal(state.payableAmount, 1200)
  assert.equal(state.amountPaid, 1200)
  assert.equal(state.remainingBalance, 1800)
  // The full PHP 1,500 required down payment must not be faked.
  assert.notEqual(state.amountPaid, 1500)
})

test('G. a failed or cancelled payment is never marked paid and records no received amount', () => {
  for (const paymentStatus of ['pending', 'unpaid', 'failed', 'refunded']) {
    const state = getCustomDownPaymentState(customOrder({ payment_status: paymentStatus }), 2)
    assert.equal(state.paid, false, `${paymentStatus} must not be treated as paid`)
    assert.equal(state.amountPaid, 0)
  }
  const cancelled = getCustomDownPaymentState(customOrder({ order_status: 'cancelled', payment_status: 'unpaid' }), 2)
  assert.equal(cancelled.paid, false)
  assert.equal(cancelled.amountPaid, 0)
})

test('H. amounts survive refresh from persisted backend fields only', () => {
  const refreshed = customOrder({
    loyalty_reward_applied: true,
    loyalty_discount_percent: 20,
    loyalty_discount_amount: 300,
    payment_amount_due: 1200,
  })
  // Even if the frontend completed-order count is stale (0), the persisted
  // session amount wins — the reward was already consumed once.
  const state = getCustomDownPaymentState(refreshed, 0)
  assert.equal(state.rewardApplied, true)
  assert.equal(state.hasPersistedSession, true)
  assert.equal(state.payableAmount, 1200)
  assert.equal(state.discountAmount, 300)
  assert.equal(state.originalDownPayment, 1500)
})

test('a fresh unpaid order has no persisted session and does not claim a reward that was never saved', () => {
  const state = getCustomDownPaymentState(customOrder(), 0)
  assert.equal(state.rewardApplied, false)
  assert.equal(state.hasPersistedSession, false)
  assert.equal(state.payableAmount, 1500)
  assert.equal(state.discountAmount, 0)
})
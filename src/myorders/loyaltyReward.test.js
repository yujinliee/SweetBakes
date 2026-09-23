import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateRewardPreview, clientAmountMatchesServer, getCustomDownPaymentState, normalizeLoyaltyState } from './loyaltyReward.js'

const customOrder = (overrides = {}) => ({ total: 3000, required_down_payment: 1500, payment_status: 'pending', order_status: 'confirmed', amount_paid: 0, loyalty_reward_applied: false, loyalty_discount_percent: 0, loyalty_discount_amount: 0, payment_amount_due: null, ...overrides })

test('loyalty state normalizes server-owned counts', () => {
  assert.deepEqual(normalizeLoyaltyState({ completed_orders: 4, threshold: 2, progress: 0, earned_rewards: 2, available_rewards: 1, reserved_rewards: 1, used_rewards: 1, discount_percent: 20 }), { completedOrders: 4, threshold: 2, progress: 0, earnedRewards: 2, availableRewards: 1, reservedRewards: 1, usedRewards: 1, discountPercent: 20 })
})

test('reward preview is presentation math only', () => {
  assert.deepEqual(calculateRewardPreview(1500, 20), { originalDownPayment: 1500, discountAmount: 300, payableAmount: 1200, percent: 20 })
  assert.deepEqual(calculateRewardPreview(924, 20), { originalDownPayment: 924, discountAmount: 184.8, payableAmount: 739.2, percent: 20 })
})

test('tampered client amount is rejected against the server payable amount', () => {
  assert.deepEqual(clientAmountMatchesServer(100, 1200), { provided: true, matches: false })
  assert.deepEqual(clientAmountMatchesServer(1200, 1200), { provided: true, matches: true })
  assert.deepEqual(clientAmountMatchesServer(null, 1200), { provided: false, matches: true })
})

test('persisted successful reward survives refresh without completed-count eligibility', () => {
  const state = getCustomDownPaymentState(customOrder({ payment_status: 'paid', amount_paid: 1200, loyalty_reward_applied: true, loyalty_discount_percent: 20, loyalty_discount_amount: 300, payment_amount_due: 1200 }))
  assert.equal(state.paid, true)
  assert.equal(state.payableAmount, 1200)
  assert.equal(state.discountAmount, 300)
  assert.equal(state.amountPaid, 1200)
  assert.equal(state.remainingBalance, 1800)
})

test('fresh unpaid order does not claim a reward that was never saved', () => {
  const state = getCustomDownPaymentState(customOrder())
  assert.equal(state.rewardApplied, false)
  assert.equal(state.hasPersistedSession, false)
  assert.equal(state.payableAmount, 1500)
  assert.equal(state.discountAmount, 0)
})

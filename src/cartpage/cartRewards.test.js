import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CART_REWARD_SERVER_READY,
  normalizeCartReward,
  fetchAvailableCartRewards,
  computeCartRewardDiscount,
  calculateCartRewardDiscount,
  formatCartRewardValue,
} from './cartRewards.js'

test('normalizeCartReward maps a fixed row', () => {
  const reward = normalizeCartReward({
    id: 'r1',
    code: 'SWEET50',
    title: 'Sweet 50',
    description: '₱50 off your cart',
    discount_type: 'fixed',
    discount_value: 50,
    discount_percent: 0,
    min_completed_orders: 1,
  })
  assert.deepEqual(reward, {
    id: 'r1',
    code: 'SWEET50',
    title: 'Sweet 50',
    description: '₱50 off your cart',
    discountType: 'fixed',
    percent: 0,
    value: 50,
    minCompletedOrders: 1,
  })
})

test('normalizeCartReward maps a percent row', () => {
  const reward = normalizeCartReward({
    id: 'r2',
    code: 'P10',
    title: '10% Off',
    description: '10% off your cart',
    discount_type: 'percent',
    discount_value: 0,
    discount_percent: 10,
  })
  assert.equal(reward.discountType, 'percent')
  assert.equal(reward.percent, 10)
  assert.equal(reward.value, 0)
})

test('normalizeCartReward rejects an unknown type as fixed', () => {
  const reward = normalizeCartReward({ discount_type: 'bogus', discount_value: 25 })
  assert.equal(reward.discountType, 'fixed')
  assert.equal(reward.value, 25)
})

test('normalizeCartReward returns null for non-objects', () => {
  assert.equal(normalizeCartReward(null), null)
  assert.equal(normalizeCartReward('x'), null)
})

test('fetchAvailableCartRewards maps rows and drops invalid entries', async () => {
  const client = {
    async rpc() {
      return { error: null, data: [{ id: 'r1', title: 'A', discount_type: 'fixed', discount_value: 20 }, null, 'junk'] }
    },
  }
  const rewards = await fetchAvailableCartRewards(client)
  assert.equal(rewards.length, 1)
  assert.equal(rewards[0].title, 'A')
})

test('fetchAvailableCartRewards throws the rpc error', async () => {
  const client = {
    async rpc() {
      return { error: new Error('boom'), data: null }
    },
  }
  await assert.rejects(fetchAvailableCartRewards(client), /boom/)
})

test('fetchAvailableCartRewards treats a non-array result as empty', async () => {
  const client = {
    async rpc() {
      return { error: null, data: null }
    },
  }
  assert.deepEqual(await fetchAvailableCartRewards(client), [])
})

test('calculateCartRewardDiscount returns 0 while the server is not ready', () => {
  assert.equal(CART_REWARD_SERVER_READY, false)
  const fixed = normalizeCartReward({ discount_type: 'fixed', discount_value: 50 })
  assert.equal(calculateCartRewardDiscount(fixed, 650), 0)
})

test('computeCartRewardDiscount returns 0 without a reward', () => {
  assert.equal(computeCartRewardDiscount(null, 650), 0)
})

test('computeCartRewardDiscount clamps a fixed reward to the subtotal', () => {
  const fixed = normalizeCartReward({ discount_type: 'fixed', discount_value: 50 })
  assert.equal(computeCartRewardDiscount(fixed, 30), 30)
  assert.equal(computeCartRewardDiscount(fixed, 650), 50)
})

test('computeCartRewardDiscount applies a percent reward with rounding', () => {
  const percent = normalizeCartReward({ discount_type: 'percent', discount_percent: 10 })
  assert.equal(computeCartRewardDiscount(percent, 924), 92.4)
})

test('formatCartRewardValue formats fixed and percent rewards', () => {
  assert.equal(formatCartRewardValue(null), '')
  assert.equal(formatCartRewardValue(normalizeCartReward({ discount_type: 'fixed', discount_value: 50 })), '₱50')
  assert.equal(formatCartRewardValue(normalizeCartReward({ discount_type: 'percent', discount_percent: 10 })), '10% OFF')
})
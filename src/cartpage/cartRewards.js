export const CART_REWARD_SERVER_READY = false

export const REWARD_TYPES = {
  FIXED: 'fixed',
  PERCENT: 'percent',
}

export function normalizeCartReward(raw) {
  if (!raw || typeof raw !== 'object') return null
  const discountType = raw.discount_type === REWARD_TYPES.PERCENT
    ? REWARD_TYPES.PERCENT
    : REWARD_TYPES.FIXED
  const percent = Math.max(0, Math.round((Number(raw.discount_percent) || 0) * 100) / 100)
  const value = Math.max(0, Math.round((Number(raw.discount_value) || 0) * 100) / 100)
  return {
    id: raw.id || null,
    code: raw.code || '',
    title: raw.title || 'Reward',
    description: raw.description || '',
    discountType,
    percent: discountType === REWARD_TYPES.PERCENT ? percent : 0,
    value: discountType === REWARD_TYPES.FIXED ? value : 0,
    minCompletedOrders: Math.max(0, Number(raw.min_completed_orders) || 0),
  }
}

export async function fetchAvailableCartRewards(client) {
  const result = await client.rpc('get_available_cart_rewards')
  if (result.error) throw result.error
  const rows = Array.isArray(result.data) ? result.data : []
  return rows.map(normalizeCartReward).filter(Boolean)
}

export function computeCartRewardDiscount(reward, subtotal) {
  if (!reward) return 0
  const base = Math.max(0, Math.round((Number(subtotal) || 0) * 100) / 100)
  if (reward.discountType === REWARD_TYPES.PERCENT) {
    return Math.round(base * reward.percent / 100 * 100) / 100
  }
  return Math.min(base, reward.value)
}

export function calculateCartRewardDiscount(reward, subtotal) {
  if (!CART_REWARD_SERVER_READY) return 0
  return computeCartRewardDiscount(reward, subtotal)
}

export function formatCartRewardValue(reward) {
  if (!reward) return ''
  if (reward.discountType === REWARD_TYPES.PERCENT) {
    return `${reward.percent}% OFF`
  }
  return `₱${reward.value.toLocaleString('en-PH')}`
}
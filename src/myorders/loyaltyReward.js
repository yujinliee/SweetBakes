export const LOYALTY_DOWN_PAYMENT_PERCENT = 20
export const LOYALTY_REQUIRED_COMPLETED_ORDERS = 2

const numberOr = (value, fallback = 0) => { const number = Number(value); return Number.isFinite(number) ? number : fallback }
const nonNegativeInteger = (value) => Math.max(0, Math.floor(numberOr(value)))

// Availability is always copied from the server-owned loyalty state. It is
// intentionally never derived from completed orders in the browser.
export function normalizeLoyaltyState(data) {
  return {
    completedOrders: nonNegativeInteger(data?.completed_orders),
    threshold: Math.max(1, nonNegativeInteger(data?.threshold) || LOYALTY_REQUIRED_COMPLETED_ORDERS),
    progress: nonNegativeInteger(data?.progress),
    earnedRewards: nonNegativeInteger(data?.earned_rewards),
    availableRewards: nonNegativeInteger(data?.available_rewards),
    reservedRewards: nonNegativeInteger(data?.reserved_rewards),
    usedRewards: nonNegativeInteger(data?.used_rewards),
    discountPercent: Math.max(0, numberOr(data?.discount_percent, LOYALTY_DOWN_PAYMENT_PERCENT)),
  }
}

export function calculateRewardPreview(requiredDownPayment, discountPercent = LOYALTY_DOWN_PAYMENT_PERCENT) {
  const originalDownPayment = Math.max(0, Math.round(numberOr(requiredDownPayment) * 100) / 100)
  const percent = Math.max(0, numberOr(discountPercent, LOYALTY_DOWN_PAYMENT_PERCENT))
  const discountAmount = Math.round(originalDownPayment * (percent / 100) * 100) / 100
  return { originalDownPayment, discountAmount, payableAmount: Math.max(0, Math.round((originalDownPayment - discountAmount) * 100) / 100), percent }
}

export function clientAmountMatchesServer(clientAmount, serverPayableAmount) {
  if (clientAmount === null || clientAmount === undefined || clientAmount === '') return { provided: false, matches: true }
  const client = Number(clientAmount)
  const server = Math.round((numberOr(serverPayableAmount) || 0) * 100) / 100
  if (!Number.isFinite(client) || client <= 0) return { provided: true, matches: false }
  return { provided: true, matches: Math.abs(Math.round(client * 100) / 100 - server) <= 0.009 }
}

export function getCustomDownPaymentState(order) {
  const originalDownPayment = Math.max(0, Math.round(numberOr(order?.required_down_payment) * 100) / 100)
  const total = Math.max(0, Math.round(numberOr(order?.total) * 100) / 100)
  const rewardApplied = Boolean(order?.loyalty_reward_applied)
  const persistedDue = Number(order?.payment_amount_due)
  const hasPersistedSession = Number.isFinite(persistedDue) && persistedDue > 0
  const discountAmount = rewardApplied ? Math.max(0, Math.round(numberOr(order?.loyalty_discount_amount) * 100) / 100) : 0
  const payableAmount = hasPersistedSession ? Math.max(0, Math.round(persistedDue * 100) / 100) : originalDownPayment
  const amountPaid = Math.max(0, Math.round(numberOr(order?.amount_paid) * 100) / 100)
  const paid = ['paid', 'verified', 'payment_verified'].includes(String(order?.payment_status || '').toLowerCase())
  return {
    originalDownPayment, total,
    percent: rewardApplied ? numberOr(order?.loyalty_discount_percent, LOYALTY_DOWN_PAYMENT_PERCENT) : LOYALTY_DOWN_PAYMENT_PERCENT,
    discountAmount, payableAmount, amountPaid,
    remainingBalance: Math.max(0, Math.round((total - amountPaid) * 100) / 100),
    rewardApplied, hasPersistedSession, paid,
  }
}

export function getRegularPaymentDisplayAmount(order) {
  const paid = Math.max(0, Math.round(numberOr(order?.amount_paid) * 100) / 100)
  const due = Math.max(0, Math.round(numberOr(order?.payment_amount_due) * 100) / 100)
  const total = Math.max(0, Math.round(numberOr(order?.total) * 100) / 100)
  const paymentStatus = String(order?.payment_status || '').toLowerCase()
  if (['paid', 'verified', 'payment_verified'].includes(paymentStatus) && paid > 0) return paid
  if (Boolean(order?.loyalty_reward_applied) && due > 0) return due
  return total
}

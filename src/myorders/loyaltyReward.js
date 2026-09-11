export const LOYALTY_DOWN_PAYMENT_PERCENT = 20
export const LOYALTY_REQUIRED_COMPLETED_ORDERS = 2

export function isLoyaltyEligible(completedOrdersCount) {
  return Number(completedOrdersCount) >= LOYALTY_REQUIRED_COMPLETED_ORDERS
}

// Display-floor calculation. The server recomputes every value authoritatively
// from auth.uid() -> completed orders; nothing here is payment authority.
export function calculateLoyaltyReward(requiredDownPayment, completedOrdersCount) {
  const originalDownPayment = Math.max(0, Math.round((Number(requiredDownPayment) || 0) * 100) / 100)
  const eligible = isLoyaltyEligible(completedOrdersCount)
  const discountAmount = eligible
    ? Math.round(originalDownPayment * (LOYALTY_DOWN_PAYMENT_PERCENT / 100) * 100) / 100
    : 0
  const payableAmount = Math.max(0, Math.round((originalDownPayment - discountAmount) * 100) / 100)
  return { eligible, originalDownPayment, discountAmount, payableAmount, percent: LOYALTY_DOWN_PAYMENT_PERCENT }
}

// Guard the exact same rule the Edge Function applies: a client-supplied amount
// is only accepted when it matches the server-calculated payable amount.
export function clientAmountMatchesServer(clientAmount, serverPayableAmount) {
  if (clientAmount === null || clientAmount === undefined || clientAmount === '') {
    return { provided: false, matches: true }
  }
  const client = Number(clientAmount)
  const server = Math.round((Number(serverPayableAmount) || 0) * 100) / 100
  if (!Number.isFinite(client) || client <= 0) {
    return { provided: true, matches: false }
  }
  const roundedClient = Math.round(client * 100) / 100
  return { provided: true, matches: Math.abs(roundedClient - server) <= 0.009 }
}

// Derive the full down-payment display state from persisted backend fields only,
// so My Orders survives refresh without trusting frontend state or re-applying
// an unlocked reward by accident.
export function getCustomDownPaymentState(order, completedOrdersCount = 0) {
  const originalDownPayment = Math.max(0, Math.round((Number(order?.required_down_payment) || 0) * 100) / 100)
  const total = Math.max(0, Math.round((Number(order?.total) || 0) * 100) / 100)
  const rewardApplied = Boolean(order?.loyalty_reward_applied)
  const persistedDue = Number(order?.payment_amount_due)
  const hasPersistedSession = Number.isFinite(persistedDue) && persistedDue > 0
  const discountAmount = rewardApplied
    ? Math.max(0, Math.round((Number(order?.loyalty_discount_amount) || 0) * 100) / 100)
    : 0
  const payableAmount = hasPersistedSession
    ? Math.max(0, Math.round(persistedDue * 100) / 100)
    : originalDownPayment
  const amountPaid = Math.max(0, Math.round((Number(order?.amount_paid) || 0) * 100) / 100)
  const paid = ['paid', 'verified', 'payment_verified'].includes(String(order?.payment_status || '').toLowerCase())
  const remainingBalance = Math.max(0, Math.round((total - amountPaid) * 100) / 100)
  const eligible = isLoyaltyEligible(completedOrdersCount)
  const percent = rewardApplied
    ? Number(order?.loyalty_discount_percent) || LOYALTY_DOWN_PAYMENT_PERCENT
    : LOYALTY_DOWN_PAYMENT_PERCENT
  return {
    originalDownPayment,
    total,
    percent,
    discountAmount,
    payableAmount,
    amountPaid,
    remainingBalance,
    rewardApplied,
    hasPersistedSession,
    paid,
    eligible,
  }
}
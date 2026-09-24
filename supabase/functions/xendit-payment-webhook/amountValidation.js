export function expectedPaymentAmount(order, isRegularPayment) {
  if (isRegularPayment) {
    const payable = Number(order.payment_amount_due)
    return Number.isFinite(payable) && payable > 0 ? payable : Number(order.total)
  }
  const downPayment = Number(order.payment_amount_due)
  return Number.isFinite(downPayment) && downPayment > 0
    ? downPayment
    : Number(order.required_down_payment)
}

export function paymentAmountMatches(expectedAmount, providerAmount) {
  return Number.isFinite(expectedAmount) && Number.isFinite(providerAmount)
    && Math.round(expectedAmount * 100) === Math.round(providerAmount * 100)
}

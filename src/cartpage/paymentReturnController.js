import { CART_PAYMENT_RETURN_STORAGE_KEY, isVerifiedPayment, logPaymentReturn } from './paymentConfirmation.js'

export function startPaymentReturn({ storage, verify, loadDetails, onState, onConfirmed,
  schedule = setTimeout, unschedule = clearTimeout, log = logPaymentReturn }) {
  let active = true, timer, attempt = 0
  const stop = () => { active = false; unschedule(timer) }
  const fail = (stage, error = {}) => {
    if (!active) return
    log(`${stage}-error`, { httpStatus: error.httpStatus ?? error.context?.status, errorCode: error.code })
    onState({ status: 'error', stage })
  }
  const run = async () => {
    let receipt
    try {
      receipt = JSON.parse(storage.getItem(CART_PAYMENT_RETURN_STORAGE_KEY) || 'null')
      if (!receipt || typeof receipt.orderId !== 'string' || !receipt.orderId.trim()
        || (Object.hasOwn(receipt, 'guestEmail') && (typeof receipt.guestEmail !== 'string' || !receipt.guestEmail.trim()))) {
        throw Object.assign(new Error(), { code: 'INVALID_RETURN_CONTEXT' })
      }
    } catch (error) { fail('context', error); return }
    log('context-loaded', { contextFound: true, hasGuestEmail: Boolean(receipt.guestEmail) })
    onState({ status: 'checking' })
    log('verification-started')
    const poll = async () => {
      if (!active) return
      attempt++
      let result
      try {
        result = await verify(receipt)
        if (!active) return
        if (result.error) throw result.error
        if (result.data?.orderId !== receipt.orderId || typeof result.data?.paymentStatus !== 'string') {
          throw Object.assign(new Error(), { code: 'INVALID_STATUS_CONTRACT' })
        }
      } catch (error) { fail('verification', error); return }
      log('verification-response', { attempt, paymentStatus: result.data.paymentStatus })
      if (isVerifiedPayment(result.data.paymentStatus)) {
        let order
        try {
          order = await loadDetails(receipt, result.data)
          if (!active) return
          if (!order) throw Object.assign(new Error(), { code: 'DETAILS_UNAVAILABLE' })
        } catch (error) { fail('details', error); return }
        log('details-loaded')
        onConfirmed(order, receipt)
        return
      }
      if (!['unpaid', 'pending', 'partial'].includes(result.data.paymentStatus)) {
        fail('verification', { code: 'PAYMENT_NOT_VERIFIED' })
        return
      }
      if (attempt >= 8) {
        log('verification-timeout', { attempt })
        onState({ status: 'timeout' })
        return
      }
      timer = schedule(() => { void poll() }, 1500)
    }
    await poll()
  }
  // Deferring also lets StrictMode cleanup invalidate the abandoned first setup.
  timer = schedule(() => { if (active) void run() }, 0)
  return stop
}

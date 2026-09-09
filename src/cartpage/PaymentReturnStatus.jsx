export default function PaymentReturnStatus({ state, onRetry }) {
  if (!state || state.status === 'verified') return null
  return <section className="cart-payment-return-panel" role="status" aria-live="polite">
    <strong>{state.status === 'checking' ? 'Confirming your payment...' : state.status === 'timeout' ? "We're still confirming your payment." : "We couldn't confirm your payment automatically."}</strong>
    {state.status !== 'checking' ? <>
      <p>{state.stage === 'context' ? 'The saved payment reference is missing or unavailable. Try again in the browser used for checkout, or use Track Order or My Orders.' : 'Your cart is unchanged. Check the same payment again or check My Orders or Track Order shortly.'}</p>
      <button type="button" className="cart-summary-browse-button" onClick={onRetry}>{state.status === 'timeout' ? 'Check Payment Again' : 'Try Again'}</button>
    </> : null}
  </section>
}

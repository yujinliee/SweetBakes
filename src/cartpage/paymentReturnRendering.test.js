import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithOxc } from 'vite'

async function compile(code, name, scope = {}) {
  const result = await transformWithOxc(code, 'return-render-test.jsx', { jsx: { runtime: 'classic' } })
  return new Function('React', ...Object.keys(scope), `${result.code}\nreturn ${name}`)(React, ...Object.values(scope))
}
const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8').replaceAll('\r\n', '\n')
const modal = await compile(read('../components/PaymentSuccessModal.jsx').replace(/^import .*$/gm, '').replace('export default function', 'function'), 'PaymentSuccessModal', {
  useLayoutEffect: React.useLayoutEffect, useRef: React.useRef, itemImage: () => '', itemFallback: () => '/image.png',
})
const panel = await compile(read('./PaymentReturnStatus.jsx').replace('export default function', 'function'), 'PaymentReturnStatus')

test('actual CartPage empty-cart render includes the unchanged success modal and canonical items', async () => {
  const source = read('./CartPage.jsx')
  const start = source.indexOf('  const paymentReturnUI =')
  const end = source.indexOf('\n  return (\n    <div className="page-shell cart-page-shell">', start)
  assert.ok(start >= 0 && end > start)
  // Compile the real JSX selection, including the empty-cart early return that
  // previously made the success modal unreachable after clearCart().
  const Render = await compile(`function Render() { ${source.slice(start, end)} return null }`, 'Render', {
    cartProducts: [], guestPaymentStatus: 'success', guestPaymentVerified: true,
    confirmedOrder: { order_number: 'SB-123', payment_status: 'paid', total: 120, order_method: 'pickup', order_items: [{ product_name: 'Flan', quantity: 1, unit_price: 120, subtotal: 120 }] },
    confirmationIsGuest: true, guestTrackingEmail: '', paymentReturnState: { status: 'verified' },
    PaymentSuccessModal: modal, PaymentReturnStatus: panel, SiteTopbar: () => null,
    onNavigate() {}, onCustomerLogout() {}, isCustomerAuthenticated: false,
  })
  const html = renderToStaticMarkup(React.createElement(Render))
  assert.match(html, /Your cart is empty/)
  assert.match(html, /Payment Successful/)
  assert.match(html, /SB-123/)
  assert.match(html, /Flan/)
  assert.match(html, /Track Order/)
})

test('technical errors and timeouts have visible same-payment retry actions', () => {
  const error = renderToStaticMarkup(React.createElement(panel, { state: { status: 'error', stage: 'verification' }, onRetry() {} }))
  assert.match(error, /confirm your payment automatically/)
  assert.match(error, /Try Again/)
  const timeout = renderToStaticMarkup(React.createElement(panel, { state: { status: 'timeout' }, onRetry() {} }))
  assert.match(timeout, /still confirming your payment/)
  assert.match(timeout, /Check Payment Again/)
  const missing = renderToStaticMarkup(React.createElement(panel, { state: { status: 'error', stage: 'context' }, onRetry() {} }))
  assert.match(missing, /saved payment reference is missing/)
})

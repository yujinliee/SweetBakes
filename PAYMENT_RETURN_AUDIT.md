# Payment return integration audit

## Proven breakpoints

The prior timeout change did not correct the integration contract. This audit downloaded production source using the Supabase CLI, rather than inferring deployment from the repository.

Project: xnroknyycvqcnjzkmvlm. Function: create-cart-xendit-payment. Deployed version: 7; ACTIVE; verify_jwt: false. Downloaded source SHA256: A890C93C51080FCD01010CBD7A3F5B3F6B43626C849B951445EEB6F9F2A9064F.

The downloaded source and local source differ by exactly one response line:

- **Deployed v7:** statusOnly returns { orderId: order.id, paymentStatus }.
- **Local:** statusOnly returns { orderId: order.id, orderNumber: order.order_number, customerId: order.customer_id, paymentStatus }.

The old frontend's loadGuestConfirmation guard required status.orderNumber. Production v7 never supplies it. Thus even a paid result deterministically returns null before track_guest_order, clearCart, or opening the modal. Repeated polling cannot repair this contract. The current local Edge Function must be deployed.

A second proven defect was the CartPage early return when cartProducts.length === 0. PaymentSuccessModal existed only below that early return. Once verification did clear the cart, rendering selected the empty page and hid the modal despite saved confirmation state. The same confirmation/status UI now renders in both branches. PaymentSuccessModal design is unchanged.

A separate authorization integration problem was reproduced with the installed SDK and locally configured legacy anonymous API key: functions.invoke adds Authorization: Bearer <anonymous API key>. Both downloaded and local functions treat any Authorization header as a customer session and call auth.getUser; an anonymous API key is not a customer session. The revised guest status-only request sends the API key in apikey and no Authorization header, reaching the existing protected guest lookup. It does not change payment creation. Guest detail RPC calls also use a stateless guest client rather than inheriting a restored account. Production frontend key format for the user's particular failed session was not inspected, so this is not claimed as its observed HTTP failure.

## Same-order trace

1. Pay Now invokes handlePayNow. Form/availability validation runs first. getCheckoutSession awaits session restoration and verifies an existing session via getUser. customerId is session.user.id or null.
2. reusableCartOrder uses pendingOrderIdRef.current only for the same customerId. Otherwise create_order_safe returns a scalar string createdOrderId. orderId = createdOrderId; pendingOrderIdRef.current = { orderId, customerId }.
3. getCartOrderReference checks that same orderId. Authenticated checkout reads its owned order row; guest checkout invokes the existing status-only endpoint with { orderId, statusOnly: true, guestEmail }. The reference assertion verifies the identifier and ownership. The legacy production response omits orderNumber for guests; the existing ownership helper accepts that legacy response.
4. Payment creation calls create-cart-xendit-payment with { orderId, guestEmail } for guests, or { orderId } plus the verified customer Bearer token for authenticated checkout. The same database UUID is used, not the cart item identifier or order number.
5. The Edge Function loads that orders.id, checks ownership/email/age and eligibility, and creates the Xendit session. Its response is { paymentId, referenceId, status, paymentUrl }. The frontend uses paymentUrl to navigate; provider status is never treated as proof of paid payment.
6. Before window.location.assign(paymentData.paymentUrl), savePaymentReturnContext writes and reads back localStorage key sweetbakes:cart-payment-return-v1. Guest value is { orderId, guestEmail }; authenticated value is { orderId }. No customer objects or provider secrets are saved.
7. Both deployed and local sessionPayload use success_return_url = appOrigin + /cart?payment=success for guests, or appOrigin + /my-orders?payment=success&order=<encoded database UUID> for authenticated checkout. Cancellation uses payment=cancelled. appOrigin is new URL(SWEET_BAKES_APP_URL).origin and must use HTTPS. The production secret's value and this latest failed browser session's literal URL were not inspected; the hardcoded CORS host is not evidence of the environment value.
8. CartPage reads payment from window.location.search. Exactly success starts the controller. The controller parses the existing storage key and validates nonempty string orderId and, when present, guestEmail. The saved context selects the path, not the cached isCustomerAuthenticated flag. An orderId-only context requires an awaited, verified customer session; it never falls back to guest authorization.
9. Guest verification sends POST /functions/v1/create-cart-xendit-payment with JSON { orderId: receipt.orderId, guestEmail: receipt.guestEmail, statusOnly: true }, the public API key, and no customer Authorization header. Authenticated verification sends { orderId, statusOnly: true } with the verified session Bearer token. No return-controller path creates an order or payment session.
10. The controller requires response.data.orderId === receipt.orderId and a string data.paymentStatus. HTTP success alone does not qualify. isVerifiedPayment is shared with MyOrdersPage.
11. For a paid guest result, status.orderNumber is required. Its absence raises a details error (MISSING_ORDER_NUMBER_CONTRACT), rather than a timeout. track_guest_order receives { p_order_number: status.orderNumber, p_email: receipt.guestEmail.trim().toLowerCase() }. Its canonical result must contain the matching order_number, a verified payment_status, and nonempty order_items. Authenticated detail loading reads the owned order and its saved items.
12. On confirmation: setConfirmedOrder(canonicalOrder); retain guest/action state; clearCart(); setGuestPaymentVerified(true); mark return state verified; consume transient storage. The modal reads confirmedOrder, independently of the cart. URL cleanup removes the payment query after confirmed success or known cancellation.

## Edge contract and authorization

For pending and paid orders, local statusOnly response shape is identical; paymentStatus is the lowercased orders.payment_status, for example pending or paid. Production v7 has the smaller response described above. This mismatch is proven from downloaded source, not a guessed schema.

- No Authorization header: requires guestEmail, matching orders.id, NULL customer_id, matching email (trimmed/case-insensitive), and order creation within 24 hours.
- Authorization header: requires a valid customer JWT, and the loaded order must belong to that user. Invalid authorization returns 401, not a guest fallback.
- Invalid input or missing guest email: 400 with { error }.
- Missing/inaccessible order or mismatched guest identity: 404 with { error }.
- Order query error: 500 with { error, code, message }.
- Gateway JWT verification is disabled in the deployed function configuration; application-level checks above still apply.

No backend authorization, RLS, webhook validation, or order ownership rule was weakened. Diagnostic output includes stages, status, allowlisted error-code syntax, and booleans, never server message bodies or personal values.

## Lifecycle and stopping conditions

Previously Cart's effect depended on guestPaymentStatus and isCustomerAuthenticated, and returned immediately when the cached customer flag was true. Both verification and its visible pending notice could be skipped while auth state was being restored. The new Cart effect depends on guestPaymentStatus and verificationAttempt. It does not restart or abort merely because account UI state changes.

Controller work starts in a cancellable scheduled callback. Cleanup disables the abandoned run and clears its scheduled timer; results after cleanup are ignored. This handles development StrictMode's setup/cleanup/setup and real navigation/unmount. No evidence showed a production StrictMode double-effect issue; the definite rendering problem was the empty-cart early return.

The effect does not run for a missing/different payment query or cancellation. On success URLs, malformed/missing context becomes a visible context error; HTTP/SDK/contract failures become verification errors; missing or invalid canonical detail data becomes a details error. Pending/unpaid/partial statuses poll up to the existing eight attempts with 1.5-second gaps. A still-pending final attempt is a timeout, not a failed payment. Other nonverified terminal statuses cannot clear the cart. No polling-window extension was made.

The status panel is above checkout and also present on the empty-cart branch. It shows Confirming your payment, a technical failure with Try Again, or pending timeout with Check Payment Again. Retry increments verificationAttempt and reruns verification for the same saved order. It never invokes handlePayNow or create_order_safe. Missing context cannot be reconstructed safely; its message directs the customer to the original checkout browser or order tracking while allowing another storage read on retry. Authenticated My Orders has the same visible retry panel and no longer labels technical exceptions as pending timeout.

Context and return query remain through verification errors, missing details, and timeout. They are consumed after verified confirmation or known cancellation. Native history.replaceState cleanup does not dispatch the App navigation function or popstate; clearing cart triggers a store rerender, not component unmount. A deliberate navigation may unmount CartPage, which is expected. Success UI exists in both cart-render branches.

## Canonical status

The latest checked-in orders_payment_status_check permits unpaid, pending, partial, paid, failed, refunded. isVerifiedPayment also retains existing compatibility equivalents verified and payment_verified; these are not newly invented schema values. The checked-in webhook recognizes payment_session.completed, validates the payment, and writes orders.payment_status = paid. payment_session.expired does not write paid. No webhook source was modified or deployed. The specific failed order row and its webhook timestamps were not queried; neither source inspection nor unit tests prove that particular payment was paid.

## Files changed

- src/cartpage/CartPage.jsx: context-selected verification, stable lifecycle, same-order retry, confirmation in both render branches.
- src/cartpage/CartPage.css: visible return-status panel only.
- src/cartpage/PaymentReturnStatus.jsx: checking/error/timeout messages and retry actions.
- src/cartpage/paymentReturnController.js: testable bounded verification and error classification.
- src/cartpage/guestPaymentStatus.js: secure anonymous status transport and stateless detail client.
- src/cartpage/paymentConfirmation.js: structured diagnostics; shared verified-status helper retained.
- src/cartpage/paymentReturnFlow.test.js: controller, contract, cleanup, retry, transport and cancellation regressions.
- src/cartpage/paymentReturnRendering.test.js: actual empty-cart JSX with unchanged modal; visible error/timeout panels.
- src/myorders/MyOrdersPage.jsx: shared status helper and visible technical-error retry.
- PAYMENT_RETURN_AUDIT.md: this report, replacing the incomplete prior diagnosis.

No Edge Function source edit was needed: the required response expansion is already present locally but absent from deployed version 7.

## Verification and deployment

CODE CORRECTED: response mismatch identified with the existing local function ready to deploy; unreachable empty-cart success UI fixed; auth-flag skip removed; guest status transport corrected; real failures classified and retry exposed.

VERIFIED: 43 automated tests across cart, order history, and status services; controller tests reproduce the exact v7 paid response failure and successful complete contract; JSX rendering proves the actual empty-cart branch includes Payment Successful, order number, and canonical items. Tests cover missing context, thrown/HTTP errors, bounded pending status, same-ID retry, cancellation, and cleanup before/during async work. Changed-file lint and production build pass. Build reports the existing large-bundle warning. These are mocked/local tests, not a live payment test.

Required deployments (none performed):

A. Frontend GitHub/Vercel: YES.
B. create-cart-xendit-payment: YES. Run from this repository:

    npx supabase functions deploy create-cart-xendit-payment --project-ref xnroknyycvqcnjzkmvlm

C. xendit-payment-webhook: NO.
D. Database migration: NO.

STILL REQUIRES LIVE VERIFICATION: deploy the local payment function and frontend, then verify a real Xendit return with a paid database order. Confirm statusOnly includes orderNumber, the detail lookup succeeds, cart clears, modal remains visible, and actions work. Also check cancellation and same-order retry. The literal failed-session URL, production SWEET_BAKES_APP_URL value, and that order's webhook timing remain unobserved. Production is not claimed fixed before deployment and this live verification.

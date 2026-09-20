# Premium pass integration checkpoint — 20 September 2026

Not a live deployment. No customer access or Stripe object changed.

## Implemented and locally tested

- `premium_stripe_adapter`: receives the original raw Buffer and verifies the
  Stripe signature with the SDK; never trusts checkout data submitted by a browser.
- Retrieves Checkout and expanded price/product server-side; pins EUR1490,
  one-time payment, product, price, mode and offer metadata. Handles completed and
  asynchronous paid events; unpaid sessions grant nothing. Purchase identity makes
  duplicates harmless even if the process restarts between receipt and response.
- Refunds are re-read from Stripe and scoped back to the exact checkout. A full
  refund revokes the paid and referral grants, including out-of-order events.
  Partial refunds are durable review items, not automatic full revocations.
- Checkout creation is off by default. It checks an active matching price/product,
  has no subscription/recurrence parameters, and returns only the actual Stripe URL.
- `premium_access_projection`: repeatable reconciliation into owned codes rows,
  exact expiry, with no replacement of legacy or administrator rights.

## Mandatory wiring before sale

1. Dedicated verified one-time offer; do not reuse the legacy 10/day product.
2. Inject a real historical-paid-customer lookup (not all registered free users).
3. HTTP raw-body signature path before JSON parser; the adapter errors must remain
   retryable on transient server/provider failures. Never acknowledge a failed grant.
4. Reconcile managed accounts after each grant/refund and before authenticated
   entitlement reads, including referrer grants and startup recovery.
5. Preserve legacy billing paths; new sessions must not reach old code/email logic.
6. Separate unlimited validated-signal viewing from existing manual computation
   credit counters; do not disable the global provider spend guard.
7. Link a verified Telegram user to each buyer; join and expiry must not interfere
   with the existing admin bot consumer or revoke unidentified historical members.
8. Wire consented, deduplicated Brevo reminders and preference routes. Provider
   acceptance is not proof of receipt; do not advertise personal winnings.
9. Complete real Stripe test-environment E2E, without a live payment. The currently
   connected account exposes live mode only. Then protected deployment and readback.

## Reproduce tests

Run `node scripts/test_premium_month_pass.js`, `test_premium_stripe_adapter.js`,
`test_premium_access_projection.js`, `test_premium_lifecycle.js`, and
`test_live_session.js` (each with the `scripts/` prefix). SQLite uses better-sqlite3
or Node24 built-in SQLite in tests. Signature test requires Stripe SDK; tested with
22.4.0 installed outside the application checkout. Production dependencies unchanged.
The general React suite finds no tests and exits1; it is not reported as green.

Provider reference: https://docs.stripe.com/checkout/fulfillment

No tagalog artifact is allowed in a public publication bundle.

# Premium calendar-month pass — confirmed specification and implementation plan

Confirmed by Greg: EUR14.90 buys one calendar month, no automatic renewal;
all validated signals, no daily quota or minimum; five distinct J-5..J-1
reminders; one referral month to the referrer only after a NEW customer pays.
No real payments, no secret changes, no changes to historical subscriptions.
Site/app and Telegram must use the same entitlement deadline. Marketing must
show losses and label flat-EUR10 simulations, never imply personal winnings.

## Global constraints
Work on the existing isolated feature checkout. Preserve untracked work.
Do not enable the new sale until the full payment/access/expiry chain is tested.
Retrieve actual Stripe product/price data; never repurpose another product.
No mass removal of historical Telegram members without verified identity.
Use signature-verified Stripe events and server-retrieved payment objects.

## Task 1: transactional entitlement core
Files: scripts/premium_month_pass.js, scripts/test_premium_month_pass.js.
Interfaces: verified Stripe checkout/price -> payment grant -> entitlement.
Write failing tests, run node scripts/test_premium_month_pass.js (expected FAIL),
implement and run again (expected PASS). Cover calendar end-of-month, UTC
deadline, amount/product/mode mismatch, unpaid events, double delivery,
self-referral, repeat customer, referrer-only reward, refund-before-payment,
refund reversal, transaction failure and missing odds. No external side effects.

## Task 2: production read-only prerequisites
File: .github/workflows/tlm-month-pass-preflight.yml.
Inspect Stripe webhook coverage, bot permissions/webhook ownership, billing
configuration and schema. Output booleans and nonsecret identifiers only.
Expected: successful workflow with evidence or precise blocker, no mutations.

## Task 3: integration and lifecycle delivery
Only after Task 2: dedicated one-time product/price, signature-verified webhook
adapter, account projection, five durable Brevo reminders, authenticated
Telegram binding/join/expiry, synchronized offer and FR/RU copy. Tests use
fake transports and fixture accounts, never real payments/customer messages.
Integration must preserve legacy billing and recover from partial failures.

## Task 4: review and guarded release
Fresh whole-change review; reproduce/fix important findings with tests.
Back up exact served files/data, stage narrow patches, tests, commit/push,
deploy, read-back verify. No release claim before all activation gates pass.

## Review focus
Forged grants; duplicate events; partial refund policy; historical customers
mistaken for new referrals; delayed events; existing admin/lifetime accounts;
DST and month-end; unknown Telegram identity; unconsented marketing; actual
received message vs queue acknowledgement; existing subscriber regressions.

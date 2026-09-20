# SDD ledger — plan: docs/superpowers/plans/2026-09-20-premium-month-pass.md

Baseline: 8252a61. Native implementation explicitly authorized by user.
Pre-flight: Task1 produces grants/deadlines consumed by Task3; Task2 must
verify external prerequisites before Task3 activation. No conflicting fields.
Ruling: use tracked progress ledger because bash helper is unavailable on this
Windows host; same per-task RED/GREEN and review gates, no completion shortcut.
Task1 core tests: RED missing module, then GREEN via
`node scripts/test_premium_month_pass.js`; `node --check` passes.
Core is NOT connected to production: account projection and integration remain Task3.
Ruling: full refunds revoke purchase plus its referral grant; partial refunds
are marked needsReview without automatic revocation, avoiding accidental full
withdrawal for a goodwill partial refund. Activation must surface this review.
Task2: complete, read-only production run 35480440189 succeeded.
Evidence: no matching active one-time Premium product; existing Premium product
is archived with recurring price; other EUR14.90 product is not Premium.
Existing Stripe webhook lacks checkout.session.async_payment_succeeded.
Telegram Premium FR/RU bot can invite/restrict, but SAME token as admin bot.
No configured Telegram webhook; allowed updates message/callback_query only;
8 pending updates left untouched. No customer-Telegram binding exists.
Task3: isolated reminder core prepared, RED missing module then GREEN via
`node scripts/test_premium_lifecycle.js`. Five distinct FR/RU messages, membership
period/delivery evidence filtering, consent, renewal suppression, durable
deduplication and uncertain-send quarantine covered. No Brevo send performed.
Still missing: verified one-time price, signed-event integration/account
projection, real consent/preferences routes, Telegram identity binding and
expiry enforcement, site/app offer updates, staged production release.
Task4: partial-change review pending; production activation NOT approved by tests.

## 2026-09-20 continuation — signed payment and managed account checkpoint

Task3 partial: real Stripe SDK signature verification + server-retrieved Checkout
and price adapter, with replay-safe ledger, async paid events, refunds and legacy
customer referral suppression. Test first failed on missing adapter, then passed.
One-time Checkout builder failed on missing function, then passed. Sales remain
disabled unless a server-only salesEnabled gate is deliberately set.
Managed account projection failed on missing module, then passed: creates only
pass-owned Premium rows, exact UTC expiry, renewal/refund reconciliation, preserves
legacy/admin rows and refuses externally changed ownership.
Ruling: an archived exact pinned price can fulfill an ALREADY paid checkout;
NEW checkout creation still requires active price and product. Otherwise a delayed
Stripe event after an offer change could deny a legitimate paid customer access.
Ruling: preserve the existing 10 manual-model-call budget in projected codes;
unlimited VALIDATED signals is not unlimited paid AI computation. Runtime wiring
must separate signal viewing from manual credits/Telegram delivery counts before
activation, otherwise existing shared-credit logic can conflict with the offer.
Ruling: do not repurpose prod_UwPXjLbjV847eR (current active product is still the
legacy Intensif 10/day offer, verified by Stripe read-only on this turn).
Ruling: no production wiring, new Stripe product, secret, sale, customer email or
Telegram membership modification at this checkpoint. The only connected Stripe
context is live acct_1AdJx2FtcI38Oqdt; requested test-environment connection for
provider-backed fictitious-payment E2E. Local remote transports are fixtures,
signature verification and SQLite are real; no real payment was attempted.
Checks: month-pass, signed adapter, access projection, lifecycle, live-session
suites all PASS. General npm test -- --watchAll=false exits1: no React tests found.
Still required: runtime routes/account read synchronization, historical payer
lookup, consent/preferences, Telegram verified identity/join/expiry, Brevo wiring,
matching dedicated product/price, provider test-mode E2E and guarded release.
Task3 and Task4 are NOT complete. Tagalog must stay private; only FR/EN/RU may publish.

Checkpoint independent review: review_pass_checkpoint read all adapter/projection/
ledger/lifecycle changes. One important finding: a managed Premium row changed
manually to lifetime could be overwritten. Reproduced RED, then fixed GREEN by
tracking last projected expiry/active state and refusing externally changed rows
(also plan, email and manual credits). Old links with no recorded state quarantine.
Final rulings on declined-to-judge items: runtime/auth/raw-body/provider configuration,
historical payer lookup, Telegram binding, concurrent reconciliation scheduling,
Brevo/Telegram receipt and legacy refund dispatch are release gates, NOT approved
by the isolated module tests. Unrelated charge refunds must continue to their
legacy handler; do not route all legacy events through this dedicated adapter.
Actual Stripe creation is fixture-tested only; live sale remains disabled.
No review findings were dismissed as harmless production behavior.

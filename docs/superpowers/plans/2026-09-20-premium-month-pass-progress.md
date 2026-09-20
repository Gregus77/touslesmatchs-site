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
Task2: workflow prepared, awaiting run. Task3: pending. Task4: pending.

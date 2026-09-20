# TLM signal and Premium reliability implementation plan

> Execute natively with executing-plans and test-driven-development; independent final review after bounded changes.

Goal: align server, site/app and Telegram on trustworthy first-half signals and a verified Premium checkout, without promising outcomes.

Spec: owner instructions in this thread and analysis-20260920/Strategie-TousLesMatchs.md in the project root.

Constraints: no secrets changed; no real payments; preserve VPS edits, official snapshots and results; no unsolicited prospect outreach; no automatic new geographical exclusions from exploratory analysis. Snapshot before deployment; abort ambiguous anchors; restore prior files/image on failure.

Architecture: a small pure signal-window policy shared by runtime decisions; existing immutable snapshots remain the official truth. Targeted edits only. Verified existing Stripe price and links, never fabricated identifiers.

Review focus: 45+ stoppage time still first half; HT not open despite minute=45; official signal remains visible after a goal/half-time; stale pre-35 votes not displayed as current; missing odd excluded from money totals.

1. Read-only production preflight: active window functions, snapshot gates, deployment file hashes, recent delivery block reasons, Stripe price/product metadata and payment links (no credentials logged).
2. Signal policy: test before 35, 35, 45+2/1H, HT, second half, missing status; implement first-half-aware eligibility and pre-35 client concealment; maintain frozen official snapshots. Verify concrete server call sites and all targeted tests before deploying.
3. Reanalysis: trace timer and duplicate-snapshot gates on score changes. Test that stale trend triggers a fresh eligible analysis, but official snapshot and HT never trigger retrospective publication. Keep budget guard and bounded concurrency.
4. History: align list-derived outcomes/cotes and totals; test missing odds and official-vs-legacy overrides. Refresh site/app from a shared source at visibility/online events and bounded intervals.
5. Delivery/payment: preserve gating; fix proven publication blockers, test FR/RU free/premium separation and price 1490 EUR monthly against Stripe; test entitlement mechanism without live payment. Report any access/price mismatch instead of substituting a secret or price.
6. Conversion: retain verified 14.90 monthly offer and accurate launch wording; validate working CTA, prepare opt-in prospect messaging without outbound campaign or spending.

Ledger: start at 8bcd749. Existing untracked analysis script belongs to preceding report; exclude it from implementation commits. Full React test command currently discovers no tests; explicit task suites remain required, never claim full suite green.

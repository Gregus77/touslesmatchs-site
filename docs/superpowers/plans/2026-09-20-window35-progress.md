# Signal-window priority 1 execution record

Scope: owner-approved 35 minutes to actual first-half whistle, preserving
published/historical votes and all unrelated payment/email work.
Base: 21eb8f6. Verified local and earlier runtime evidence show 15/30/45 gates
and immediate queue expiry beyond 45. Root cause reproduced before correction.

Tests: test_signal_window_35 RED before35 accepted; UI stoppage incorrectly closed;
snapshot parser returned null for 45+3. All GREEN after targeted corrections.
Review: review_signal_window_35 found collector Number('45+3') and monitoring SQL
excluding minute48. Each reproduced RED then fixed GREEN.
Final local checks: window35, archived votes, coherence, Telegram sender/HT retry,
session reuse, patch idempotence and syntax passed. npm test -- --watchAll=false
finds no React tests and exits1; no claim of global suite passing.

Ruling: integer35..45 IN_PLAY may enter collection; mandatory provider collector
still confirms1H before model data can be used. Beyond45 requires explicit1H
even before collection. This preserves compatibility with normalized providers.
Ruling: existing official legacy snapshots remain displayable under their old
rule; never rewrite historical records to pretend they met the new35 threshold.
No confidence/odds/league change, no secret change, no payment/email activation.
First deployment run35481350692 stopped BEFORE replacing any production file:
homepage has newer decisionText verdict absent from checkout. Public source
inspected; patch now changes four exact window literals only, preserving verdict.
Variant regression reproduced RED then tested GREEN. Next rollout pending.
Run35481407663 stopped before deployment because isolated archive test lacked
public/app.html. Added read-only test dependency; application itself unchanged.
Run35481450502 succeeded at2026-09-20T01:31:17Z: four staged suites passed,
runtime window check passed and served lifecycle asset matches stage.
Backup: /opt/backups/tlm-window35-20260920T012800Z. Commit1251a6f.
Actual newly delivered client message: still pending natural signal evidence.

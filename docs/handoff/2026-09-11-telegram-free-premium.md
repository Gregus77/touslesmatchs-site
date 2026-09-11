# Telegram Gratuit / Premium — 11 septembre 2026

## Scope and preservation

Worktree `/tmp/tlm-telegram-work`, branch `codex/telegram-free-premium-20260911`.
Commit `6b5b61b` snapshots the already modified VPS API and its budget/bookmaker dependencies; it is a preservation prerequisite, not a replacement of the five AI seats by this mission. The following commit contains this mission. The VPS worktree and frontend changes remain untouched by preparation.

## Confirmed destinations

Read-only Telegram getChat confirmed the .env and running API destinations:

| Language | Free | Premium |
|---|---|---|
| FR | TousLesMatchs (`-1003914002109`) | TousLesMatchs Premium (`-1003937354630`) |
| RU | TousLesMatchs БЕСПЛАТНЫЙ (`-1003885393321`) | TousLesMatchs Премиум (`-1004373972665`) |

Premium routing is based on configured PREMIUM_CHANNEL_ID and existing purchase invitation code, not titles alone. Standard FR/RU are distinct archived channels, not these Premium destinations. An obsolete PREMIUM_CHAT_ID alias points to Hermès; never use it for clients. No group/member deletion or subscription migration.

## Delivery behavior

- Existing sports, odds, consensus, confidence and live-window gates are preserved byte-for-byte. Existing Premium/Recovery commercial cap removal is retained.
- One durable queue entry per event/destination; live keys deduplicate match/day, free teaser keys day/destination. FR and RU do not depend on each other's result.
- A positive Telegram message_id is mandatory. Proven signal delivery and its legacy FR flag update commit together. Result/recap deliveries never manufacture signal proof. Standard/Elite markers remain unchanged.
- Explicit Telegram refusal can retry, inside the original bounded live window for signals. Network timeout, unreadable response or interrupted in-flight request is `uncertain`: no blind resend because Telegram has no sendMessage idempotency key. Manual reconciliation is needed for these ambiguous cases.
- Results and previous-day recaps use only deliveries proven for the actual language/channel, including losses. Recaps have bounded pages without dropping rows. The API live path is the sole sports signal publisher; JSON/manual scripts cannot bypass its quality gates.
- Russian templates preserve teams, scores, odds and numbers. The Russian explanation is a deterministic factual summary of observed quorum/confidence, never untranslated French AI prose. 18+ and responsible gaming are present.
- Free messages never contain the exact selection, explanation or odds; affiliate links remain in Premium.

## Stripe blocker and temporary behavior

Actual Stripe read-only results:

- Old link ending `6oU3cvdfK4Fm0JC1yK3VC06`: active **one-time** 1490 EUR price `price_1TwWiXFtcI38Oqdt0ogomRoC`, no recurrence. Not suitable for monthly CTA.
- Requested `price_1UEWOpFtcI38OqdtotvpGZp3`: 404 with the VPS credential.
- Existing `price_1TyZkxFtcI38OqdtOfiEu13I`: active/live, 1490 EUR, month/1.
- Its product `prod_UfJAGDlQDV6xwh` (Premium Touslesmatchs): live but **inactive**.

No Stripe object, existing charge, price or subscription has been modified. Until the configured price AND product validate as active/live, EUR 1490 monthly, new Telegram publications contain no payment URL/button and explicitly state that new subscriptions are temporarily unavailable. A validated future checkout uses locale fr/ru and metadata tlm_language; no currency conversion is promised. Reactivating the product or changing the configured price requires the owner's decision.

## Verification

- Syntax checks and git diff --check.
- Nine targeted tests passed in `/tmp/tlm-telegram-validation`, combining candidate backend with the unchanged current VPS frontend and current VPS window test.
- SQLite tests use the existing API image, network disabled, memory DB: successful message_id, missing message_id, Telegram error, FR success/RU failure then RU-only retry, restart, duplicate queueing, expired signal, 11 Premium signals, no alteration of historic Standard/Elite markers, result deliveries not counted as signal deliveries.
- Actual result router test: FR proof cannot publish a RU result, and vice versa, including losses.
- Inactive/wrong-currency/wrong-amount/nonmonthly/test-mode Stripe mock cases cannot create a Checkout Session; inactive mode emits no payment URL/button.
- Isolated API boot on SQLite backup responded HTTP 200 for public-signal-rules, no external network or real credentials.
- GitHub's old window test fails against the already corrected VPS API; the current VPS test passes before/after. GitHub frontend still contains old Payment Links; the combined offer test passes with the actual VPS frontend. These tests were not disabled.

## Backup and deployment

Initial SQLite online backup + quick_check and restricted configuration backup:
`/opt/touslesmatchs/backups/telegram-free-premium-20260911-2100`.
Before production deployment, take another online SQLite backup and hash-compare each touched VPS source with its preparation snapshot. Build the API from the candidate code, retaining current dependency layers. Replace only changed API/publishing files and Dockerfile.api; preserve the local Compose environment and all frontend files. Recreate only api. Verify all four service states, new server/module hashes, local/public endpoints, new queue schema and sanitized logs. Roll back only the deployed files/image on a technical failure; never restore the whole DB over newly recorded live data.

Production delivery is not validated by mocks/getChat. Without a natural admissible signal and each message_id, report "déployé, livraison réelle en attente".

## Separate out-of-scope findings

The current frontend still contains Standard-related translation keys (public/js/i18n.js) and the old one-time Premium link on Live IA. No design or frontend change was made here. Some cron references (weekly_recap.js, hermes_mail_to_telegram.py) are absent from the repository; no guessed replacement was executed. Council public Telegram is disabled by its existing default; no council code or AI model was changed by this patch.

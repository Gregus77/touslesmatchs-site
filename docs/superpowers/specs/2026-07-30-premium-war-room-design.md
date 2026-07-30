# Premium War Room Design

## Goal

Bring TousLesMatchs closer to the GPT reference image: a premium, dense, data-led sports AI interface, while preserving the live product integrations already in production.

## Scope

- Frontend only for this pass.
- Priority pages: `public/index.html` and `public/live-ia.html`.
- Preserve existing API routes, Stripe links, Telegram links, Brevo capture hooks, localStorage keys, and IDs used by existing JavaScript.
- Do not modify `scripts/api_server.js`, `council/`, Docker, or Telegram routing.

## Direction

Visual thesis: TousLesMatchs is a sports decision room run by five AI agents. The interface should feel like a live control panel: dark navy surface, electric blue/violet highlights, green confidence signals, compact tables, precise cards, and mobile-first dashboard layouts.

Palette:
- Base: `#050914`
- Panel: `#08111f`
- Panel raised: `#0d1829`
- Border: `rgba(148, 163, 184, .18)`
- Signal blue: `#1d9bf0`
- Consensus violet: `#7c3aed`
- Trust green: `#10b981`
- Alert amber: `#f59e0b`

## Page Requirements

Homepage:
- Replace the current first impression with a product dashboard hero, not a stadium hero.
- Show a Concile visual, proof cards, the free daily pick, and subscription cards above the fold.
- Keep the current hidden functional hero IDs intact so existing scripts do not break.
- Make offers feel like dashboard plan cards with clear Standard / Premium / Elite hierarchy.

Live IA:
- Convert the page into an app layout: sidebar filters, central match feed, right access panel.
- Preserve `filters`, `auth-bar`, `matches-wrap`, `tab-live`, `tab-stats`, and history IDs.
- Improve density and table-like alignment without changing the data loading code.

Verification:
- Run `node --check scripts/api_server.js`.
- Run `git diff --check`.
- Validate the edited HTML is still structurally present by searching for the preserved IDs.

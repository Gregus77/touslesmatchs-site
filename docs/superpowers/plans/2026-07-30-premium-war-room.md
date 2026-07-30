# Premium War Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the homepage and Live IA page match the premium GPT dashboard reference without touching production backend, Stripe, Telegram, or Hermes routing.

**Architecture:** Add targeted frontend layers to the existing static HTML files. Preserve all existing JavaScript-owned IDs and backend contracts, and use CSS/markup additions instead of rewriting the large legacy page.

**Tech Stack:** Static HTML, inline CSS, vanilla JavaScript, existing Node backend verification.

## Global Constraints

- Do not edit `scripts/api_server.js`, `council/`, Docker, or Telegram routing for this visual pass.
- Keep existing Stripe hrefs and Telegram hrefs unchanged.
- Keep existing IDs used by scripts: `hero-email-box`, `hero-pick-teaser`, `filters`, `auth-bar`, `matches-wrap`, `tab-live`, `tab-stats`, `history-list`.
- Keep ANJ-safe vocabulary: use "analyse", "pick", "selection", "signal"; do not add "pari" to public copy.
- Use ASCII for newly written copy unless the surrounding file already requires an existing symbol.

---

### Task 1: Homepage Premium Hero

**Files:**
- Modify: `public/index.html`

**Interfaces:**
- Consumes: Existing page nav, Stripe links, Telegram links, legacy hero scripts.
- Produces: A visible `tlm-war-room` hero and hidden legacy `hero-stadium` kept for script compatibility.

- [ ] Add premium hero markup before the legacy `hero-stadium` block.
- [ ] Add CSS for `.tlm-war-room`, `.tlm-concile-core`, `.tlm-screen-card`, and responsive mobile layout.
- [ ] Hide `.hero-stadium` visually but preserve it in the DOM.
- [ ] Confirm `hero-email-box`, `hero-pick-teaser`, and `hero-stats` still exist.

### Task 2: Homepage Offer Cards

**Files:**
- Modify: `public/index.html`

**Interfaces:**
- Consumes: Existing `#plans`, `#plan-carte`, `btn-standard`, `btn-pro`, `btn-elite`.
- Produces: More polished plan-card styling without changing checkout destinations.

- [ ] Add premium CSS overrides for `.plans-section`, `.plans-grid`, `.pc`, `.pc-price`, `.pc-btn`, and `.cmp-table`.
- [ ] Keep all hrefs exactly as they are.
- [ ] Confirm `#plans`, `#plan-carte`, `#btn-standard`, `#btn-pro`, and `#btn-elite` still exist.

### Task 3: Live IA App Layout

**Files:**
- Modify: `public/live-ia.html`

**Interfaces:**
- Consumes: Existing filters, auth bar, match loading, history loading.
- Produces: A dashboard shell with sidebar, match feed, and access panel.

- [ ] Wrap the live tab contents in `.live-dashboard-shell`.
- [ ] Move existing `auth-bar`, `filters`, `refresh-bar`, and `matches-wrap` into stable dashboard columns.
- [ ] Add a right-side access panel using static links to `/dashboard`, `/#plans`, and `/#plan-carte`.
- [ ] Keep the existing modal and tab switching outside the shell.
- [ ] Confirm `filters`, `auth-bar`, `matches-wrap`, and `history-list` still exist.

### Task 4: Verification And Handoff

**Files:**
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: Existing handoff expectations.
- Produces: Clear GitHub handoff note.

- [ ] Run `node --check scripts/api_server.js`.
- [ ] Run `git diff --check`.
- [ ] Run ID-preservation searches for homepage and Live IA.
- [ ] Update `CHANGELOG.md` with the visual pass and the verification boundary.
- [ ] Review `git diff --stat`.

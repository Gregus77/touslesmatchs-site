# Auto Improvement Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TousLesMatchs learn from every prediction by sport, competition, market, and score context, while sending Elite alerts only when the signal is strong and historically supported.

**Architecture:** Reuse the existing `concile_analyses` and `agent_predictions` SQLite tables. Add minimal metadata columns and helper functions in `scripts/api_server.js`, then expose stricter strategy and alert filtering to Hermès without changing the public promise.

**Tech Stack:** Node.js, Express, better-sqlite3, API-Sports live feeds, existing Hermès Telegram bot.

## Global Constraints

- Elite alerts require confidence >= 80/100.
- Elite alerts require enough resolved history before client publication.
- Low-trust competitions, youth/reserve/friendlies, and too-late live states remain excluded.
- Other sports can be observed for learning, but should not become Elite alerts until data proves reliability.
- Results must update the site and history; finished picks must not look playable.

---

### Task 1: Add Learning Metadata

**Files:**
- Modify: `scripts/api_server.js`

**Interfaces:**
- Produces: `getLearningProfile({ sport, competition, bet })`
- Produces: `isLearningProfileSafe(profile, minResolved)`

- [ ] Add `sport`, `learning_tier`, and `learning_note` columns to `concile_analyses`.
- [ ] Save the sport and learning profile on every Concile snapshot.
- [ ] Add confidence penalties when sport/market history is weak.

### Task 2: Harden Elite Alerts

**Files:**
- Modify: `scripts/api_server.js`

**Interfaces:**
- Consumes: `getLearningProfile({ sport, competition, bet })`
- Produces: `/strong-signal-alerts` items with `learningProfile`

- [ ] Require confidence >= 80.
- [ ] Require resolved history by market and sport.
- [ ] Block client-facing alerts for low sample, weak sport, weak competition, or volatile league.

### Task 3: Keep Hermès Honest

**Files:**
- Modify: `scripts/hermes_admin_bot.js`

**Interfaces:**
- Consumes: alert payload `learningProfile`

- [ ] Show sport, history, and block reason in admin alerts.
- [ ] Client alert copy must say “signal fort du Concile”, never guaranteed win.

### Task 4: Verify

**Files:**
- Test with: `node --check scripts/api_server.js`
- Test with: `node --check scripts/hermes_admin_bot.js`

- [ ] Confirm syntax.
- [ ] Confirm strong alerts still return JSON.
- [ ] Commit and push.

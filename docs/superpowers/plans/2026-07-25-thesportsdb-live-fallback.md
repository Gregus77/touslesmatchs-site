# TheSportsDB Live Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TheSportsDB as a secondary live-score source for Soccer, NBA, MLB, and NHL without replacing the existing API-Sports football flow.

**Architecture:** Keep all runtime code inside `scripts/api_server.js` because the API Dockerfile only copies this file and `bookmakers.config.js`. Add one TheSportsDB fetcher, normalize its events to the existing live match shape, merge it after football-data.org and API-Sports, and keep `/current-pick` untouched.

**Tech Stack:** Node.js built-in `https`, existing Express API, Docker `api` service, TheSportsDB V2 with `X-API-KEY`.

## Global Constraints

- Do not commit or print `THESPORTSDB_API_KEY`.
- Do not change Stripe, Telegram, Brevo, Concile, or `/current-pick`.
- Do not add new required runtime files outside `scripts/api_server.js`.
- Preserve existing API-Sports and football-data.org behavior.

---

### Task 1: Add TheSportsDB Source

**Files:**
- Modify: `scripts/api_server.js`

**Interfaces:**
- Consumes: `THESPORTSDB_API_KEY` from `process.env`.
- Produces: `fetchFromTheSportsDb(): Promise<Array<object>|null>`.

- [ ] Add `THESPORTSDB_API_KEY`.
- [ ] Add a normalizer that accepts common V2 livescore fields such as `idEvent`, `strHomeTeam`, `strAwayTeam`, `intHomeScore`, `intAwayScore`, `strLeague`, `strSport`, and badge URLs.
- [ ] Fetch `livescore/all` once with `X-API-KEY` and filter to Football, Basketball, Hockey, and Baseball.
- [ ] Log counts per sport and continue if one sport fails.

### Task 2: Merge With Existing Live Flow

**Files:**
- Modify: `scripts/api_server.js`

**Interfaces:**
- Consumes: `fetchFromFootballData()`, `fetchFromApiSports()`, `fetchFromTheSportsDb()`.
- Produces: `fetchLiveMatches()` merged live list.

- [ ] Include TheSportsDB in the `Promise.all` fetch.
- [ ] Merge it using `mergeLiveMatchSources()` after API-Sports.
- [ ] Treat the live feed as failed only when all sources fail.

### Task 3: Verify And Commit

**Files:**
- Verify: `scripts/api_server.js`

- [ ] Run `node --check scripts/api_server.js`.
- [ ] Run `git diff --check -- scripts/api_server.js`.
- [ ] Commit with `[Codex] Branche TheSportsDB live secondaire`.

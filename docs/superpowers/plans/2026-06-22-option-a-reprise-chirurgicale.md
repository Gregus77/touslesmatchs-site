# Option A Reprise Chirurgicale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize TousLesMatchs so live matches, live stats, picks, and Hermes actions cannot invent data or overwrite the wrong system surface.

**Architecture:** Keep the current static frontend plus Express API plus Hermes admin bot. Add strict normalization and provenance at the API boundary, make the frontend display only verified states, and reduce Hermes privileges before adding business automation.

**Tech Stack:** Node.js 20, Express, plain browser JavaScript in `public/*.html`, Docker Compose, Git branch `claude/happy-bell-h9zj83`.

## Global Constraints

- Branche autorisee: `claude/happy-bell-h9zj83`.
- Never use `git add -A`.
- Always run `node --check scripts/api_server.js` before committing JS changes.
- If `scripts/hermes_admin_bot.js` changes, run `node --check scripts/hermes_admin_bot.js`.
- No fake live match, fake live score, or fake live stat may be returned as real product data.
- API absence must produce a clear empty or unavailable state.
- Live stats require a valid API-Sports football `fixtureId`.
- Hermes may manage business data, but must not freely pull, reset, deploy, or modify application code.

---

## File Structure

- `scripts/api_server.js`: Keep as the API entrypoint, but add small pure helpers near the existing live-match code. Responsibilities: normalize API matches, preserve provenance, expose strict stats status, and feed the Concile only verified context.
- `public/live-ia.html`: Keep as the static Live IA UI. Responsibilities: show verified live matches, distinguish unavailable stats from missing matches, and stop injecting a pick as live unless the API proves it is live.
- `public/index.html`: Keep homepage score refresh behavior, but stop defaulting unknown live scores to `0`.
- `scripts/hermes_admin_bot.js`: Keep admin bot commands, but neutralize `/deploy` into a read-only diagnostic message.
- `council/tools/sports_api.py`: Fix import-time failure and keep fallback empty.
- `scripts/smoke_live_contract.js`: Create a small Node smoke test for API helper behavior without needing external API keys.
- `docs/superpowers/specs/2026-06-22-option-a-reprise-chirurgicale-design.md`: Reference only, no edits expected.

---

### Task 1: Add Live Data Contract Smoke Tests

**Files:**
- Create: `scripts/smoke_live_contract.js`
- Modify: `scripts/api_server.js`

**Interfaces:**
- Consumes: no existing exported API.
- Produces: `module.exports.__liveContractTest` with:
  - `normalizeFootballDataMatch(match: object): object`
  - `normalizeApiSportsFootballFixture(fixture: object): object`
  - `getVerifiedFixtureId(match: object): string | null`
  - `buildStatsStatus(match: object, stats: object | null, reason: string): object`

- [ ] **Step 1: Make `api_server.js` importable without starting the server**

Replace the final server start:

```js
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`TousLesMatchs API running on :${PORT}`));
```

with:

```js
const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`TousLesMatchs API running on :${PORT}`));
}
```

This preserves runtime behavior when the file is launched with `node`, and allows smoke tests to import pure helpers without opening a listening server.

- [ ] **Step 2: Add exports without changing runtime behavior**

At the end of `scripts/api_server.js`, before or after `app.listen(...)`, expose the helper names that will be implemented in Task 2. If helper functions do not exist yet, define temporary stubs above the export block so this test can fail on behavior rather than module loading.

```js
function normalizeFootballDataMatch(m) {
  return formatFDMatch(m);
}

function normalizeApiSportsFootballFixture(f) {
  return {
    id: String(f.fixture.id),
    fixtureId: String(f.fixture.id),
    source: "api-sports",
    sourceId: String(f.fixture.id),
    sport: "Football",
    home: f.teams.home.name,
    away: f.teams.away.name,
    score_home: f.goals.home ?? null,
    score_away: f.goals.away ?? null,
    minute: f.fixture.status.elapsed ?? null,
    status: "IN_PLAY",
    competition: f.league.name + (f.league.country !== "World" ? " · " + f.league.country : ""),
    utcDate: f.fixture.date,
  };
}

function getVerifiedFixtureId(match) {
  if (!match || match.source !== "api-sports" || match.sport !== "Football") return null;
  if (!match.fixtureId || String(match.fixtureId).startsWith("demo")) return null;
  return String(match.fixtureId);
}

function buildStatsStatus(match, stats, reason) {
  return {
    available: !!stats,
    source: stats ? "api-sports" : null,
    fixtureId: getVerifiedFixtureId(match),
    reason: stats ? null : reason,
    stats: stats || null,
  };
}

module.exports.__liveContractTest = {
  normalizeFootballDataMatch,
  normalizeApiSportsFootballFixture,
  getVerifiedFixtureId,
  buildStatsStatus,
};
```

- [ ] **Step 3: Create the failing smoke test**

Create `scripts/smoke_live_contract.js`:

```js
"use strict";

const assert = require("assert");
process.env.DB_PATH = process.env.DB_PATH || ":memory:";

const { __liveContractTest } = require("./api_server.js");

function testFootballDataProvenance() {
  const match = __liveContractTest.normalizeFootballDataMatch({
    id: 123,
    homeTeam: { name: "France" },
    awayTeam: { name: "Brazil" },
    score: { fullTime: { home: null, away: null }, halfTime: { home: null, away: null } },
    status: "LIVE",
    competition: { name: "World Cup" },
    utcDate: "2026-06-22T19:00:00Z",
  });

  assert.equal(match.source, "football-data");
  assert.equal(match.sourceId, "123");
  assert.equal(match.fixtureId, null);
  assert.equal(match.score_home, null);
  assert.equal(__liveContractTest.getVerifiedFixtureId(match), null);
}

function testApiSportsFixtureCanFetchStats() {
  const match = __liveContractTest.normalizeApiSportsFootballFixture({
    fixture: { id: 987, status: { elapsed: 55 }, date: "2026-06-22T19:00:00Z" },
    teams: { home: { name: "France" }, away: { name: "Brazil" } },
    goals: { home: 1, away: 0 },
    league: { name: "World Cup", country: "World" },
  });

  assert.equal(match.source, "api-sports");
  assert.equal(match.fixtureId, "987");
  assert.equal(match.sourceId, "987");
  assert.equal(__liveContractTest.getVerifiedFixtureId(match), "987");
}

function testStatsStatusIsExplicitWhenUnavailable() {
  const status = __liveContractTest.buildStatsStatus(
    { source: "football-data", sport: "Football", fixtureId: null },
    null,
    "missing_api_sports_fixture"
  );

  assert.deepEqual(status, {
    available: false,
    source: null,
    fixtureId: null,
    reason: "missing_api_sports_fixture",
    stats: null,
  });
}

testFootballDataProvenance();
testApiSportsFixtureCanFetchStats();
testStatsStatusIsExplicitWhenUnavailable();

console.log("smoke_live_contract: ok");
```

- [ ] **Step 4: Run test and verify it fails**

Run: `node scripts/smoke_live_contract.js`

Expected: FAIL before Task 2 because `normalizeFootballDataMatch` does not yet attach `source`, `sourceId`, and `fixtureId`.

- [ ] **Step 5: Commit the failing test and explicit contract exports**

```bash
git add scripts/api_server.js scripts/smoke_live_contract.js
git commit -m "test: define live data contract"
```

---

### Task 2: Enforce Provenance on Live Matches

**Files:**
- Modify: `scripts/api_server.js`
- Test: `scripts/smoke_live_contract.js`

**Interfaces:**
- Consumes: `normalizeFootballDataMatch`, `normalizeApiSportsFootballFixture`, `getVerifiedFixtureId`, `buildStatsStatus`.
- Produces: `/live-matches` entries with `source`, `sourceId`, and `fixtureId`.

- [ ] **Step 1: Update football-data normalizer**

Replace `formatFDMatch(m)` with:

```js
function formatFDMatch(m) {
  return {
    id: `fd-${m.id}`,
    source: "football-data",
    sourceId: String(m.id),
    fixtureId: null,
    sport: "Football",
    home: m.homeTeam.name,
    away: m.awayTeam.name,
    score_home: m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null,
    score_away: m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null,
    minute: m.minute ?? null,
    status: m.status === "FINISHED" ? "FINISHED" : "IN_PLAY",
    competition: m.competition?.name || "International",
    utcDate: m.utcDate,
  };
}
```

- [ ] **Step 2: Update API-Sports football mapping**

In `fetchFromApiSports()`, replace the football `.map((f) => ({ ... }))` body with:

```js
const items = (data.response || []).slice(0, 20).map(normalizeApiSportsFootballFixture);
```

Ensure `normalizeApiSportsFootballFixture(f)` is defined exactly as:

```js
function normalizeApiSportsFootballFixture(f) {
  const fixtureId = String(f.fixture.id);
  return {
    id: fixtureId,
    source: "api-sports",
    sourceId: fixtureId,
    fixtureId,
    sport: "Football",
    home: f.teams.home.name,
    away: f.teams.away.name,
    score_home: f.goals.home ?? null,
    score_away: f.goals.away ?? null,
    minute: f.fixture.status.elapsed ?? null,
    status: "IN_PLAY",
    competition: f.league.name + (f.league.country !== "World" ? " · " + f.league.country : ""),
    utcDate: f.fixture.date,
  };
}
```

- [ ] **Step 3: Update non-football mappings**

For basketball entries, add:

```js
source: "api-sports",
sourceId: String(g.id),
fixtureId: null,
```

For hockey entries, add:

```js
source: "api-sports",
sourceId: String(g.id),
fixtureId: null,
```

- [ ] **Step 4: Implement verified fixture helper**

Keep or replace `getVerifiedFixtureId(match)` with:

```js
function getVerifiedFixtureId(match) {
  if (!match || match.source !== "api-sports" || match.sport !== "Football") return null;
  const fixtureId = match.fixtureId || match.sourceId || match.id;
  if (!fixtureId) return null;
  const id = String(fixtureId);
  if (!/^\d+$/.test(id)) return null;
  return id;
}
```

- [ ] **Step 5: Run smoke and syntax checks**

Run: `node scripts/smoke_live_contract.js`

Expected: `smoke_live_contract: ok`

Run: `node --check scripts/api_server.js`

Expected: no output and exit code 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/api_server.js scripts/smoke_live_contract.js
git commit -m "fix(live): tag verified match provenance"
```

---

### Task 3: Make Live Stats Strict and Explicit

**Files:**
- Modify: `scripts/api_server.js`
- Test: `scripts/smoke_live_contract.js`

**Interfaces:**
- Consumes: `getVerifiedFixtureId(match)`.
- Produces: `fetchMatchStatsForMatch(match): Promise<{ available: boolean, source: string | null, fixtureId: string | null, reason: string | null, stats: object | null }>` and explicit `statsStatus` in Concile analysis responses.

- [ ] **Step 1: Replace fixture-only stats function with match-aware function**

Add this function below `fetchMatchStats(fixtureId)`:

```js
async function fetchMatchStatsForMatch(match) {
  const fixtureId = getVerifiedFixtureId(match);
  if (!API_SPORTS_KEY) return buildStatsStatus(match, null, "api_sports_key_missing");
  if (!fixtureId) return buildStatsStatus(match, null, "missing_api_sports_fixture");

  const stats = await fetchMatchStats(fixtureId);
  if (!stats) return buildStatsStatus({ ...match, fixtureId }, null, "api_sports_stats_unavailable");
  return buildStatsStatus({ ...match, fixtureId }, stats, null);
}
```

Keep `fetchMatchStats(fixtureId)` as the low-level API caller.

- [ ] **Step 2: Update `runConcileAnalysis(match)` stats block**

Replace:

```js
const liveStats = isLiveMatch ? await fetchMatchStats(match.id) : null;
const statsBlock = buildStatsBlock(liveStats, match.home, match.away);

if (liveStats) console.log(`[concile] Stats live récupérées pour ${match.home} vs ${match.away}`);
```

with:

```js
const statsStatus = isLiveMatch
  ? await fetchMatchStatsForMatch(match)
  : buildStatsStatus(match, null, "match_not_live");
const liveStats = statsStatus.available ? statsStatus.stats : null;
const statsBlock = buildStatsBlock(liveStats, match.home, match.away);

if (statsStatus.available) {
  console.log(`[concile] Stats live récupérées pour ${match.home} vs ${match.away} fixture=${statsStatus.fixtureId}`);
} else {
  console.log(`[concile] Stats live indisponibles pour ${match.home} vs ${match.away}: ${statsStatus.reason}`);
}
```

- [ ] **Step 3: Add `statsStatus` to returned analysis**

In both `runConcileAnalysis(match)` and `getMockAnalysis(match)`, include:

```js
statsStatus: typeof statsStatus !== "undefined" ? statsStatus : buildStatsStatus(match, null, "mock_or_unavailable"),
```

For the real `runConcileAnalysis`, add it in the final returned object next to `agents`, `summary`, or the existing top-level fields.

- [ ] **Step 4: Extend smoke test**

Append to `scripts/smoke_live_contract.js`:

```js
function testVerifiedFixtureRejectsNonNumericIds() {
  assert.equal(__liveContractTest.getVerifiedFixtureId({ source: "api-sports", sport: "Football", fixtureId: "demo1" }), null);
  assert.equal(__liveContractTest.getVerifiedFixtureId({ source: "api-sports", sport: "Basketball", fixtureId: "123" }), null);
  assert.equal(__liveContractTest.getVerifiedFixtureId({ source: "api-sports", sport: "Football", fixtureId: "123" }), "123");
}

testVerifiedFixtureRejectsNonNumericIds();
```

- [ ] **Step 5: Run checks**

Run: `node scripts/smoke_live_contract.js`

Expected: `smoke_live_contract: ok`

Run: `node --check scripts/api_server.js`

Expected: no output and exit code 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/api_server.js scripts/smoke_live_contract.js
git commit -m "fix(concile): require verified fixture for live stats"
```

---

### Task 4: Remove Live Match Invention from Live IA Frontend

**Files:**
- Modify: `public/live-ia.html`

**Interfaces:**
- Consumes: `/api/live-matches` entries from Task 2.
- Produces: UI that never inserts `PICK_MATCH` into `allMatches` unless the API returns a matching live record.

- [ ] **Step 1: Stop injecting pick as a live match**

In `loadMatches(force)`, replace the block:

```js
if(PICK_MATCH && PICK_MATCH.status !== 'upcoming' && !pickMatchInList(allMatches)){
  // Cherche la version terminée dans l'API ...
}
```

with:

```js
if(PICK_MATCH && PICK_MATCH.status !== 'upcoming' && !pickMatchInList(allMatches)){
  const finishedVersion = d.matches.find(m =>
    m.status === "FINISHED" &&
    (matchTeamLive(m.home,PICK_MATCH.home)||matchTeamLive(m.away,PICK_MATCH.home)) &&
    (matchTeamLive(m.home,PICK_MATCH.away)||matchTeamLive(m.away,PICK_MATCH.away))
  );
  if(finishedVersion){
    PICK_MATCH.score_home = finishedVersion.score_home;
    PICK_MATCH.score_away = finishedVersion.score_away;
    PICK_MATCH.status = 'FINISHED';
  }
}
```

This removes the fallback that prepended `PICK_MATCH` when the API did not prove it was live.

- [ ] **Step 2: Preserve upcoming pick card only**

Leave this branch unchanged:

```js
if(allMatches.length === 0){
  if(PICK_MATCH && PICK_MATCH.status === 'upcoming'){
    html += `<div class="matches-grid" id="matches-grid">${renderUpcomingCard(PICK_MATCH)}</div>`;
```

This keeps a scheduled pick visible without pretending it is live.

- [ ] **Step 3: Show unavailable source status**

In `renderMatchCard(m, i)`, add a small source line below `match-comp`:

```js
const sourceLabel = m.source === 'api-sports'
  ? 'Source: API-Sports'
  : m.source === 'football-data'
    ? 'Source: football-data.org'
    : 'Source non verifiee';
```

Then add this inside the card top area:

```html
<div style="font-size:10px;color:var(--muted);margin-top:4px">${escHtml(sourceLabel)}</div>
```

- [ ] **Step 4: Run syntax-oriented checks**

Run: `node --check scripts/api_server.js`

Expected: no output and exit code 0.

Open `public/live-ia.html` in the browser or dev server and verify:
- no API matches means "Aucun match en direct";
- upcoming pick remains an upcoming card;
- no match card appears solely because it exists in `picks.json`.

- [ ] **Step 5: Commit**

```bash
git add public/live-ia.html
git commit -m "fix(front): stop inventing live matches"
```

---

### Task 5: Stop Homepage Score Defaults from Hiding Unknown Data

**Files:**
- Modify: `public/index.html`

**Interfaces:**
- Consumes: `/api/live-score` and `/api/live-matches`.
- Produces: homepage score display that uses `?` for unknown values and `0` only when API gives `0`.

- [ ] **Step 1: Update `applyScore(m)` score rendering**

Replace:

```js
sA.textContent=m.score_home??0; sA.classList.remove('pending');
sB.textContent=m.score_away??0; sB.classList.remove('pending');
```

with:

```js
const hasHomeScore = m.score_home !== null && m.score_home !== undefined;
const hasAwayScore = m.score_away !== null && m.score_away !== undefined;
sA.textContent = hasHomeScore ? m.score_home : '?';
sB.textContent = hasAwayScore ? m.score_away : '?';
sA.classList.toggle('pending', !hasHomeScore);
sB.classList.toggle('pending', !hasAwayScore);
```

- [ ] **Step 2: Only update stored score when values are known**

Replace:

```js
PICK.scoreA=m.score_home; PICK.scoreB=m.score_away; PICK.minute=m.minute;
```

with:

```js
if (hasHomeScore) PICK.scoreA = m.score_home;
if (hasAwayScore) PICK.scoreB = m.score_away;
PICK.minute = m.minute;
```

- [ ] **Step 3: Manual verification**

Temporarily inspect with browser devtools or by reading the rendered page:
- when API score is `{ score_home: null, score_away: null }`, display is `? - ?`;
- when API score is `{ score_home: 0, score_away: 0 }`, display is `0 - 0`.

- [ ] **Step 4: Commit**

```bash
git add public/index.html
git commit -m "fix(front): show unknown scores explicitly"
```

---

### Task 6: Fix Council Python Import Failure

**Files:**
- Modify: `council/tools/sports_api.py`

**Interfaces:**
- Consumes: environment variables `SPORTS_API_KEY`, `API_SPORTS_KEY`, `SPORTS_API_HOST`, `SPORTS_API_PROVIDER`.
- Produces: importable `council.tools.sports_api` module.

- [ ] **Step 1: Add missing import**

At the top of `council/tools/sports_api.py`, replace:

```python
import requests
import json
from datetime import datetime, timedelta
```

with:

```python
import os
import requests
import json
from datetime import datetime, timedelta
```

- [ ] **Step 2: Run import check**

If Python dependencies are available:

```bash
python -c "import sys; sys.path.insert(0, 'council'); import tools.sports_api; print('sports_api import ok')"
```

Expected: `sports_api import ok`

If local `requests` is missing, record the observed dependency error and verify syntax instead:

```bash
python -m py_compile council/tools/sports_api.py
```

Expected: no output and exit code 0.

- [ ] **Step 3: Commit**

```bash
git add council/tools/sports_api.py
git commit -m "fix(council): import sports api environment"
```

---

### Task 7: Neutralize Hermes Deploy Command

**Files:**
- Modify: `scripts/hermes_admin_bot.js`

**Interfaces:**
- Consumes: Telegram command router already in `scripts/hermes_admin_bot.js`.
- Produces: `/deploy` as read-only guidance, not a `git pull`.

- [ ] **Step 1: Replace deploy command behavior**

Find the `/deploy` handler that runs:

```js
execSync("cd /repo && git pull origin $(git branch --show-current) 2>&1", { timeout: 30000 });
```

Replace the handler body with:

```js
await reply(chatId,
  "🔒 <b>Déploiement verrouillé</b>\n\n" +
  "Hermes ne lance plus git pull ni rebuild automatiquement.\n" +
  "Branche autorisée : <code>claude/happy-bell-h9zj83</code>\n\n" +
  "Commande humaine sur VPS après validation :\n" +
  "<code>cd /opt/touslesmatchs\n" +
  "git fetch origin claude/happy-bell-h9zj83\n" +
  "git reset --hard origin/claude/happy-bell-h9zj83\n" +
  "docker compose up -d --build [site|api|hermes-admin]</code>"
);
```

- [ ] **Step 2: Remove unused `execSync` only if no longer used**

Search:

```bash
rg -n "execSync" scripts/hermes_admin_bot.js
```

If `/status` still uses `execSync`, keep the import. If no usage remains, remove:

```js
const { execSync } = require("child_process");
```

- [ ] **Step 3: Run checks**

Run: `node --check scripts/hermes_admin_bot.js`

Expected: no output and exit code 0.

Run: `node --check scripts/api_server.js`

Expected: no output and exit code 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/hermes_admin_bot.js
git commit -m "fix(hermes): lock deploy command"
```

---

### Task 8: Stamp Pick Provenance and Keep One Normal Read Path

**Files:**
- Modify: `scripts/hermes_admin_bot.js`
- Modify: `scripts/api_server.js`
- Test: `scripts/smoke_live_contract.js`

**Interfaces:**
- Consumes: existing `currentPick` shape in `public/data/picks.json`.
- Produces: `currentPick.source`, `currentPick.updatedAt`, and `/current-pick` response fields `source` and `updatedAt`.

- [ ] **Step 1: Stamp NOPICK writes from Hermes**

In `scripts/hermes_admin_bot.js`, inside the `data.currentPick = { ... }` object for NOPICK, add:

```js
source: "hermes",
updatedAt: new Date().toISOString(),
```

The resulting object must contain:

```js
data.currentPick = {
  date: new Date().toISOString().slice(0, 10),
  home: "PAS DE PICK",
  away: "",
  league: "",
  time: "",
  prono: "Aucun pick aujourd'hui",
  bet: "",
  cote: "",
  status: "NOPICK",
  score: "",
  nopick_raison: raison,
  source: "hermes",
  updatedAt: new Date().toISOString(),
};
```

- [ ] **Step 2: Stamp real pick writes from Hermes**

In the `data.currentPick = { ... }` object for a generated pick, add:

```js
source: "hermes",
updatedAt: new Date().toISOString(),
sourceMatchId: p.sourceMatchId || p.fixtureId || null,
fixtureId: p.fixtureId || null,
```

Keep existing fields unchanged.

- [ ] **Step 3: Preserve provenance in `/current-pick`**

In `scripts/api_server.js`, inside the object returned by `/current-pick`, add:

```js
source: p.source || "hermes",
updatedAt: p.updatedAt || null,
sourceMatchId: p.sourceMatchId || null,
fixtureId: p.fixtureId || null,
```

Place these next to `time`, `marketType`, and `marketLabel`.

- [ ] **Step 4: Make manual admin fallback explicit**

In `app.post("/admin/set-pick", ...)`, replace:

```js
savePick(pick);
res.json({ ok: true, pick });
```

with:

```js
const manualPick = {
  ...pick,
  source: pick.source || "manual-admin",
  updatedAt: new Date().toISOString(),
};
savePick(manualPick);
res.json({ ok: true, pick: manualPick });
```

- [ ] **Step 5: Run checks**

Run: `node --check scripts/api_server.js`

Expected: no output and exit code 0.

Run: `node --check scripts/hermes_admin_bot.js`

Expected: no output and exit code 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/api_server.js scripts/hermes_admin_bot.js
git commit -m "fix(picks): stamp source of truth metadata"
```

---

### Task 9: Add Final Smoke Documentation and Run Full Checks

**Files:**
- Create: `docs/superpowers/reports/2026-06-22-option-a-smoke.md`

**Interfaces:**
- Consumes: commits from Tasks 1-8.
- Produces: concise verification record for Gregory.

- [ ] **Step 1: Run checks**

Run:

```bash
node scripts/smoke_live_contract.js
node --check scripts/api_server.js
node --check scripts/hermes_admin_bot.js
python -m py_compile council/tools/sports_api.py
git status --short --branch
```

Expected:
- `smoke_live_contract: ok`
- both Node syntax checks exit 0;
- Python compile exits 0;
- `git status` shows only the new report before commit.

- [ ] **Step 2: Create report**

Create `docs/superpowers/reports/2026-06-22-option-a-smoke.md`:

```markdown
# Option A Smoke Report - 2026-06-22

Branch: `claude/happy-bell-h9zj83`

Checks run:
- `node scripts/smoke_live_contract.js`
- `node --check scripts/api_server.js`
- `node --check scripts/hermes_admin_bot.js`
- `python -m py_compile council/tools/sports_api.py`
- `git status --short --branch`

Expected production behavior after deploy:
- No demo match appears as a live match.
- Unknown score stays unknown instead of becoming `0-0`.
- Live stats require API-Sports football `fixtureId`.
- Concile analysis reports stats availability explicitly.
- Picks expose `source` and `updatedAt`.
- Hermes `/deploy` no longer runs `git pull`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/reports/2026-06-22-option-a-smoke.md
git commit -m "docs: record option a smoke checks"
```

---

## Self-Review

Spec coverage:
- Stop fake data: Tasks 2, 4, 5.
- Stabilize `/live-matches`: Task 2.
- Stabilize live stats: Task 3.
- Stabilize Concile Live: Task 3.
- Source of truth for picks: Task 8 stamps provenance and keeps `/current-pick` as the normal API read path.
- Encadrer Hermes: Task 7.
- Verification: Tasks 1 and 9.

Known intentional limits:
- Stripe, Brevo, SEO, agent weighting, and database migration remain out of scope.
- No production deploy is included in this plan; deployment remains a human-approved VPS action after review.

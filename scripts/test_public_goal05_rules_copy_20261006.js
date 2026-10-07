'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const apiSource = fs.readFileSync(path.join(__dirname, 'api_server.js'), 'utf8');
function section(startMarker, endMarker) {
  const start = apiSource.indexOf(startMarker);
  const end = apiSource.indexOf(endMarker, start + startMarker.length);
  assert(start >= 0 && end > start, startMarker);
  return apiSource.slice(start, end);
}

let handler;
const apiContext = vm.createContext({
  CLIENT_OU25_CLIENT_MAX_MINUTE: 45,
  CLIENT_OU25_MIN_VOTES: 3,
  CLIENT_OU25_MIN_CONFIDENCE: 80,
  TIER_MIN_REAL_ODD: 1.3,
  TIER_MAX_REAL_ODD: 2.1,
  officialSnapshots: {OFFICIAL_FROM_MINUTE: 35, OFFICIAL_TO_MINUTE: 45},
  app:{get(route, callback) {
  assert.equal(route, '/public-signal-rules');
  handler = callback;
}}});
vm.runInContext(section('app.get("/public-signal-rules"', 'app.get("/public-analysis-stats"'), apiContext);
let rules;
handler({}, {set() {}, json(value) { rules = JSON.parse(JSON.stringify(value)); }});
assert.deepEqual(rules, {
  ok: true,
  strategy: 'goal05-favorite-v2',
  from_minute: 30,
  to_minute: 85,
  min_votes: 4,
  min_odd: 1.6,
  min_score: 8,
  min_coverage_pct: 75,
  top5_bottom5_required: true,
  target_must_be_scoreless: true,
});

async function render(apiRules) {
  const elements = {lead: {}, end: {}, note: {}};
  const browser = vm.createContext({
    window: {},
    fetch: async () => ({ok: true, json: async () => apiRules}),
    document: {
      querySelector: () => elements.lead,
      getElementById: (id) => id === 'hero-window-end' ? elements.end : elements.note,
    },
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'public/js/signal-rules.js'), 'utf8'), browser);
  await new Promise((resolve) => setImmediate(resolve));
  return {elements, window: browser.window};
}

(async () => {
  const rendered = await render(rules);
  assert.equal(rendered.window.tlmSignalWindowEnd, 85);
  assert.equal(rendered.elements.end.textContent, "85'");
  assert.match(rendered.elements.lead.textContent, /30e à la 85e minute/);
  assert.match(rendered.elements.lead.textContent, /4 IA sur 5/);
  assert.match(rendered.elements.note.textContent, /une seule équipe ciblée/);
  assert.match(rendered.elements.note.textContent, /marquer au moins un but/);
  assert.match(rendered.elements.note.textContent, /Top 5 contre Bottom 5/);
  assert.match(rendered.elements.note.textContent, /une seule équipe ciblée/);
  assert.match(rendered.elements.note.textContent, /encore à 0 but/);
  assert.match(rendered.elements.note.textContent, /note verte ≥ 8\/10/);
  assert.match(rendered.elements.note.textContent, /couverture factuelle ≥ 75 %/);
  assert.match(rendered.elements.note.textContent, /cote réelle fraîche ≥ 1,60/);
  assert.doesNotMatch(rendered.elements.note.textContent, /77\/100|1,30|2,10|écart.*places|prioritaires/i);
  console.log('PUBLIC_GOAL05_RULES_COPY_OK');
})().catch((error) => { console.error(error); process.exitCode = 1; });

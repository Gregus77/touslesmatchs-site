'use strict';
// No production calls: execute actual rule functions and browser rule rendering.
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const path = require('path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(__dirname, 'api_server.js'), 'utf8');
function section(a, b) {
  const start = source.indexOf(a), end = source.indexOf(b, start + a.length);
  assert(start >= 0 && end > start, a);
  return source.slice(start, end);
}
const constant = source.match(/const CLIENT_OU25_CLIENT_MAX_MINUTE\s*=[\s\S]*?;/)[0];
for (const oldValue of [undefined, '32', '40', '45', '75', 'invalid']) {
  const context = vm.createContext({process: {env: {CLIENT_OU25_CLIENT_MAX_MINUTE: oldValue}}});
  vm.runInContext(constant, context);
  assert.equal(vm.runInContext('CLIENT_OU25_CLIENT_MAX_MINUTE', context), 45);
}
const ctx = vm.createContext({
  isAmericanFootballMatch: () => false, isWomenMatch: () => false,
  isCategoryBanned: () => false, isLowTrustCompetition: () => false,
  leagueTier: () => 'trusted_major', leagueHaystack: () => 'Ligue 1 France',
  isMatchDecided: () => false, CONCILE_AGENT_NAMES: ['A','B','C','D','E'],
  db: {prepare: () => ({all: () => []})}, console,
});
vm.runInContext(constant, ctx);
vm.runInContext(section('function parseLiveMinuteValue(', '// Codes de statut bruts'), ctx);
vm.runInContext(section('function isClientOu25MatchEligible(', '// Decision du 02/09/2026'), ctx);
vm.runInContext(section('const AUTO_CONCILE_WINDOW_MIN =', '// ── Règles métier'), ctx);
vm.runInContext(section('function livePickBlockReason(', 'function shouldAutoObserveMatch('), ctx);
vm.runInContext(section('function getLiveOu25VoteState(', '// ── Live matches'), ctx);
for (const minute of [15, 40, 41, 44, 45, "45'"]) {
  const match = {sport:'Football', minute};
  assert.equal(ctx.isClientOu25MatchEligible(match), true, String(minute));
  assert.equal(ctx.livePickBlockReason(match), null, String(minute));
  const votes = ctx.getLiveOu25VoteState(match);
  assert.equal(votes.window_status, 'open');
  assert.equal(votes.to_minute, 45);
}
for (const minute of [14,46,90,'45+1','HT',null,undefined]) {
  const match = {sport:'Football', minute};
  assert.equal(ctx.isClientOu25MatchEligible(match), false, String(minute));
  assert(ctx.livePickBlockReason(match), String(minute));
  assert.notEqual(ctx.getLiveOu25VoteState(match).window_status, 'open');
}
// Unchanged criteria and actual public endpoint output.
Object.assign(ctx, {CLIENT_OU25_MIN_VOTES:3,CLIENT_OU25_MIN_CONFIDENCE:77,TIER_MIN_REAL_ODD:1.3,TIER_MAX_REAL_ODD:2.1});
let handler;
ctx.app = {get(route, callback) { assert.equal(route,'/public-signal-rules'); handler = callback; }};
vm.runInContext(section('app.get("/public-signal-rules"', 'app.get("/public-analysis-stats"'), ctx);
let rules;
handler({}, {set(){},json(value){rules=JSON.parse(JSON.stringify(value));}});
assert.deepEqual(rules,{ok:true,from_minute:15,to_minute:45,min_votes:4,min_confidence:77,min_odd:1.3,max_odd:2.1});
assert(fs.readFileSync(path.join(root,'docker-compose.yml'),'utf8').includes('- CLIENT_OU25_CLIENT_MAX_MINUTE=45'));
// All public text comes from the real API rule response, not a cosmetic 45.
(async () => {
  const elements = {lead:{},end:{},note:{}};
  const browser = vm.createContext({window:{},fetch:async()=>({ok:true,json:async()=>rules}),
    document:{querySelector:()=>elements.lead,getElementById:id=>id==='hero-window-end'?elements.end:elements.note}});
  vm.runInContext(fs.readFileSync(path.join(root,'public/js/signal-rules.js'),'utf8'),browser);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(browser.window.tlmSignalWindowEnd,45);
  assert.equal(elements.end.textContent,"45'");
  assert(elements.lead.textContent.includes('15e et la 45e minute'));
  assert(elements.note.textContent.includes('15e et la 45e minute'));
  console.log('OK: 15–45 inclusive; 41–45 open; 46+, added time and missing minutes blocked; old env cannot override; API and homepage aligned.');
})().catch(error=>{console.error(error);process.exitCode=1;});

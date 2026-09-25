'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const api = fs.readFileSync(__dirname + '/api_server.js', 'utf8');
const eventRule = api.slice(api.indexOf('const CLIENT_OU25_EXCLUDED_EVENT_REGEX'), api.indexOf('// Décision propriétaire : signal client', api.indexOf('const CLIENT_OU25_EXCLUDED_EVENT_REGEX')));
assert(eventRule.includes('clientOu25StaticExclusionReason') && eventRule.includes('isClientOu25MatchEligible'));
const ctx = vm.createContext({
  isAmericanFootballMatch: () => false,
  isWomenMatch: () => false,
  isCategoryBanned: () => false,
  isLowTrustCompetition: () => false,
  leagueTier: () => 'trusted_major',
  leagueHaystack: m => String(m.competition || '').toLowerCase(),
  parseLiveMinuteValue: x => Number.isInteger(Number(x)) ? Number(x) : null,
  CLIENT_OU25_CLIENT_MAX_MINUTE: 45,
});
vm.runInContext(eventRule, ctx);
for (const [fixture, expected] of [
  [{sport:'Football', competition:'Coppa Italia · Italy', minute:46}, /Coppa Italia.*coupe exclue/],
  [{sport:'Football', competition:'AFC Champions League Elite', minute:45}, /AFC Champions League Elite.*tournoi continental exclu/],
]) {
  assert.match(ctx.clientOu25StaticExclusionReason(fixture), expected);
  assert.equal(ctx.isClientOu25MatchEligible(fixture, false), false);
}
const league = {sport:'Football', competition:'Premier League · England', minute:40};
assert.equal(ctx.clientOu25StaticExclusionReason(league), null);
assert.equal(ctx.isClientOu25MatchEligible(league, true), true);
assert(api.includes('|| staticExclusionReason'), 'raison statique jointe à l’API');
assert(!eventRule.includes('ARJEL_BOOKMAKERS'), 'le classement ARJEL ne fait pas partie de cette exclusion');
const app = fs.readFileSync(__dirname + '/../public/app.html', 'utf8');
assert(app.includes("var exclusionReason=String(m.analysis_exclusion_reason||'')"));
console.log('PASS: les deux coupes restent exclues sportivement avec motif explicite API/PWA; championnat admis inchangé');

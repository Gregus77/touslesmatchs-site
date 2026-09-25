'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, 'api_server.js'), 'utf8');
function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert(start >= 0 && end > start, startMarker);
  return source.slice(start, end);
}

const ctx = vm.createContext({
  isAmericanFootballMatch: () => false,
  isWomenMatch: () => false,
  isCategoryBanned: () => false,
  isUsaOrCanadaMatch: () => false,
  isLowTrustCompetition: () => false,
  leagueTier: () => 'trusted_major',
  leagueHaystack: (match) => String(match.competition || '').toLowerCase(),
  parseLiveMinuteValue: (value) => Number.isInteger(Number(value)) ? Number(value) : null,
  CLIENT_OU25_CLIENT_MAX_MINUTE: 45,
});
vm.runInContext(section('const PUBLIC_FOOTBALL_BLOCKED_COUNTRIES', 'async function fetchFromFootballData'), ctx);
vm.runInContext(section('function isClientOu25MatchEligible(', '// Decision du 05/09/2026'), ctx);

const caribbean = {
  sport: 'Football', country: 'World', minute: 17,
  competition: 'CONCACAF Caribbean Club Championship',
};
assert.equal(ctx.isPublicFootballScopeMatch(caribbean), false);
assert.equal(ctx.isClientOu25MatchEligible(caribbean), true,
  'le filtre Conseil est une defense distincte; le scope public doit bloquer ce faux positif en amont');

const libertadores = {
  sport: 'Football', country: 'World', minute: 30,
  competition: 'CONMEBOL Libertadores',
};
assert.equal(ctx.isPublicFootballScopeMatch(libertadores), true, 'affichage continental reconnu');
assert.equal(ctx.isClientOu25MatchEligible(libertadores), false, 'competition continentale jamais envoyee au Conseil championnat');

const english = {
  sport: 'Football', country: 'England', minute: 30,
  competition: 'Championship · England',
};
assert.equal(ctx.isPublicFootballScopeMatch(english), true, 'Championship anglais conserve');
assert.equal(ctx.isClientOu25MatchEligible(english), true, 'championnat anglais dans la fenetre conserve');

assert(source.includes('[live-filter] avant='), 'journal de comptage avant/apres present');
assert(source.includes('[live-filter] exclude='), 'raison par exclusion presente');
console.log('OK: faux positif Championship bloque; CONMEBOL visible mais non analysable; Championship anglais preserve; diagnostics presents.');

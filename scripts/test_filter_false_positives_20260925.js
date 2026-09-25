'use strict';
// Offline: evaluate only pure filter functions, never import the API server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');
const source = fs.readFileSync(process.env.FILTER_SOURCE || path.join(__dirname, 'api_server.js'), 'utf8');
function extract(pattern) {
  const match = source.match(pattern);
  assert(match, String(pattern));
  return match[0];
}
function fn(name) { return extract(new RegExp(`function ${name}\\(.*?\\n}`, 's')); }
function array(name) { return extract(new RegExp(`const ${name} = \\[.*?\\n\\];`, 's')); }
const arrays = ['CATEGORY_BAN_KEYWORDS', 'LOW_TRUST_COMPETITION_KEYWORDS',
  'LEAGUE_TIER_SECONDARY', 'LEAGUE_TIER_WATCHLIST', 'TRUSTED_COMPETITIONS'];
const functions = ['matchesCategoryPhrase', 'isReserveTeamName', 'competitionFilterText',
  'hasLowTrustCompetitionKeyword', 'recoveryNormalize', 'ownerExpandedLeagueAllowed',
  'leagueHaystack', 'leagueTier', 'isLowTrustCompetition', 'isCategoryBanned',
  'isWomenMatch', 'isUsaOrCanadaMatch', 'isAmericanFootballMatch', 'tlmScopeNorm',
  'tlmScopeCountry', 'isPublicFootballScopeMatch', 'isBlacklistedForLiveDisplay',
  'parseLiveMinuteValue', 'isClientOu25MatchEligible', 'clientOu25StaticExclusionReason'];
const ctx = vm.createContext({
  liveStateCoherence: require('./live_state_coherence'),
});
vm.runInContext([
  ...arrays.map(array), ...functions.map(fn),
  extract(/const PUBLIC_FOOTBALL_BLOCKED_COUNTRIES = new Set\(\[.*?\n\]\);/s),
  extract(/const CLIENT_OU25_EXCLUDED_EVENT_REGEX = .*?;/),
  extract(/const CLIENT_OU25_CLIENT_MAX_MINUTE = .*?;/),
].join('\n'), ctx);
let passed = 0;
function test(name, run) { run(); passed++; console.log('PASS ' + name); }
function match(country, league, extra = {}) {
  return {sport: 'Football', country, competition: `${league} · ${country}`,
    home: 'Home', away: 'Away', minute: 38, status: 'IN_PLAY', period: '1H', ...extra};
}
const allowed = [
  ['Japan', 'J1 League'], ['South-Korea', 'K League 1'], ['Netherlands', 'Eredivisie'],
  ['Denmark', 'Superliga'], ['Ireland', 'Premier Division'],
  ['Brazil', 'Serie A'], ['Brazil', 'Serie B'], ['Brasil', 'Serie A'], ['Brasil', 'Serie B'],
  ['Argentina', 'Liga Profesional Argentina'], ['Argentina', 'Primera Division'],
  ['Australia', 'A-League'], ['Australia', 'A-League Men'],
  ['France', 'Ligue 1'], ['France', 'Ligue 2'], ['England', 'Premier League'],
  ['England', 'Championship'], ['Spain', 'La Liga'], ['Spain', 'Segunda Division'],
  ['Germany', 'Bundesliga'], ['Germany', '2. Bundesliga'], ['Italy', 'Serie A'],
  ['Italy', 'Serie B'], ['Portugal', 'Primeira Liga'], ['Belgium', 'Jupiler Pro League'],
  ['Turkey', 'Süper Lig'],
];
for (const [country, league] of allowed) test(`${country}: ${league} remains allowed`, () => {
  const m = match(country, league);
  assert.equal(ctx.isPublicFootballScopeMatch(m), true);
  assert.equal(ctx.isClientOu25MatchEligible(m), true);
  assert.equal(ctx.clientOu25StaticExclusionReason(m), null);
  assert.equal(ctx.isBlacklistedForLiveDisplay(m), false);
});
const excluded = [
  ['Japan', 'J2 League'], ['Japan', 'J3 League'], ['South-Korea', 'K League 2'],
  ['South-Korea', 'K3 League'], ['Argentina', 'Primera D'], ['Argentina', 'Primera D Metropolitana'],
  ['Argentina', 'Primera C'], ['Argentina', 'Primera B Nacional'],
  ['Argentina', 'Primera Nacional'], ['Brazil', 'Serie C'], ['Australia', 'NPL Queensland'],
  ['Poland', 'III Liga - Group 1'], ['Netherlands', 'Eerste Divisie'],
  ['Denmark', '1. Division'], ['Ireland', 'First Division'], ['Scotland', 'Premiership'],
  ['Finland', 'Ykkösliiga'], ['Guatemala', 'Liga Nacional'], ['Mexico', 'Liga de Expansión MX'],
  ['China', 'League One'], ['Uzbekistan', 'Pro League A'],
];
for (const [country, league] of excluded) test(`${country}: ${league} remains excluded`, () => {
  const m = match(country, league);
  assert.equal(ctx.isPublicFootballScopeMatch(m), false);
  assert.equal(ctx.isClientOu25MatchEligible(m), false);
  assert.notEqual(ctx.clientOu25StaticExclusionReason(m), null);
});
test('III Liga is not a reserve category; Polish league remains excluded', () => {
  const m = match('Poland', 'III Liga - Group 1', {home: 'Swit', away: 'Łomża'});
  assert.equal(ctx.isCategoryBanned(m), false);
  assert.equal(ctx.isCategoryBanned('III Liga - Group 1'), false);
  assert.equal(ctx.hasLowTrustCompetitionKeyword(m), true);
  assert.equal(ctx.isClientOu25MatchEligible(m), false);
});
for (const home of ['Ajax II', 'AJAX ii', 'Ajax (II)', 'Wisła Kraków II', 'Ajax III']) test(`reserve suffix ${home}`, () => {
  const m = match('Netherlands', 'Eredivisie', {home});
  assert.equal(ctx.isCategoryBanned(m), true);
  assert.equal(ctx.isLowTrustCompetition(m), true);
  assert.equal(ctx.isBlacklistedForLiveDisplay(m), true);
  assert.equal(ctx.isClientOu25MatchEligible(m), false);
});
test('away reserve is excluded', () => {
  assert.equal(ctx.isCategoryBanned(match('Netherlands', 'Eredivisie', {away: 'Ajax II'})), true);
});
for (const home of ['Shiina', 'Reserveville', 'Friendlytown']) test(`no partial category match: ${home}`, () => {
  assert.equal(ctx.isCategoryBanned(match('France', 'Ligue 1', {home})), false);
});
test('Primera D and Primera Division are distinct exact phrases', () => {
  assert.equal(ctx.hasLowTrustCompetitionKeyword(match('Argentina', 'Primera Division')), false);
  assert.equal(ctx.hasLowTrustCompetitionKeyword(match('Argentina', 'Primera D')), true);
  assert.equal(ctx.hasLowTrustCompetitionKeyword('Primera Division · Argentina'), false);
  assert.equal(ctx.hasLowTrustCompetitionKeyword('Primera D · Argentina'), true);
});
for (const extra of [{home: 'Club U17'}, {away: 'Club U18'}, {home: 'Club U19'},
  {away: 'Club U20'}, {home: 'Club U21'}, {home: 'Club U23'}, {home: 'Club Under 19'},
  {home: 'Club Reserves'}, {home: 'Club B Team'}, {home: 'Club Academy'}]) {
  test(`excluded team category ${JSON.stringify(extra)}`, () => {
    const m = match('England', 'Premier League', extra);
    assert.equal(ctx.isCategoryBanned(m), true);
    assert.equal(ctx.isClientOu25MatchEligible(m), false);
  });
}
for (const league of ['Ligue 1 Women', 'Ligue 1 Féminine', 'Friendlies', 'Club Friendly',
  'Coupe de France', 'Ligue 1 Play-offs', 'Ligue 1 Barrage', 'UEFA Champions League',
  'UEFA Nations League', 'CONCACAF Nations League', 'UEFA Euro', 'Euro 2028', 'World Cup']) {
  test(`client structural exclusion ${league}`, () => {
    const m = match('France', league);
    assert.equal(ctx.isClientOu25MatchEligible(m), false);
    assert.notEqual(ctx.clientOu25StaticExclusionReason(m), null);
  });
}
test('female team suffix remains excluded', () => {
  assert.equal(ctx.isClientOu25MatchEligible(match('France', 'Ligue 1', {away: 'Club W'})), false);
});
for (const [home, away, competition] of [
  ['Costa Rica', 'Curaçao', 'CONCACAF Nations League'],
  ['Armenia', 'Latvia', 'UEFA Nations League'],
  ['Georgia', 'Northern Ireland', 'UEFA Nations League'],
]) test(`geography fixed without client authorization: ${home} - ${away}`, () => {
  const m = match('World', competition, {home, away, competition});
  assert.equal(ctx.hasLowTrustCompetitionKeyword(m), false);
  assert.equal(ctx.isLowTrustCompetition(m), false);
  assert.equal(ctx.isClientOu25MatchEligible(m), false);
  assert.match(ctx.clientOu25StaticExclusionReason(m), /Coupe, tournoi continental ou qualification/);
});
test('country words in a club name do not blacklist an authorized domestic league', () => {
  const m = match('France', 'Ligue 1', {home: 'Armenia Club', away: 'Northern Ireland Club'});
  assert.equal(ctx.isClientOu25MatchEligible(m), true);
  assert.equal(ctx.isBlacklistedForLiveDisplay(m), false);
});
test('team names cannot whitelist an unknown competition', () => {
  const m = match('World', 'Unknown League', {home: 'Premier League Club'});
  assert.equal(ctx.isLowTrustCompetition(m), true);
  assert.equal(ctx.isClientOu25MatchEligible(m), false);
});
for (const [minute, period, expected] of [[34, '1H', false], [35, '1H', true],
  ['45+3', '1H', true], [45, 'HT', false], [46, '2H', false]]) {
  test(`unchanged window ${minute}/${period}`, () => {
    assert.equal(ctx.isClientOu25MatchEligible(match('France', 'Ligue 1', {minute, period})), expected);
  });
}
// Golden hashes from 85efaac/f66d689/a084041: no authorized league/tier added.
const unchanged = [
  [array('TRUSTED_COMPETITIONS'), 'e4665e4576b410'],
  [array('LEAGUE_TIER_SECONDARY'), '19900f433c0531'],
  [array('LEAGUE_TIER_WATCHLIST'), '6febaa128c9a0e'],
  [fn('ownerExpandedLeagueAllowed'), 'df7a8de215492b'],
  [fn('resolveModel'), '3f63abc146c76e'],
  [extract(/const MODELE_DES_AGENTS = .*?\n};/s), 'ee741025249cde'],
  [extract(/app.get\("\/concile-roster".*?\n}\);/s), '4e248af58ab9e1'],
];
for (const [text, hash] of unchanged) if (hash) test(`unchanged authorized scope/roster ${hash}`, () => {
  assert.equal(crypto.createHash('sha256').update(text).digest('hex').slice(0, 14), hash);
});
console.log(`PASS ${passed} offline filter checks; no API server, database, provider or Telegram invoked.`);

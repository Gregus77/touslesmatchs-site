'use strict';

const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const source = fs.readFileSync(require('path').join(__dirname, 'api_server.js'), 'utf8');

function section(startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert(start >= 0 && end > start, startNeedle);
  return source.slice(start, end);
}

const ctx = vm.createContext({});
vm.runInContext(
  section('function mergeApiSportsFootballItems(', '// Basketball/hockey/baseball'),
  ctx
);

const direct = [
  { id: '100', fixtureId: '100', home: 'Bayer Leverkusen' },
  { id: '200', fixtureId: '200', home: 'Fiorentina' },
];
const day = [
  { id: '100', fixtureId: '100', home: 'Duplicate must not replace direct' },
  { id: '300', fixtureId: '300', home: 'Hoffenheim' },
  { id: '400', fixtureId: '400', home: 'Borussia Monchengladbach' },
];
const merged = ctx.mergeApiSportsFootballItems(direct, day);
assert.equal(merged.length, 4);
assert.equal(merged[0].home, 'Bayer Leverkusen');
assert(merged.some((match) => match.fixtureId === '300'));
assert(merged.some((match) => match.fixtureId === '400'));

assert(source.includes('/fixtures?date=${encodeURIComponent(date)}&timezone=Europe%2FParis'));
assert(source.includes('.filter(isApiSportsLiveGame)'));
assert(source.includes('const dayItems = await fetchApiSportsFootballDayLive();'));
assert(source.includes('const items = mergeApiSportsFootballItems(directItems, dayItems);'));
assert(source.includes('const API_SPORTS_FOOTBALL_DAY_CACHE_MS = Math.max('));
assert(source.includes('Number(process.env.API_SPORTS_FOOTBALL_DAY_CACHE_MINUTES || 5)'));
assert(source.includes('async function isBookmakerPlayableBeforeAnalysis(match)'));
assert(source.includes('if (!API_SPORTS_KEY || match.source !== "api-sports") return null;'));

console.log('OK: flux du jour complete le live API-Football, deduplication par fixture et garde-fou de cote reelle conserves.');

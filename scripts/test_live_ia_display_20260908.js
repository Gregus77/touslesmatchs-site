'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'live-ia.html'), 'utf8');
const start = html.indexOf('function liveDisplayState(');
const end = html.indexOf('function renderMatches()', start);
assert(start >= 0 && end > start, 'liveDisplayState introuvable');
const ctx = vm.createContext({});
vm.runInContext(html.slice(start, end), ctx);

assert.deepEqual(
  { ...ctx.liveDisplayState({ status: 'IN_PLAY', minute: 24, score_home: null, score_away: null }) },
  { isLive: true, hasScore: false, hasMinute: true, incompleteLive: true }
);
assert.deepEqual(
  { ...ctx.liveDisplayState({ status: 'IN_PLAY', minute: null, score_home: 0, score_away: 0 }) },
  { isLive: true, hasScore: true, hasMinute: false, incompleteLive: true }
);
assert.deepEqual(
  { ...ctx.liveDisplayState({ status: 'IN_PLAY', minute: 31, score_home: 1, score_away: 0 }) },
  { isLive: true, hasScore: true, hasMinute: true, incompleteLive: false }
);
assert.equal(ctx.liveDisplayState({ status: 'IN_PLAY', minute: '45+2', score_home: 1, score_away: 1 }).incompleteLive, false);
assert.equal(ctx.liveDisplayState({ status: 'HT', minute: null, score_home: 1, score_away: 1 }).incompleteLive, false);

assert(html.includes('max-width:1180px'), 'largeur desktop non corrigée');
assert(html.includes('class="flag-england"'), 'drapeau anglais fiable absent');
assert(html.includes('Données live incomplètes'), 'état incomplet absent');
assert(html.includes('Score indisponible'), 'score indisponible absent');
assert(html.includes('Minute indisponible'), 'minute indisponible absente');

console.log('OK: affichage Live IA distingue score, minute et données incomplètes.');

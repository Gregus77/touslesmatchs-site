'use strict';

const assert = require('assert');
const guard = require('./ai_budget_guard');

const request = {
  matchKey: 'Remo_Santos_0-0-18',
  modelKey: 'mistral',
  promptVersion: 'official-ou25-v1',
};
const saturday2359 = Date.parse('2026-09-19T21:59:59Z'); // 23:59 Europe/Paris
const sunday0000 = Date.parse('2026-09-19T22:00:00Z');   // 00:00 Europe/Paris

const saturdayKey = guard.buildRequestKey(request, saturday2359);
const sundayKey = guard.buildRequestKey(request, sunday0000);
assert.notEqual(saturdayKey, sundayKey, 'la clé anti-doublon doit changer à minuit Europe/Paris, pas à minuit UTC');
assert.match(saturdayKey, /^2026-09-19__/);
assert.match(sundayKey, /^2026-09-20__/);

const breakerDb = {
  exec() {},
  prepare(sql) {
    assert.match(sql, /SELECT tripped_at FROM ai_circuit_breaker/);
    return { get: () => ({ tripped_at: '2026-09-19 21:59:59' }) };
  },
};
assert.equal(guard.isBreakerTripped(breakerDb, 'daily_requests', saturday2359), true);
assert.equal(guard.isBreakerTripped(breakerDb, 'daily_requests', sunday0000), false,
  'un coupe-circuit journalier du samedi doit expirer à minuit Europe/Paris');

const scoped = guard.scopeTodaySql(
  "SELECT match_key FROM ai_call_budget_log WHERE date(created_at) = date('now')",
  sunday0000,
);
assert.match(scoped, /2026-09-19T22:00:00\.000Z/,
  'la journée du dimanche à Paris doit commencer samedi à 22:00 UTC en heure d’été');
assert.match(scoped, /2026-09-20T22:00:00\.000Z/,
  'le comptage doit se terminer au prochain minuit de Paris');
assert.doesNotMatch(scoped, /date\(created_at\) = date\('now'\)/,
  'aucun compteur journalier Paris ne doit rester basé sur minuit UTC');

console.log('PASS rollover Paris samedi vers dimanche pour clés et coupe-circuits IA');

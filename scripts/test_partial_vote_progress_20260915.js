'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('scripts/api_server.js', 'utf8');
const tracerStart = source.indexOf('const tracerAppel =');
const tracerEnd = source.indexOf('const tracerVote =', tracerStart);
const tracer = source.slice(tracerStart, tracerEnd);
assert.match(tracer, /getPredictionSnapshotKey\(match\)/,
  'agent_calls must use the same snapshot key as persisted votes');
assert.doesNotMatch(tracer, /_fallbackMatchKey, agCfg\.name/,
  'budget key must not leak into vote-attempt tracking');

const liveStart = source.indexOf('function getLiveOu25VoteState');
const liveEnd = source.indexOf('function clientOu25VisibilityEligibility', liveStart);
const live = source.slice(liveStart, liveEnd);
assert.match(live, /immutableState\.kind === 'official' \|\| snapshot\.id === currentSnapshotKey/,
  'an older trend must not hide a current partial vote set');
assert.match(live, /FROM agent_calls[\s\S]*WHERE match_key = \?/,
  'current failure states must come from persisted calls');
assert.match(live, /analysis_state:/,
  'the API must distinguish running, completed and not started');
assert.match(source, /OpenRouter limité pour ce modèle — aucun coupe-circuit global ouvert/,
  'one model-level 429 must not disable every OpenRouter seat');
assert.match(source, /reasoning: \{ effort: "none" \}/,
  'Qwen must return content within its unchanged normal output limit');

const currentKey = '42_2026-09-15_30_0-0';
const context = {
  CLIENT_OU25_CLIENT_MAX_MINUTE: 45,
  CLIENT_OU25_MIN_VOTES: 4,
  CONCILE_AGENT_NAMES: ['Perplexity-Web','DeepSeek-V3','Mistral-Large','OpenRouter-Luna','OpenRouter-Qwen'],
  parseLiveMinuteValue: value => Number(value),
  getPredictionSnapshotKey: () => currentKey,
  officialSnapshots: { stateForMatch: () => ({ kind: 'trend', snapshot: {
    id: '42_2026-09-15_15_0-0', votes: [], seat_statuses: [], directions: [],
  } }) },
  db: { prepare(sql) { return { all() {
    if (sql.includes('FROM agent_market_predictions')) return [{ match_key: currentKey,
      agent_name: 'Perplexity-Web', bet: 'Under 2.5 buts', confidence: 81,
      created_at: '2026-09-15 00:01:01', source_priority: 0 }];
    if (sql.includes('FROM agent_predictions')) return [];
    if (sql.includes('FROM agent_calls')) return [
      {agent_name:'DeepSeek-V3',http_status:429,issue:'http_erreur',vote_produit:0,created_at:'2026-09-15 00:01:02'},
    ];
    throw new Error('unexpected query');
  } }; } },
  console: { error() {} },
};
vm.createContext(context);
vm.runInContext(live, context);
const progress = context.getLiveOu25VoteState({fixtureId:42,home:'Alpha',away:'Beta',minute:30});
assert.equal(progress.vote_count, 1, 'a real first vote must be visible before quorum');
assert.equal(progress.votes[0].status, 'voted');
assert.equal(progress.votes[1].status, 'unavailable');
assert.equal(progress.votes[1].reason, 'Fournisseur temporairement limité.');
assert.equal(progress.analysis_state, 'running');

console.log('PASS partial votes: shared snapshot key, immediate progress, explicit failures, model-scoped 429 and Qwen bounded output');

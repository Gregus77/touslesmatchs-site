'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,'api_server.js'), 'utf8');
const tracerStart = source.indexOf('const tracerAppel =');
const tracerEnd = source.indexOf('const tracerVote =', tracerStart);
const tracer = source.slice(tracerStart, tracerEnd);
assert.match(tracer, /getPredictionSnapshotKey\(match\)/,
  'agent_calls must use the same snapshot key as persisted votes');
assert.doesNotMatch(tracer, /_fallbackMatchKey, agCfg\.name/,
  'budget key must not leak into vote-attempt tracking');

const liveStart = source.indexOf('function ou25TerminalReason');
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
assert.doesNotMatch(source, /!providers\.length && OPENROUTER_API_KEY[\s\S]{0,400}modelKey: "qwen"/,
  'a different seat must never fall back to the Qwen model');
assert.doesNotMatch(source, /!providers\.length && OPENROUTER_API_KEY[\s\S]{0,400}modelKey: "kimi"/,
  'a different seat must never fall back to the Kimi model');

const currentKey = '42_2026-09-15_35_0-0';
const context = {
  liveStateCoherence: require('./live_state_coherence'),
  CLIENT_OU25_CLIENT_MAX_MINUTE: 45,
  CLIENT_OU25_MIN_VOTES: 4,
  CONCILE_AGENT_NAMES: ['Perplexity-Web','DeepSeek-V3','Mistral-Large','OpenRouter-Luna','OpenRouter-Qwen'],
  parseLiveMinuteValue: value => Number(value),
  getPredictionSnapshotKey: () => currentKey,
  officialSnapshots: { archivedStateForMatch: () => context.officialSnapshots.stateForMatch(), stateForMatch: () => ({ kind: 'trend', snapshot: {
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
const progress = context.getLiveOu25VoteState({fixtureId:42,home:'Alpha',away:'Beta',minute:35,status:'1H',score_home:0,score_away:0});
assert.equal(progress.vote_count, 1, 'a real first vote must be visible before quorum');
assert.equal(progress.votes[0].status, 'voted');
assert.equal(progress.votes[1].status, 'unavailable');
assert.equal(progress.votes[1].reason, 'Fournisseur temporairement limité (HTTP 429).');
assert.equal(progress.analysis_state, 'running');

context.officialSnapshots.stateForMatch = () => ({ kind:'trend', snapshot:{
  id:'42_2026-09-15_45_1-0', minute:45, score_home:1, score_away:0,
  created_at:'2026-09-15T00:45:00.000Z', consensus_votes:4,
  seat_statuses:['voted','unavailable','voted','voted','voted'],
  votes:context.CONCILE_AGENT_NAMES.map((agent,index)=>({agent,direction:index===1?null:'under',status:index===1?'unavailable':'voted'})),
} });
const afterWindow=context.getLiveOu25VoteState({fixtureId:42,home:'Alpha',away:'Beta',minute:70});
assert.equal(afterWindow.snapshot_minute,45,'closed match must retain its latest immutable trend');
assert.equal(afterWindow.vote_count,4);
assert.equal(afterWindow.votes[1].status,'unavailable','a terminal fifth seat must not revert to pending after 45 minutes');
assert.equal(afterWindow.votes[1].reason,'Fournisseur temporairement limité (HTTP 429).');

console.log('PASS partial votes: immediate progress, terminal states retained after window, model-scoped 429 and Qwen bounded output');

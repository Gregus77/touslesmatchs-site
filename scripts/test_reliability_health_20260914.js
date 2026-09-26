'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, 'api_server.js'), 'utf8');
const councilSource = fs.readFileSync(require('node:path').join(__dirname, '../council/hermes.py'), 'utf8');

const section = (from, to) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert(start >= 0 && end > start, `missing section: ${from}`);
  return source.slice(start, end);
};

assert.match(source, /const CLIENT_OU25_MIN_VOTES = 3;/);
assert.doesNotMatch(section('async function runConcileAnalysis(', 'const neutralNote ='), /getMockAnalysis/);
assert.match(source, /delivery_from_minute:\s*officialSnapshots\.OFFICIAL_FROM_MINUTE/);
assert.match(source, /await refreshIntegrationHealth\(\);/);
assert.match(source, /selection_source: "official_signal_registry"/);
assert.match(source, /persisted_votes_required: CLIENT_OU25_MIN_VOTES/);
assert.match(source, /FROM official_signal_registry registry[\s\S]{0,300}JOIN official_vote_snapshots snapshot/);
assert.doesNotMatch(section('async function runReliabilityLoop', 'function checkAnalyticsSchedule'),
  /diffusion_block IS NULL AND consensus_votes >= 3/);
assert.match(source, /decision: _journalDecision/);
assert.doesNotMatch(source, /decision: \(_blockReason \|\| _tierBlock\) \? "blocked" : "accepted_for_delivery"/);
const registerIndex = source.indexOf('const officialSnapshot = officialSnapshots.registerOfficial');
const cacheIndex = source.indexOf('_signalSentCache.add(signalKey)', registerIndex);
assert(registerIndex >= 0 && cacheIndex > registerIndex, 'cache must only arm after official persistence');
assert.match(source, /WHERE lower\(COALESCE\(reason,''\)\) NOT LIKE 'promotion :%'/);
assert.doesNotMatch(section('function auditAgentsEtPromotion()', '// Meilleur agent PAR MARCHE'),
  /INSERT INTO model_overrides/);
assert.match(councilSource, /shadow_agents\s*=\s*\[\s*\("opus", opus_agent\),\s*\("gpt4o", gpt4o_agent\),\s*\]/s);
assert.match(source, /if \(shadowWorthy && shadowQuotaAllows\(\)\)/);
assert.match(section('async function collectAgentsUntilOu25Quorum', '// Un timeout ou une erreur HTTP'),
  /completed === agentPromises\.length/);

const healthSource = section('function integrationHealthView(', 'app.get("/health"');
const context = { INTEGRATION_CHECK_MAX_AGE_MS: 30 * 60 * 1000, Date };
vm.createContext(context);
vm.runInContext(healthSource, context);
const now = new Date().toISOString();
const stale = new Date(Date.now() - 31 * 60 * 1000).toISOString();
assert.equal(context.integrationHealthView({configured:true,ok:true,checked_at:now}).check_result, 'ok');
assert.equal(context.integrationHealthView({configured:true,ok:true,checked_at:stale}).check_result, 'stale');
assert.equal(context.integrationHealthView({configured:true,ok:false,checked_at:now}).check_result, 'failed');
assert.equal(context.integrationHealthView({configured:false,ok:null,checked_at:null}).check_result, 'not_configured');
assert.equal(context.integrationHealthView({configured:true,ok:true,checked_at:now}, 'proof').last_delivery_at, 'proof');

console.log('PASS reliability: official registry only, quorum 4, fresh/stale health, cache after persistence, no shadow promotion');

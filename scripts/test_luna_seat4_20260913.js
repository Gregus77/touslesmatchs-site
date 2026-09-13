'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(require.resolve('./api_server.js'), 'utf8');
const models = require('./ai_models.config.js');

assert.deepStrictEqual(
  models.getModel('luna'),
  models.getModel('openrouter-luna'),
  'l’alias du siège Luna doit résoudre le même modèle'
);
assert.strictEqual(models.getModel('luna').id, 'openai/gpt-5.6-luna');
assert.strictEqual(models.getModel('luna').mode, 'official');
assert.strictEqual(models.getModel('luna').enabled, true);

const rosterMatch = source.match(/const CONCILE_AGENT_NAMES = (\[[^;]+\]);/);
assert(rosterMatch, 'roster du Concile introuvable');
const roster = vm.runInNewContext(rosterMatch[1]);
assert.deepStrictEqual(
  Array.from(roster),
  ['Perplexity-Web', 'DeepSeek-V3', 'Mistral-Large', 'OpenRouter-Luna', 'OpenRouter-Qwen'],
  'Luna doit occuper uniquement le siège 4'
);

const helpersStart = source.indexOf('function isOu25Bet(');
const helpersEnd = source.indexOf('function buildOu25VoteSummary(', helpersStart);
assert(helpersStart >= 0 && helpersEnd > helpersStart, 'helpers O/U introuvables');
const context = vm.createContext({});
vm.runInContext(source.slice(helpersStart, helpersEnd), context);
const schema = vm.runInContext('strictOu25ResponseFormat()', context);
assert.strictEqual(schema.type, 'json_schema');
assert.strictEqual(schema.json_schema.strict, true);
assert.deepStrictEqual(
  Array.from(schema.json_schema.schema.required),
  ['bet', 'confidence', 'raison', 'marches']
);
const extracted = vm.runInContext(`extractStructuredOu25Vote(${JSON.stringify({
  bet: 'Over 2.5 buts', confidence: 81, raison: 'Score et rythme cohérents.',
  marches: { buts: { p: 'o2.5', c: 81 } }
})})`, context);
assert.strictEqual(extracted.bet, 'Over 2.5 buts');
assert.strictEqual(extracted.confidence, 81);

const concileStart = source.indexOf('async function runConcileAnalysis(');
const concileEnd = source.indexOf('function getAgentPerformance(', concileStart);
const concile = source.slice(concileStart, concileEnd > concileStart ? concileEnd : undefined);
assert(concile.includes('openRouterModelKey: "luna"'), 'routage budgétaire Luna absent');
assert(concile.includes('requestBody.response_format = strictOu25ResponseFormat();'), 'schéma strict non transmis');
assert(concile.includes('requestBody.reasoning = { effort: "none" };'), 'reasoning non désactivé');
assert(concile.includes('requestBody.provider = { require_parameters: true };'), 'support du schéma non exigé');
assert(concile.includes('providers.push({ ...providers[0], targetedRetry: true });'), 'relance ciblée Luna absente');
assert(!concile.includes('name: "Cohere-Command"'), 'Cohere reste configuré comme siège officiel');
assert(source.includes('const AUTO_CONCILE_MAX_ATTEMPTS_PER_SEAT = 1;'), 'l’observateur pourrait relancer les cinq sièges');

console.log('PASS Luna siège 4: roster, modèle, JSON strict, reasoning désactivé, relance ciblée et extraction O/U');

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'api_server.js'), 'utf8');
const start = source.indexOf('function agentProviderRouting(');
assert.notEqual(start, -1);
const open = source.indexOf(') {', start) + 2;
let depth = 0, quote = null, escape = false, end = -1;
for (let i = open; i < source.length; i++) {
  const ch = source[i];
  if (quote) {
    if (escape) escape = false;
    else if (ch === '\\') escape = true;
    else if (ch === quote) quote = null;
    continue;
  }
  if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
  if (ch === '{') depth++;
  if (ch === '}' && --depth === 0) { end = i + 1; break; }
}
assert.notEqual(end, -1);
const sandbox = {};
vm.runInNewContext(`${source.slice(start, end)};this.route=agentProviderRouting;`, sandbox);

assert.deepEqual({ ...sandbox.route('Mistral-Large', 'https://openrouter.ai/api/v1/chat/completions') },
  { sort: 'throughput', allow_fallbacks: true });
assert.deepEqual({ ...sandbox.route('Mistral-Large', 'https://api.mistral.ai/v1/chat/completions') }, {});
assert.deepEqual({ ...sandbox.route('DeepSeek-V3', 'https://openrouter.ai/api/v1/chat/completions') }, {});
assert.deepEqual({ ...sandbox.route('Mistral-Large', 'https://openrouter.ai/api/v1/chat/completions', { require_parameters: true }) },
  { require_parameters: true, sort: 'throughput', allow_fallbacks: true });

console.log('PASS IA3 throughput routing is scoped to its OpenRouter endpoint and preserves other seat options');

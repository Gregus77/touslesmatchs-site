'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const index = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../public/app.html'), 'utf8');
const take = (source, from, to) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert(start >= 0 && end > start, `missing UI function ${from}`);
  return source.slice(start, end);
};
const votes = ['Perplexity-Web', 'DeepSeek-V3', 'Mistral-Large', 'OpenRouter-Luna', 'OpenRouter-Qwen']
  .map((agent, index) => ({ agent, status: 'voted', direction: index % 2 ? 'under' : 'over', confidence: 80 + index }));
const match = { ou25: { votes, vote_count: 5, consensus_count: 3, locked: true, window_status: 'open' } };

const homeContext = {
  TLMMatchLifecycle: { phase: () => 'live' },
  esc: (value) => String(value),
};
vm.createContext(homeContext);
vm.runInContext(take(index, 'function heroOu25(', 'function heroVoteTime('), homeContext);
homeContext.tlmVotesAreOld = () => false;
vm.runInContext(take(index, 'function tlmVoteCirclesHtml(', 'function renderAnalyzedList('), homeContext);
const homeState = homeContext.heroOu25(match);
const homeHtml = homeContext.tlmVoteCirclesHtml(match);
assert.equal(homeState.slots[1].status, 'voted');
assert.equal(homeState.slots[4].status, 'voted');
assert.match(homeHtml, /IA 2 : vote enregistré, direction réservée à Premium/);
assert.match(homeHtml, /IA 5 : vote enregistré, direction réservée à Premium/);
assert.doesNotMatch(homeHtml, /IA (2|5) : sans réponse/);

const appContext = {
  TLMMatchLifecycle: { phase: () => 'live' },
  esc: (value) => String(value),
};
vm.createContext(appContext);
vm.runInContext(take(app, 'function appOu25(', 'function appVoteTime('), appContext);
appContext.appVoteTime = () => '';
vm.runInContext(take(app, 'function appMiniVotes(', 'function appLogo('), appContext);
const appState = appContext.appOu25(match);
const appHtml = appContext.appMiniVotes(match);
assert.equal(appState.slots[1].status, 'voted');
assert.equal(appState.slots[4].status, 'voted');
assert.match(appHtml, />\?<[\s\S]*>\?</);
assert.doesNotMatch(appHtml, /IA (2|5) : en attente/);

const partialMatch = { ou25: { votes: [
  votes[0],
  { agent: 'DeepSeek-V3', status: 'unavailable', direction: null, reason: 'Fournisseur temporairement limité.' },
  { agent: 'Mistral-Large', status: 'pending', direction: null },
  votes[3],
  { agent: 'OpenRouter-Qwen', status: 'empty', direction: null },
], vote_count: 2, consensus_count: 1, locked: true, window_status: 'open' } };
const partialHome = homeContext.tlmVoteCirclesHtml(partialMatch);
const partialApp = appContext.appMiniVotes(partialMatch);
assert.match(partialHome, /IA 2 : Fournisseur temporairement limité\./);
assert.match(partialHome, /IA 5 : réponse sans vote exploitable/);
assert.match(partialApp, /IA 2 : Fournisseur temporairement limité\./);
assert.match(partialApp, /IA 5 : réponse sans vote exploitable/);
assert.match(partialApp, />2\/5 IA</);

console.log('PASS UI: persisted voted states for seats 2 and 5 render on site and PWA without exposing locked directions');

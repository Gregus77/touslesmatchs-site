'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'api_server.js'), 'utf8');
const start = source.indexOf('function buildOu25VoteSummary');
const end = source.indexOf('\n// Un timeout ou une erreur HTTP', start);
assert(start >= 0 && end > start, 'quorum functions missing');
const context = {
  CONCILE_AGENT_NAMES: ['A', 'B', 'C', 'D', 'E'],
  CLIENT_OU25_MIN_VOTES: 3,
  isOu25Bet: bet => /^(Over|Under) 2\.5 buts$/.test(String(bet || '')),
  console: { error() {} },
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

const vote = (name, side, extra = {}) => ({
  name,
  bet: side === 'o2.5' ? 'Over 2.5 buts' : 'Under 2.5 buts',
  confidence: 82,
  _ou25Markets: { buts: { p: side, c: 82 } },
  ...extra,
});
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const tick = () => new Promise(resolve => setImmediate(resolve));

(async () => {
  const seats = Array.from({ length: 5 }, deferred);
  const progressivelyPersisted = [];
  let finished = false;
  const pending = context.collectAgentsUntilOu25Quorum(seats.map(row => row.promise), result => progressivelyPersisted.push(result));
  pending.then(() => { finished = true; });
  seats[0].resolve(vote('A', 'o2.5'));
  seats[1].resolve(vote('B', 'o2.5'));
  seats[2].resolve(vote('C', 'o2.5'));
  await tick();
  assert.equal(finished, false, 'all bounded seats must settle before freezing a snapshot');
  assert.equal(progressivelyPersisted.length, 3, 'each received vote must be persisted before quorum');
  seats[3].resolve(vote('D', 'o2.5'));
  await tick();
  assert.equal(finished, false, 'the immutable snapshot must wait for the fifth bounded seat');
  seats[4].resolve(vote('E', 'u2.5'));
  const result = await pending;
  assert.equal(result.early, false);
  assert.equal(result.results.length, 5);
  assert.equal(context.buildOu25VoteSummary(result.results.map(r => ({name:r.name,marches:r._ou25Markets})), result.results).recommended, true);
  assert.equal(result.results.find(row => row.name === 'E').bet, 'Under 2.5 buts', 'the late contradictory fifth vote must be preserved');

  const terminal = await context.collectAgentsUntilOu25Quorum([
    Promise.resolve(vote('A','u2.5')),
    Promise.resolve(vote('B','u2.5')),
    Promise.resolve({name:'C',failed:true,failure_type:'unavailable'}),
    Promise.resolve({name:'D',failed:true,failure_type:'parse_error'}),
    Promise.resolve({name:'E',failed:true,failure_type:'unavailable',abstention:true}),
  ]);
  const terminalState = context.buildOu25VoteSummary(
    terminal.results.filter(r => r._ou25Markets).map(r => ({name:r.name,marches:r._ou25Markets})),
    terminal.results
  );
  assert.equal(terminalState.vote_count, 2);
  assert.equal(terminalState.recommended, false, 'abstentions and provider errors must not fill quorum');
  assert.equal(terminalState.votes.find(row => row.agent === 'C').status, 'unavailable');
  assert.equal(terminalState.votes.find(row => row.agent === 'D').status, 'parse_error');

  const rejected = context.buildOu25VoteSummary([
    {name:'A',marches:vote('A','o2.5')._ou25Markets},
    {name:'B',marches:vote('B','o2.5')._ou25Markets},
    {name:'C',marches:vote('C','o2.5')._ou25Markets},
    {name:'D',marches:vote('D','o2.5')._ou25Markets},
  ], [vote('A','o2.5'),vote('B','o2.5'),vote('C','o2.5'),vote('D','o2.5',{statistically_rejected:true})]);
  assert.equal(rejected.vote_count, 3);
  assert.equal(rejected.recommended, true);
  assert.equal(rejected.votes.find(row => row.agent === 'D').status, 'rejected_statistical');

  console.log('PASS quorum: 3/5 accepted only after all five bounded seats settle, statistical rejection excluded');
})().catch(error => { console.error(error); process.exitCode = 1; });

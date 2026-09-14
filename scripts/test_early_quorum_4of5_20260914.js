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
  CLIENT_OU25_MIN_VOTES: 4,
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
  let finished = false;
  const pending = context.collectAgentsUntilOu25Quorum(seats.map(row => row.promise));
  pending.then(() => { finished = true; });
  seats[0].resolve(vote('A', 'o2.5'));
  seats[1].resolve(vote('B', 'o2.5'));
  seats[2].resolve(vote('C', 'o2.5'));
  await tick();
  assert.equal(finished, false, '3/5 must remain an intermediate trend');
  seats[3].resolve(vote('D', 'o2.5'));
  await tick();
  assert.equal(finished, false, 'the immutable snapshot must wait for the fifth bounded seat');
  seats[4].resolve(vote('E', 'u2.5'));
  const result = await pending;
  assert.equal(result.early, false);
  assert.equal(result.results.length, 5);
  assert.equal(context.buildOu25VoteSummary(result.results.map(r => ({name:r.name,marches:r._ou25Markets})), result.results).recommended, true);

  const rejected = context.buildOu25VoteSummary([
    {name:'A',marches:vote('A','o2.5')._ou25Markets},
    {name:'B',marches:vote('B','o2.5')._ou25Markets},
    {name:'C',marches:vote('C','o2.5')._ou25Markets},
    {name:'D',marches:vote('D','o2.5')._ou25Markets},
  ], [vote('A','o2.5'),vote('B','o2.5'),vote('C','o2.5'),vote('D','o2.5',{statistically_rejected:true})]);
  assert.equal(rejected.vote_count, 3);
  assert.equal(rejected.recommended, false);
  assert.equal(rejected.votes.find(row => row.agent === 'D').status, 'rejected_statistical');

  console.log('PASS quorum: 3/5 blocked, 4/5 accepted only after all five bounded seats settle, statistical rejection excluded');
})().catch(error => { console.error(error); process.exitCode = 1; });

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const Database = require('better-sqlite3');
const telegramClient = require('./telegram_client');

const source = fs.readFileSync(path.join(__dirname, 'api_server.js'), 'utf8');
function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const open = source.indexOf('{', start);
  let depth = 0, quote = null, escaped = false;
  for (let index = open; index < source.length; index++) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth++;
    if (char === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

const actualFunctions = ['claimHermesBilan', 'finishHermesBilan', 'dueHermesBilanSlot', 'hermesBilanPeriod']
  .map(extractFunction).join('\n');
const sandbox = { telegramClient, Date };
vm.runInNewContext(`${actualFunctions}\nthis.claim=claimHermesBilan;this.finish=finishHermesBilan;this.due=dueHermesBilanSlot;this.period=hermesBilanPeriod;`, sandbox);

assert.equal(sandbox.due(8), null);
assert.equal(sandbox.due(9), '09');
assert.equal(sandbox.due(20), '09');
assert.equal(sandbox.due(21), '21');
assert.equal(sandbox.due(23), '21');
assert.equal(sandbox.due(9), '09', 'restart at 10 can catch up morning slot before 21');

for (const [instant, hours] of [['2026-03-29T12:00:00Z', 23], ['2026-10-25T12:00:00Z', 25]]) {
  const parisDay = telegramClient.parisParts(Date.parse(instant)).day;
  const bounds = telegramClient.parisDayBounds(parisDay);
  assert.equal((Date.parse(bounds.end) - Date.parse(bounds.start)) / 3600000, hours);
}
const morning = sandbox.period('09', new Date('2026-09-18T07:00:00Z'));
assert.equal(morning.label, 'veille (Europe/Paris)');
assert.equal(telegramClient.parisParts(Date.parse(morning.start)).day, '2026-09-17');
const evening = sandbox.period('21', new Date('2026-09-18T19:00:00Z'));
assert.equal(evening.end, '2026-09-18T19:00:00.000Z');
assert.equal(telegramClient.parisParts(Date.parse(evening.start)).day, '2026-09-18');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tlm-hermes-bilan-'));
const dbPath = path.join(dir, 'runtime.sqlite');
let db = new Database(dbPath);
const parisDay = '2026-09-18';
assert.equal(sandbox.claim(db, parisDay, '09'), true, 'first claim succeeds');
assert.equal(sandbox.claim(db, parisDay, '09'), false, 'concurrent/repeated claim is rejected');
assert.equal(sandbox.finish(db, parisDay, '09', false), true, 'failed send releases slot for retry');
assert.equal(sandbox.claim(db, parisDay, '09'), true, 'failed send can retry');
assert.equal(sandbox.finish(db, parisDay, '09', true), true);
db.close();

db = new Database(dbPath);
assert.equal(sandbox.claim(db, parisDay, '09'), false, 'sent marker survives process restart');
assert.equal(sandbox.claim(db, parisDay, '21'), true, 'evening remains an independent slot');
db.prepare("UPDATE hermes_bilan_dispatch SET claimed_at=? WHERE day=? AND slot=?")
  .run(new Date(Date.now() - 11 * 60 * 1000).toISOString(), parisDay, '21');
assert.equal(sandbox.claim(db, parisDay, '21'), true, 'stale in-flight claim recovers after 10 minutes');
assert.equal(db.prepare('SELECT count(*) n FROM hermes_bilan_dispatch').get().n, 2, 'unique day/slot rows prevent duplicates');
db.close();
fs.rmSync(dir, { recursive: true, force: true });

console.log('PASS real Paris slots, DST boundaries, persistent/retryable atomic dispatch, restart and concurrent duplicate suppression');

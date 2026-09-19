'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Database = require(process.env.TEST_SQLITE_MODULE || 'better-sqlite3');

const source = fs.readFileSync(path.join(__dirname, 'shadow_tournament_worker.js'), 'utf8');
const settleSource = source.match(/function settle\([^]*?\n\}/)?.[0];
const resolveSource = source.match(/function resolveFinished\(\) \{[^]*?\n\}/)?.[0];
assert.ok(settleSource && resolveSource, 'shadow settlement functions must remain available');
assert.doesNotMatch(source, /TELEGRAM_BOT_TOKEN|telegram_signal_deliveries|official_signal_registry/);
assert.match(source, /influences_telegram:\s*false/);
assert.match(source, /automatic_promotion:\s*false/);

const db = new Database(':memory:');
db.exec(`
  CREATE TABLE concile_analyses (
    match_key TEXT PRIMARY KEY,
    final_score_home INTEGER,
    final_score_away INTEGER
  );
  CREATE TABLE shadow_tournament_predictions (
    id INTEGER PRIMARY KEY, match_key TEXT, prediction TEXT, outcome TEXT,
    final_score_home INTEGER, final_score_away INTEGER, resolved_at TEXT
  );
  CREATE TABLE shadow_market_predictions (
    id INTEGER PRIMARY KEY, match_key TEXT, selection TEXT, outcome TEXT,
    final_score_home INTEGER, final_score_away INTEGER, resolved_at TEXT
  );
  CREATE TABLE client_telegram_outbox (id INTEGER PRIMARY KEY);
  INSERT INTO concile_analyses VALUES ('simulation-shadow', 2, 1);
  INSERT INTO shadow_tournament_predictions
    VALUES (1, 'simulation-shadow', 'Over 2.5 buts', NULL, NULL, NULL, NULL);
  INSERT INTO shadow_market_predictions
    VALUES (1, 'simulation-shadow', 'BTTS Oui', NULL, NULL, NULL, NULL);
`);

const context = { db };
vm.createContext(context);
vm.runInContext(`${settleSource}\n${resolveSource}`, context);
const resolved = context.resolveFinished();
assert.deepEqual({ primary: resolved.primary, markets: resolved.markets }, { primary: 1, markets: 1 });
assert.equal(db.prepare('SELECT outcome FROM shadow_tournament_predictions').get().outcome, 'win');
assert.equal(db.prepare('SELECT outcome FROM shadow_market_predictions').get().outcome, 'win');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM client_telegram_outbox').get().n, 0);
db.close();

console.log('PASS shadow persistence: isolated predictions and results saved; no client outbox or automatic promotion');

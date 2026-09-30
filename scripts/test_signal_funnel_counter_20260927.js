'use strict';
const assert = require('assert');
const Database = require('better-sqlite3');
const { STAGES, createSignalFunnelCounter } = require('./signal_funnel_counter');

const expectedStages = [
  'fixtures_seen','live_stats_available','minute_window_valid','first_half_confirmed',
  'votes_received','consensus_4_of_5','confidence_ge_80','real_odd_present',
  'real_odd_in_range','official_registry','site_exposed','telegram_attempted','telegram_succeeded'
];
assert.deepStrictEqual(STAGES, expectedStages);

const db = new Database(':memory:');
let now = Date.UTC(2026, 8, 27, 10, 0, 0);
const counter = createSignalFunnelCounter({ db, now: () => now });

assert.equal(counter.recordStage('fixtures_seen', 'fixture:1'), true);
assert.equal(counter.recordStage('fixtures_seen', 'fixture:1'), false, 'same stage/event is idempotent');
assert.throws(() => counter.recordStage('unknown', 'fixture:1'), /Unknown funnel stage/);

counter.recordPipeline('snapshot:1', [
  'fixtures_seen','live_stats_available','minute_window_valid','first_half_confirmed',
  'votes_received','consensus_4_of_5','confidence_ge_80','real_odd_present','real_odd_in_range'
], 'official_registry_missing');
assert.equal(counter.recordRejection('snapshot:1', 'different_reason'), false, 'first rejection is exclusive');

counter.recordPipeline('snapshot:2', expectedStages, null);
let report = counter.report(7);
assert.equal(report.ok, true);
assert.equal(report.days.length, 1);
assert.equal(report.days[0].stages.fixtures_seen, 3);
assert.equal(report.days[0].stages.telegram_succeeded, 1);
assert.deepStrictEqual(report.days[0].rejections, { official_registry_missing: 1 });
assert.equal(JSON.stringify(report).includes('fixture:1'), false, 'report never exposes event identifiers');

now += 8 * 86400000;
counter.recordStage('fixtures_seen', 'fixture:new');
report = counter.report(7);
assert.equal(report.days.length, 1, 'data older than seven retained calendar days is pruned');
assert.equal(report.days[0].stages.fixtures_seen, 1);

db.close();
console.log('PASS signal funnel persistence, idempotency, exclusive rejection and 7-day retention');

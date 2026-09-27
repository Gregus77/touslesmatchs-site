'use strict';
const assert = require('assert');
const Database = require('better-sqlite3');
const { validateCaptureBatch, validateExtraction, classifyCandidate, fuseCouncilVotes,
  createLiveCaptureStore } = require('./live_capture_analysis');

function capture(category, overrides = {}) {
  return { category, mimeType: 'image/jpeg', sizeBytes: 500000, dataUrl: 'data:image/jpeg;base64,AA==', ...overrides };
}

assert.deepStrictEqual(
  validateCaptureBatch([capture('odds'), capture('odds'), capture('odds'), capture('stats')]),
  { ok: true, oddsCount: 3, statsCount: 1, totalBytes: 2000000 },
);
assert.strictEqual(
  validateCaptureBatch([capture('odds'), capture('odds'), capture('stats')]).error,
  'Ajoutez une capture des cotes',
);
assert.strictEqual(
  validateCaptureBatch([capture('odds'), capture('odds'), capture('odds'), capture('odds')]).error,
  'Ajoutez une capture des statistiques',
);
assert.strictEqual(
  validateCaptureBatch(Array.from({ length: 11 }, (_, i) => capture(i < 9 ? 'odds' : 'stats'))).error,
  'Maximum 10 captures',
);
assert.strictEqual(
  validateCaptureBatch([capture('odds'), capture('odds'), capture('odds'), capture('stats', { mimeType: 'image/svg+xml' })]).error,
  'Format image non autorise',
);

const source = {
  match: { home: 'Serbie', away: 'Pays-Bas', minute: 55, scoreHome: 1, scoreAway: 1 },
  screenshots: [
    { category: 'odds', bookmaker: 'Winamax' },
    { category: 'odds', bookmaker: ' winamax ' },
    { category: 'odds', bookmaker: 'WINAMAX' },
    { category: 'stats' },
  ],
  markets: [{ market: '1X2', selection: 'away', odd: 1.8 }],
};
const extracted = validateExtraction(source);
assert.strictEqual(extracted.ok, true);
assert.strictEqual(extracted.bookmaker, 'Winamax');
assert.strictEqual(
  validateExtraction({ ...source, screenshots: [{ category: 'odds', bookmaker: 'A' }, { category: 'odds', bookmaker: 'B' }] }).error,
  'Les captures de cotes doivent provenir du meme bookmaker',
);

assert.strictEqual(classifyCandidate(0.6, 1.8).label, 'VALUE');
assert.strictEqual(classifyCandidate(0.55, 1.8).label, 'COHERENT');
assert.strictEqual(classifyCandidate(0.4, 1.8).label, 'RISQUE');

const verdict = fuseCouncilVotes([
  { seat: 'internal-a', market: '1X2', selection: 'away', probability: 0.60 },
  { seat: 'internal-b', market: '1X2', selection: 'away', probability: 0.58 },
  { seat: 'internal-c', market: '1X2', selection: 'away', probability: 0.62 },
  { seat: 'internal-d', market: '1X2', selection: 'draw', probability: 0.30 },
  { seat: 'internal-e', market: '1X2', selection: 'away', probability: 0.56 },
], [{ market: '1X2', selection: 'away', odd: 1.8 }]);
assert.strictEqual(verdict.best.market, '1X2');
assert.strictEqual(verdict.best.selection, 'away');
assert.strictEqual(verdict.best.agreement, 4);
assert.strictEqual(verdict.best.totalValidSeats, 5);
assert.strictEqual(verdict.best.probability, 0.59);
assert.strictEqual(JSON.stringify(verdict).includes('internal-a'), false);

const db = new Database(':memory:');
const store = createLiveCaptureStore({ db, now: () => '2026-09-27T18:00:00.000Z' });
const batch = [capture('odds'), capture('odds'), capture('odds'), capture('stats')];
const session = store.createSession({ owner: 'greg-admin', captures: batch });
assert.strictEqual(session.status, 'draft');
assert.strictEqual(JSON.stringify(session).includes('data:image'), false, 'database metadata must not contain image bytes');
store.saveExtraction(session.id, source);
const confirmed = store.confirmSnapshot(session.id, source);
assert.strictEqual(confirmed.status, 'confirmed');
assert.throws(() => store.confirmSnapshot(session.id, source), /Session deja confirmee/);
const analysed = store.saveVotes(session.id, [
  { seat: 'internal-a', market: '1X2', selection: 'away', probability: 0.60, reasoningShort: 'A' },
  { seat: 'internal-b', market: '1X2', selection: 'away', probability: 0.58, reasoningShort: 'B' },
  { seat: 'internal-c', market: '1X2', selection: 'away', probability: 0.62, reasoningShort: 'C' },
  { seat: 'internal-d', market: '1X2', selection: 'draw', probability: 0.30, reasoningShort: 'D' },
  { seat: 'internal-e', market: '1X2', selection: 'away', probability: 0.56, reasoningShort: 'E' },
]);
assert.strictEqual(analysed.status, 'analysed');
assert.strictEqual(analysed.verdict.best.agreement, 4);
assert.strictEqual(JSON.stringify(analysed).includes('internal-a'), false);
assert.throws(
  () => db.prepare('UPDATE live_capture_predictions SET probability=0.99').run(),
  /immutable/,
);

for (let i = 0; i < 9; i += 1) {
  const extra = store.createSession({ owner: 'greg-admin', captures: batch });
  store.saveExtraction(extra.id, source);
  store.confirmSnapshot(extra.id, source);
}
assert.strictEqual(store.dailyCount('greg-admin'), 10);
const overLimit = store.createSession({ owner: 'greg-admin', captures: batch });
store.saveExtraction(overLimit.id, source);
assert.throws(() => store.confirmSnapshot(overLimit.id, source), /Limite quotidienne atteinte/);
db.close();
console.log('PASS live capture validation, bookmaker guard, labels and anonymous fusion');

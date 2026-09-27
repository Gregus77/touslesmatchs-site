'use strict';
const assert = require('assert');
const Database = require('better-sqlite3');
const { validateCaptureBatch, validateExtraction, classifyCandidate, fuseCouncilVotes,
  createLiveCaptureStore, registerLiveCaptureRoutes, parseStrictJson, buildVisionPrompt, buildCouncilPrompt } = require('./live_capture_analysis');

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


async function postJson(base, route, body, admin = true) {
  const response = await fetch(base + route, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(admin ? { 'x-test-admin': 'yes' } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function runRouteContract() {
  assert.strictEqual(typeof registerLiveCaptureRoutes, 'function',
    'registerLiveCaptureRoutes must be exported for the admin integration');

  const express = require('express');
  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  const routeDb = new Database(':memory:');
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tlm-live-capture-'));
  const extraction = {
    match: { home: 'Serbie', away: 'Pays-Bas', minute: 55, scoreHome: 1, scoreAway: 1 },
    screenshots: [
      { category: 'odds', bookmaker: 'Winamax' },
      { category: 'odds', bookmaker: 'Winamax' },
      { category: 'odds', bookmaker: 'Winamax' },
      { category: 'stats' },
    ],
    markets: [{ market: '1X2', selection: 'away', odd: 1.8 }],
    stats: { shotsHome: 7, shotsAway: 10 },
  };
  let visionCalls = 0;
  assert.throws(() => parseStrictJson('{malformed'), /Unexpected token|JSON/);
  const visionPrompt = buildVisionPrompt([{ category: 'odds' }, { category: 'stats' }]);
  assert.match(visionPrompt, /N invente aucune/);
  const councilPrompt = buildCouncilPrompt({ markets: extraction.markets, match: extraction.match });
  assert.match(councilPrompt, /Analyse exclusivement le JSON confirme/);
  assert.strictEqual(councilPrompt.includes('Perplexity'), false);

  const councilInputs = [];
  const app = express();
  app.use(express.json({ limit: '20mb' }));
  registerLiveCaptureRoutes({
    app,
    db: routeDb,
    storageDir,
    enabled: () => true,
    requireAdmin: (req) => req.headers['x-test-admin'] === 'yes' ? 'greg-admin' : null,
    callVision: async ({ captures }) => {
      visionCalls += 1;
      assert.strictEqual(captures.length, 4);
      return { text: JSON.stringify(extraction), usage: { tokensIn: 100, tokensOut: 40, costUsd: 0.01 } };
    },
    callCouncil: async ({ seat, confirmed }) => {
      councilInputs.push({ seat, confirmed });
      if (seat === 'seat-5') return { text: '{malformed' };
      if (seat === 'seat-4') return { text: JSON.stringify({ market: 'marche invente', selection: 'oui', probability: 0.99 }) };
      return {
        text: JSON.stringify({
          market: '1X2',
          selection: 'away',
          probability: 0.6 + councilInputs.length / 100,
          reasoningShort: 'Donnees confirmees uniquement',
        }),
        usage: { tokensIn: 50, tokensOut: 20, costUsd: 0.001 },
      };
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const routeCaptures = [
    capture('odds', { sizeBytes: 1 }),
    capture('odds', { sizeBytes: 1 }),
    capture('odds', { sizeBytes: 1 }),
    capture('stats', { sizeBytes: 1 }),
  ];

  try {
    const denied = await postJson(base, '/admin/live-capture/sessions', { captures: routeCaptures }, false);
    assert.strictEqual(denied.status, 403);
    assert.strictEqual(routeDb.prepare('SELECT COUNT(*) n FROM live_capture_sessions').get().n, 0,
      'non-admin must be rejected before session or file creation');
    assert.deepStrictEqual(fs.readdirSync(storageDir), []);

    const created = await postJson(base, '/admin/live-capture/sessions', { captures: routeCaptures });
    assert.strictEqual(created.status, 201);
    assert.strictEqual(created.body.session.status, 'extracted');
    assert.strictEqual(visionCalls, 1, 'vision is called exactly once for a session');
    assert.deepStrictEqual(fs.readdirSync(storageDir), [], 'ephemeral images are removed after extraction');

    const confirmedRoute = await postJson(
      base,
      '/admin/live-capture/sessions/' + created.body.session.id + '/confirm',
      { confirmed: extraction },
    );
    assert.strictEqual(confirmedRoute.status, 200);
    assert.strictEqual(confirmedRoute.body.session.status, 'confirmed');

    const analysedRoute = await postJson(
      base,
      '/admin/live-capture/sessions/' + created.body.session.id + '/analyse',
      {},
    );
    assert.strictEqual(analysedRoute.status, 200);
    assert.strictEqual(analysedRoute.body.session.status, 'analysed');
    assert.strictEqual(councilInputs.length, 5, 'all five existing seats receive one confirmed JSON analysis');
    assert.ok(councilInputs.every((entry) => JSON.stringify(entry.confirmed) === JSON.stringify(confirmedRoute.body.session.confirmed)));
    assert.strictEqual(JSON.stringify(analysedRoute.body).includes('seat-'), false,
      'provider and seat identities never reach the admin response');
    assert.strictEqual(analysedRoute.body.session.verdict.best.agreement, 3,
      'malformed and out-of-snapshot seats are excluded without invented ballots');
    assert.strictEqual(JSON.stringify(analysedRoute.body).includes('marche invente'), false);
    assert.deepStrictEqual(analysedRoute.body.session.usage, {
      tokensIn: 250,
      tokensOut: 100,
      costUsd: 0.013000000000000001,
    }, 'vision and only valid council usage are accounted together');

    const duplicate = await postJson(
      base,
      '/admin/live-capture/sessions/' + created.body.session.id + '/analyse',
      {},
    );
    assert.strictEqual(duplicate.status, 409);
    assert.strictEqual(councilInputs.length, 5, 'duplicate analysis never bills the council twice');

    const createdMismatch = await postJson(base, '/admin/live-capture/sessions', { captures: routeCaptures });
    assert.strictEqual(createdMismatch.status, 201);
    const mismatch = JSON.parse(JSON.stringify(extraction));
    mismatch.screenshots[1].bookmaker = 'Betclic';
    const rejected = await postJson(
      base,
      '/admin/live-capture/sessions/' + createdMismatch.body.session.id + '/confirm',
      { confirmed: mismatch },
    );
    assert.strictEqual(rejected.status, 400);
    assert.match(rejected.body.error, /meme bookmaker/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    routeDb.close();
    fs.rmSync(storageDir, { recursive: true, force: true });
  }
}

runRouteContract()
  .then(() => console.log('PASS admin live capture routes, one vision extraction, five anonymous seats and cleanup'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

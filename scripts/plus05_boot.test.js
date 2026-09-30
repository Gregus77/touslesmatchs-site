'use strict';
const test = require('node:test');
const assert = require('node:assert');
let Database;
try { Database = require('better-sqlite3'); } catch { Database = require('node:sqlite').DatabaseSync; }
const boot = require('./plus05_boot');

function setup(envExtra = {}) {
  const routes = {};
  const app = { get: (p, h) => { [].concat(p).forEach((x) => { routes[x] = h; }); } };
  const db = new Database(':memory:');
  const calls = { http: [] };
  const engine = boot({
    app, db, log: { log() {}, error() {} },
    httpGet: async (url) => { calls.http.push(url); return { response: [] }; },
    httpPost: async (url, body) => ({ choices: [{ message: { content: '{"vote":"OUI"}' } }] }),
    resolveModel: (x) => x, fetchLiveMatches: async () => [],
    isAdminAccess: (email, code) => email === 'admin@x' && code === 'OK',
    publisher: { targets: [], enqueue: () => true, flush: async () => {} },
    parisParts: () => ({ day: '2026-10-03', hour: 10, minute: 0 }),
    env: { API_SPORTS_KEY: 'k', ...envExtra },
  });
  const call = (path, query = {}) => { let out; const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { out = { code: this.statusCode, body: b }; return this; } }; routes[path]({ query }, res); return out; };
  return { routes, engine, call, db, calls };
}

test('routes admin et publique enregistrees, schema cree', () => {
  const { routes, db } = setup();
  assert.ok(routes['/admin/plus05-log']);
  assert.ok(routes['/api/plus05/stats']);
  assert.ok(routes['/plus05/stats'], 'route sans prefixe /api (Caddy le retire)');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name);
  assert.ok(tables.includes('plus05_signals') && tables.includes('plus05_watchlist'));
});
test('journal admin : 403 sans droits, 200 avec droits, flags inactifs par defaut', () => {
  const { call } = setup();
  assert.equal(call('/admin/plus05-log', { email: 'x', code: 'no' }).code, 403);
  const ok = call('/admin/plus05-log', { email: 'admin@x', code: 'OK' });
  assert.equal(ok.code, 200);
  assert.equal(ok.body.flags.enabled, false);
  assert.equal(ok.body.flags.dryRun, true);
  assert.ok(ok.body.leagues > 30);
});
test('stats publiques : vides et sans donnees sensibles', () => {
  const { call } = setup();
  const r = call('/api/plus05/stats');
  assert.equal(r.body.ok, true);
  assert.equal(r.body.total, 0);
  assert.deepEqual(r.body.recent, []);
});
test('reglages par variables d environnement', () => {
  const { call } = setup({ PLUS05_ENABLED: '1', PLUS05_DRY_RUN: '0', PLUS05_LEAGUE_IDS: '39,140' });
  const b = call('/admin/plus05-log', { email: 'admin@x', code: 'OK' }).body;
  assert.equal(b.flags.enabled, true);
  assert.equal(b.flags.dryRun, false);
  assert.equal(b.leagues, 2);
});

test('la carte application est ecrite dans le fichier lu par /goal05/latest', async () => {
  const fs = require('fs'), os = require('os'), path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p05-'));
  const file = path.join(dir, 'sub', 'goal05-latest-signal.json');
  const { engine } = (() => { const r = setup({ GOAL05_LATEST_SIGNAL_FILE: file, PLUS05_DRY_RUN: '0' }); return { engine: r.engine }; })();
  assert.ok(engine);
  // le moteur ecrit via onSignal : on le declenche par le chemin reel (publication simulee)
  const w = { fixture_id: '5', home: 'A', away: 'B', competition: 'L', fav_name: 'A', opp_name: 'B', side: 'home', fav_id: 1, fav_rank: 1, opp_rank: 20, total_teams: 20, fav_scored_in: 5, fav_goals5: 9, opp_conceded_in: 5 };
  await engine._internals.publish(w, { minute: 60, score_home: 0, score_away: 1 }, { odd: 1.7 }, { yes: 5, total: 5, results: [] });
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(saved.team, 'A');
  assert.equal(saved.odd, 1.7);
});

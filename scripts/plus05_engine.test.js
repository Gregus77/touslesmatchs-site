'use strict';
const test = require('node:test');
const assert = require('node:assert');
let Database;
try { Database = require('better-sqlite3'); } catch { Database = require('node:sqlite').DatabaseSync; }
const { createPlus05Engine } = require('./plus05_engine');

const NOW = Date.UTC(2026, 9, 3, 15, 0, 0);
const FIX = 9001;
const table = (n, favId, oppId) => ({
  response: [{ league: { standings: [Array.from({ length: n }, (_, i) => ({ rank: i + 1, team: { id: i + 1 === 2 ? favId : i + 1 === 19 ? oppId : 100 + i } }))] } }],
});
const formFix = (teamId, list) => ({ response: list.map(([gf, ga], i) => ({ fixture: { timestamp: 1000 - i }, teams: { home: { id: teamId }, away: { id: 999 } }, goals: { home: gf, away: ga } })) });

function build(opts = {}) {
  const db = new Database(':memory:');
  const sent = [];
  let clock = NOW;
  let odd = opts.odd ?? 1.65, liveGoals = opts.favGoals ?? 0, suspended = false;
  const calls = { seats: 0, apis: [] };
  const apiGet = async (path) => {
    calls.apis.push(path);
    if (path.startsWith('/fixtures?date=')) return { response: [{ fixture: { id: FIX, timestamp: Math.floor((NOW - 3600e3) / 1000) }, league: { id: 39, name: 'Premier League', country: 'England', season: 2026 }, teams: { home: { id: 10, name: 'Alpha FC' }, away: { id: 20, name: 'Omega FC' } } }] };
    if (path.startsWith('/standings')) return table(20, 10, 20);
    if (path.startsWith('/fixtures?team=10')) return formFix(10, [[2, 1], [1, 0], [3, 1], [1, 2], [2, 0]]);
    if (path.startsWith('/fixtures?team=20')) return formFix(20, [[0, 2], [1, 3], [0, 1], [2, 2], [1, 1]]);
    if (path.startsWith('/players/squads')) return { response: [{ players: [{ id: 7, position: 'Attacker' }, { id: 8, position: 'Midfielder' }] }] };
    if (path.startsWith('/injuries')) return { response: opts.injuredAttacker ? [{ team: { id: 10 }, player: { id: 7, name: 'Star' } }] : [] };
    if (path.startsWith('/fixtures/lineups')) return { response: [{ team: { id: 10 }, startXI: [{ player: { pos: 'F' } }, { player: { pos: 'M' } }] }] };
    if (path === '/odds/live' || path.startsWith('/odds/live?fixture=')) {
      const e = { fixture: { id: FIX, status: { elapsed: 58 } }, teams: { home: { goals: liveGoals }, away: { goals: 1 } }, status: { blocked: false, stopped: false }, update: new Date(NOW).toISOString(),
        odds: [{ id: 58, values: [{ value: 'Over', handicap: '0.5', odd: String(odd), suspended }] }] };
      return { response: [e] };
    }
    if (path.startsWith('/fixtures?id=')) return { response: [{ fixture: { status: { short: 'FT' } }, goals: { home: opts.finalHome ?? 1, away: 1 }, score: { fulltime: { home: opts.finalHome ?? 1, away: 1 } } }] };
    return { response: [] };
  };
  const eng = createPlus05Engine({
    db, apiGet, now: () => clock, leagueIds: [39], log: { log() {}, error() {} },
    fetchLiveMatches: async () => [{ fixtureId: String(FIX), minute: 58, score_home: liveGoals, score_away: 1 }],
    callSeat: async (seat) => { calls.seats++; const yes = (opts.yesVotes ?? 5) > ['Perplexity-Web', 'DeepSeek-V3', 'Mistral-Large', 'OpenRouter-Luna', 'OpenRouter-Qwen'].indexOf(seat); return { ok: true, text: `{"vote":"${yes ? 'OUI' : 'NON'}","confiance":70,"raison":"test"}` }; },
    publisher: {
      targets: [{ id: 'chatFree', channel: 'free' }, { id: 'chatPrem', channel: 'premium' }],
      enqueue: (kind, data, dest, key) => { sent.push({ kind, data, dest, key }); return true; },
      flush: async () => {},
    },
    flags: () => ({ enabled: true, dryRun: opts.dryRun ?? false, requireHistory: true, sendResults: true }),
  });
  return { db, eng, sent, calls, setOdd: (v) => { odd = v; }, advance: (ms) => { clock += ms; } };
}

test('watchlist : le match top5 vs bottom5 est retenu avec pastille verte', async () => {
  const { db, eng } = build();
  const st = await eng.buildWatchlist('2026-10-03');
  assert.equal(st.eligible, 1);
  const w = db.prepare('SELECT * FROM plus05_watchlist').get();
  assert.equal(w.fav_name, 'Alpha FC');
  assert.equal(w.risk_color, 'vert');
});

test('signal envoye aux 2 salons quand cote 1,65 et 5/5 IA ; anti-doublon au tick suivant', async () => {
  const { db, eng, sent } = build();
  await eng.buildWatchlist('2026-10-03');
  const r1 = await eng.tick();
  assert.equal(r1.sent, 1);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].kind, 'plus05');
  assert.equal(sent[0].data.favName, 'Alpha FC');
  assert.equal(sent[0].data.odd, '1.65');
  assert.equal(sent[0].data.riskColor, 'vert');
  assert.equal(sent[0].data.votes, 5);
  const r2 = await eng.tick();
  assert.equal(sent.length, 2, 'pas de second envoi');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM plus05_signals').get().n, 1);
  void r2;
});

test('aucun signal si cote 1,55', async () => {
  const { eng, sent, calls } = build({ odd: 1.55 });
  await eng.buildWatchlist('2026-10-03');
  const r = await eng.tick();
  assert.equal(sent.length, 0);
  assert.equal(r.reasons.cote_sous_1_60, 1);
  assert.equal(calls.seats, 0, 'aucun appel IA inutile');
});

test('aucun signal si le favori a deja marque', async () => {
  const { eng, sent } = build({ favGoals: 1 });
  await eng.buildWatchlist('2026-10-03');
  await eng.tick();
  assert.equal(sent.length, 0);
});

test('aucun signal avec 3 IA sur 5 seulement', async () => {
  const { eng, sent } = build({ yesVotes: 3 });
  await eng.buildWatchlist('2026-10-03');
  const r = await eng.tick();
  assert.equal(sent.length, 0);
  assert.equal(r.reasons.quorum_insuffisant, 1);
});

test('4 IA sur 5 suffisent', async () => {
  const { eng, sent } = build({ yesVotes: 4 });
  await eng.buildWatchlist('2026-10-03');
  await eng.tick();
  assert.equal(sent.length, 2);
});

test('attaquant blesse : pas de signal', async () => {
  const { eng, sent, calls } = build({ injuredAttacker: true });
  await eng.buildWatchlist('2026-10-03');
  const r = await eng.tick();
  assert.equal(sent.length, 0);
  assert.equal(r.reasons.attaquants_non_verifies, 1);
  assert.equal(calls.seats, 0);
});

test('essai a blanc : enregistre mais n envoie rien', async () => {
  const { db, eng, sent } = build({ dryRun: true });
  await eng.buildWatchlist('2026-10-03');
  await eng.tick();
  assert.equal(sent.length, 0);
  assert.equal(db.prepare('SELECT dry_run FROM plus05_signals').get().dry_run, 1);
});

test('resultat : favori a marque = win, sinon loss ; journal admin coherent', async () => {
  for (const [finalHome, expected] of [[1, 'win'], [0, 'loss']]) {
    const { db, eng, sent, advance } = build({ finalHome });
    await eng.buildWatchlist('2026-10-03');
    await eng.tick();
    assert.equal((await eng.settlePending()).resolved, 0, 'trop tot : < 20 min');
    advance(2 * 3600e3);
    const s = await eng.settlePending();
    assert.equal(s.resolved, 1);
    assert.equal(db.prepare('SELECT outcome FROM plus05_signals').get().outcome, expected);
    assert.equal(sent.length, 4, '2 salons x (signal + resultat)');
    const rep = eng.adminReport();
    assert.equal(rep.total, 1);
    assert.equal(rep.winRatePct, expected === 'win' ? 100 : 0);
    assert.equal(rep.signals[0].team, 'Alpha FC');
    assert.equal(rep.signals[0].oddSource, 'api-sports live (indicative)');
  }
});

test('journal admin : les essais a blanc sont exclus par defaut', async () => {
  const { eng } = build({ dryRun: true });
  await eng.buildWatchlist('2026-10-03');
  await eng.tick();
  assert.equal(eng.adminReport().total, 0);
  assert.equal(eng.adminReport({ includeDry: true }).total, 1);
});

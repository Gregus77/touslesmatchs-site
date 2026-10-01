'use strict';
// Test du radar +0,5 but : filtres, classement, extraction de cote, cycle
// complet (candidat -> surveillance -> GO -> resultat) et modele Telegram.
// Lancer : node scripts/test_radar05_20261001.js   (Node >= 22, sans reseau)
const assert = require('assert');
const { DatabaseSync } = require('node:sqlite');
const radar = require('./radar05');
const client = require('./telegram_client');

// Adaptateur minimal node:sqlite -> API better-sqlite3 utilisee par le radar.
function openDb() {
  const d = new DatabaseSync(':memory:');
  return { exec: s => d.exec(s), prepare: s => { const st = d.prepare(s); return { run: (...a) => st.run(...a), get: (...a) => st.get(...a), all: (...a) => st.all(...a) }; } };
}

const cfg = radar.defaultConfig({});
const quiet = { log() {}, warn() {}, error() {} };

// ── 1. Perimetre ─────────────────────────────────────────────────────────────
const fx = (over = {}) => ({ homeId: 1, awayId: 2, leagueId: 61, season: 2026, leagueName: 'Ligue 1', country: 'France', round: 'Regular Season - 8', home: 'A', away: 'B', ...over });
assert.equal(radar.staticExclusion(fx(), cfg), null);
assert.equal(radar.staticExclusion(fx({ leagueName: 'Ligue 2' }), cfg), null);
assert.equal(radar.staticExclusion(fx({ leagueName: 'Serie B', country: 'Italy' }), cfg), null);
assert.equal(radar.staticExclusion(fx({ leagueName: 'Championship', country: 'England' }), cfg), null);
for (const name of ['UEFA Champions League', 'UEFA Europa League', 'Coupe de France', 'FA Cup', 'Copa Libertadores', 'Friendlies', 'UEFA Nations League', 'World Cup - Qualification Europe']) {
  assert(radar.staticExclusion(fx({ leagueName: name }), cfg), `${name} doit etre exclu`);
}
assert.equal(radar.staticExclusion(fx({ country: 'World', leagueName: 'Something' }), cfg), 'competition_internationale');
for (const name of ['3. Liga', 'League Two', 'League One', 'Serie C', 'Regionalliga', 'National 2', 'Primera RFEF', 'Liga 3']) {
  assert.equal(radar.staticExclusion(fx({ leagueName: name }), cfg), 'division_inferieure', `${name} = division inferieure`);
}
assert.equal(radar.staticExclusion(fx({ leagueName: '3. Liga' }), { ...cfg, onlyTop2: false }), null);
assert.equal(radar.staticExclusion(fx({ homeId: null }), cfg), 'identifiants_manquants');
assert.equal(radar.staticExclusion(fx(), cfg, () => 'feminin'), 'feminin');

// ── 2. Classement ────────────────────────────────────────────────────────────
function table(n, over = {}) {
  return [Array.from({ length: n }, (_, i) => ({ teamId: i + 1, rank: i + 1, played: 10, gf: 30 - i, ga: 8 + i, ...(over[i + 1] || {}) }))];
}
const g18 = table(18);
const m = (h, a) => fx({ homeId: h, awayId: a });
assert.equal(radar.evaluateStandings(m(1, 18), g18, cfg).side, 'home');         // domicile top 1 vs dernier
assert.equal(radar.evaluateStandings(m(16, 3), g18, cfg).side, 'away');         // exterieur top 3 vs 16e (bas de tableau)
assert.equal(radar.evaluateStandings(m(5, 14), g18, cfg).side, 'home');         // 5e vs 14e = les 5 derniers (14..18)
assert.equal(radar.evaluateStandings(m(6, 18), g18, cfg).reason, 'pas_top_contre_bas');
assert.equal(radar.evaluateStandings(m(1, 13), g18, cfg).reason, 'pas_top_contre_bas');
assert.equal(radar.evaluateStandings(m(1, 99), g18, cfg).reason, 'classement_indisponible');
assert.equal(radar.evaluateStandings(m(1, 8), table(8), cfg).reason, 'classement_trop_court');
assert.equal(radar.evaluateStandings(m(1, 18), table(18, { 1: { played: 3 } }), cfg).reason, 'debut_de_saison');
assert.equal(radar.evaluateStandings(m(1, 18), table(18, { 1: { gf: 8 } }), cfg).reason, 'attaque_peu_prolifique');
assert.equal(radar.evaluateStandings(m(1, 18), table(18, { 18: { ga: 5 } }), cfg).reason, 'defense_adverse_solide');
const ev = radar.evaluateStandings(m(1, 18), g18, cfg);
assert(ev.ok && ev.target.gf === 30 && ev.opponent.rank === 18);
// Championnat a plusieurs groupes : on choisit celui qui contient les deux equipes.
const two = [table(12)[0], table(12)[0].map(r => ({ ...r, teamId: r.teamId + 100 }))];
assert.equal(radar.evaluateStandings(m(101, 112), two, cfg).side, 'home');
assert.equal(radar.evaluateStandings(m(1, 112), two, cfg).reason, 'classement_indisponible');

// ── 3. Extraction de cote ────────────────────────────────────────────────────
const teams = { home: 'Paris FC', away: 'Le Havre' };
const live = { response: [{ odds: [
  { name: 'Home Team Total Goals', values: [{ value: 'Over', handicap: '0.5', odd: '1.62' }, { value: 'Under', handicap: '0.5', odd: '2.10' }] },
  { name: 'Away Team Total Goals', values: [{ value: 'Over', handicap: '0.5', odd: '1.20' }] },
  { name: 'Match Goals', values: [{ value: 'Over', handicap: '2.5', odd: '1.90' }] },
] }] };
assert.equal(radar.extractTeamOver05(live, teams, 'home').odd, 1.62);
assert.equal(radar.extractTeamOver05(live, teams, 'away').odd, 1.20);
const pre = { response: [{ bookmakers: [
  { name: 'Unibet', bets: [{ name: 'Total - Home', values: [{ value: 'Over 0.5', odd: '1.40' }, { value: 'Over 1.5', odd: '2.60' }] }] },
  { name: 'Winamax', bets: [{ name: 'Total - Home', values: [{ value: 'Over 0.5', odd: '1.50' }] }] },
  { name: 'PMU', bets: [{ name: 'Home Team Score a Goal', values: [{ value: 'Yes', odd: '1.45' }] }] },
] }] };
assert.equal(radar.extractTeamOver05(pre, teams, 'home').odd, 1.45);  // mediane de 1.40 / 1.45 / 1.50
assert.equal(radar.extractTeamOver05(pre, teams, 'away').odd, null);
// Marches parasites (mi-temps, corners, buteur) jamais pris pour le total equipe.
const noise = { response: [{ odds: [
  { name: 'Home Team Total Goals - 1st Half', values: [{ value: 'Over', handicap: '0.5', odd: '3.00' }] },
  { name: 'Home Corners Over/Under', values: [{ value: 'Over', handicap: '0.5', odd: '1.10' }] },
  { name: 'Anytime Goalscorer Home', values: [{ value: 'Over 0.5', odd: '2.00' }] },
] }] };
assert.equal(radar.extractTeamOver05(noise, teams, 'home').odd, null);
// Cote suspendue = pas de cote exploitable.
const susp = { response: [{ odds: [{ name: 'Home Team Total Goals', values: [{ value: 'Over', handicap: '0.5', odd: '1.80', suspended: true }] }] }] };
const s = radar.extractTeamOver05(susp, teams, 'home');
assert.equal(s.odd, null); assert.equal(s.suspended, true);
// Le nom de l'equipe dans le libelle du marche est reconnu.
const named = { response: [{ bookmakers: [{ name: 'Betclic', bets: [{ name: 'Total Goals Paris FC', values: [{ value: 'Over 0.5', odd: '1.33' }] }] }] }] };
assert.equal(radar.extractTeamOver05(named, teams, 'home').odd, 1.33);
assert.equal(radar.extractTeamOver05(named, teams, 'away').odd, null);

// ── 4. Cycle complet avec fausse API ─────────────────────────────────────────
function apiFixture(id, status, minute, gh, ga, over = {}) {
  return { fixture: { id, date: new Date(Date.now() + 30 * 60000).toISOString(), status: { short: status, elapsed: minute } },
    league: { id: 61, name: 'Ligue 1', country: 'France', season: 2026, round: 'Regular Season - 8' },
    teams: { home: { id: 1, name: 'Paris FC' }, away: { id: 18, name: 'Le Havre' } },
    goals: { home: gh, away: ga }, ...over };
}
const standingsResp = { response: [{ league: { standings: [Array.from({ length: 18 }, (_, i) => ({ team: { id: i + 1 }, rank: i + 1, points: 20 - i, all: { played: 10, goals: { for: 30 - i, against: 8 + i } } }))] } }] };

async function scenario(name, steps, check) {
  const db = openDb();
  let step = 0, calls = [];
  const queued = [], gos = [];
  const publisher = {
    targets: [{ channel: 'free', lang: 'fr', tier: 'free', id: '-1' }, { channel: 'premium', lang: 'fr', tier: 'premium', id: '-2' }],
    enqueue: (kind, data, dest, key, exp) => { const k = `${kind}:${key}:${dest.id}`; if (queued.find(q => q.k === k)) return false; queued.push({ k, kind, data, dest, exp }); return true; },
    flush: async () => true,
  };
  const httpGet = async (url) => {
    calls.push(url);
    const cur = steps[Math.min(step, steps.length - 1)];
    if (url.includes('/fixtures?date=')) return { response: cur.fixtures };
    if (url.includes('/standings')) return standingsResp;
    if (url.includes('/fixtures/headtohead')) return cur.h2h || h2hResp(8, 7);
    if (url.includes('/teams/statistics')) return cur.stats || { response: { fixtures: { played: { total: 10 } }, failed_to_score: { total: 1 } } };
    if (url.includes('/injuries')) return cur.injuries || { response: [] };
    if (url.includes('/players/squads')) return { response: [{ players: [{ id: 7, position: 'Attacker' }, { id: 8, position: 'Midfielder' }] }] };
    if (url.includes('/fixtures/lineups')) return cur.lineups || { response: [] };
    if (url.includes('/odds/live')) return cur.odds ? (typeof cur.odds === 'function' ? cur.odds() : cur.odds) : { response: [] };
    throw new Error('url inattendue ' + url);
  };
  const r = radar.createRadar05({ db, httpGet, apiKey: 'k', publisher, env: {}, log: quiet, config: { coldEvery: 1 }, onGo: (r, f, d) => { gos.push({ r, f, d }); } });
  for (step = 0; step < steps.length; step++) await r.runCycle();
  check({ r, db, queued, calls, gos });
  console.log('  ok -', name);
}
const h2hResp = (n, scored) => ({ response: Array.from({ length: n }, (_, i) => ({ fixture: { status: { short: 'FT' } }, teams: { home: { id: 1 }, away: { id: 18 } }, goals: { home: i < scored ? 1 : 0, away: 0 } })) });
const lineupResp = fw => ({ response: [{ team: { id: 1 }, startXI: [...Array(fw).fill(0).map(() => ({ player: { pos: 'F' } })), ...Array(11 - fw).fill(0).map(() => ({ player: { pos: 'M' } }))] }] });
const goOnly = q => q.filter(x => x.kind === 'radar05');
const oddsResp = odd => ({ response: [{ odds: [{ name: 'Home Team Total Goals', values: [{ value: 'Over', handicap: '0.5', odd: String(odd) }] }] }] });
const row = db => db.prepare('SELECT * FROM radar05_signals').all();

(async () => {
  console.log('Cycle complet :');
  await scenario('candidat -> surveillance -> GO unique -> victoire', [
    { fixtures: [apiFixture(1, 'NS', null, null, null)] },
    { fixtures: [apiFixture(1, '2H', 55, 0, 1)], odds: oddsResp(1.35) },
    { fixtures: [apiFixture(1, '2H', 62, 0, 1)], odds: oddsResp(1.62) },
    { fixtures: [apiFixture(1, '2H', 65, 0, 1)], odds: oddsResp(1.70) },       // pas de 2e alerte
    { fixtures: [apiFixture(1, '2H', 70, 1, 1)] },                              // l'equipe marque
    { fixtures: [apiFixture(1, 'FT', 90, 2, 1)] },
  ], ({ db, queued, r, gos }) => {
    assert.equal(gos.length, 1, 'le GO alimente aussi la notification application, une seule fois');
    assert.equal(gos[0].r.target_name, 'Paris FC'); assert.equal(gos[0].d.odd, '1.62');
    const [x] = row(db);
    assert.equal(x.target_side, 'home'); assert.equal(x.state, 'go');
    assert.equal(x.watch_odd, 1.35); assert.equal(x.go_odd, 1.62); assert.equal(x.go_minute, 62);
    assert.equal(x.outcome, 'win'); assert.equal(x.final_score_home, 2);
    const go = goOnly(queued), watch = queued.filter(q => q.kind === 'radar05watch');
    assert.equal(go.length, 2, 'une alerte GO par canal, jamais plus');
    assert.equal(watch.length, 2, 'une annonce « a surveiller » par canal, jamais plus');
    assert(go.every(q => q.data.team === 'Paris FC' && q.data.odd === '1.62' && q.data.confidence.level === 'green' && q.data.confidence.score === 8));
    assert(watch.every(q => q.data.odd === null && q.data.team === 'Paris FC'));
    assert(go.every(q => q.exp - Date.now() < 11 * 60 * 1000), 'alerte a duree de vie courte');
    const st = r.stats(); assert.equal(st.signals, 1); assert.equal(st.wins, 1); assert.equal(st.hit_rate, 100);
  });

  await scenario('GO puis defaite si l\'equipe ne marque jamais', [
    { fixtures: [apiFixture(2, 'NS', null, null, null)] },
    { fixtures: [apiFixture(2, '2H', 75, 0, 0)], odds: oddsResp(1.75) },
    { fixtures: [apiFixture(2, 'FT', 90, 0, 0)] },
  ], ({ db, r }) => {
    const [x] = row(db); assert.equal(x.outcome, 'loss'); assert.equal(r.stats().losses, 1);
  });

  await scenario('cote qui retombe a la 2e lecture = aucune alerte', [
    { fixtures: [apiFixture(3, 'NS', null, null, null)] },
    { fixtures: [apiFixture(3, '2H', 70, 0, 0)], odds: (() => { let n = 0; return () => oddsResp(n++ % 2 === 0 ? 1.80 : 1.45); })() },
  ], ({ db, queued }) => {
    assert.equal(goOnly(queued).length, 0); assert.notEqual(row(db)[0].state, 'go');
  });

  await scenario('l\'equipe marque avant la cote : jamais de signal', [
    { fixtures: [apiFixture(4, 'NS', null, null, null)] },
    { fixtures: [apiFixture(4, '1H', 20, 1, 0)], odds: oddsResp(1.90) },
  ], ({ db, queued }) => {
    assert.equal(goOnly(queued).length, 0); assert.equal(row(db)[0].state, 'done');
  });

  await scenario('le but de l\'adversaire ne gene pas : GO a 0-1', [
    { fixtures: [apiFixture(5, 'NS', null, null, null)] },
    { fixtures: [apiFixture(5, '2H', 60, 0, 1)], odds: oddsResp(1.65) },
  ], ({ queued }) => assert.equal(goOnly(queued).length, 2));

  await scenario('passe la minute max : pas de GO', [
    { fixtures: [apiFixture(6, 'NS', null, null, null)] },
    { fixtures: [apiFixture(6, '2H', 88, 0, 0)], odds: oddsResp(3.0) },
  ], ({ queued }) => assert.equal(goOnly(queued).length, 0));

  await scenario('mi-temps : aucune interrogation de cotes', [
    { fixtures: [apiFixture(7, 'NS', null, null, null)] },
    { fixtures: [apiFixture(7, 'HT', 45, 0, 0)], odds: oddsResp(2.0) },
  ], ({ queued, calls }) => { assert.equal(goOnly(queued).length, 0); assert(!calls.some(u => u.includes('/odds/live'))); });

  await scenario('match exclu (coupe) et match du milieu de tableau : ignores, un seul appel classement', [
    { fixtures: [
      apiFixture(8, 'NS', null, null, null, { league: { id: 66, name: 'Coupe de France', country: 'France', season: 2026, round: '8th Round' } }),
      apiFixture(9, 'NS', null, null, null, { teams: { home: { id: 6, name: 'X' }, away: { id: 9, name: 'Y' } } }),
    ] },
  ], ({ db, calls, r }) => {
    assert.equal(row(db).length, 0);
    assert.equal(calls.filter(u => u.includes('/standings')).length, 1);
    assert.equal(r._rejected.get('8'), 'competition_hors_championnat'); assert.equal(r._rejected.get('9'), 'pas_top_contre_bas');
  });

  await scenario('plafond de classements par cycle respecte', Array.from({ length: 1 }, () => ({
    fixtures: Array.from({ length: 30 }, (_, i) => apiFixture(100 + i, 'NS', null, null, null, { league: { id: 1000 + i, name: 'Liga ' + i, country: 'Pays' + i, season: 2026, round: 'RS' } })),
  })), ({ calls }) => assert(calls.filter(u => u.includes('/standings') && u.includes('season=2026')).length <= 12));

  await scenario('match reporte : ferme sans signal', [
    { fixtures: [apiFixture(10, 'NS', null, null, null)] },
    { fixtures: [apiFixture(10, 'PST', null, null, null)] },
  ], ({ db }) => assert.equal(row(db)[0].state, 'void'));

  // Vue publique : rien d'exploitable sans abonnement.
  await scenario('vue publique masque equipe et cote', [
    { fixtures: [apiFixture(11, 'NS', null, null, null)] },
    { fixtures: [apiFixture(11, '2H', 70, 0, 0)], odds: oddsResp(1.7) },
  ], ({ r }) => {
    const free = JSON.stringify(r.view(false).matches), paid = r.view(true);
    assert(!free.includes('"team"') && !free.includes('1.7') && !free.includes('odd'));
    assert.equal(paid.matches[0].team, 'Paris FC'); assert.equal(paid.matches[0].state, 'go');
  });

  await scenario('pastille rouge : mauvais face-a-face, attaque muette, aucun attaquant titulaire', [
    { fixtures: [apiFixture(12, 'NS', null, null, null)], h2h: h2hResp(8, 1), stats: { response: { fixtures: { played: { total: 10 } }, failed_to_score: { total: 5 } } }, lineups: lineupResp(0) },
  ], ({ queued, db }) => {
    const w = queued.filter(q => q.kind === 'radar05watch');
    assert.equal(w.length, 2); assert.equal(w[0].data.confidence.level, 'red');
    assert.equal(w[0].data.confidence.parts.h2h.points, 0); assert.equal(w[0].data.confidence.parts.attackers.points, 0);
    assert.equal(row(db)[0].conf_level, 'red');
  });

  await scenario('attaquants relus juste avant le GO : vert a l\'annonce, jaune au GO', [
    { fixtures: [apiFixture(13, 'NS', null, null, null)], stats: { response: { fixtures: { played: { total: 10 } }, failed_to_score: { total: 3 } } }, lineups: lineupResp(3) },
    { fixtures: [apiFixture(13, '2H', 60, 0, 0)], odds: oddsResp(1.40), stats: { response: { fixtures: { played: { total: 10 } }, failed_to_score: { total: 3 } } }, lineups: lineupResp(3) },
    { fixtures: [apiFixture(13, '2H', 66, 0, 0)], odds: oddsResp(1.70), lineups: lineupResp(0), injuries: { response: [{ team: { id: 1 }, player: { id: 7 } }] } },
  ], ({ queued }) => {
    const w = queued.find(q => q.kind === 'radar05watch'), g = queued.find(q => q.kind === 'radar05');
    assert.equal(w.data.confidence.level, 'green'); assert.equal(w.data.confidence.score, 7);
    assert.equal(g.data.confidence.level, 'yellow'); assert.equal(g.data.confidence.parts.attackers.points, 0);
  });

  await scenario('blesse attaquant identifie via l\'effectif quand la composition n\'est pas publiee', [
    { fixtures: [apiFixture(14, 'NS', null, null, null)], injuries: { response: [{ team: { id: 1 }, player: { id: 7 } }, { team: { id: 1 }, player: { id: 8 } }, { team: { id: 18 }, player: { id: 7 } }] } },
  ], ({ queued }) => {
    const a = queued.find(q => q.kind === 'radar05watch').data.confidence.parts.attackers;
    assert.equal(a.missing, 1); assert.equal(a.forwards, null); assert.equal(a.points, 1);
  });

  console.log('Confiance :');
  assert.equal(radar.scoreH2h(h2hResp(8, 7).response, 1).points, 2);
  assert.equal(radar.scoreH2h(h2hResp(10, 6).response, 1).points, 1);
  assert.equal(radar.scoreH2h(h2hResp(10, 3).response, 1).points, 0);
  assert.equal(radar.scoreH2h(h2hResp(2, 2).response, 1).points, null, 'moins de 3 confrontations = non verifie');
  assert.equal(radar.scoreScoring({ played: 10, failed: 1 }).points, 2);
  assert.equal(radar.scoreScoring({ played: 10, failed: 3 }).points, 1);
  assert.equal(radar.scoreScoring({ played: 10, failed: 6 }).points, 0);
  assert.equal(radar.scoreScoring({ played: 0 }).points, null);
  assert.equal(radar.scoreHistory([{ target: 2, opponent: 17 }, { target: 4, opponent: 15 }]).points, 2);
  assert.equal(radar.scoreHistory([{ target: 2, opponent: 17 }, { target: 15, opponent: 3 }]).points, 1);
  assert.equal(radar.scoreHistory([{ target: 15, opponent: 3 }, { target: 12, opponent: 4 }]).points, 0);
  assert.equal(radar.scoreHistory([]).points, null);
  assert.equal(radar.scoreAttackers({ forwards: 3 }).points, 2);
  assert.equal(radar.scoreAttackers({ forwards: 1 }).points, 1);
  assert.equal(radar.scoreAttackers({ forwards: 0 }).points, 0);
  assert.equal(radar.scoreAttackers({ forwards: 3, missing: 2 }).points, 1, 'deux attaquants absents plafonnent a 1');
  assert.equal(radar.scoreAttackers({ missing: 0 }).points, 2);
  assert.equal(radar.scoreAttackers({}).points, null);
  const cf = radar.defaultConfig({});
  assert.equal(radar.summarizeConfidence({ a: { points: 2 }, b: { points: 2 }, c: { points: 2 }, d: { points: 0 } }, cf).level, 'green');
  assert.equal(radar.summarizeConfidence({ a: { points: 2 }, b: { points: 1 }, c: { points: 1 }, d: { points: 0 } }, cf).level, 'yellow');
  assert.equal(radar.summarizeConfidence({ a: { points: 0 }, b: { points: 1 }, c: { points: 1 }, d: { points: 0 } }, cf).level, 'red');
  assert.equal(radar.summarizeConfidence({ a: { points: null }, b: { points: null }, c: { points: null }, d: { points: null } }, cf).level, 'yellow', 'tout non verifie = neutre, jamais vert');
  console.log('  ok - notation des 4 controles et seuils de pastille');

  // ── 5. Modele Telegram ─────────────────────────────────────────────────────
  console.log('Telegram :');
  const data = { home: 'Paris FC', away: 'Le Havre & Co', competition: 'Ligue 1 · France', minute: 63, scoreHome: 0, scoreAway: 1,
    team: 'Paris FC', opponent: 'Le Havre & Co', odd: '1.62', teamRank: 3, opponentRank: 18, teamPlayed: 10, teamGf: 36, teamGa: 14, opponentPlayed: 10, opponentGf: 18, opponentGa: 30, kickoff: '21:00',
    confidence: { level: 'yellow', score: 5, max: 8, parts: { h2h: { points: 2, scored: 7, played: 8 }, scoring: { points: 1, failed: 3, played: 10 }, history: { points: 2, confirmed: 2, total: 2 }, attackers: { points: 0, forwards: 0, missing: null } } } };
  const targets = client.destinations({ TELEGRAM_CHANNEL_ID: '-1', TELEGRAM_PREMIUM_CHANNEL_ID: '-2', TELEGRAM_RU_FREE_CHANNEL_ID: '-3', TELEGRAM_RU_PREMIUM_CHANNEL_ID: '-4' });
  for (const dest of targets) {
    const msg = client.render('radar05', data, { ...dest, paymentVerified: true });
    const t = msg.text;
    assert(t.includes('Paris FC') && t.includes('Le Havre &amp; Co'), 'les deux equipes toujours visibles');
    assert(t.includes('18+') && t.includes('joueurs-info-service.fr'));
    assert(!/\bpari\b/i.test(t.replace(/Paris FC/g, '')), 'jamais le mot « pari »');
    if (dest.tier === 'free') {
      assert(!t.includes('1.62') && !t.includes('36') && !/Équipe ciblée|Целевая/.test(t) && !/n°3|место3/.test(t), 'le gratuit ne voit ni equipe visee ni cote ni stats');
      assert(/Premium/.test(t));
      assert.equal(msg.reply_markup.inline_keyboard[0][0].text, client.CTA[dest.lang]);
    } else {
      assert(t.includes('1.62') && t.includes('36') && t.includes('18'));
      assert(/Équipe ciblée : <b>Paris FC<\/b>|Целевая команда : <b>Paris FC<\/b>/.test(t));
      if (dest.lang === 'ru') assert(!/Équipe|cote|encaissés/.test(t), 'version russe sans francais');
    }
  }
  for (const dest of targets) {
    const msg = client.render('radar05watch', data, { ...dest, paymentVerified: true });
    const t = msg.text;
    assert(t.includes('🟡') && t.includes('21:00') && t.includes('1,60'));
    assert(!/\bpari\b/i.test(t.replace(/Paris FC/g, '')));
    if (dest.tier === 'free') {
      assert(!/Équipe surveillée|Команда под наблюдением|Face-à-face|Личные встречи|36/.test(t), 'le gratuit ne voit ni equipe visee ni detail');
      assert(msg.reply_markup.inline_keyboard[0][0].text === client.CTA[dest.lang]);
    } else {
      assert(/Équipe surveillée : <b>Paris FC|Команда под наблюдением : <b>Paris FC/.test(t));
      assert(/Patientez|Не действуйте заранее/.test(t));
      assert(/7\/8|7 из 8/.test(t) && /⚠️/.test(t));
      if (dest.lang === 'ru') assert(!/Patientez|Face-à-face|confrontations|Attaquants/.test(t));
    }
  }
  const goMsg = client.render('radar05', data, { ...targets[1], paymentVerified: true });
  assert(goMsg.text.includes('🟡') && goMsg.text.includes('Face-à-face') && goMsg.text.includes('1.62'));
  console.log('  ok - gratuit = apercu, Premium = detail, FR + RU, ANJ, pastille, annonce « patientez 1,60 »');
  console.log('\nTous les tests radar +0,5 but passent.');
})().catch(e => { console.error('ECHEC:', e.stack || e.message); process.exit(1); });

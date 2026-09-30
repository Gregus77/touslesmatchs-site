'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { render } = require('./telegram_client');

const data = {
  matchKey: 'plus05:9001', market: 'plus05', votes: 5, votesTotal: 5, home: 'Alpha FC', away: 'Omega <FC>',
  competition: 'Premier League', minute: 58, scoreHome: 0, scoreAway: 1, favName: 'Alpha FC', odd: '1.65',
  riskColor: 'vert', riskEmoji: '🟢', riskLabel: 'Sûr', favScoredIn: 5, favGoals5: 9, oppConcededIn: 5,
  favRank: 2, oppRank: 19, totalTeams: 20,
};
const dests = {
  frFree: { id: '1', lang: 'fr', tier: 'free', channel: 'free' },
  frPrem: { id: '2', lang: 'fr', tier: 'premium', channel: 'premium' },
  ruFree: { id: '3', lang: 'ru', tier: 'free', channel: 'ru_free' },
  ruPrem: { id: '4', lang: 'ru', tier: 'premium', channel: 'ru_premium' },
};

test('premium FR : selection, cote indicative, niveau, classement', () => {
  const t = render('plus05', data, dests.frPrem).text;
  assert.match(t, /SIGNAL \+0,5 BUT/);
  assert.match(t, /Alpha FC marque au moins 1 but/);
  assert.match(t, /Cote indicative : <b>1\.65<\/b>/);
  assert.match(t, /🟢 Niveau de risque : <b>Sûr<\/b>/);
  assert.match(t, /2e face à 19e sur 20/);
  assert.match(t, /Omega &lt;FC&gt;/, 'echappement HTML');
});
test('gratuit FR : teaser sans selection ni cote', () => {
  const t = render('plus05', data, dests.frFree).text;
  assert.match(t, /DÉTECTÉ/);
  assert.doesNotMatch(t, /1\.65/);
  assert.doesNotMatch(t, /marque au moins 1 but/);
  assert.match(t, /réservées aux membres Premium/);
});
test('russe : premium complet, gratuit verrouille, niveau traduit', () => {
  const p = render('plus05', data, dests.ruPrem).text;
  assert.match(p, /СИГНАЛ \+0,5 ГОЛА/);
  assert.match(p, /Надёжный/);
  assert.match(p, /1\.65/);
  const f = render('plus05', data, dests.ruFree).text;
  assert.doesNotMatch(f, /1\.65/);
  assert.match(f, /ОБНАРУЖЕН/);
});
test('aucun mot "pari" cote public, toutes langues et niveaux', () => {
  for (const d of Object.values(dests)) {
    assert.doesNotMatch(render('plus05', data, d).text, /\bpari/i);
    assert.doesNotMatch(render('plus05_result', { ...data, outcome: 'win', scoreHome: 1, scoreAway: 1, favGoals: 1 }, d).text, /\bpari/i);
  }
});
test('resultat gagne / perdu', () => {
  const w = render('plus05_result', { ...data, outcome: 'win', scoreHome: 2, scoreAway: 1, favGoals: 2 }, dests.frPrem).text;
  assert.match(w, /✅ <b>\+0,5 BUT VALIDÉ/);
  assert.match(w, /2 buts marqués/);
  const l = render('plus05_result', { ...data, outcome: 'loss', scoreHome: 0, scoreAway: 1, favGoals: 0 }, dests.ruPrem).text;
  assert.match(l, /❌/);
  assert.match(l, /ПРОИГРЫШ/);
});
test('gabarit Telegram : moins de 4096 caracteres, mentions legales presentes', () => {
  for (const d of Object.values(dests)) {
    const t = render('plus05', data, d).text;
    assert.ok(t.length < 4096);
    assert.match(t, /18\+/);
    assert.match(t, /joueurs-info-service\.fr/);
  }
});

const { createPublisher } = require('./telegram_client');
let Database;
try { Database = require('better-sqlite3'); } catch { Database = require('node:sqlite').DatabaseSync; }

function recapDb() {
  const db = new Database(':memory:');
  // node:sqlite (Node 24) n'a pas transaction() ; better-sqlite3 (serveur) l'a.
  if (typeof db.transaction !== 'function') db.transaction = (fn) => { const f = (...a) => fn(...a); f.immediate = f; return f; };
  db.exec(`CREATE TABLE concile_analyses (match_key TEXT PRIMARY KEY, minute_at_analysis INTEGER, score_home_at_analysis INTEGER,
      score_away_at_analysis INTEGER, best_bet TEXT, real_odd REAL, real_odd_source TEXT, analysed_at TEXT, sig_sent_free INTEGER, sig_sent_premium INTEGER, outcome TEXT, final_score_home INTEGER, final_score_away INTEGER);
    CREATE TABLE telegram_signal_deliveries (id INTEGER PRIMARY KEY AUTOINCREMENT, match_key TEXT, channel TEXT, telegram_message_id INTEGER, market TEXT, vote_count INTEGER, ok INTEGER, official_signal_snapshot_id TEXT, error TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE plus05_signals (id INTEGER PRIMARY KEY AUTOINCREMENT, fixture_id TEXT UNIQUE, sent_at INTEGER, home TEXT, away TEXT, fav_name TEXT, odd REAL,
      risk_color TEXT, outcome TEXT, final_home INTEGER, final_away INTEGER, dry_run INTEGER DEFAULT 0);`);
  return db;
}
const DAY = '2026-10-03';
const at = Date.UTC(2026, 9, 3, 16, 0, 0); // 18h Paris, meme jour
const addSig = (db, id, outcome, odd, dry = 0) => db.prepare('INSERT INTO plus05_signals (fixture_id,sent_at,home,away,fav_name,odd,risk_color,outcome,final_home,final_away,dry_run) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
  .run(id, at, 'Alpha FC', 'Omega FC', 'Alpha FC', odd, 'vert', outcome, outcome === 'win' ? 2 : 0, 1, dry);

test('bilan +0,5 : attend les resultats, une seule fois, ignore les essais a blanc', () => {
  const db = recapDb();
  const pub = createPublisher({ db, env: { TELEGRAM_BOT_TOKEN: 'x', TELEGRAM_CHANNEL_ID: '111', TELEGRAM_PREMIUM_CHANNEL_ID: '222' }, now: () => Date.UTC(2026, 9, 3, 21, 30, 0) });
  assert.equal(pub.queuePlus05Recap(DAY), false, 'aucun signal : pas de message');
  addSig(db, '1', 'pending', 1.65);
  assert.equal(pub.queuePlus05Recap(DAY), false, 'un resultat manque : on attend');
  db.prepare("UPDATE plus05_signals SET outcome='win' WHERE fixture_id='1'").run();
  addSig(db, '2', 'loss', 1.7);
  addSig(db, '3', 'win', 1.6, 1); // essai a blanc : ignore
  assert.equal(pub.queuePlus05Recap(DAY), true);
  assert.equal(pub.queuePlus05Recap(DAY), false, 'jamais deux fois');
  const out = db.prepare("SELECT channel,payload FROM client_telegram_outbox WHERE kind='plus05_recap' ORDER BY channel").all();
  assert.equal(out.length, 2);
  const free = JSON.parse(out.find((o) => o.channel === 'free').payload).text;
  const prem = JSON.parse(out.find((o) => o.channel === 'premium').payload).text;
  assert.match(prem, /BILAN DU JOUR \+0,5 BUT/);
  assert.match(prem, /gagnés 1 · perdus 1/);
  assert.match(prem, /Alpha FC \+0,5 · cote 1\.65/);
  assert.doesNotMatch(free, /cote 1\.65/, 'le salon gratuit ne montre pas la selection');
  assert.doesNotMatch(prem, /\bpari/i);
});
test('bilan 2,5 : plus de message "aucun signal" les jours vides', () => {
  const db = recapDb();
  const pub = createPublisher({ db, env: { TELEGRAM_BOT_TOKEN: 'x', TELEGRAM_CHANNEL_ID: '111' }, now: () => Date.UTC(2026, 9, 3, 21, 30, 0) });
  pub.queueDailyRecap(DAY);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM client_telegram_outbox WHERE kind='recap'").get().n, 0);
});

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

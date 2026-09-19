'use strict';

const assert = require('assert');
const client = require('./telegram_client');

const premiumRows = [
  { home: 'Alpha FC', away: 'Beta FC', outcome: 'win', final_score_home: 2, final_score_away: 1, best_bet: 'Over 2.5 buts', real_odd: 2.10 },
  { home: 'Gamma FC', away: 'Delta FC', outcome: 'loss', final_score_home: 0, final_score_away: 1, best_bet: 'Over 2.5 buts', real_odd: 1.80 },
  { home: 'Epsilon FC', away: 'Zeta FC', outcome: 'win', final_score_home: 3, final_score_away: 0, best_bet: 'Over 2.5 buts', real_odd: null },
];

const recapData = { day: '2026-09-19', rows: premiumRows, part: 1, parts: 1 };
const premiumFr = client.render('recap', recapData, { id: '-2', tier: 'premium', lang: 'fr', paymentVerified: true });

// Catch a regression to estimated or invented odds: only a stored positive real_odd
// may enter the fixed-stake calculation.
assert.match(premiumFr.text, /Alpha FC[^\n]*cote 2,10[^\n]*retour brut 21,00 €[^\n]*bénéfice net \+11,00 €/);
assert.match(premiumFr.text, /Gamma FC[^\n]*cote 1,80[^\n]*perte -10,00 €/);
assert.match(premiumFr.text, /Epsilon FC[^\n]*cote indisponible[^\n]*exclu du calcul financier/);
assert.match(premiumFr.text, /Total misé : 20,00 €/);
assert.match(premiumFr.text, /Retour total : 21,00 €/);
assert.match(premiumFr.text, /Bénéfice net : \+1,00 €/);
assert.match(premiumFr.text, /1 signal exclu du calcul financier/);
assert(!premiumFr.text.includes(client.PAYMENT), 'un membre Premium ne doit pas recevoir le CTA de paiement');

const premiumRu = client.render('recap', recapData, { id: '-4', tier: 'premium', lang: 'ru', paymentVerified: true });
assert.match(premiumRu.text, /Alpha FC[^\n]*коэффициент 2,10[^\n]*валовой возврат 21,00 €[^\n]*чистая прибыль \+11,00 €/);
assert.match(premiumRu.text, /Epsilon FC[^\n]*коэффициент недоступен[^\n]*исключён из финансового расчёта/);
assert.match(premiumRu.text, /Всего поставлено : 20,00 €/);
assert.match(premiumRu.text, /Общий возврат : 21,00 €/);
assert.match(premiumRu.text, /Чистая прибыль : \+1,00 €/);
assert(!/Gagnés|Perdus|cote|Bénéfice|misé|retour total|sélection|confiance|Jeu responsable/.test(premiumRu.text));

for (const [lang, freeId] of [['fr', '-1'], ['ru', '-3']]) {
  const freeDest = { id: freeId, tier: 'free', lang, paymentVerified: true };
  const freeResult = client.render('result', { home: 'Alpha FC', away: 'Beta FC', outcome: 'win', scoreHome: 2, scoreAway: 1, market: 'Over 2.5 buts' }, freeDest);
  const freeRecap = client.render('recap', recapData, freeDest);
  const combined = `${freeResult.text}\n${freeRecap.text}`;

  assert(!/SIGNAL GAGNÉ|SIGNAL PERDU|ВЫИГРЫШ|ПРОИГРЫШ|2-1|2,10|21,00|\+11,00|Alpha FC/.test(combined),
    'le canal gratuit ne doit révéler ni résultat, ni match, ni détail financier');
  assert(freeResult.reply_markup && freeRecap.reply_markup, 'le CTA Stripe vérifié doit être présent sur chaque publication gratuite');
  assert.equal(freeResult.reply_markup.inline_keyboard[0][0].url, `${client.PAYMENT}?lang=${lang}`);

  if (lang === 'fr') {
    assert.match(combined, /offre de lancement à 14,90 €\/mois/i);
    assert.match(combined, /bientôt 19,90 €\/mois/i);
    assert.match(combined, /tous les signaux validés disponibles dans la journée/i);
    assert.match(combined, /aucun minimum quotidien/i);
  } else {
    assert.match(combined, /стартовая цена — 14,90 € в месяц/i);
    assert.match(combined, /скоро 19,90 € в месяц/i);
    assert.match(combined, /все доступные в течение дня подтверждённые сигналы/i);
    assert.match(combined, /минимальное количество сигналов в день не гарантируется/i);
    assert(!/Gagnés|Perdus|cote|bénéfice|mise|résultat|sélection|confiance|Jeu responsable/.test(combined));
  }
}

console.log('PASS bilan financier 10 euros, cote manquante exclue, Free masque, CTA FR/RU');

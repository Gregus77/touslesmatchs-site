'use strict';
const assert = require('assert');
const ui = require('../public/js/analyse-live.js');

assert.strictEqual(ui.stateMessage('draft'), 'Captures recues, extraction en attente.');
assert.strictEqual(ui.stateMessage('extracted'), 'Extraction terminee : verifiez chaque donnee avant confirmation.');
assert.strictEqual(ui.stateMessage('confirmed'), 'Donnees confirmees : le Concile peut maintenant analyser cet instantane.');
assert.strictEqual(ui.stateMessage('analysed'), 'Analyse privee terminee.');

const html = ui.renderVerdict({
  status: 'analysed',
  verdict: {
    best: {
      market: '1X2',
      selection: 'away',
      probability: 0.63,
      agreement: 4,
      totalValidSeats: 4,
      bookmakerOdd: 1.8,
      fairOdd: 1.59,
      value: 1.134,
      label: 'VALUE',
    },
    alternatives: [],
  },
});
assert.match(html, /VALUE/);
assert.match(html, /63 %/);
assert.match(html, /4 avis valides/);
assert.strictEqual(/Perplexity|DeepSeek|Mistral|Luna|Qwen|seat-/i.test(html), false);
assert.strictEqual(/Telegram|Brevo|Stripe/i.test(html), false);

const extracted = ui.extractionToEditor({
  match: { home: 'Serbie', away: 'Pays-Bas', minute: 55, scoreHome: 1, scoreAway: 1 },
  bookmaker: 'Winamax',
  screenshots: [{ category: 'odds', bookmaker: 'Winamax' }],
  markets: [{ market: '1X2', selection: 'away', odd: 1.8 }],
  stats: { shotsHome: 7, shotsAway: 10 },
});
assert.strictEqual(extracted.match.home, 'Serbie');
assert.strictEqual(extracted.markets[0].odd, 1.8);
assert.notStrictEqual(extracted, null);

console.log('PASS analyse-live admin states, editor data and anonymous verdict');

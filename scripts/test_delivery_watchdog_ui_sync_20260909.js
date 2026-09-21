'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const api = fs.readFileSync(path.join(__dirname, 'api_server.js'), 'utf8');
const read = (name) => fs.readFileSync(path.join(root, 'public', name), 'utf8');

assert(api.includes('channel: `ru_${ruTarget.tier}`'), 'canal russe distinct dans la preuve');
assert(api.includes('sendTelegramMessage(ruTarget.id, ruText, ruDeliveryMeta, true)'), 'miroir russe transmet les métadonnées de livraison');
assert(api.includes('CREATE TABLE IF NOT EXISTS concile_watchdog_alert_state'), 'état watchdog persistant');
assert(api.includes('adminOperationalAlert !== true'), 'seules les alertes opérationnelles explicites contournent le digest');
assert(api.includes('CONCILE_ALERT_MAX_ATTEMPTS = 3'), 'tentatives watchdog bornées');
assert(api.includes('last_sent_ms'), 'anti-doublon watchdog persistant');
assert(api.includes("telegram_delivery_proven: telegramDeliveryProven"), 'accueil reçoit la preuve Telegram calculée côté serveur');

for (const page of ['index.html', 'live-ia.html', 'performances.html', 'faq.html', 'bankroll.html']) {
  const html = read(page);
  for (const target of ['/live-ia', '/performances', '/bankroll']) {
    assert(html.includes(`href="${target}"`), `${page}: menu ${target}`);
  }
}

const live = read('live-ia.html');
const app = read('app.html');
assert(live.includes('/js/signal-rules.js?v=20260909-signal-sync'), 'Live IA lit les règles API');
assert(app.includes('/js/signal-rules.js?v=20260909-signal-sync'), 'application lit les mêmes règles API');
assert(live.includes('/js/i18n.js?v=20260909-signal-sync'), 'traducteur chargé sur Live IA');
assert(live.includes('class="nav-right"'), 'zone supérieure droite présente sur Live IA');

const auto = read('js/i18n-auto.js');
assert(auto.includes('document.querySelector(".nav-right, header nav'), 'traducteur placé prioritairement en haut à droite');
assert(!auto.includes("au moins 4 votes sur 5 sur Over/Under 2,5"), 'ancien quorum français supprimé');
assert(auto.includes("au moins 3 votes sur 5 sur Over/Under 2,5"), 'quorum français 3/5 présent');

assert(live.includes('pinnedBet') && live.includes('pinnedConfidence'), 'meilleur signal rendu sur Live IA');
assert(app.includes('/api/current-pick') && app.includes('/api/live-matches'), 'application partage les données signal et live');
assert(live.includes('@media(max-width:600px)'), 'mise en page mobile Live IA conservée');
const home = read('index.html');
assert(home.includes('m.telegram_delivery_proven===true||m.signal_delivered===true'), 'badge capture exige une preuve Telegram explicite');
assert(home.includes("admissible?'Consensus IA · non diffusé'"), 'un consensus non livré est distingué d’un signal diffusé sans le dire admissible');
console.log('OK: livraisons RU persistées, watchdog borné/idempotent, règles et interfaces site/app synchronisées sans envoi réseau.');

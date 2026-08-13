#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public', 'app.html'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error('mobile_app_alerts_bookmakers: FAIL');
    console.error(message);
    process.exit(1);
  }
}

assert(app.includes('signal-alert-toggle'), 'Bouton activation popup + son manquant');
assert(app.includes('tlm-signal-popup'), 'Popup signal manquante');
assert(app.includes('playSignalTone'), 'Son signal manquant');
assert(app.includes('bookmakerButtons'), 'Bloc boutons bookmakers manquant');
assert(app.includes('https://www.winamax.fr/parrain?code=77953728'), 'Lien Winamax manquant');
assert(app.includes('https://www.unibet.fr/inscription/?campaign=210726&parrain=5EBF919DF1008254'), 'Lien Unibet manquant');
assert(app.includes('https://www.pmu.fr/turf/static/offre-parrainage/?codeParrainage=779753728'), 'Lien PMU manquant');
assert(!/betclic\.fr|zebet\.fr|parionssport/i.test(app), 'Ancien bookmaker non actif trouvé dans app.html');
assert(app.includes('18+ · Jouer comporte des risques'), 'Mention 18+ / jeu responsable manquante');

console.log('mobile_app_alerts_bookmakers: OK');

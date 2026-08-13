const fs = require('fs');
const app = fs.readFileSync('public/app.html', 'utf8');
function assert(c,m){ if(!c){ console.error('goal05_verdict_card: FAIL'); console.error(m); process.exit(1); } }
for (const txt of [
  'goal05-verdict-card',
  'SIGNAL EN ATTENTE',
  '@—',
  'Aucun match validé +0,5',
  'Analyse football uniquement',
  'Critères lus comme la carte validée',
  'Force 3-5 saisons',
  'Top vs bas tableau',
  'Buteur 5/5',
  'Cote ANJ validée'
]) assert(app.includes(txt), 'élément carte verdict manquant: '+txt);
assert(!app.includes('victoire, BTTS'), 'ancien pavé explicatif encore présent');
console.log('goal05_verdict_card: OK');

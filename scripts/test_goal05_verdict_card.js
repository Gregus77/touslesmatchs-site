const fs = require('fs');
const app = fs.readFileSync('public/app.html', 'utf8');
function assert(c,m){ if(!c){ console.error('goal05_verdict_card: FAIL'); console.error(m); process.exit(1); } }
for (const txt of [
  'goal05-verdict-card',
  'SIGNAL EN ATTENTE',
  '@—',
  'Aucun match validé +0,5',
  'Football uniquement · moteur en surveillance',
  'Écart historique favorable',
  'Enjeu réel au classement',
  'Adversaire encaisse régulièrement',
  'Aucun signal envoyé si un critère dur manque',
  'Force 3-5 saisons',
  'Top vs bas tableau',
  'Buteur 5/5',
  'Cote ANJ validée'
]) assert(app.includes(txt), 'élément carte verdict manquant: '+txt);
assert(!app.includes('victoire, BTTS'), 'ancien pavé explicatif encore présent');
assert(!app.includes('Aucun signal +0,5 validé maintenant'), 'ancien état sans signal encore présent');
console.log('goal05_verdict_card: OK');

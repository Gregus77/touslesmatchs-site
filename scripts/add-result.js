// scripts/add-result.js
// Usage : node scripts/add-result.js gagne 2-1
// Ajoute le résultat du match de la veille à l'historique

const fs = require('fs');
const path = require('path');

function getYesterdayShort() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

async function addResult(resultat, score) {
  const valid = ['gagne','perdu','nul'];
  if (!valid.includes(resultat)) {
    console.error('Usage: node add-result.js [gagne|perdu|nul] [score]');
    console.error('Exemple: node add-result.js gagne 2-1');
    process.exit(1);
  }

  const dataPath = path.join(__dirname, '../data/match-data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  if (data.today.pas_de_match) {
    console.log('ℹ️  Pas de match hier, rien à ajouter');
    return;
  }

  const entry = {
    date: getYesterdayShort(),
    equipe1: data.today.equipe1,
    equipe2: data.today.equipe2,
    flag1: data.today.flag1,
    flag2: data.today.flag2,
    competition: data.today.competition,
    pronostic: data.today.pronostic,
    cote: data.today.cote,
    note: data.today.note,
    resultat,
    score: score || ''
  };

  // Ajouter en tête, limiter à 50 entrées
  data.history = [entry, ...(data.history || [])].slice(0, 50);

  // Recalculer stats
  const h = data.history;
  const total = h.length;
  const gagnes = h.filter(x => x.resultat === 'gagne').length;
  const taux = total > 0 ? Math.round(gagnes / total * 100) : 0;
  const cotes = h.map(x => parseFloat(x.cote)).filter(c => !isNaN(c));
  const cote_moy = cotes.length > 0
    ? Math.round(cotes.reduce((a,b)=>a+b,0)/cotes.length*100)/100 : 1.70;

  let units = 0;
  h.forEach(x => {
    const c = parseFloat(x.cote) || 1;
    if (x.resultat === 'gagne') units += Math.round((c-1)*10)/10;
    else if (x.resultat === 'perdu') units -= 1;
  });

  data.stats = { taux, total, units: Math.round(units*10)/10, cote_moy };
  data.updated_at = new Date().toISOString();

  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');

  const e = resultat === 'gagne' ? '✅' : resultat === 'perdu' ? '❌' : '➖';
  console.log(`${e} ${entry.equipe1} vs ${entry.equipe2} → ${resultat.toUpperCase()} ${score}`);
  console.log(`📊 Stats: ${taux}% sur ${total} matchs | +${units} unités`);
}

const [,,resultat, score] = process.argv;
if (!resultat) {
  console.log('Usage: node scripts/add-result.js [gagne|perdu|nul] [score]');
  process.exit(1);
}
addResult(resultat, score).catch(console.error);

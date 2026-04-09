// scripts/generate-prono.js
// Génère le prono du jour à partir de Football-Data.org
// SANS clé Anthropic — analyse algorithmique pure
// Lancé chaque matin à 7h UTC par GitHub Actions

const https = require('https');
const fs = require('fs');
const path = require('path');

const FOOTBALL_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = 'api.football-data.org';

// ============================================================
// CHAMPIONNATS AUTORISÉS (codes Football-Data.org)
// ============================================================
const LEAGUES = [
  { code: 'FL1', name: 'Ligue 1',        flag: '🇫🇷', country: 'France'    },
  { code: 'PL',  name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: 'Angleterre' },
  { code: 'PD',  name: 'La Liga',        flag: '🇪🇸', country: 'Espagne'   },
  { code: 'BL1', name: 'Bundesliga',     flag: '🇩🇪', country: 'Allemagne' },
  { code: 'SA',  name: 'Serie A',        flag: '🇮🇹', country: 'Italie'    }
];

// ============================================================
// DRAPEAUX PAYS
// ============================================================
const COUNTRY_FLAGS = {
  'France': '🇫🇷', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Spain': '🇪🇸',
  'Germany': '🇩🇪', 'Italy': '🇮🇹'
};

// ============================================================
// APPEL API FOOTBALL-DATA
// ============================================================
function apiCall(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: `/v4${endpoint}`,
      method: 'GET',
      headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Parse error: ' + data.substring(0, 100))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

// ============================================================
// DATES
// ============================================================
function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

function getTodayFR() {
  const jours = ['Dim.','Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.'];
  const mois = ['janvier','février','mars','avril','mai','juin',
                'juillet','août','septembre','octobre','novembre','décembre'];
  const d = new Date();
  return `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
}

function getDateShort() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

function formatHeure(dateStr) {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2,'0')}h${String(d.getMinutes()).padStart(2,'0')}`;
}

// ============================================================
// RÉCUPÉRER LES MATCHS DU JOUR
// ============================================================
async function getMatchesForLeague(leagueCode, today) {
  try {
    const data = await apiCall(`/competitions/${leagueCode}/matches?dateFrom=${today}&dateTo=${today}&status=SCHEDULED`);
    return data.matches || [];
  } catch(e) {
    console.log(`⚠️  ${leagueCode}: ${e.message}`);
    return [];
  }
}

// ============================================================
// RÉCUPÉRER LE CLASSEMENT D'UNE ÉQUIPE
// ============================================================
async function getTeamStanding(leagueCode, teamId) {
  try {
    const data = await apiCall(`/competitions/${leagueCode}/standings`);
    const standings = data.standings?.[0]?.table || [];
    const team = standings.find(t => t.team.id === teamId);
    return team || null;
  } catch(e) {
    return null;
  }
}

// ============================================================
// ALGORITHME DE NOTATION (1 à 10)
// Basé sur données disponibles sans IA
// ============================================================
function scoreMatch(homeStanding, awayStanding, league) {
  let score = 5; // base

  if (!homeStanding || !awayStanding) return { note: 5, pick: 'home', cote: '1.70', type: 'victoire' };

  const homePos = homeStanding.position;
  const awayPos = awayStanding.position;
  const homeWinRate = homeStanding.playedGames > 0
    ? homeStanding.won / homeStanding.playedGames : 0.5;
  const awayWinRate = awayStanding.playedGames > 0
    ? awayStanding.won / awayStanding.playedGames : 0.5;

  // Avantage domicile
  score += 0.5;

  // Écart de position
  const posDiff = awayPos - homePos;
  if (posDiff >= 8) score += 2;
  else if (posDiff >= 5) score += 1.5;
  else if (posDiff >= 3) score += 1;
  else if (posDiff <= -5) score -= 2;
  else if (posDiff <= -3) score -= 1;

  // Forme générale
  if (homeWinRate > 0.65) score += 1.5;
  else if (homeWinRate > 0.55) score += 1;
  else if (homeWinRate < 0.35) score -= 1;

  // Buts marqués/concédés
  const homeGoalsFor = homeStanding.goalsFor / Math.max(homeStanding.playedGames, 1);
  const awayGoalsAgainst = awayStanding.goalsAgainst / Math.max(awayStanding.playedGames, 1);
  if (homeGoalsFor > 2.0 && awayGoalsAgainst > 1.5) score += 0.5;

  // Seuil minimum 1, maximum 10
  score = Math.max(1, Math.min(10, Math.round(score)));

  // Déterminer le pick
  let pick, pickTeam, cote, type;
  if (homePos < awayPos && homeWinRate >= 0.5) {
    pick = 'home';
    pickTeam = homeStanding.team.name;
    // Estimer la cote selon l'écart
    const diff = awayPos - homePos;
    cote = diff >= 8 ? '1.55' : diff >= 5 ? '1.70' : diff >= 3 ? '1.85' : '2.00';
    type = 'victoire';
  } else if (awayPos < homePos && awayWinRate >= 0.55) {
    pick = 'away';
    pickTeam = awayStanding.team.name;
    cote = '2.10';
    type = 'victoire';
  } else {
    pick = 'home';
    pickTeam = homeStanding.team.name;
    cote = '1.75';
    type = 'victoire';
  }

  // +1.5 buts si les deux équipes marquent beaucoup
  const bothScore = homeGoalsFor > 1.8 && (awayStanding.goalsFor / Math.max(awayStanding.playedGames,1)) > 1.5;
  if (score >= 7 && bothScore && league !== 'SA') {
    // Ligue autre que Serie A : on peut proposer +1.5 buts
    type = 'plus15';
    cote = String((parseFloat(cote) - 0.25).toFixed(2));
  }

  return { note: score, pick, pickTeam, cote, type };
}

// ============================================================
// GÉNÉRER LE TEXTE DE RÉSUMÉ (sans IA)
// ============================================================
function generateResume(match, homeStanding, awayStanding, scoring) {
  if (!homeStanding || !awayStanding) {
    return `${match.homeTeam.name} reçoit ${match.awayTeam.name}. Analyse en cours.`;
  }

  const homeTeam = match.homeTeam.name;
  const awayTeam = match.awayTeam.name;
  const homePos = homeStanding.position;
  const awayPos = awayStanding.position;
  const homeWins = homeStanding.won;
  const homeGames = homeStanding.playedGames;
  const awayWins = awayStanding.won;
  const awayGames = awayStanding.playedGames;

  const homePct = homeGames > 0 ? Math.round(homeWins/homeGames*100) : 50;
  const awayPct = awayGames > 0 ? Math.round(awayWins/awayGames*100) : 50;

  let resume = '';

  if (scoring.pick === 'home') {
    resume = `${homeTeam} (${homePos}e) reçoit ${awayTeam} (${awayPos}e). `;
    resume += `À domicile, les locaux affichent ${homePct}% de victoires cette saison. `;
    if (awayPos > homePos + 5) {
      resume += `L'écart de classement est significatif en faveur des locaux.`;
    } else {
      resume += `Avantage domicile attendu dans cette rencontre.`;
    }
  } else {
    resume = `${homeTeam} (${homePos}e) affronte ${awayTeam} (${awayPos}e). `;
    resume += `Les visiteurs affichent ${awayPct}% de victoires cette saison. `;
    resume += `Malgré le déplacement, ${awayTeam} est favori sur le papier.`;
  }

  return resume;
}

// ============================================================
// GÉNÉRER LE PRONOSTIC — LOGIQUE PRINCIPALE
// ============================================================
async function generateProno() {
  const today = getTodayISO();
  console.log(`📅 Analyse des matchs du ${today}...`);

  let allMatches = [];

  // Récupérer les matchs de tous les championnats
  for (const league of LEAGUES) {
    const matches = await getMatchesForLeague(league.code, today);
    const tagged = matches.map(m => ({ ...m, leagueCode: league.code, leagueName: league.name, leagueFlag: league.flag }));
    allMatches = allMatches.concat(tagged);
    console.log(`  ${league.flag} ${league.name}: ${matches.length} matchs`);
    // Pause pour éviter le rate limit API
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n📊 Total: ${allMatches.length} matchs trouvés`);

  if (allMatches.length === 0) {
    return buildNoPariResult('Aucun match dans nos 5 championnats ce soir.');
  }

  // Analyser chaque match
  let bestMatch = null;
  let bestScore = 0;
  let bestScoring = null;
  let bestHomeStanding = null;
  let bestAwayStanding = null;

  for (const match of allMatches) {
    // Récupérer les standings
    const [homeStanding, awayStanding] = await Promise.all([
      getTeamStanding(match.leagueCode, match.homeTeam.id),
      getTeamStanding(match.leagueCode, match.awayTeam.id)
    ]);

    const scoring = scoreMatch(homeStanding, awayStanding, match.leagueCode);

    console.log(`  ${match.homeTeam.name} vs ${match.awayTeam.name}: ${scoring.note}/10`);

    if (scoring.note > bestScore) {
      bestScore = scoring.note;
      bestMatch = match;
      bestScoring = scoring;
      bestHomeStanding = homeStanding;
      bestAwayStanding = awayStanding;
    }

    await new Promise(r => setTimeout(r, 300));
  }

  // Seuil minimum 8/10
  if (!bestMatch || bestScore < 8) {
    console.log(`\n⏭️  Aucun match à 8/10 minimum (meilleur: ${bestScore}/10)`);

    // Chercher le prochain bon match
    const nextMatch = bestScore >= 7 ? bestMatch : null;
    return buildNoPariResult(
      `Aucun match ne remplit nos critères ce soir (meilleur score: ${bestScore}/10).`,
      nextMatch,
      bestScoring
    );
  }

  console.log(`\n✅ Meilleur match: ${bestMatch.homeTeam.name} vs ${bestMatch.awayTeam.name} → ${bestScore}/10`);

  // Construire le résultat
  const homeFlag = bestMatch.leagueFlag;
  const awayFlag = bestMatch.leagueFlag;

  const pickEquipe = bestScoring.pick === 'home'
    ? bestMatch.homeTeam.name : bestMatch.awayTeam.name;

  const pronosticText = bestScoring.type === 'plus15'
    ? `Victoire ${pickEquipe} + Plus de 1.5 buts`
    : `Victoire ${pickEquipe}`;

  const resume = generateResume(bestMatch, bestHomeStanding, bestAwayStanding, bestScoring);

  const journee = bestMatch.matchday ? `· Journée ${bestMatch.matchday}` : '';

  return {
    today: {
      equipe1: bestMatch.homeTeam.name,
      equipe2: bestMatch.awayTeam.name,
      flag1: homeFlag,
      flag2: awayFlag,
      competition: `${bestMatch.leagueName} ${journee}`.trim(),
      heure: formatHeure(bestMatch.utcDate),
      date: getTodayFR(),
      pronostic: pronosticText,
      cote: bestScoring.cote,
      note: bestScore,
      live: false,
      status: 'avant',
      resume,
      sources: ['Football-Data.org', 'Classements officiels', 'Statistiques saison'],
      pas_de_match: false,
      prochain_match: null
    }
  };
}

// ============================================================
// PAS DE PARI — BUILDER
// ============================================================
function buildNoPariResult(reason, nextMatch = null, nextScoring = null) {
  let prochain = null;
  if (nextMatch && nextScoring) {
    const pickEquipe = nextScoring.pick === 'home'
      ? nextMatch.homeTeam.name : nextMatch.awayTeam.name;
    prochain = {
      equipe1: nextMatch.homeTeam.name,
      equipe2: nextMatch.awayTeam.name,
      flag1: nextMatch.leagueFlag || '🏴',
      flag2: nextMatch.leagueFlag || '🏴',
      date: 'Prochainement',
      heure: formatHeure(nextMatch.utcDate),
      competition: nextMatch.leagueName || '',
      pronostic: `Victoire ${pickEquipe}`,
      cote: nextScoring.cote || '1.80',
      note: nextScoring.note || 7
    };
  }

  return {
    today: {
      equipe1: '', equipe2: '', flag1: '', flag2: '',
      competition: '', heure: '', date: getTodayFR(),
      pronostic: 'Pas de match recommandé ce soir',
      cote: '--', note: 0, live: false, status: 'avant',
      resume: reason,
      sources: [], pas_de_match: true,
      prochain_match: prochain
    }
  };
}

// ============================================================
// CHARGER L'HISTORIQUE EXISTANT
// ============================================================
function loadHistory() {
  const p = path.join(__dirname, '../data/match-data.json');
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')).history || [];
  } catch(e) { return []; }
}

function loadStats() {
  const p = path.join(__dirname, '../data/match-data.json');
  if (!fs.existsSync(p)) return { taux: 0, total: 0, units: 0, cote_moy: 1.70 };
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')).stats || { taux: 0, total: 0, units: 0, cote_moy: 1.70 };
  } catch(e) { return { taux: 0, total: 0, units: 0, cote_moy: 1.70 }; }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  if (!FOOTBALL_API_KEY) {
    console.error('❌ FOOTBALL_DATA_API_KEY manquante');
    process.exit(1);
  }

  console.log('🚀 TousLesMatchs — Génération automatique du prono\n');

  let result;
  try {
    result = await generateProno();
  } catch(e) {
    console.error('❌ Erreur:', e.message);
    result = buildNoPariResult('Erreur de récupération des données. Vérifiez la clé API football.');
  }

  // Ajouter historique + stats
  result.history = loadHistory();
  result.stats = loadStats();
  result.updated_at = new Date().toISOString();
  result.source = 'Football-Data.org — Analyse algorithmique';

  // Sauvegarder
  const out = path.join(__dirname, '../data/match-data.json');
  fs.writeFileSync(out, JSON.stringify(result, null, 2), 'utf8');

  console.log('\n💾 match-data.json sauvegardé');
  if (result.today.pas_de_match) {
    console.log('ℹ️  Pas de pari aujourd\'hui');
  } else {
    console.log(`⚽ ${result.today.equipe1} vs ${result.today.equipe2}`);
    console.log(`🎯 ${result.today.pronostic} @ ${result.today.cote}`);
    console.log(`📊 Confiance: ${result.today.note}/10`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });

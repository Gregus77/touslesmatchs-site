// scripts/check-result.js
const https = require('https');
const fs = require('fs');
const path = require('path');

const FOOTBALL_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = 'api.football-data.org';
const LEAGUES = ['FL1','PL','PD','BL1','SA'];

function apiCall(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: '/v4' + endpoint,
      method: 'GET',
      headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Parse: ' + data.substring(0, 100))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function normalize(name) {
  return name.toLowerCase()
    .replace(/[àâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[îï]/g,'i')
    .replace(/[ôö]/g,'o').replace(/[ùûü]/g,'u')
    .replace(/\bfc\b/g,'').replace(/\bsc\b/g,'').replace(/\bac\b/g,'')
    .replace(/olympique de /g,'').replace(/olympique /g,'')
    .replace(/\s+/g,' ').trim();
}

function teamsMatch(a, b) {
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const aliases = {
    'marseille': ['om','olympique de marseille'],
    'paris saint-germain': ['psg','paris sg'],
    'bayern munich': ['fc bayern munchen','fc bayern','bayern'],
    'borussia dortmund': ['bvb','dortmund'],
    'rb leipzig': ['rasenballsport leipzig','leipzig'],
    'manchester city': ['man city'],
    'manchester united': ['man united','man utd'],
    'atletico madrid': ['atletico','atl madrid'],
  };
  for (const [key, vals] of Object.entries(aliases)) {
    const inA = na.includes(key) || vals.some(v => na.includes(v));
    const inB = nb.includes(key) || vals.some(v => nb.includes(v));
    if (inA && inB) return true;
  }
  return false;
}

function getISO(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function getDateShort(iso) {
  const d = new Date(iso);
  return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
}

async function findMatchResult(equipe1, equipe2) {
  const from = getISO(-1), to = getISO(0);
  for (const code of LEAGUES) {
    try {
      const data = await apiCall('/competitions/' + code + '/matches?dateFrom=' + from + '&dateTo=' + to + '&status=FINISHED');
      const found = (data.matches || []).find(m =>
        teamsMatch(m.homeTeam.name, equipe1) && teamsMatch(m.awayTeam.name, equipe2)
      );
      if (found) { console.log('Match trouve: ' + found.homeTeam.name + ' vs ' + found.awayTeam.name); return found; }
      await new Promise(r => setTimeout(r, 400));
    } catch(e) { console.log(code + ': ' + e.message); }
  }
  return null;
}

function determineResult(match, pronostic) {
  const home = match.score.fullTime.home;
  const away = match.score.fullTime.away;
  const winner = match.score.winner;
  const score = home + '-' + away;
  const p = pronostic.toLowerCase();
  let resultat = 'perdu';

  if (p.includes('plus de 2.5')) { resultat = (home + away) > 2 ? 'gagne' : 'perdu'; }
  else if (p.includes('plus de 1.5')) { resultat = (home + away) > 1 ? 'gagne' : 'perdu'; }
  else if (p.includes('les 2') || p.includes('btts')) { resultat = (home > 0 && away > 0) ? 'gagne' : 'perdu'; }
  else if (p.includes('nul')) { resultat = winner === 'DRAW' ? 'gagne' : 'perdu'; }
  else if (p.includes('victoire')) {
    const homeNorm = normalize(match.homeTeam.name);
    const awayNorm = normalize(match.awayTeam.name);
    if (p.includes(homeNorm) || p.includes(homeNorm.split(' ')[0])) {
      resultat = winner === 'HOME_TEAM' ? 'gagne' : 'perdu';
    } else if (p.includes(awayNorm) || p.includes(awayNorm.split(' ')[0])) {
      resultat = winner === 'AWAY_TEAM' ? 'gagne' : 'perdu';
    } else {
      resultat = winner === 'HOME_TEAM' ? 'gagne' : 'perdu';
    }
  }
  return { resultat, score };
}

function recalcStats(history) {
  const h = history.filter(x => x.resultat !== 'en_cours');
  const total = h.length;
  const gagnes = h.filter(x => x.resultat === 'gagne').length;
  const taux = total > 0 ? Math.round(gagnes/total*100) : 0;
  const cotes = h.map(x => parseFloat(x.cote)).filter(c => !isNaN(c));
  const cote_moy = cotes.length > 0 ? Math.round(cotes.reduce((a,b)=>a+b,0)/cotes.length*100)/100 : 1.70;
  let units = 0;
  h.forEach(x => {
    const c = parseFloat(x.cote) || 1;
    if (x.resultat === 'gagne') units += Math.round((c-1)*10)/10;
    else if (x.resultat === 'perdu') units -= 1;
  });
  return { taux, total, units: Math.round(units*10)/10, cote_moy };
}

async function main() {
  if (!FOOTBALL_API_KEY) { console.error('FOOTBALL_DATA_API_KEY manquante'); process.exit(1); }
  const dataPath = path.join(__dirname, '../data/match-data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  if (data.today.pas_de_match || !data.today.equipe1) {
    console.log('Pas de match a verifier'); return;
  }
  const todayShort = getDateShort(getISO(0));
  const yestShort = getDateShort(getISO(-1));
  const already = (data.history || []).some(h =>
    (h.date === todayShort || h.date === yestShort) &&
    teamsMatch(h.equipe1, data.today.equipe1) && teamsMatch(h.equipe2, data.today.equipe2)
  );
  if (already) { console.log('Resultat deja enregistre'); return; }
  console.log('Recherche: ' + data.today.equipe1 + ' vs ' + data.today.equipe2);
  const match = await findMatchResult(data.today.equipe1, data.today.equipe2);
  if (!match) { console.log('Match pas encore termine'); return; }
  const { resultat, score } = determineResult(match, data.today.pronostic);
  console.log((resultat==='gagne'?'GAGNE':'PERDU') + ' ' + score);
  const entry = {
    date: getDateShort(match.utcDate),
    equipe1: data.today.equipe1, equipe2: data.today.equipe2,
    flag1: data.today.flag1, flag2: data.today.flag2,
    competition: data.today.competition, pronostic: data.today.pronostic,
    cote: data.today.cote, note: data.today.note, resultat, score
  };
  data.history = [entry, ...(data.history || [])].slice(0, 50);
  data.stats = recalcStats(data.history);
  data.updated_at = new Date().toISOString();
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
  console.log('Historique mis a jour · ' + data.stats.taux + '% sur ' + data.stats.total + ' matchs');
}

main().catch(e => { console.error(e.message); process.exit(1); });

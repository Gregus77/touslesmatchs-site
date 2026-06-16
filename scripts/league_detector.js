#!/usr/bin/env node
const https = require('https');
require('dotenv').config();
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const FOOTBALL_KEY = process.env.FOOTBALL_DATA_KEY;
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const PRIMARY_LEAGUES = {
  'FR': ['Ligue 1', 'France - Ligue 1'],
  'ES': ['La Liga', 'Spain - La Liga'],
  'EN': ['Premier League', 'England - Premier League'],
  'IT': ['Serie A', 'Italy - Serie A'],
  'DE': ['Bundesliga', 'Germany - Bundesliga'],
  'BR': ['Brasileirão', 'Brazil - Série A'],
};
const FALLBACK_LEAGUES = {
  'FR': ['Ligue 2', 'France - Ligue 2', 'Ligue 3', 'France - Ligue 3'],
  'ES': ['La Liga 2', 'Spain - La Liga 2'],
  'EN': ['Championship', 'England - Championship'],
  'IT': ['Serie B', 'Italy - Serie B'],
  'DE': ['2. Bundesliga', 'Germany - 2. Bundesliga'],
  'BR': ['Série B', 'Brazil - Série B'],
};
function httpsRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({}); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
async function getTodayMatchesRapidAPI() {
  if (!RAPIDAPI_KEY) return [];
  try {
    const today = new Date().toISOString().split('T')[0];
    const data = await httpsRequest({
      hostname: 'free-api-live-football-data.p.rapidapi.com',
      path: `/fixtures?date=${today}`,
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'free-api-live-football-data.p.rapidapi.com',
        'x-rapidapi-key': RAPIDAPI_KEY
      }
    });
    if (!data.response) return [];
    return data.response.map(m => ({
      home: m.teams?.home?.name || '?',
      away: m.teams?.away?.name || '?',
      league: m.league?.name || '?',
      status: m.fixture?.status || 'NOT_STARTED',
      time: m.fixture?.timestamp || null
    })).filter(m => m.home !== '?' && m.away !== '?');
  } catch (e) {
    console.error('RapidAPI error:', e.message);
    return [];
  }
}
async function getLiveMatchesFootballData() {
  if (!FOOTBALL_KEY) return [];
  try {
    const data = await httpsRequest({
      hostname: 'api.football-data.org',
      path: '/v4/matches?status=LIVE',
      method: 'GET',
      headers: { 'X-Auth-Token': FOOTBALL_KEY }
    });
    if (!data.matches) return [];
    return data.matches.map(m => ({
      home: m.homeTeam?.name || '?',
      away: m.awayTeam?.name || '?',
      league: m.competition?.name || '?',
      status: m.status || 'IN_PLAY',
      time: m.utcDate || null
    })).filter(m => m.home !== '?' && m.away !== '?');
  } catch (e) {
    console.error('football-data.org error:', e.message);
    return [];
  }
}
async function detectActiveLeagues() {
  const [rapidMatches, footballMatches] = await Promise.all([
    getTodayMatchesRapidAPI().catch(() => []),
    getLiveMatchesFootballData().catch(() => [])
  ]);
  const allMatches = [...rapidMatches, ...footballMatches];
  if (allMatches.length === 0) {
    console.log('❌ Aucun match trouvé.');
    return { active: [], fallback: [] };
  }
  const leaguesSet = new Set();
  allMatches.forEach(m => {
    if (m.league && m.league !== '?') leaguesSet.add(m.league);
  });
  const activeLeagues = Array.from(leaguesSet);
  console.log(`✅ Championnats actifs : ${activeLeagues.join(', ')}`);
  const fallbackRecommendations = [];
  for (const [country, primaries] of Object.entries(PRIMARY_LEAGUES)) {
    const hasPrimary = activeLeagues.some(l =>
      primaries.some(p => l.toLowerCase().includes(p.toLowerCase()))
    );
    if (!hasPrimary && FALLBACK_LEAGUES[country]) {
      fallbackRecommendations.push(...FALLBACK_LEAGUES[country]);
    }
  }
  return {
    active: activeLeagues,
    fallback: fallbackRecommendations,
    totalMatches: allMatches.length,
    timestamp: new Date().toISOString()
  };
}
async function saveLeagueStatus() {
  const status = await detectActiveLeagues();
  const fs = require('fs');
  fs.writeFileSync(
    '/opt/touslesmatchs/scripts/active_leagues.json',
    JSON.stringify(status, null, 2)
  );
  console.log('\n📊 Statut sauvegardé dans active_leagues.json');
  console.log(JSON.stringify(status, null, 2));
  return status;
}
module.exports = {
  detectActiveLeagues,
  saveLeagueStatus,
  getTodayMatchesRapidAPI,
  getLiveMatchesFootballData
};
if (require.main === module) {
  saveLeagueStatus().catch(console.error);
}

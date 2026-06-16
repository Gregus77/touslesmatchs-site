#!/bin/bash
cd /opt/touslesmatchs/scripts

# Créer league_detector.js
cat > league_detector.js << 'LEAGUE_EOF'
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
LEAGUE_EOF

# Créer auto_fallback.js
cat > auto_fallback.js << 'FALLBACK_EOF'
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const ACTIVE_LEAGUES_FILE = '/opt/touslesmatchs/scripts/active_leagues.json';
const CONFIG_FILE = '/opt/touslesmatchs/scripts/current_target_leagues.json';
const DEFAULT_CONFIG = {
  primary: [
    'Ligue 1', 'France - Ligue 1',
    'Premier League', 'England - Premier League',
    'La Liga', 'Spain - La Liga',
    'Serie A', 'Italy - Serie A',
    'Bundesliga', 'Germany - Bundesliga'
  ],
  fallback: [
    'Ligue 2', 'France - Ligue 2',
    'Championship', 'England - Championship',
    'La Liga 2', 'Spain - La Liga 2',
    'Serie B', 'Italy - Serie B',
    '2. Bundesliga', 'Germany - 2. Bundesliga'
  ],
  lastUpdated: new Date().toISOString(),
  mode: 'primary'
};
function readLeagueStatus() {
  try {
    if (fs.existsSync(ACTIVE_LEAGUES_FILE)) {
      const data = fs.readFileSync(ACTIVE_LEAGUES_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('❌ Erreur lecture active_leagues.json:', e.message);
  }
  return null;
}
function readCurrentConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('⚠️  Config non trouvée, création par défaut');
  }
  return { ...DEFAULT_CONFIG };
}
function saveCurrentConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log(`✅ Config sauvegardée: mode=${config.mode}`);
}
function decideTargetLeagues() {
  const status = readLeagueStatus();
  const config = readCurrentConfig();
  if (!status || !status.active || status.active.length === 0) {
    console.log('⚠️  Pas de statut actif détecté. Gardant configuration actuelle.');
    return config;
  }
  const activeLeagues = status.active;
  console.log(`📊 Championnats actifs détectés: ${activeLeagues.join(', ')}`);
  const primaryActive = config.primary.some(p =>
    activeLeagues.some(a => a.toLowerCase().includes(p.toLowerCase()))
  );
  if (primaryActive) {
    console.log('✅ Championnats principaux actifs → Mode PRIMARY');
    config.mode = 'primary';
    config.targetLeagues = config.primary;
  } else {
    console.log('🔄 Championnats principaux terminés → Mode FALLBACK');
    config.mode = 'fallback';
    config.targetLeagues = config.fallback;
  }
  config.lastUpdated = new Date().toISOString();
  config.activeDetectedLeagues = activeLeagues;
  return config;
}
function applyTargetLeagues(config) {
  fs.writeFileSync(
    '/opt/touslesmatchs/scripts/target_leagues.json',
    JSON.stringify({
      leagues: config.targetLeagues || config.primary,
      mode: config.mode,
      updatedAt: config.lastUpdated
    }, null, 2)
  );
  console.log(`\n🎯 Championnats cibles pour cette analyse:`);
  (config.targetLeagues || config.primary).forEach(l => console.log(`   - ${l}`));
  return config;
}
async function runFallbackDetection() {
  console.log('\n🔍 === AUTO FALLBACK DETECTION ===');
  console.log(`⏰ ${new Date().toISOString()}\n`);
  const config = decideTargetLeagues();
  applyTargetLeagues(config);
  saveCurrentConfig(config);
  console.log('\n✅ Fallback detection complète!');
  return config;
}
module.exports = {
  decideTargetLeagues,
  applyTargetLeagues,
  readCurrentConfig,
  saveCurrentConfig,
  runFallbackDetection
};
if (require.main === module) {
  runFallbackDetection().catch(console.error);
}
FALLBACK_EOF

echo "✅ Fichiers créés avec succès!"
ls -la league_detector.js auto_fallback.js

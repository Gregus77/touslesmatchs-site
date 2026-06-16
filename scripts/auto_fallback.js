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

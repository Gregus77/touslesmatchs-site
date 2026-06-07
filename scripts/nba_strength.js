// ─────────────────────────────────────────────────────────────
// NBA TEAM STRENGTH — ELO calibré sur win% saison 2025-26
// Mis à jour manuellement à partir des standings NBA.com
// ─────────────────────────────────────────────────────────────
"use strict";

const NBA_ELO = {
  // East
  "Boston Celtics":          1800,
  "Cleveland Cavaliers":     1770,
  "New York Knicks":         1750,
  "Milwaukee Bucks":         1720,
  "Orlando Magic":           1700,
  "Indiana Pacers":          1700,
  "Philadelphia 76ers":      1690,
  "Miami Heat":              1670,
  "Atlanta Hawks":           1660,
  "Detroit Pistons":         1650,
  "Chicago Bulls":           1620,
  "Toronto Raptors":         1580,
  "Brooklyn Nets":           1560,
  "Charlotte Hornets":       1540,
  "Washington Wizards":      1480,
  // West
  "Oklahoma City Thunder":   1820,
  "Denver Nuggets":          1780,
  "Minnesota Timberwolves":  1760,
  "Los Angeles Lakers":      1730,
  "Dallas Mavericks":        1720,
  "Phoenix Suns":            1710,
  "Golden State Warriors":   1700,
  "Houston Rockets":         1700,
  "LA Clippers":             1690,
  "Los Angeles Clippers":    1690,
  "Sacramento Kings":        1670,
  "Memphis Grizzlies":       1660,
  "San Antonio Spurs":       1620,
  "Portland Trail Blazers":  1580,
  "Utah Jazz":               1540,
  "New Orleans Pelicans":    1600,
};

const DEFAULT_NBA_ELO = 1650;

function getNbaElo(teamName) {
  if (NBA_ELO[teamName]) return NBA_ELO[teamName];
  for (const [k, v] of Object.entries(NBA_ELO)) {
    if (k.toLowerCase().includes(teamName.toLowerCase()) ||
        teamName.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return DEFAULT_NBA_ELO;
}

module.exports = { getNbaElo, NBA_ELO };

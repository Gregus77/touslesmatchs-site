// ─────────────────────────────────────────────────────────────
// MLB TEAM STRENGTH — ELO calibré sur win% saison régulière
// Mis à jour manuellement à partir des standings MLB.com
// Permet à Hermès d'évaluer les matchs MLB au-delà des cotes
// ─────────────────────────────────────────────────────────────
"use strict";

// Saison 2026 (mise à jour juin 2026 — à rafraîchir périodiquement)
// Échelle : 1500 = équipe neutre 50%, +20 ELO ≈ +1% win
const MLB_ELO = {
  // AL East
  "New York Yankees":     1780,
  "Baltimore Orioles":    1740,
  "Boston Red Sox":       1690,
  "Tampa Bay Rays":       1680,
  "Toronto Blue Jays":    1670,
  // AL Central
  "Cleveland Guardians":  1730,
  "Detroit Tigers":       1700,
  "Kansas City Royals":   1670,
  "Minnesota Twins":      1660,
  "Chicago White Sox":    1500,
  // AL West
  "Houston Astros":       1750,
  "Texas Rangers":        1700,
  "Seattle Mariners":     1680,
  "Los Angeles Angels":   1620,
  "Oakland Athletics":    1520,
  "Athletics":            1520,
  // NL East
  "Philadelphia Phillies": 1770,
  "Atlanta Braves":       1750,
  "New York Mets":        1700,
  "Washington Nationals": 1620,
  "Miami Marlins":        1580,
  // NL Central
  "Milwaukee Brewers":    1720,
  "Chicago Cubs":         1700,
  "St. Louis Cardinals":  1680,
  "Cincinnati Reds":      1650,
  "Pittsburgh Pirates":   1580,
  // NL West
  "Los Angeles Dodgers":  1810,
  "San Diego Padres":     1730,
  "Arizona Diamondbacks": 1700,
  "San Francisco Giants": 1680,
  "Colorado Rockies":     1520,
};

const DEFAULT_MLB_ELO = 1650;

function getMlbElo(teamName) {
  if (MLB_ELO[teamName]) return MLB_ELO[teamName];
  // Recherche partielle pour gérer petites variations de noms
  for (const [k, v] of Object.entries(MLB_ELO)) {
    if (k.toLowerCase().includes(teamName.toLowerCase()) ||
        teamName.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return DEFAULT_MLB_ELO;
}

module.exports = { getMlbElo, MLB_ELO };

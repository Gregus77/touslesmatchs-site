// ─────────────────────────────────────────────────────────────
// FOOTBALL LEAGUE IDs → noms officiels & flag "compétition sérieuse"
// Source : RapidAPI free-football-data leagueId
// ─────────────────────────────────────────────────────────────
"use strict";

// Compétitions de club majeures
const CLUB_LEAGUES = {
  47:  { name: "Premier League",     country: "England",  serious: true },
  87:  { name: "La Liga",            country: "Spain",    serious: true },
  54:  { name: "Bundesliga",         country: "Germany",  serious: true },
  55:  { name: "Serie A",            country: "Italy",    serious: true },
  53:  { name: "Ligue 1",            country: "France",   serious: true },
  42:  { name: "Champions League",   country: "Europe",   serious: true },
  73:  { name: "Europa League",      country: "Europe",   serious: true },
  100: { name: "Conference League",  country: "Europe",   serious: true },
  301: { name: "Coupe de France",    country: "France",   serious: true },
  170: { name: "Eredivisie",         country: "Netherlands", serious: true },
  61:  { name: "Primeira Liga",      country: "Portugal", serious: true },
};

// Compétitions internationales sélections
const INTERNATIONAL_LEAGUES = {
  9469: { name: "UEFA Nations League", serious: true,  type: "nations_league" },
  4:    { name: "FIFA World Cup",       serious: true,  type: "world_cup" },
  77:   { name: "EURO",                 serious: true,  type: "euro" },
  928683: { name: "World Cup Qualifying", serious: true, type: "qualifying" },
  344:  { name: "International Friendly", serious: false, type: "friendly" },
  914609: { name: "International Friendly", serious: false, type: "friendly" },
  // Les amicaux internationaux sont marqués serious:false → rejet automatique
};

const ALL_LEAGUES = { ...CLUB_LEAGUES, ...INTERNATIONAL_LEAGUES };

function getLeagueInfo(leagueId) {
  return ALL_LEAGUES[leagueId] || { name: `Competition #${leagueId}`, serious: false, type: "unknown" };
}

function isSeriousCompetition(leagueId) {
  const info = getLeagueInfo(leagueId);
  return info.serious === true;
}

module.exports = { getLeagueInfo, isSeriousCompetition, ALL_LEAGUES };

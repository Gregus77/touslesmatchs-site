"use strict";

const assert = require("assert/strict");
const { adminVerdict, findTeamGoalOver05Offers, formatAdminWatchlistMessage, loadHistoricalCaches } = require("./goal05_api_scan");

const offersHome = findTeamGoalOver05Offers([
  {
    name: "Bookmaker test",
    bets: [
      {
        name: "Team to score over 0.5",
        values: [
          { value: "Home over 0.5", odd: "1.34" },
          { value: "Away over 0.5", odd: "1.55" },
        ],
      },
    ],
  },
], "home");

assert.equal(offersHome.length, 1);
assert.equal(offersHome[0].odd, 1.34);
assert.equal(offersHome[0].bookmaker, "Bookmaker test");

const offersAway = findTeamGoalOver05Offers([
  {
    name: "Bookmaker test",
    bets: [
      {
        name: "Team total goals",
        values: [
          { value: "Home over 0.5", odd: "1.31" },
          { value: "Away over 0.5", odd: "1.62" },
        ],
      },
    ],
  },
], "away");

assert.equal(offersAway.length, 1);
assert.equal(offersAway[0].odd, 1.62);

const caches = loadHistoricalCaches();
assert.ok(caches.length >= 10);
assert.ok(caches.some((cache) => cache.country === "Brazil" && cache.league.includes("Brasileiro")));

const adminMessage = formatAdminWatchlistMessage({
  date: "2026-08-16",
  report: {
    summary: { total: 1, eligible: 0, noBet: 1, sent: 0 },
    results: [
      {
        match: "Vitoria - Botafogo",
        team: "Botafogo",
        country: "Brazil",
        league: "Brasileiro Serie A",
        homeLogo: "https://media.api-sports.io/football/teams/1.png",
        awayLogo: "https://media.api-sports.io/football/teams/2.png",
        status: "NO_BET",
        bestOdd: { odd: 2.31 },
        reasons: ["enjeu de classement non dÃ©montrÃ©", "Ã©quipe non buteuse sur les cinq derniers matchs"],
        warnings: ["historique 3 saisons acceptÃ© : prudence renforcÃ©e"],
        evidence: {
          country: "Brazil",
          league: "Brasileiro Serie A",
          competitionType: "league",
          fiveYearStrength: { levelTableLoaded: true, seasonsAvailable: 3, teamPercentile: 70, opponentPercentile: 20 },
          recent: { scoredInLastFive: 2, opponentConcededInLastFive: 5, weightedConstructedGoals: 1 },
          stake: { teamHasMeaningfulObjective: false, sameZoneAfterResult: true },
          market: { bestOdd: 2.31 },
        },
      },
    ],
  },
});
assert.ok(adminMessage.includes("WATCHLIST ADMIN Goal +0,5"));
assert.ok(adminMessage.includes("admin uniquement"));
assert.ok(adminMessage.includes("Botafogo"));
assert.ok(adminMessage.includes("NO BET"));
assert.ok(adminMessage.includes("Lecture rapide"));
assert.ok(adminMessage.includes("Brazil - Brasileiro Serie A"));
assert.ok(adminMessage.includes("Fanions:"));
assert.ok(adminMessage.includes("Crit"));
assert.ok(adminMessage.includes("Buteur 5/5"));
assert.equal(adminVerdict({ status: "NO_BET", reasons: ["enjeu de classement non dÃ©montrÃ©", "Ã©quipe non buteuse sur les cinq derniers matchs", "preuves insuffisantes"] }).label, "NO BET");

console.log("goal05_api_scan: OK");

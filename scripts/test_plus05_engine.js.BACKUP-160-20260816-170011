"use strict";

const assert = require("node:assert/strict");
const { evaluateCandidate, findTeamToScoreOver05Odds, PLUS05_MIN_ODD, MIN_HISTORICAL_SEASONS } = require("./plus05_engine");

const base = {
  country: "France",
  league: "Ligue 1",
  competitionType: "league",
  teamSide: "home",
  team: "Paris FC",
  opponent: "Toulouse",
  fiveYearStrength: { levelTableLoaded: true, seasonsAvailable: 4, teamPercentile: 88, opponentPercentile: 19, historicalCacheStatus: "OK" },
  recent: {
    recentMatchesOrder: "oldest_to_newest",
    scoredInLastFive: 5,
    opponentConcededInLastFive: 5,
    weightedConstructedGoals: 4,
    scoringState: "yes",
    scoringStateWithCharacter: "yes",
    goal05SpecificEvidence: "strong",
    opponentConcedesState: "yes",
    candidateCanReproduceConcessionPattern: true,
    candidateLevelMatchesPriorScorers: true,
    psychologicalGoalPainScore: 1
  },
  stake: { teamHasMeaningfulObjective: true, stakeTeamIsStrongerSide: true, sameZoneAfterResult: false },
  odds: {
    fetchedAt: "2026-08-11T10:00:00.000Z",
    arjelBookmakers: [{ name: "Unibet", bets: [{ name: "Home Team To Score", values: [{ value: "Over 0.5", odd: "1.72" }] }] }]
  }
};

assert.equal(PLUS05_MIN_ODD, 1.30);
assert.equal(MIN_HISTORICAL_SEASONS, 3);
assert.equal(findTeamToScoreOver05Odds(base.odds, "home").bestOdd, 1.72);
assert.equal(evaluateCandidate(base).status, "ELIGIBLE_SHADOW");
assert.equal(evaluateCandidate({ ...base, country: "Chile" }).status, "NO_BET");
assert.equal(evaluateCandidate({ ...base, competitionType: "cup" }).status, "NO_BET");
assert.equal(evaluateCandidate({ ...base, fiveYearStrength: { ...base.fiveYearStrength, seasonsAvailable: 3 } }).status, "ELIGIBLE_SHADOW");
assert.match(evaluateCandidate({ ...base, fiveYearStrength: { ...base.fiveYearStrength, seasonsAvailable: 3 } }).warnings.join(" "), /3 saisons accepté/);
assert.equal(evaluateCandidate({ ...base, fiveYearStrength: { ...base.fiveYearStrength, seasonsAvailable: 2 } }).status, "NO_BET");
assert.equal(evaluateCandidate({ ...base, recent: { ...base.recent, weightedConstructedGoals: 2 } }).status, "NO_BET");
assert.equal(evaluateCandidate({ ...base, recent: { ...base.recent, candidateLevelMatchesPriorScorers: false } }).status, "NO_BET");
assert.equal(evaluateCandidate({ ...base, recent: { ...base.recent, positiveIntensityWithoutGoal: true } }).status, "WATCHLIST_SHADOW");
assert.equal(evaluateCandidate({ ...base, odds: { ...base.odds, arjelBookmakers: [] } }).status, "NO_BET");

console.log("plus05_engine: OK");
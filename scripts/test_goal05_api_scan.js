"use strict";

const assert = require("assert/strict");
const { findTeamGoalOver05Offers, loadHistoricalCaches } = require("./goal05_api_scan");

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

console.log("goal05_api_scan: OK");
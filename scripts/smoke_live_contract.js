"use strict";

const assert = require("assert");
const Module = require("module");

process.env.DB_PATH = process.env.DB_PATH || ":memory:";

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "express") {
    const express = () => {
      const app = {
        use() { return app; },
        get() { return app; },
        post() { return app; },
        delete() { return app; },
        listen() { return app; },
      };
      return app;
    };
    express.json = () => (req, res, next) => (typeof next === "function" ? next() : undefined);
    express.raw = () => (req, res, next) => (typeof next === "function" ? next() : undefined);
    return express;
  }
  if (request === "cors") {
    return () => (req, res, next) => (typeof next === "function" ? next() : undefined);
  }
  if (request === "better-sqlite3") {
    return class FakeDatabase {
      constructor() {}
      exec() {}
      prepare() {
        return {
          get() { return null; },
          all() { return []; },
          run() { return { changes: 0 }; },
        };
      }
      close() {}
    };
  }
  if (request === "bcryptjs" || request === "jsonwebtoken") {
    return {};
  }
  return originalLoad(request, parent, isMain);
};

const { __liveContractTest } = require("./api_server.js");
Module._load = originalLoad;

function testFootballDataProvenance() {
  const match = __liveContractTest.normalizeFootballDataMatch({
    id: 123,
    homeTeam: { name: "France" },
    awayTeam: { name: "Brazil" },
    score: { fullTime: { home: null, away: null }, halfTime: { home: null, away: null } },
    status: "LIVE",
    competition: { name: "World Cup" },
    utcDate: "2026-06-22T19:00:00Z",
  });

  assert.equal(match.source, "football-data");
  assert.equal(match.sourceId, "123");
  assert.equal(match.fixtureId, null);
  assert.equal(match.score_home, null);
  assert.equal(__liveContractTest.getVerifiedFixtureId(match), null);
}

function testApiSportsFixtureCanFetchStats() {
  const match = __liveContractTest.normalizeApiSportsFootballFixture({
    fixture: { id: 987, status: { elapsed: 55 }, date: "2026-06-22T19:00:00Z" },
    teams: { home: { name: "France" }, away: { name: "Brazil" } },
    goals: { home: 1, away: 0 },
    league: { name: "World Cup", country: "World" },
  });

  assert.equal(match.source, "api-sports");
  assert.equal(match.fixtureId, "987");
  assert.equal(match.sourceId, "987");
  assert.equal(__liveContractTest.getVerifiedFixtureId(match), "987");
}

function testStatsStatusIsExplicitWhenUnavailable() {
  const status = __liveContractTest.buildStatsStatus(
    { source: "football-data", sport: "Football", fixtureId: null },
    null,
    "missing_api_sports_fixture"
  );

  assert.deepEqual(status, {
    available: false,
    source: null,
    fixtureId: null,
    reason: "missing_api_sports_fixture",
    stats: null,
  });
}

testFootballDataProvenance();
testApiSportsFixtureCanFetchStats();
testStatsStatusIsExplicitWhenUnavailable();

console.log("smoke_live_contract: ok");

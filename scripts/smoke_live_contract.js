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

function testVerifiedFixtureRejectsNonNumericIds() {
  assert.equal(__liveContractTest.getVerifiedFixtureId({ source: "api-sports", sport: "Football", fixtureId: "demo1" }), null);
  assert.equal(__liveContractTest.getVerifiedFixtureId({ source: "api-sports", sport: "Basketball", fixtureId: "123" }), null);
  assert.equal(__liveContractTest.getVerifiedFixtureId({ source: "api-sports", sport: "Football", fixtureId: "123" }), "123");
}

function testHermesCurrentPickNormalization() {
  const pick = __liveContractTest.normalizeCurrentPick({
    home: "France",
    away: "Brazil",
    league: "World Cup",
    time: "19:00",
    bet: "1X2",
    prono: "Victoire France",
    cote: "1.95",
    status: "GAGNE",
    score: "2-1",
    source: "hermes",
    updatedAt: "2026-06-22T19:05:00.000Z",
    sourceMatchId: "fd-123",
    fixtureId: "987",
  }, "hermes");

  assert.equal(pick.teamA.name, "France");
  assert.equal(pick.teamB.name, "Brazil");
  assert.equal(pick.source, "hermes");
  assert.equal(pick.updatedAt, "2026-06-22T19:05:00.000Z");
  assert.equal(pick.sourceMatchId, "fd-123");
  assert.equal(pick.fixtureId, "987");
  assert.equal(pick.status, "win");
  assert.equal(pick.result, "win");
  assert.equal(pick.scoreA, 2);
  assert.equal(pick.scoreB, 1);
}

function testHermesPendingCurrentPickNormalizesToUpcoming() {
  const pick = __liveContractTest.normalizeCurrentPick({
    home: "France",
    away: "Brazil",
    league: "World Cup",
    time: "19:00",
    bet: "1X2",
    prono: "Victoire France",
    cote: "1.95",
    status: "EN ATTENTE",
    score: "",
    source: "hermes",
    updatedAt: "2026-06-22T19:05:00.000Z",
    sourceMatchId: "fd-123",
    fixtureId: "987",
  }, "hermes");

  assert.equal(pick.status, "upcoming");
  assert.equal(pick.result, null);
  assert.equal(pick.source, "hermes");
  assert.equal(pick.updatedAt, "2026-06-22T19:05:00.000Z");
  assert.equal(pick.sourceMatchId, "fd-123");
  assert.equal(pick.fixtureId, "987");
}

function testHermesNopickCurrentPickNormalizesToUpcoming() {
  const pick = __liveContractTest.normalizeCurrentPick({
    home: "PAS DE PICK",
    away: "",
    league: "",
    time: "",
    prono: "Aucun pick aujourd'hui",
    bet: "",
    cote: "",
    status: "NOPICK",
    score: "",
    source: "hermes",
    updatedAt: "2026-06-22T00:00:00.000Z",
  }, "hermes");

  assert.equal(pick.status, "upcoming");
  assert.equal(pick.result, null);
  assert.equal(pick.source, "hermes");
  assert.equal(pick.updatedAt, "2026-06-22T00:00:00.000Z");
}

function testAdminCurrentPickNormalizationDefaultsProvenance() {
  const pick = __liveContractTest.normalizeCurrentPick({
    teamA: { name: "Maroc", abbr: "MAR", color: "#4f46e5" },
    teamB: { name: "Espagne", abbr: "ESP", color: "#7c3aed" },
    competition: "Friendly",
    time: "21:00",
    marketType: "BTTS",
    marketLabel: "Les deux équipes marquent",
    cote: 1.8,
    status: "upcoming",
    scoreA: null,
    scoreB: null,
    updatedAt: "2026-06-22T21:00:00.000Z",
    sourceMatchId: "manual-42",
    fixtureId: "fixture-42",
  }, "manual-admin");

  assert.equal(pick.teamA.name, "Maroc");
  assert.equal(pick.teamB.name, "Espagne");
  assert.equal(pick.marketType, "BTTS");
  assert.equal(pick.marketLabel, "Les deux équipes marquent");
  assert.equal(pick.source, "manual-admin");
  assert.equal(pick.updatedAt, "2026-06-22T21:00:00.000Z");
  assert.equal(pick.sourceMatchId, "manual-42");
  assert.equal(pick.fixtureId, "fixture-42");
}

testFootballDataProvenance();
testApiSportsFixtureCanFetchStats();
testStatsStatusIsExplicitWhenUnavailable();
testVerifiedFixtureRejectsNonNumericIds();
testHermesCurrentPickNormalization();
testHermesPendingCurrentPickNormalizesToUpcoming();
testHermesNopickCurrentPickNormalizesToUpcoming();
testAdminCurrentPickNormalizationDefaultsProvenance();

console.log("smoke_live_contract: ok");
process.exit(0);

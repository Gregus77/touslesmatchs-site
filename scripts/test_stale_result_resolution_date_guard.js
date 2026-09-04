#!/usr/bin/env node
"use strict";

const fs = require("fs");
const assert = require("assert");
const source = fs.readFileSync(require("path").join(__dirname, "api_server.js"), "utf8");

assert(source.includes("function finalMatchDay(match)"), "finalMatchDay absent");
assert(source.includes("function findUniqueFinishedMatchForStale(stale, finished)"), "sélecteur daté absent");
assert(source.includes("finalMatchDay(candidate) !== day"), "date finale non exigée");
assert(source.includes("sameLiveTeamName(stale?.home, candidate?.home)"), "équipe domicile non vérifiée strictement");
assert(source.includes("sameLiveTeamName(stale?.away, candidate?.away)"), "équipe extérieure non vérifiée strictement");

const start = source.indexOf("async function resolveStalePredictions()");
const end = source.indexOf("let signalFortResolveRunning", start);
assert(start >= 0 && end > start, "bloc resolveStalePredictions introuvable");
const block = source.slice(start, end);
assert(block.includes("findUniqueFinishedMatchForStale(s, finished)"), "rattrapage non branché sur le sélecteur sûr");
assert(!block.includes("sameCompetition.find"), "ancien repli flou encore actif");
assert(!block.includes("levenshteinAtMost(w, hw, 3)"), "distance floue dangereuse encore active");

function day(value) { return String(value || "").slice(0, 10); }
const stale = { home: "Lyon", away: "Auxerre", day: "2026-09-04" };
const wrong = { home: "Lens", away: "Auxerre", utcDate: "2026-08-22T19:00:00Z", score_home: 5, score_away: 2 };
assert.notStrictEqual(day(wrong.utcDate), stale.day, "fixture de régression mal construite");

console.log("OK — Lens-Auxerre 5-2 ne peut plus résoudre Lyon-Auxerre du 04/09");

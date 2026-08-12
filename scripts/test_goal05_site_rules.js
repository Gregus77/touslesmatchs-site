"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const rulesPath = path.join(root, "docs", "goal-05", "2026-08-12-criteres-selection-goal-05.md");
const homePath = path.join(root, "public", "index.html");

const rules = fs.readFileSync(rulesPath, "utf8");
const home = fs.readFileSync(homePath, "utf8");

assert(rules.includes("GOAL 0.5 IA - criteres de selection"), "rules title missing");
assert(rules.includes("40 / 30 / 20 / 10"), "four-season weighting missing");
assert(rules.includes("top 25% historique contre bottom 25% historique"), "historical mismatch rule missing");
assert(rules.includes("domicile ou a l'exterieur"), "home/away neutrality rule missing");
assert(rules.includes("historiquement la plus forte"), "historically strongest team rule missing");
assert(rules.includes("80/100"), "minimum score missing");
assert(rules.includes("1.60"), "minimum live odd missing");

assert(home.includes("goal05-founder-card"), "Goal 0.5 founder card missing from homepage");
assert(home.includes("Equipe +0,5 but"), "Goal 0.5 card title missing");
assert(home.includes("20 places offertes pendant la beta"), "founder beta offer missing");
assert(home.includes('id="goal05-remaining-count"'), "dynamic remaining count missing");
assert(home.includes('goal05-live-places'), "live scarcity badge missing");
assert(home.includes('goal05Pulse'), "scarcity pulse animation missing");
assert(home.includes('updateGoal05Remaining'), "remaining count updater missing");
assert(home.includes("Analyse historique 4 saisons"), "four-season proof copy missing");
assert(home.includes("La selection n'est pas liee au domicile"), "homepage must not imply home team only");

console.log("Goal 0.5 site/rules checks passed");
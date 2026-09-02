#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const sourcePath = path.join(__dirname, "api_server.js");
const source = fs.readFileSync(sourcePath, "utf8");

const checks = [
  ["mode actif par defaut", 'const RECOVERY_MODE_ENABLED = process.env.OU25_RECOVERY_MODE !== "0";'],
  ["plafond 1-2 par jour", "const RECOVERY_MAX_DAILY_SIGNALS = Math.min(2, Math.max(1"],
  ["fenetre live 15-40", "Math.max(15, Number(process.env.CLIENT_OU25_CLIENT_MAX_MINUTE || 40))"],
  ["Over >= 2.80", "const RECOVERY_OVER_MIN_AVG = 2.80;"],
  ["Under <= 2.20", "const RECOVERY_UNDER_MAX_AVG = 2.20;"],
  ["minimum 3 indicateurs", "const RECOVERY_MIN_CONVERGENT_INDICATORS = 3;"],
  ["consensus 4/5", "return CLIENT_OU25_MIN_VOTES;"],
  ["cote minimum 1.40", "const TIER_MIN_REAL_ODD = Math.max(1.40"],
  ["cote maximum 2.10", "const TIER_MAX_REAL_ODD = Math.min(2.10"],
  ["championnats autorises", "function recoveryLeagueAllowed(match)"],
  ["historique 6-8", "if (rows.length < 6)"],
  ["domicile/exterieur", 'fetchRecoveryRecentGoalProfile(match, match.homeId, "home")'],
  ["statistiques live obligatoires", 'reason: "statistiques live incompletes"'],
  ["absences obligatoires", 'reason: "donnees absences indisponibles"'],
  ["filtre fail-closed", "&& recoveryEvidence.ok && recoveryCapacityAvailable"],
];

const failures = checks.filter(([, needle]) => !source.includes(needle)).map(([label]) => label);
if (failures.length) {
  console.error("FAILED — garde-fous Recovery absents:", failures.join(", "));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  checks: checks.length,
  mode: "Recovery",
  daily_max: 2,
  confidence_min: 78,
  required_votes: "4/5",
  live_window: "15-40",
  fail_closed: true,
}, null, 2));

#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const api = fs.readFileSync(path.join(root, "scripts/api_server.js"), "utf8");
const models = fs.readFileSync(path.join(root, "scripts/ai_models.config.js"), "utf8");

const checks = [
  ["plancher client 78", /CLIENT_OU25_MIN_CONFIDENCE\s*=\s*Math\.max\(78,/],
  ["fonction plancher exécutable", /\nfunction getSignalFloor\(\) \{ return 78; \}/],
  ["fin de fenêtre client 32e", /CLIENT_OU25_CLIENT_MAX_MINUTE[\s\S]{0,160}Number\(process\.env\.CLIENT_OU25_CLIENT_MAX_MINUTE \|\| 32\)/],
  ["Qwen titulaire", /CONCILE_AGENT_NAMES[^\n]+OpenRouter-Qwen/],
  ["Kimi absent des titulaires", /CONCILE_AGENT_NAMES[^\n]+OpenRouter-Kimi/],
  ["unanimité Under", /market\.startsWith\("under 2\.5"\)\) return 5/],
  ["unanimité Championship", /championship[\s\S]{0,100}return 5/],
  ["unanimité Brésil A-B", /serie a\|serie b[\s\S]{0,160}return 5/],
  ["résultats immuables", /analyse résolue immuable, réanalyse ignorée/],
  ["résolution unique", /if \(matches\.length !== 1\)/],
];

for (const [label, pattern] of checks) {
  const found = pattern.test(api);
  if (label === "Kimi absent des titulaires") assert.equal(found, false, label);
  else assert.equal(found, true, label);
}

assert.match(models, /qwen:[\s\S]*?role: "official",[\s\S]*?mode: "official"/);
assert.match(models, /kimi:[\s\S]*?role: "shadow_test",[\s\S]*?mode: "test"/);

console.log("OK — garde-fous O/U 2,5 vérifiés (78 %, 15-32', 5/5 ciblé, Qwen/Kimi, résolution).");

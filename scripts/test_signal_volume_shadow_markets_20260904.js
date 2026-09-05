#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const api = fs.readFileSync(path.join(root, "scripts/api_server.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "scripts/shadow_tournament_worker.js"), "utf8");
const compose = fs.readFileSync(path.join(root, "docker-compose.yml"), "utf8");

assert.match(api, /CLIENT_OU25_MIN_VOTES\s*=\s*3/);
assert.match(api, /CLIENT_OU25_MIN_CONFIDENCE\s*=\s*Math\.max\(77,/);
assert.match(api, /TIER_MIN_REAL_ODD\s*=\s*Math\.max\(1\.30,/);
assert.match(api, /TIER_MAX_REAL_ODD\s*=\s*Math\.min\(2\.10,/);
assert.match(api, /enoughOu25SeatsPresent\s*=\s*Number\(voteInfo\.vote_active \|\| 0\)\s*>=\s*CLIENT_OU25_MIN_VOTES/);
assert.doesNotMatch(api, /fiveOu25SeatsPresent/);
assert.match(api, /const ok = combinedAligned && liveAligned[\s\S]{0,100}RECOVERY_MIN_CONVERGENT_INDICATORS/);
assert.match(api, /fetchSeasonRows\(numericSeason - 1\)/);

for (const market of ["over_under_1_5", "over_under_3_5", "btts"]) {
  assert.ok(worker.includes(market), `marché shadow absent: ${market}`);
}
assert.match(worker, /CREATE TABLE IF NOT EXISTS shadow_market_predictions/);
assert.match(worker, /minimum_confidence: shadowMinConfidence/);
assert.match(worker, /influences_telegram: false/);
assert.match(worker, /automatic_promotion: false/);
assert.doesNotMatch(worker, /TELEGRAM_BOT_TOKEN|sendTelegramMessage|telegram\.org/);
assert.doesNotMatch(worker, /sig_sent_standard|sig_sent_premium|telegram_signal_deliveries/);
assert.match(compose, /CLIENT_OU25_MIN_CONFIDENCE=\$\{CLIENT_OU25_MIN_CONFIDENCE:-77\}/);
assert.match(compose, /TIER_MIN_REAL_ODD=\$\{TIER_MIN_REAL_ODD:-1\.30\}/);
assert.match(compose, /TIER_MAX_REAL_ODD=\$\{TIER_MAX_REAL_ODD:-2\.10\}/);

console.log("OK — volume O/U 2,5 sécurisé et trois marchés shadow isolés de Telegram.");

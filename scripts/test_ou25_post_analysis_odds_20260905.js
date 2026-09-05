"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.join(__dirname, "api_server.js"), "utf8");
const start = source.indexOf("function betIsPlayable(");
const end = source.indexOf("\nfunction getVerifiedFixtureId(", start);
assert.ok(start >= 0 && end > start, "fonction betIsPlayable introuvable");

const ctx = vm.createContext({
  MIN_PLAYABLE_ODD: 1.60,
  MAX_PLAYABLE_ODD: 2.50,
  TIER_MIN_REAL_ODD: 1.30,
  TIER_MAX_REAL_ODD: 2.10,
  isOu25Bet: bet => /^(Over|Under) 2[.,]5 buts$/i.test(String(bet || "").trim()),
});
vm.runInContext(source.slice(start, end), ctx);

assert.equal(ctx.betIsPlayable({}, "Over 2.5 buts", 1.50).ok, true, "Over 2,5 à 1,50 doit passer");
assert.equal(ctx.betIsPlayable({}, "Under 2.5 buts", 1.30).ok, true, "Under 2,5 à 1,30 doit passer");
assert.equal(ctx.betIsPlayable({}, "Over 2.5 buts", 1.29).ok, false, "O/U 2,5 sous 1,30 doit rester bloqué");
assert.equal(ctx.betIsPlayable({}, "Under 2.5 buts", 2.11).ok, false, "O/U 2,5 au-dessus de 2,10 doit rester bloqué");
assert.equal(ctx.betIsPlayable({}, "Victoire domicile", 1.50).ok, false, "les autres marchés gardent leur seuil générique VPS");

console.log("OK: O/U 2,5 utilise 1,30-2,10 malgré un ancien MIN_PLAYABLE_ODD=1,60; autres marchés inchangés");

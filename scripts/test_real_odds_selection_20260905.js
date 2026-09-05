"use strict";

const fs = require("fs");
const vm = require("vm");
const assert = require("assert/strict");
const source = fs.readFileSync(require("path").join(__dirname, "api_server.js"), "utf8");

function section(startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert(start >= 0 && end > start, startNeedle);
  return source.slice(start, end);
}

const ctx = vm.createContext({});
vm.runInContext(
  'const ARJEL_BOOKMAKERS = ["betclic","winamax","unibet","pmu"];\n' +
  section("function pickRealOdd(", "// Cote marché réaliste par défaut"),
  ctx
);

const oddsData = {
  bookmaker: "Partner",
  bets: [{ name: "Goals Over/Under", values: [
    { value: "Over 2.5", odd: "2.55" },
    { value: "Under 2.5", odd: "1.22" }
  ]}],
  allBookmakers: [
    { name: "Partner", bets: [{ name: "Goals Over/Under", values: [
      { value: "Over 2.5", odd: "2.55" },
      { value: "Under 2.5", odd: "1.22" }
    ]}]},
    { name: "Genuine Bookmaker", bets: [{ name: "Goals Over/Under", values: [
      { value: "Over 2.5", odd: "1.78" },
      { value: "Under 2.5", odd: "1.96" }
    ]}]}
  ]
};

const over = ctx.pickRealBookmakerOdd(oddsData, "Over 2.5 buts", {}, 1.30, 2.10);
const under = ctx.pickRealBookmakerOdd(oddsData, "Under 2.5 buts", {}, 1.30, 2.10);
assert.deepEqual(JSON.parse(JSON.stringify(over)), { odd: 1.78, bookmaker: "Genuine Bookmaker" });
assert.deepEqual(JSON.parse(JSON.stringify(under)), { odd: 1.96, bookmaker: "Genuine Bookmaker" });

assert(source.includes("allBookmakers: bookmakers"));
assert(/isBookmakerPlayableBeforeAnalysis[\s\S]*?pickRealBookmakerOdd\([\s\S]*?TIER_MIN_REAL_ODD[\s\S]*?TIER_MAX_REAL_ODD/.test(source));
assert(/computeBestOdd[\s\S]*?pickRealBookmakerOdd\([\s\S]*?TIER_MIN_REAL_ODD[\s\S]*?TIER_MAX_REAL_ODD/.test(source));
assert(source.includes("voteCountForSignal >= requiredVotesForSignal"));
assert(source.includes("conf >= CLIENT_OU25_MIN_CONFIDENCE"));

console.log("OK: toutes les vraies cotes O/U jouables sont considerees; seuil, quorum et confiance conserves.");

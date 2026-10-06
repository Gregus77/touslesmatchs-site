"use strict";
const fs=require("fs");
const assert=require("assert");
const api=fs.readFileSync(__dirname+"/api_server.js","utf8");
const tg=fs.readFileSync(__dirname+"/telegram_client.js","utf8");
const perf=fs.readFileSync(__dirname+"/../public/performances.html","utf8");
const rules=fs.readFileSync(__dirname+"/../CURRENT_RULES.md","utf8");
const guardian=fs.readFileSync(__dirname+"/tlm_guardian.py","utf8");

for(const marker of [
  'require("./goal05_v2")',
  'goal05_signal_evidence',
  'goal05_signal_results',
  'goal05_scanner_history',
  'fetchGoal05RecentProfile',
  'goal05_v2_20261006',
  'historicalStrengthScore',
  'qualityVerified',
  'resolveGoal05SignalResults',
  'goal05StatsPayload',
  'app.get("/api/goal05/stats"'
]) assert(api.includes(marker),"API marker missing: "+marker);

assert(api.includes("season:season-1")&&api.includes("season:season-2")&&api.includes("season:season-3"),"four-season history missing");
assert(api.includes("weight:0.40")&&api.includes("weight:0.25")&&api.includes("weight:0.20")&&api.includes("weight:0.15"),"history weights missing");
assert(api.includes("last=5&status=FT"),"last five league fixtures missing");
assert(api.includes("Number(targetRecent.scoredCount)")===false,"recent scoring must remain encapsulated in goal05_v2");
assert(api.includes("criteria.rating")&&api.includes("criteria.color"),"rating/color not persisted");
assert(api.includes("owner_scanner_20261005_velez_platense"),"known scanner winner missing");
assert(api.includes("'Vélez Sarsfield','Platense'")&&api.includes("2,2,'win'"),"Velez 2-2 scanner win missing");
assert(!api.includes("'Banfield','Rosario Central'"),"Banfield-Rosario must not be inserted as a scanner win");

assert(tg.includes("Note V2"),"Telegram rating missing");
assert(tg.includes("historicalSeasons")&&tg.includes("historyScore"),"Telegram history evidence missing");
assert(perf.includes("Stratégie +0,5 V2 · statistiques séparées"),"performance V2 panel missing");
assert(perf.includes("/api/goal05/stats"),"performance V2 API missing");
assert(perf.includes("Scanner propriétaire"),"scanner KPI label missing");

assert(rules.includes("saison actuelle + les 3 saisons précédentes"),"current rules history missing");
assert(rules.includes("**40 %**")&&rules.includes("**25 %**")&&rules.includes("**20 %**")&&rules.includes("**15 %**"),"current rule weights missing");
assert(rules.includes("**8,0/10 ou plus**"),"green gate missing");
assert(rules.includes("30 % de bankroll")&&rules.includes("interdite"),"bankroll prohibition missing");
assert(guardian.includes("'version': 'v2_20261006'"),"Guardian V2 version missing");
assert(guardian.includes("'min_rating': 8.0"),"Guardian V2 rating missing");

console.log("GOAL05_V2_INTEGRATION_OK");

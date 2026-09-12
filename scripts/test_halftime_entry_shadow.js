"use strict";
const assert = require("assert");
const Database = require("better-sqlite3");
const shadow = require("./halftime_entry_shadow");

const db = new Database(":memory:");
const base = { matchKey:"42_2026-09-12",home:"Lyon",away:"Auxerre",competition:"Ligue 1",
  selection:"Over 2.5 buts",confidence:80,consensus:3,scoreHome:1,scoreAway:0,
  context:{shots:9} };
assert.equal(shadow.observe(db,{...base,minute:14}).action,"ignored");
assert.equal(shadow.observe(db,{...base,minute:25}).action,"candidate");
assert.equal(shadow.observe(db,{...base,minute:41,odd:1.30,oddSource:"Betclic"}).action,"waiting_odds");
assert.equal(shadow.observe(db,{...base,minute:44,odd:1.52,oddSource:"Betclic"}).action,"qualified");
assert.equal(shadow.resolve(db,{home:"Lyon",away:"Auxerre",scoreHome:3,scoreAway:1,resolutionDay:"2026-09-12"}),1);
const report = shadow.report(db);
assert.equal(report.telegram_delivery,false);
assert.equal(report.totals.wins,1);
assert.equal(report.conclusion,"collecte_en_cours_1_sur_20");

const reversed = {...base,matchKey:"43_2026-09-12",home:"Paris",away:"Lille"};
shadow.observe(db,{...reversed,minute:20});
assert.equal(shadow.observe(db,{...reversed,minute:43,selection:"Under 2.5 buts",odd:1.50,oddSource:"Winamax"}).reason,"direction_changed");
assert.equal(shadow.normalizeSelection("Plus de 2,5 buts"),"Over 2.5 buts");
assert.equal(shadow.realOdd(1.5,"estimation"),null);
assert.equal(require("fs").readFileSync(require.resolve("./halftime_entry_shadow"),"utf8").includes("sendMessage"),false);
console.log("OK: halftime shadow two-stage, real odds, settlement, sample gate and no Telegram delivery");

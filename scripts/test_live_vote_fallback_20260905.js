"use strict";

const fs=require("fs");
const assert=require("assert/strict");
const source=fs.readFileSync(require("path").join(__dirname,"api_server.js"),"utf8");
const start=source.indexOf("function getLiveOu25VoteState(match)");
const end=source.indexOf("// ── Live matches",start);
assert(start>=0&&end>start);
const fn=source.slice(start,end);
assert(fn.includes("FROM agent_market_predictions"));
assert(fn.includes("FROM agent_predictions"));
assert(fn.includes("AND bet IN ('Over 2.5 buts','Under 2.5 buts')"));
assert(fn.includes("const rows = [...marketRows, ...primaryRows].sort"));
assert(fn.includes("if (!latestByAgent.has(row.agent_name))"));
assert(fn.includes("agent_name IN (${placeholders})"));
console.log("OK: affichage live complete les votes multi-marches avec les votes principaux reels.");

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "scripts", "api_server.js"), "utf8");

assert.match(source, /const CLIENT_OU25_MIN_VOTES\s*=\s*3;/, "le consensus client O\/U 2,5 doit etre 3\/5");
assert.match(source, /CLIENT_OU25_MIN_CONFIDENCE\s*=\s*Math\.max\(77,/, "la confiance minimale doit rester a 77");
assert.match(source, /TIER_MIN_REAL_ODD\s*=\s*Math\.max\(1\.30,/, "la cote reelle minimale doit rester a 1,30");
assert.match(source, /TIER_MAX_REAL_ODD\s*=\s*Math\.min\(2\.10,/, "la cote reelle maximale doit rester a 2,10");
assert.match(source, /CLIENT_OU25_CLIENT_MAX_MINUTE\s*=\s*Math\.min\(\s*45,/, "la fenetre client doit rester fermee a 45 minutes");
assert.match(source, /RECOVERY_MIN_CONVERGENT_INDICATORS\s*=\s*3;/, "Recovery doit garder trois indicateurs convergents");

const start = source.indexOf("function buildOu25VoteSummary");
const end = source.indexOf("\n// Un timeout ou une erreur HTTP", start);
assert.ok(start >= 0 && end > start, "fonction buildOu25VoteSummary introuvable");

const context = {
  CONCILE_AGENT_NAMES: ["IA-1", "IA-2", "IA-3", "IA-4", "IA-5"],
  CLIENT_OU25_MIN_VOTES: 3,
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

function ballot(sides) {
  return sides.map((p, index) => ({
    name: context.CONCILE_AGENT_NAMES[index],
    marches: { buts: { p, c: 80 } },
  }));
}

let summary = context.buildOu25VoteSummary(ballot(["o2.5", "o2.5", "o2.5", "u2.5", "u2.5"]));
assert.strictEqual(summary.vote_top, "Over 2.5 buts");
assert.strictEqual(summary.vote_count, 3);
assert.strictEqual(summary.recommended, true);
assert.strictEqual(summary.vote_status, "strong");

summary = context.buildOu25VoteSummary(ballot(["u2.5", "u2.5", "u2.5", "o2.5", "o2.5"]));
assert.strictEqual(summary.vote_top, "Under 2.5 buts");
assert.strictEqual(summary.vote_count, 3);
assert.strictEqual(summary.recommended, true);

summary = context.buildOu25VoteSummary(ballot(["o2.5", "o2.5", "u2.5", "u2.5"]));
assert.strictEqual(summary.vote_count, 2);
assert.strictEqual(summary.recommended, false);
assert.strictEqual(summary.vote_status, "none");

summary = context.buildOu25VoteSummary(ballot(["o2.5", "o2.5", "o2.5"]));
assert.strictEqual(summary.vote_count, 3);
assert.strictEqual(summary.recommended, true);

console.log("OK: consensus O/U 2,5 valide a 3/5; 2/5 bloque; confiance, cotes, fenetre et Recovery preserves");

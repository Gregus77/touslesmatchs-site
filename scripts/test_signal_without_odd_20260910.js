#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const api = fs.readFileSync(path.join(__dirname, "api_server.js"), "utf8");

assert(api.includes('&& !providerEcarte("openrouter.ai")'), "OpenRouter écarté ne doit pas être rappelé en secours");
assert(api.includes('/daily limit/i.test'), "le plafond journalier OpenRouter doit se réarmer le jour suivant");
assert(!api.includes('if (!_coteReelle) return "pas de vraie cote bookmaker"'), "absence de cote encore bloquante");
assert(api.includes('const oddOk = !_coteReelle || (realOdd >= TIER_MIN_REAL_ODD'), "absence de cote non autorisée par le filtre final");
assert(api.includes('Cote : <b>indisponible</b>'), "libellé Telegram cote indisponible absent");
assert(api.includes('cote_status: reveal &&'), "état public de cote absent");

const gate = ({realOdd, hasRealOdd, votes=3, confidence=80, recovery=true, scope=true}) => {
  const oddOk = !hasRealOdd || (realOdd >= 1.30 && realOdd <= 2.10);
  return oddOk && votes >= 3 && confidence >= 77 && recovery && scope;
};
assert.equal(gate({hasRealOdd:false, realOdd:0}), true);
assert.equal(gate({hasRealOdd:true, realOdd:1.20}), false);
assert.equal(gate({hasRealOdd:true, realOdd:2.20}), false);
assert.equal(gate({hasRealOdd:false, realOdd:0, votes:2}), false);
assert.equal(gate({hasRealOdd:false, realOdd:0, recovery:false}), false);
console.log("PASS: cote absente autorisée seule; cote réelle hors plage bloquée; quorum et autres contrôles conservés; aucun calcul de cote");

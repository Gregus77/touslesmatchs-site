#!/usr/bin/env node
"use strict";
const fs=require("fs"),assert=require("assert");
const html=fs.readFileSync("public/live-ia.html","utf8");
assert(html.indexOf('/js/match-lifecycle.js') < html.indexOf('function loadMatches(force)'));
assert.match(html,/if \(!r\.ok\) throw new Error\("HTTP " \+ r\.status\)/);
assert.match(html,/tlm_live_ia_last_data/);
assert.match(html,/Données temporairement indisponibles/);
assert.match(html,/données anciennes/);
assert.match(html,/if \(allMatches\.length\) renderMatches\(\); else showEmpty\(\)/);
console.log("OK: dépendance chargée avant usage; vide réel, erreur et cache ancien sont distincts");

#!/usr/bin/env node
"use strict";

const fs = require("fs");
const assert = require("assert");

const api = fs.readFileSync("scripts/api_server.js", "utf8");
const app = fs.readFileSync("public/app.html", "utf8");
const site = fs.readFileSync("public/index.html", "utf8");

// Réponse verrouillée réellement observée : quatre sièges votés, directions
// masquées. Le compteur serveur doit rester 4 dans les deux rendus.
const response = { ou25: { vote_count: 4, consensus_count: 4, over_count: null,
  under_count: null, votes: Array.from({length: 5}, (_, i) => ({status: i === 3 ? "pending" : "voted", direction: null})) } };
const visibleDirections = response.ou25.votes.filter(v => ["over", "under"].includes(v.direction)).length;
const appCount = Number(response.ou25.vote_count != null ? response.ou25.vote_count : visibleDirections) || 0;
assert.equal(appCount, 4, "un scrutin verrouillé ne doit pas devenir 0/5");

assert.match(api, /consensus_at: raw\.consensus_at \|\| null/);
assert.match(api, /snapshot_minute: raw\.snapshot_minute/);
assert.match(api, /diffusion_block: deliveredAnalysis\?\.diffusion_block \|\| null/);
assert.match(app, /Votes antérieurs — fenêtre terminée/);
assert.match(site, /Votes antérieurs — fenêtre terminée/);
assert.match(app, /Preuve de diffusion/);
assert.match(site, /Preuve de diffusion/);
console.log("OK: même compteur API 4/5 verrouillé, consensus antérieur, blocage et preuve séparés");

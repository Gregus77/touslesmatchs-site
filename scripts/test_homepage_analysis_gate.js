#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const api = fs.readFileSync(path.join(root, "scripts", "api_server.js"), "utf8");
const home = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  api.includes("const homepageDisplayEligible = clientProductEligible && alignedVotes >= CLIENT_OU25_MIN_VOTES"),
  "Le serveur doit exiger une ligue client eligible et au moins 3 votes alignes."
);
assert(
  api.includes("homepage_display_eligible: homepageDisplayEligible"),
  "L'API doit exposer la decision d'affichage issue du serveur."
);
assert(
  home.includes("function tlmHomepageAnalyzedMatch(m)"),
  "L'accueil doit posseder un garde-fou explicite."
);
assert(
  home.includes(".filter(tlmHomepageAnalyzedMatch)"),
  "Le hero et la liste live doivent filtrer les matchs non analyses."
);
assert(
  !home.includes("var matches=(d.matches||d.live||[]).filter(tlmMatchAllowed).slice(0,3)"),
  "La liste d'accueil ne doit plus se contenter du filtre visuel historique."
);
assert(
  home.includes("/sw.js?v=tlm-app-v8-proof-and-upcoming-20260828") && serviceWorker.includes("tlm-app-v8-proof-and-upcoming-20260828"),
  "Le cache PWA doit changer de version avec le garde-fou d'accueil."
);

console.log("OK homepage_analysis_gate");

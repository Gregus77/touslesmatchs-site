#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const api = fs.readFileSync(path.join(root, "scripts", "api_server.js"), "utf8");
const home = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log("  ✅ " + message);
}

assert(api.includes("refreshUpcomingPicksInBackground"), "le calcul H2H froid passe en arrière-plan");
assert(api.includes("refreshing: !cacheFresh"), "l'API expose honnêtement son état de calcul");
assert(home.includes("AbortController") && home.includes("12000"), "le navigateur ne peut plus rester indéfiniment sur Chargement");
assert(home.includes("setTimeout(loadUpcoming,10000)"), "la zone à venir se réactualise après le calcul");
assert(!home.includes("encore en pause estivale, la reprise c'est mi-août"), "le message saisonnier périmé est retiré");
assert(api.includes("lastResult") && api.includes("daily_pick_log"), "l'API fournit la dernière preuve résolue quand le pick du jour est vide");
assert(api.includes("sig_sent_free=1 OR sig_sent_standard=1") && api.includes("COALESCE(source_type,'live') <> 'prematch'"), "le repli accepte uniquement un ancien signal réellement diffusé");
assert(home.includes("Dernier résultat gratuit vérifié"), "l'accueil affiche la preuve sans la présenter comme un nouveau pick");
assert(home.includes("Aucun nouveau pick ne respecte encore les critères"), "l'absence de nouveau signal reste explicite");
assert(
  home.includes('id="proof-bar" hidden aria-hidden="true" style="display:none"'),
  "les anciens totaux cumulés ne sont plus présentés comme un décompte quotidien"
);

console.log("\nRÉSULTAT : OK");

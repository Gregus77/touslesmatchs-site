#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const api = fs.readFileSync(path.join(root, "scripts/api_server.js"), "utf8");
const compose = fs.readFileSync(path.join(root, "docker-compose.yml"), "utf8");

assert.doesNotMatch(api, /PREMIUM_SIGNAL_DAILY_CAP|STANDARD_SIGNAL_DAILY_CAP|ELITE_SIGNAL_DAILY_CAP/, "aucun plafond commercial ne limite Premium");
assert.match(api, /confiance >= \$\{CLIENT_OU25_MIN_CONFIDENCE\}/, "le prompt suit le plancher produit sans seuil caché");
assert.match(api, /"j1 league", "j-league", "meiji yasuda"/, "la J1 reste dans les championnats fiables décidés");
assert.match(api, /tier !== "trusted_major" && tier !== "trusted_secondary"/, "les ligues secondaires décidées restent diffusables sous contrôle");
assert.match(api, /if \(_tier === "watchlist_shadow"\) return "watchlist_shadow_only";/, "la watchlist reste non diffusable");

assert.doesNotMatch(api, /RECOVERY_MAX_DAILY_SIGNALS|recoveryCapacityAvailable|_recoverySignalDaily/, "aucun plafond Recovery global ne doit écraser les plafonds produit");
assert.doesNotMatch(api, /function recoveryLeagueAllowed|championnat hors liste Recovery/, "aucune seconde whitelist Recovery ne doit contredire le périmètre client");
assert.doesNotMatch(compose, /OU25_RECOVERY_MAX_DAILY_SIGNALS/, "l’ancien réglage de plafond n’est plus injecté au runtime");

assert.match(api, /historique 6-8 matchs ou contexte domicile\/exterieur indisponible/, "historique récent conservé");
assert.match(api, /donnees absences indisponibles/, "contrôle des absences conservé");
assert.match(api, /statistiques live incompletes/, "statistiques live conservées");
assert.match(api, /const ok = combinedAligned && liveAligned[\s\S]{0,120}RECOVERY_MIN_CONVERGENT_INDICATORS/, "trois indicateurs, moyenne et confirmation live conservés");
assert.match(api, /recoveryEvidence\.ok;/, "les preuves Recovery restent nécessaires à la diffusion");

console.log("OK recovery-premium-scope: J1 fiable, whitelist et plafonds retirés, contrôles qualité conservés");

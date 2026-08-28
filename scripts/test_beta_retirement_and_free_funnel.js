#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const api = fs.readFileSync(path.join(root, "scripts", "api_server.js"), "utf8");
const home = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "public", "app.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log("  ✅ " + message);
}

assert(!/bêta privée|entre dans la bêta|20 places fondatrices|accès fondateur|cycle 01/i.test(home + app), "aucun discours bêta visible dans le site ou l'application");
assert(api.includes("const FOUNDER_BETA_ENABLED = false"), "campagne bêta désactivée côté serveur");
assert(api.includes("return res.status(410)"), "ancienne route de candidature fermée explicitement");
assert(app.includes("var locked = !goal05MemberAccess()"), "le compte gratuit ne déverrouille plus le signal +0,5 exact");
assert(api.includes("function paidGoal05Account(req)") && api.includes("signal: null") && api.includes("locked: true"), "l'API masque aussi le signal +0,5 exact sans abonnement vérifié");
assert(api.includes('db.prepare("SELECT email, expires_at FROM sessions WHERE token = ?")') && api.includes("verifyFcmSubscriber(email, sessionToken)"), "les deux systèmes de connexion existants vérifient les droits payants");
assert(app.includes('headers.Authorization = "Bearer " + sessionToken') && app.includes('headers["X-TLM-Email"] = sessionEmail'), "l'application transmet la session au contrôle d'accès serveur");
assert(app.includes("goal05VerdictCard(locked ? null : signal)"), "aucune donnée exacte n'est rendue derrière le verrou gratuit");
assert(app.includes("Dès 4,90€") && app.includes("Sélections exactes et alertes réservées aux abonnés"), "offre membre +0,5 claire dès 4,90€");
assert(home.includes("Pick gratuit du jour") && home.includes("Aucune carte bancaire"), "une preuve gratuite reste disponible pour attirer les visiteurs");
assert(api.includes("_freeSignalDailyDate.count < 1"), "diffusion gratuite limitée à une vitrine par jour");
assert(api.includes("SANS la sélection exacte"), "Telegram gratuit reste un teaser et ne remplace pas l'abonnement");
assert(home.includes("tlm-app-v7-paid-funnel-20260828") && app.includes("tlm-app-v7-paid-funnel-20260828") && sw.includes("tlm-app-v7-paid-funnel-20260828"), "cache PWA v7 cohérent sur toutes les pages");

console.log("\nRÉSULTAT : OK");

#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "app-store.html"), "utf8");
const main = fs.readFileSync(path.join(root, "android-native", "app", "src", "main", "java", "com", "touslesmatchs", "app", "MainActivity.java"), "utf8");
const gradle = fs.readFileSync(path.join(root, "android-native", "app", "build.gradle.kts"), "utf8");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

[
  /buy\.stripe\.com/i,
  /winamax\.fr/i,
  /unibet\.fr/i,
  /pmu\.fr/i,
  /<a[^>]+href=["']\/#plans/i,
  /4,90\s*€/i,
  /après paiement/i,
  /\bcote\s*@/i,
  /Ouvrir un bookmaker/i,
  /NE PAS JOUER/i,
  /· JOUER/i,
  /Profit simulé/i,
  /\bROI\b/i
].forEach((pattern) => assert(!pattern.test(html), `Référence interdite: ${pattern}`));

assert(html.includes("window.__TLM_PLAY_STORE_FREE=true"), "mode gratuit absent");
assert(html.includes("function goal05MemberAccess() { return true; }"), "signal encore verrouillé");
assert(html.includes("Toutes les analyses validées sont gratuites pendant la phase de lancement."), "message gratuit absent");
assert(html.includes("joueurs-info-service.fr"), "prévention jeu responsable absente");
assert(html.includes('marketingConsent: false, source: "google_play_free"'), "consentement marketing forcé");
assert(main.includes("/app-store.html?source=google-play"), "page Store non chargée par Android");
assert(main.includes("TousLesMatchsAndroidPlay/1.0.8"), "identifiant version Android absent");
assert(/compileSdk\s*=\s*36/.test(gradle), "compileSdk 36 absent");
assert(/targetSdk\s*=\s*36/.test(gradle), "targetSdk 36 absent");

let inlineCount = 0;
for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/\bsrc\s*=|application\/ld\+json/i.test(match[1])) continue;
  new vm.Script(match[2], { filename: `app-store-inline-${++inlineCount}.js` });
}
assert(inlineCount > 0, "aucun script inline contrôlé");

console.log(`OK: application Google Play gratuite, sans Stripe/bookmaker, prévention présente, API 36, ${inlineCount} scripts valides`);

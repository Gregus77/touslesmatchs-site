#!/usr/bin/env node
"use strict";
const fs=require("fs"),assert=require("assert"),vm=require("vm");
const src=fs.readFileSync("scripts/api_server.js","utf8");
assert.match(src,/Оформить Premium — 14,90 €\/мес\./);
assert.match(src,/url: PREMIUM_PAYMENT_LINK/);
assert.match(src,/const PREMIUM_PAYMENT_LINK = "https:\/\/buy\.stripe\.com\//);
assert.match(src,/createRuPremiumInviteLink\(customerEmail\)/);
assert.match(src,/return TELEGRAM_PREMIUM_CHANNEL_ID;\n}/);
assert.match(src,/RU_STANDARD_LEGACY_MIRROR_ENABLED/);
assert.match(src,/La sélection exacte et la raison sont réservées aux membres Premium/);
assert.match(src,/Under 2\[\.,\]5 buts\/gi, "Тотал меньше 2,5 голов"/);
assert.match(src,/Over 2\[\.,\]5 buts\/gi, "Тотал больше 2,5 голов"/);
assert.match(src,/SIGNAL FORT GAGNÉ\/gi, "СИЛЬНЫЙ СИГНАЛ — ВЫИГРЫШ"/);
assert.match(src,/SIGNAL FORT PERDU\/gi, "СИЛЬНЫЙ СИГНАЛ — ПРОИГРЫШ"/);

function extractFunction(name, nextName) {
  const start=src.indexOf(`function ${name}(`);
  const end=src.indexOf(`function ${nextName}(`, start);
  assert.ok(start >= 0 && end > start, `fonction ${name} introuvable`);
  return src.slice(start, end);
}

const routing=extractFunction("russianClientChannelFor", "recordSignalDeliveryExpectation");
const translate=extractFunction("translateTelegramClientRu", "sendTelegramMessage");
function context(legacy) {
  const sandbox={
    TELEGRAM_CHANNEL_ID:"fr-free", TELEGRAM_RU_FREE_CHANNEL_ID:"ru-free",
    TELEGRAM_STANDARD_CHANNEL_ID:"fr-standard", TELEGRAM_RU_STANDARD_CHANNEL_ID:"ru-standard",
    TELEGRAM_PREMIUM_CHANNEL_ID:"fr-premium", TELEGRAM_RU_PREMIUM_CHANNEL_ID:"ru-premium",
    RU_STANDARD_LEGACY_MIRROR_ENABLED:legacy,
    process:{env:{TELEGRAM_FREE_CHANNEL_ID:"fr-free"}},
  };
  vm.createContext(sandbox);
  vm.runInContext(`${routing}\n${translate}`, sandbox);
  return sandbox;
}

const active=context(true);
assert.deepStrictEqual({...active.russianClientChannelFor("fr-free")}, {id:"ru-free",tier:"free"});
assert.deepStrictEqual({...active.russianClientChannelFor("fr-premium")}, {id:"ru-premium",tier:"premium"});
assert.deepStrictEqual({...active.russianClientChannelFor("fr-standard")}, {id:"ru-standard",tier:"standard",legacy:true});
assert.strictEqual(context(false).russianClientChannelFor("fr-standard"), null);
assert.strictEqual(active.russianClientChannelFor("admin"), null);
const full=active.translateTelegramClientRu("SIGNAL CONSEIL IA\nSignal : Over 2.5 goals\nScore de confiance : 81%\nSIGNAL FORT GAGNÉ");
assert.match(full,/СИГНАЛ ИИ/);
assert.match(full,/Тотал больше 2,5 голов/);
assert.match(full,/Уровень доверия/);
assert.match(full,/СИЛЬНЫЙ СИГНАЛ — ВЫИГРЫШ/);
assert.doesNotMatch(full,/Over 2\.5 goals|SIGNAL FORT GAGNÉ/);
console.log("OK exécutable hors réseau: Gratuit RU masqué + paiement Premium; Premium RU complet/résultats; Standard RU legacy seulement");

"use strict";

const fs=require("fs");
const assert=require("assert");

const index=fs.readFileSync("public/index.html","utf8");
const app=fs.readFileSync("public/app.html","utf8");
const header=fs.readFileSync("public/js/global-header.js","utf8");
const tg=fs.readFileSync("scripts/telegram_client.js","utf8");
const api=fs.readFileSync("scripts/api_server.js","utf8");
const sw=fs.readFileSync("public/sw.js","utf8");

assert(
  header.includes("TLM-COMMERCIAL-ACCOUNT-BEGIN"),
  "source commerciale commune absente"
);

assert(
  header.includes("standard|premium|elite|vip"),
  "compatibilite plans historiques absente"
);

assert.strictEqual(
  (index.match(/TLM PREMIUM STATE FINAL/g)||[]).length,
  0,
  "ancienne rustine Premium encore presente"
);

assert(
  index.includes('id="premium-main-cta"'),
  "CTA Premium absent"
);

assert(
  app.includes("TLM-APP-PREMIUM-UI-BEGIN"),
  "controle Premium application absent"
);

assert(
  app.includes('id="tlm-app-trust-ui"'),
  "mise en page application absente"
);

assert(
  sw.includes("tlm-v24-commercial-source-20260922"),
  "version PWA V24 absente"
);

assert(
  tg.includes("{channel:'premium',lang:'fr',tier:'premium'"),
  "Telegram Premium FR absent"
);

assert(
  tg.includes("{channel:'ru_premium',lang:'ru',tier:'premium'"),
  "Telegram Premium RU absent"
);

assert(
  api.includes("const priceMap = { premium: STRIPE_PRICE_ID_PREMIUM }"),
  "checkout actif non limite a Premium"
);

assert(
  api.includes("Seule l") &&
  api.includes("offre Premium est disponible"),
  "protection offre Premium unique absente"
);

console.log(
  "PASS source commerciale : site + application + Stripe + Telegram FR/RU"
);

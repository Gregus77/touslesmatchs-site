#!/usr/bin/env node
"use strict";

const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const api = fs.readFileSync(require("path").join(__dirname, "api_server.js"), "utf8");
const match = api.match(/function premiumSignalDispatchAllowed\([^]*?\n\}/);
assert(match, "politique Premium pure absente");
const ctx = {};
vm.runInNewContext(`${match[0]}; this.policy = premiumSignalDispatchAllowed;`, ctx);

let delivered = 0;
for (let i = 1; i <= 11; i += 1) {
  assert.strictEqual(ctx.policy(true, false), true, `signal admissible ${i} bloque`);
  delivered += 1;
}
assert.strictEqual(delivered, 11, "le 11e signal doit etre autorise");
assert.strictEqual(ctx.policy(true, true), false, "antidoublon inactif");
assert.strictEqual(ctx.policy(false, false), false, "signal non admissible autorise");

const checkoutMatch = api.match(/function buildPremiumCheckoutParams\([^]*?\n\}/);
assert(checkoutMatch, "constructeur Checkout Premium absent");
const languageMatch = api.match(/function normalizeCustomerLanguage\([^]*?\n\}/);
assert(languageMatch, "normalisation de langue absente");
const stripeCtx = {};
vm.runInNewContext(`${checkoutMatch[0]}; ${languageMatch[0]}; this.build = buildPremiumCheckoutParams;`, stripeCtx);
const checkout = stripeCtx.build({ priceId: "price_test_premium", successUrl: "https://example.test/success", cancelUrl: "https://example.test/cancel", clientReferenceId: 42, customerEmail: "TEST@EXAMPLE.COM" });
assert.strictEqual(checkout.mode, "subscription");
assert.strictEqual(checkout.line_items[0].price, "price_test_premium");
assert.strictEqual(checkout.customer_email, "test@example.com");
assert.strictEqual(checkout.payment_method_types, undefined);

assert(!/PREMIUM_SIGNAL_DAILY_CAP|STANDARD_SIGNAL_DAILY_CAP|ELITE_SIGNAL_DAILY_CAP/.test(api), "ancien plafond commercial encore executable");
assert(/const priceMap = \{ premium: STRIPE_PRICE_ID_PREMIUM \}/.test(api), "checkout legacy encore vendable");
assert(!/payment_method_types:\s*\["card"\]/.test(api), "Checkout force inutilement un moyen de paiement");
assert(/\[STRIPE_PRICE_ID_STANDARD, \{ status: "standard"/.test(api), "compatibilite webhook Standard perdue");
assert(/\[STRIPE_PRICE_ID_ELITE, \{ status: "elite"/.test(api), "compatibilite webhook Elite perdue");
assert(/standard:\s*"sig_sent_premium"/.test(api), "ancien droit Standard non aligne sur Premium");
assert(/elite:\s*"sig_sent_premium"/.test(api), "ancien droit Elite non aligne sur Premium");
assert(!/push\(TELEGRAM_STANDARD_CHANNEL_ID, "legacy-standard"\)/.test(api), "ancienne branche Telegram Standard encore active");
assert(!/push\(TELEGRAM_ELITE_CHANNEL_ID, "legacy-elite"\)/.test(api), "ancienne branche Telegram Elite encore active");

for (const page of ["index.html", "live-ia.html", "app.html", "faq.html", "dashboard.html", "cgv.html", "cgu.html", "pronostic-ia.html"]) {
  const html = fs.readFileSync(require("path").join(__dirname, "..", "public", page), "utf8");
  assert(!/buy\.stripe\.com\/(00w14ncbGgo48c4fpA3VC05|4gM9AT5Nifk0gIA91c3VC07)/.test(html), `${page}: ancien lien de vente`);
  assert(!/(?<!1)4[,.]90\s*(?:€|&nbsp;€)/.test(html), `${page}: ancien prix 4,90 visible`);
}
const home = fs.readFileSync(require("path").join(__dirname, "..", "public", "index.html"), "utf8");
assert(!/data-i18n="plan_std"/.test(home), "carte Standard encore visible");
assert(/\/api\/premium-checkout\?lang=fr/.test(home), "checkout Premium mensuel absent");
const telegramClient = fs.readFileSync(require("path").join(__dirname, "telegram_client.js"), "utf8");
assert(/premium-checkout/.test(telegramClient) && /\?lang=\$\{lang\}/.test(telegramClient), "checkout russe localise absent");

console.log("OK: offre Gratuit/Premium, 11e signal, antidoublon, checkout et compatibilite historique");

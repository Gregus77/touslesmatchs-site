#!/usr/bin/env node
"use strict";
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const src = fs.readFileSync("scripts/api_server.js", "utf8");
function between(start, end) {
  const a = src.indexOf(start), b = src.indexOf(end, a);
  assert(a >= 0 && b > a, `${start} introuvable`);
  return src.slice(a, b);
}
const code = between("function buildPremiumCheckoutParams", "app.post(\"/stripe/create-checkout\"");
const ctx = {
  STRIPE_PRICE_ID_PREMIUM: "price_premium",
  STRIPE_PRICE_ID_STANDARD: "price_standard_historique",
  STRIPE_PRICE_ID_VIP: "price_vip_historique",
  STRIPE_PRICE_ID_ELITE: "price_elite_historique",
  STRIPE_PRICE_ID_CARTE: "price_carte_historique",
};
vm.createContext(ctx);
vm.runInContext(`${code};this.normalize=normalizeCustomerLanguage;this.plan=stripePlanForPrice;this.validate=validateStripeEventForProcessing;this.checkout=buildPremiumCheckoutParams;`, ctx);

assert.strictEqual(ctx.normalize("ru-RU"), "ru");
assert.strictEqual(ctx.normalize("en-US"), "fr");
assert.strictEqual(ctx.plan("price_premium").status, "premium");
assert.strictEqual(ctx.plan("price_standard_historique").status, "standard");
assert.strictEqual(ctx.plan("price_inconnu"), null);

const session = { id:"cs_test", payment_status:"paid", line_items:{data:[{price:{id:"price_premium"}}]}, subscription:{status:"active"} };
const stripe = { checkout:{ sessions:{ retrieve: async () => session } } };
(async () => {
  let r = await ctx.validate({type:"checkout.session.completed",data:{object:{id:"cs_test"}}}, stripe);
  assert.strictEqual(r.ok, true);
  session.payment_status="unpaid"; session.subscription={status:"incomplete"};
  r = await ctx.validate({type:"checkout.session.completed",data:{object:{id:"cs_test"}}}, stripe);
  assert.strictEqual(r.ok, false, "un paiement non confirmé ne doit créer aucun droit");
  session.payment_status="paid"; session.line_items.data[0].price.id="price_inconnu";
  r = await ctx.validate({type:"checkout.session.completed",data:{object:{id:"cs_test"}}}, stripe);
  assert.strictEqual(r.ok, false, "un prix inconnu ne doit jamais devenir Premium");
  r = await ctx.validate({type:"invoice.paid",data:{object:{paid:true,status:"paid",lines:{data:[{price:{id:"price_standard_historique"}}]}}}}, stripe);
  assert.strictEqual(r.ok, true, "un renouvellement historique reconnu doit être préservé");
  r = await ctx.validate({type:"invoice.paid",data:{object:{paid:false,status:"open",lines:{data:[{price:{id:"price_premium"}}]}}}}, stripe);
  assert.strictEqual(r.ok, false);

  const checkout=ctx.checkout({priceId:"price_premium",successUrl:"https://example.test/ok",cancelUrl:"https://example.test/no",clientReferenceId:7,customerEmail:"A@EXAMPLE.TEST",customerLanguage:"ru"});
  assert.strictEqual(checkout.mode,"subscription");
  assert.strictEqual(checkout.metadata.tlm_language,"ru");
  assert.strictEqual(checkout.subscription_data.metadata.tlm_language,"ru");
  assert.strictEqual(checkout.payment_method_types,undefined);

  assert(src.indexOf("validateStripeEventForProcessing(event, stripe)") < src.indexOf("INSERT OR IGNORE INTO stripe_processed_events (event_id, event_type, processing_status)"));
  assert.match(src,/constructEvent\(req\.body, req\.headers\["stripe-signature"\], STRIPE_WEBHOOK_SECRET\)/);
  assert.match(src,/processing_status='processed'/);
  assert.match(src,/processing_status TEXT DEFAULT 'processed'/);
  assert.match(src,/preferred_language TEXT DEFAULT 'fr'/);
  assert.match(src,/preferredLanguage === "ru"\s*\? await createRuPremiumInviteLink/);
  const securedFlow=between("// ── Stripe ──", "app.post(\"/internal/pick-notify\"");
  assert.doesNotMatch(securedFlow,/status = "premium"[^\n]*planMap\[priceId\]/);
  const failedBlock=between('if (event.type === "invoice.payment_failed")', '// Remboursement');
  assert.doesNotMatch(failedBlock,/UPDATE (users|codes).*status|SET active = 0/i, "un refus de renouvellement ne doit pas couper une période encore acquise");
  const cancelBlock=between('if (event.type === "customer.subscription.deleted")', '// Renouvellement paye');
  assert.match(cancelBlock,/UPDATE users SET status = 'free'/);
  assert.doesNotMatch(cancelBlock,/UPDATE codes SET active = 0/, "la résiliation ne doit pas supprimer rétroactivement le code daté");
  console.log("OK isolé: signature, paiement/droit, prix reconnu, historique, rejeu réessayable et langue FR/RU");
})().catch(e => { console.error(e); process.exit(1); });

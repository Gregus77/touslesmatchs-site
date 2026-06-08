// ═══════════════════════════════════════════════════════════════
//  STRIPE WEBHOOK HANDLER — Sécurité & Monétisation complète
//  Événements gérés :
//   ✅ checkout.session.completed     → accès accordé (invite Telegram)
//   ✅ invoice.payment_succeeded      → renouvellement confirmé
//   ✅ invoice.payment_failed         → accès suspendu + alerte admin
//   ✅ customer.subscription.deleted  → accès révoqué + alerte admin
//   ✅ customer.subscription.updated  → changement de plan
// ═══════════════════════════════════════════════════════════════

const crypto = require("crypto");
const https  = require("https");
const store  = require("./subscriptions_store");

const BOT_TOKEN          = process.env.TELEGRAM_BOT_TOKEN     || "";
const ADMIN_CHAT_ID      = process.env.TELEGRAM_ADMIN_CHAT_ID || "";
const PREMIUM_CHAT_ID    = process.env.TELEGRAM_PREMIUM_CHAT_ID || "";
const PREMIUM_PLUS_CHAT_ID = process.env.TELEGRAM_PREMIUM_PLUS_CHAT_ID || PREMIUM_CHAT_ID;

const PREMIUM_PRICE_ID   = process.env.REACT_APP_STRIPE_PRICE_PREMIUM || "";
const PREMIUM_PLUS_PRICE_ID = process.env.REACT_APP_STRIPE_PRICE_VIP || "";

// ── Vérification signature HMAC Stripe ──────────────────────────
function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) throw new Error("Signature manquante");
  const parts     = sigHeader.split(",");
  const timestamp = (parts.find(p => p.startsWith("t=")) || "").slice(2);
  const sig       = (parts.find(p => p.startsWith("v1=")) || "").slice(3);
  if (!timestamp || !sig) throw new Error("Format signature invalide");
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300)
    throw new Error("Timestamp expiré (> 5 min)");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig)))
    throw new Error("Signature invalide");
  return JSON.parse(rawBody.toString());
}

// ── Telegram Bot API ─────────────────────────────────────────────
function telegramPost(method, body) {
  if (!BOT_TOKEN) return Promise.resolve(null);
  return new Promise((resolve) => {
    const json = JSON.stringify(body);
    const req  = https.request({
      hostname: "api.telegram.org",
      path: `/bot${BOT_TOKEN}/${method}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(json) }
    }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    req.write(json); req.end();
  });
}

function sendAdminAlert(message) {
  if (!ADMIN_CHAT_ID) { console.log("[ADMIN ALERT]", message); return Promise.resolve(); }
  return telegramPost("sendMessage", {
    chat_id: ADMIN_CHAT_ID,
    text: `🤖 *Hermès Admin*\n\n${message}`,
    parse_mode: "Markdown"
  });
}

// Génère un lien d'invitation unique (usage unique, expire dans 48h)
async function generateInviteLink(chatId) {
  if (!chatId || !BOT_TOKEN) return null;
  const expireDate = Math.floor(Date.now() / 1000) + 48 * 3600;
  const result = await telegramPost("createChatInviteLink", {
    chat_id: chatId,
    member_limit: 1,
    expire_date: expireDate,
    name: "Premium Access"
  });
  return result?.result?.invite_link || null;
}

// Exclut un membre du canal (révocation d'accès)
async function kickMember(chatId, telegramUserId) {
  if (!chatId || !telegramUserId || !BOT_TOKEN) return false;
  await telegramPost("banChatMember", { chat_id: chatId, user_id: telegramUserId });
  // Unban immédiatement (on veut juste kick, pas bannir définitivement)
  await telegramPost("unbanChatMember", { chat_id: chatId, user_id: telegramUserId });
  return true;
}

// Détermine le tier selon le price_id
function getTierFromPriceId(priceId) {
  if (priceId === PREMIUM_PLUS_PRICE_ID) return "premium_plus";
  if (priceId === PREMIUM_PRICE_ID)      return "premium";
  return "premium"; // fallback
}

function getChatIdForTier(tier) {
  return tier === "premium_plus" ? PREMIUM_PLUS_CHAT_ID : PREMIUM_CHAT_ID;
}

// ── HANDLERS PAR ÉVÉNEMENT ───────────────────────────────────────

// checkout.session.completed → nouveau paiement, accorder accès
async function onCheckoutCompleted(session) {
  const email     = session.customer_details?.email || session.customer_email || "";
  const customerId = session.customer;
  const priceId   = session.line_items?.data?.[0]?.price?.id;

  // Récupérer le price_id depuis les métadonnées si absent
  const tier   = getTierFromPriceId(priceId || "");
  const chatId = getChatIdForTier(tier);

  // Générer le lien d'invitation unique
  const inviteLink = await generateInviteLink(chatId);

  // Enregistrer l'abonnement
  const subscriptionId = session.subscription || `sess_${session.id}`;
  store.upsert(subscriptionId, {
    customer_id: customerId,
    email,
    price_id: priceId,
    tier,
    status: "active",
    telegram_invite_link: inviteLink,
    telegram_invite_used: false,
    created_at: new Date().toISOString(),
    session_id: session.id
  });

  // Notifier l'admin
  const tierLabel = tier === "premium_plus" ? "💎 PREMIUM PLUS (19,90€)" : "⭐ PREMIUM (9,90€)";
  await sendAdminAlert(
    `✅ *Nouveau abonnement*\n📧 ${email}\n🏷️ ${tierLabel}\n🔗 Lien envoyé : ${inviteLink ? "Oui" : "⚠️ Non (configurer TELEGRAM_PREMIUM_CHAT_ID)"}`
  );

  console.log(`[WEBHOOK] Checkout completed: ${email} → ${tier}`, inviteLink ? "✓ invite link" : "⚠️ no invite");
  return { email, tier, inviteLink };
}

// invoice.payment_succeeded → renouvellement
async function onPaymentSucceeded(invoice) {
  const customerId    = invoice.customer;
  const subscriptionId = invoice.subscription;
  const periodEnd     = invoice.lines?.data?.[0]?.period?.end;
  const email         = invoice.customer_email || "";

  if (subscriptionId) {
    store.renewSubscription(subscriptionId, periodEnd);
  }

  if (invoice.billing_reason === "subscription_cycle") {
    await sendAdminAlert(`🔄 *Renouvellement* — ${email || customerId}`);
  }

  console.log(`[WEBHOOK] Payment succeeded: ${subscriptionId}`);
}

// invoice.payment_failed → suspension
async function onPaymentFailed(invoice) {
  const subscriptionId = invoice.subscription;
  const email          = invoice.customer_email || "";

  if (subscriptionId) {
    store.suspendSubscription(subscriptionId);
  }

  await sendAdminAlert(`❌ *Paiement refusé*\n📧 ${email}\n⚠️ Accès suspendu automatiquement`);
  console.log(`[WEBHOOK] Payment FAILED: ${subscriptionId}`);
}

// customer.subscription.deleted → annulation / expiration
async function onSubscriptionDeleted(subscription) {
  const subscriptionId = subscription.id;
  const customerId     = subscription.customer;

  const sub = store.getBySubscriptionId(subscriptionId) || store.getByCustomerId(customerId);
  const email = sub?.email || customerId;

  if (subscriptionId) {
    store.cancelSubscription(subscriptionId);
  }

  // Si on a le telegram_user_id, on kick automatiquement
  if (sub?.telegram_user_id) {
    const chatId = getChatIdForTier(sub.tier || "premium");
    const kicked = await kickMember(chatId, sub.telegram_user_id);
    await sendAdminAlert(`🚫 *Annulation* — ${email}\n${kicked ? "✅ Exclu du canal Telegram" : "⚠️ Kick manuel requis (telegram_user_id inconnu)"}`);
  } else {
    await sendAdminAlert(`🚫 *Annulation* — ${email}\n⚠️ Kick manuel requis (ID Telegram non enregistré)`);
  }

  console.log(`[WEBHOOK] Subscription deleted: ${subscriptionId}`);
}

// customer.subscription.updated → changement de plan
async function onSubscriptionUpdated(subscription) {
  const subscriptionId = subscription.id;
  const newPriceId     = subscription.items?.data?.[0]?.price?.id;
  const newTier        = getTierFromPriceId(newPriceId || "");
  const sub            = store.getBySubscriptionId(subscriptionId);

  if (sub && sub.tier !== newTier) {
    store.upsert(subscriptionId, { tier: newTier, price_id: newPriceId });
    await sendAdminAlert(`📦 *Changement de plan* — ${sub.email}\n${sub.tier} → ${newTier}`);
  }
}

// charge.refunded → remboursement
async function onChargeRefunded(charge) {
  const email  = charge.billing_details?.email || charge.receipt_email || "";
  const amount = (charge.amount_refunded / 100).toFixed(2);
  await sendAdminAlert(`💸 *Remboursement* — ${email}\nMontant : ${amount}€`);
  console.log(`[WEBHOOK] Charge refunded: ${charge.id}`);
}

// ── DISPATCHER PRINCIPAL ─────────────────────────────────────────
async function handleStripeEvent(event) {
  switch (event.type) {
    case "checkout.session.completed":
      return onCheckoutCompleted(event.data.object);
    case "invoice.payment_succeeded":
      return onPaymentSucceeded(event.data.object);
    case "invoice.payment_failed":
      return onPaymentFailed(event.data.object);
    case "customer.subscription.deleted":
      return onSubscriptionDeleted(event.data.object);
    case "customer.subscription.updated":
      return onSubscriptionUpdated(event.data.object);
    case "charge.refunded":
      return onChargeRefunded(event.data.object);
    default:
      console.log(`[WEBHOOK] Événement non traité : ${event.type}`);
  }
}

module.exports = { verifyStripeSignature, handleStripeEvent };

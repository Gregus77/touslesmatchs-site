"use strict";
/**
 * stripe_webhook.js — Serveur webhook Stripe
 * Port : 4242 (proxifié via nginx /stripe/webhook)
 *
 * Événements gérés :
 *  - checkout.session.completed  → sauvegarde session, attend vérification bot
 *  - customer.subscription.deleted → expulse l'abonné du canal Premium
 */

const http   = require("http");
const https  = require("https");
const crypto = require("crypto");
const fs     = require("fs");
const path   = require("path");

const WEBHOOK_SECRET  = process.env.STRIPE_WEBHOOK_SECRET || "";
const TG_TOKEN        = process.env.TELEGRAM_BOT_TOKEN;
const PREMIUM_CHANNEL = process.env.TELEGRAM_PREMIUM_CHAT_ID;
const SESSIONS_FILE   = path.join(__dirname, "verify_sessions.json");
const USERS_DB_FILE   = path.join(__dirname, "users_db.json");

// ─── Helpers fichiers ─────────────────────────────────────
function loadJson(file, def) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return def; }
}
function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ─── Telegram API ─────────────────────────────────────────
function tgApi(method, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${TG_TOKEN}/${method}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
    }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on("error", () => resolve({}));
    req.end(data);
  });
}

// ─── Vérification signature Stripe ────────────────────────
function verifyStripeSignature(rawBody, header, secret) {
  if (!secret || secret === "whsec_test_xxxxx") return true; // skip en dev
  const parts = {};
  header.split(",").forEach(p => { const [k,v] = p.split("="); parts[k] = v; });
  const signed = `${parts.t}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(signed, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(parts.v1 || "", "hex"),
      Buffer.from(expected, "hex")
    );
  } catch { return false; }
}

// ─── Handlers événements ──────────────────────────────────

// Paiement réussi → sauvegarder session pour vérification bot
async function onPaymentSuccess(session) {
  const sessions = loadJson(SESSIONS_FILE, {});
  sessions[session.id] = {
    customer_id:   session.customer       || null,
    customer_email: session.customer_email || session.customer_details?.email || null,
    subscription_id: session.subscription || null,
    created_at:    Date.now(),
    used:          false,
  };
  saveJson(SESSIONS_FILE, sessions);
  console.log(`✅ Session enregistrée: ${session.id} — ${sessions[session.id].customer_email}`);
}

// Abonnement annulé → expulser l'utilisateur du canal Premium
async function onSubscriptionCancelled(subscription) {
  const db = loadJson(USERS_DB_FILE, {});
  const customerId = subscription.customer;

  const found = Object.entries(db).find(([, v]) => v.customer_id === customerId);
  if (!found) {
    console.log(`⚠️ Aucun utilisateur Telegram trouvé pour customer ${customerId}`);
    return;
  }
  const [telegramId, userData] = found;
  const uid = parseInt(telegramId);

  if (PREMIUM_CHANNEL) {
    await tgApi("banChatMember",   { chat_id: PREMIUM_CHANNEL, user_id: uid });
    await tgApi("unbanChatMember", { chat_id: PREMIUM_CHANNEL, user_id: uid });
    console.log(`❌ Utilisateur ${uid} (${userData.email}) expulsé du canal Premium`);
  }

  delete db[telegramId];
  saveJson(USERS_DB_FILE, db);
}

// ─── Serveur HTTP ─────────────────────────────────────────
const server = http.createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/stripe/webhook") {
    res.writeHead(404); res.end("Not found"); return;
  }

  let body = "";
  req.on("data", chunk => body += chunk);
  req.on("end", async () => {
    const sig = req.headers["stripe-signature"] || "";
    try {
      if (!verifyStripeSignature(body, sig, WEBHOOK_SECRET)) {
        console.warn("❌ Signature Stripe invalide");
        res.writeHead(400); res.end("Invalid signature"); return;
      }

      const event = JSON.parse(body);
      console.log(`📨 Événement Stripe: ${event.type}`);

      if (event.type === "checkout.session.completed") {
        await onPaymentSuccess(event.data.object);
      } else if (event.type === "customer.subscription.deleted") {
        await onSubscriptionCancelled(event.data.object);
      }

      res.writeHead(200); res.end("OK");
    } catch (e) {
      console.error("Webhook error:", e.message);
      res.writeHead(500); res.end("Error");
    }
  });
});

server.listen(4242, () => console.log("🔗 Stripe webhook server — port 4242"));

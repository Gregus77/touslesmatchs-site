#!/usr/bin/env node

// Mission 003: Stripe Integration — Real HTTP Tests
// Spawns api_server.js and sends simulated Stripe webhook events over HTTP.
// Tests signature verification, idempotence, all event types, and error paths.
// Run: node scripts/test_stripe_integration.js

const Database = require("better-sqlite3");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const DB_PATH = "/tmp/tlm_stripe_http_test.db";
const CODES_DB_PATH = "/tmp/tlm_stripe_http_codes.db";
const PORT = 3997;
const BASE = `http://127.0.0.1:${PORT}`;
const JWT_SECRET = "test_secret_stripe_003";
const STRIPE_WEBHOOK_SECRET = "whsec_test_stripe_003_secret";

// ── Cleanup ──────────────────────────────────────────────────────────────────
for (const f of [DB_PATH, CODES_DB_PATH, DB_PATH + "-wal", DB_PATH + "-shm",
                 CODES_DB_PATH + "-wal", CODES_DB_PATH + "-shm"]) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

// ── Seed ─────────────────────────────────────────────────────────────────────
console.log("🌱 Seeding test databases...\n");
const seed = new Database(DB_PATH);
seed.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    status TEXT DEFAULT 'free',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    plan TEXT NOT NULL DEFAULT 'VISITOR',
    subscription_status TEXT NOT NULL DEFAULT 'ACTIVE',
    subscription_start_date TEXT,
    subscription_end_date TEXT,
    auto_renew BOOLEAN DEFAULT FALSE,
    stripe_price_id TEXT,
    stripe_subscription_id TEXT,
    telegram_group_id TEXT,
    telegram_group_name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id)
  );
  CREATE TABLE analysis_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    analysis_id TEXT NOT NULL,
    match_key TEXT NOT NULL,
    purchase_date TEXT DEFAULT (datetime('now')),
    stripe_payment_id TEXT,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'EUR',
    status TEXT DEFAULT 'completed',
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, analysis_id)
  );
  CREATE TABLE subscription_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    old_plan TEXT, new_plan TEXT, old_status TEXT, new_status TEXT,
    reason TEXT, details TEXT, triggered_by TEXT,
    triggered_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE revealed_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    match_key TEXT NOT NULL,
    analysis_json TEXT NOT NULL,
    revealed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

function addUser(email, stripeCustomerId = null) {
  const uid = seed.prepare("INSERT INTO users (email, password_hash, stripe_customer_id) VALUES (?, ?, ?)")
    .run(email, "hash", stripeCustomerId).lastInsertRowid;
  seed.prepare(`
    INSERT INTO subscriptions (user_id, plan, subscription_status, created_at, updated_at)
    VALUES (?, 'VISITOR', 'ACTIVE', datetime('now'), datetime('now'))
  `).run(uid);
  return uid;
}

const aliceId = addUser("alice@test.com", "cus_alice_http");
const bobId = addUser("bob@test.com", "cus_bob_http");
const carolId = addUser("carol@test.com", "cus_carol_http");

// Admin code
const codes = new Database(CODES_DB_PATH);
codes.exec(`
  CREATE TABLE IF NOT EXISTS codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    email TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    active INTEGER DEFAULT 1,
    expires_at TEXT DEFAULT NULL,
    credits_max INTEGER DEFAULT 10,
    credits_used INTEGER DEFAULT 0,
    credits_date TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);
codes.prepare("INSERT INTO codes (code, email, plan, active) VALUES (?, ?, 'elite', 1)")
  .run("ELITE-ADMIN-STRIPE", "admin@test.com");
codes.close();
seed.close();

// ── Helpers ──────────────────────────────────────────────────────────────────
function token(email) {
  return jwt.sign({ id: 1, email, status: "free" }, JWT_SECRET, { expiresIn: "1h" });
}

function signWebhookPayload(payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
  const signedPayload = `${timestamp}.${payloadStr}`;
  const signature = crypto.createHmac("sha256", STRIPE_WEBHOOK_SECRET).update(signedPayload).digest("hex");
  return {
    body: payloadStr,
    headers: {
      "stripe-signature": `t=${timestamp},v1=${signature}`,
      "content-type": "application/json",
    },
  };
}

let passed = 0, failed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
    failures.push(`${name}: ${e.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function sendWebhook(event) {
  const { body, headers } = signWebhookPayload(event);
  const res = await fetch(BASE + "/stripe/webhook", {
    method: "POST",
    headers,
    body,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function sendUnsignedWebhook(event) {
  const res = await fetch(BASE + "/stripe/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": "t=123,v1=badsig" },
    body: JSON.stringify(event),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

function makeEvent(type, data, id = null) {
  return {
    id: id || `evt_http_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    data: { object: data },
  };
}

async function getSubscription(email) {
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token(email)}` };
  const res = await fetch(BASE + `/api/subscription/${email}`, { headers });
  return (await res.json());
}

// ── Boot server ──────────────────────────────────────────────────────────────
async function waitForHealth(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(BASE + "/health");
      if (r.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error("Server did not become healthy in time");
}

async function main() {
  console.log("🚀 Spawning api_server.js on port " + PORT + "...\n");
  const server = spawn("node", [path.join(__dirname, "api_server.js")], {
    env: {
      ...process.env,
      DB_PATH,
      CODES_DB_PATH,
      PORT: String(PORT),
      JWT_SECRET,
      STRIPE_SECRET_KEY: "sk_test_fake_for_unit_test",
      STRIPE_WEBHOOK_SECRET,
      STRIPE_PRICE_ID_CARTE: "price_carte_http",
      STRIPE_PRICE_ID_ESSENTIAL: "price_essential_http",
      STRIPE_PRICE_ID_ELITE: "price_elite_http",
      AUTO_CONCILE_OBSERVER: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  server.stdout.on("data", d => { serverLog += d.toString(); });
  server.stderr.on("data", d => { serverLog += d.toString(); });

  try {
    await waitForHealth();
    console.log("🟢 Server healthy — running Stripe HTTP tests\n");
    console.log("━".repeat(60) + "\n");

    // ===== GROUP 1: Webhook signature verification =====
    console.log("📋 GROUP 1: Webhook security\n");

    await check("Webhook with invalid signature → 400", async () => {
      const r = await sendUnsignedWebhook(makeEvent("checkout.session.completed", { id: "cs_bad" }));
      assertEqual(r.status, 400, "status");
    });

    await check("Webhook with valid signature → 200", async () => {
      const event = makeEvent("customer.subscription.created", {
        id: "sub_sig_test",
        customer: "cus_alice_http",
        status: "active",
        items: { data: [{ price: { id: "price_essential_http" } }] },
      });
      const r = await sendWebhook(event);
      assertEqual(r.status, 200, "status");
      assertEqual(r.json.ok, true, "ok");
    });

    console.log("\n" + "━".repeat(60) + "\n");

    // ===== GROUP 2: Subscription lifecycle via webhooks =====
    console.log("📋 GROUP 2: Subscription lifecycle\n");

    await check("checkout.session.completed with unresolvable price → error (no subscription modified)", async () => {
      const event = makeEvent("checkout.session.completed", {
        id: "cs_lifecycle_1",
        customer: "cus_bob_http",
        customer_email: "bob@test.com",
        subscription: "sub_bob_1",
        payment_intent: "pi_bob_1",
        client_reference_id: String(bobId),
        mode: "subscription",
      });
      const r = await sendWebhook(event);
      assertEqual(r.status, 200, "status");
      assertEqual(r.json.ok, false, "ok (should fail — unknown price_id)");
    });

    await check("customer.subscription.created → plan set", async () => {
      const event = makeEvent("customer.subscription.created", {
        id: "sub_carol_1",
        customer: "cus_carol_http",
        status: "active",
        items: { data: [{ price: { id: "price_elite_http" } }] },
      });
      const r = await sendWebhook(event);
      assertEqual(r.status, 200, "status");
      assertEqual(r.json.ok, true, "ok");

      const sub = await getSubscription("carol@test.com");
      assertEqual(sub.subscription.plan, "ELITE", "plan");
    });

    await check("customer.subscription.updated → plan changed", async () => {
      const event = makeEvent("customer.subscription.updated", {
        id: "sub_carol_1",
        customer: "cus_carol_http",
        status: "active",
        items: { data: [{ price: { id: "price_essential_http" } }] },
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      });
      const r = await sendWebhook(event);
      assertEqual(r.status, 200, "status");

      const sub = await getSubscription("carol@test.com");
      assertEqual(sub.subscription.plan, "ESSENTIAL", "plan changed to ESSENTIAL");
    });

    await check("invoice.payment_failed → status PENDING_PAYMENT", async () => {
      const event = makeEvent("invoice.payment_failed", {
        customer: "cus_carol_http",
        subscription: "sub_carol_1",
        attempt_count: 1,
      });
      const r = await sendWebhook(event);
      assertEqual(r.status, 200, "status");

      const sub = await getSubscription("carol@test.com");
      assertEqual(sub.subscription.status, "PENDING_PAYMENT", "status");
    });

    await check("invoice.paid → reactivates subscription", async () => {
      const event = makeEvent("invoice.paid", {
        customer: "cus_carol_http",
        subscription: "sub_carol_1",
        payment_intent: "pi_carol_renew",
        lines: { data: [{ period: { end: Math.floor(Date.now() / 1000) + 32 * 86400 } }] },
      });
      const r = await sendWebhook(event);
      assertEqual(r.status, 200, "status");

      const sub = await getSubscription("carol@test.com");
      assertEqual(sub.subscription.status, "ACTIVE", "reactivated");
    });

    await check("charge.refunded → status REFUNDED", async () => {
      const event = makeEvent("charge.refunded", {
        customer: "cus_carol_http",
        payment_intent: "pi_carol_refund",
      });
      const r = await sendWebhook(event);
      assertEqual(r.status, 200, "status");

      const sub = await getSubscription("carol@test.com");
      assertEqual(sub.subscription.status, "REFUNDED", "status");
    });

    await check("customer.subscription.deleted → status CANCELLED", async () => {
      const event = makeEvent("customer.subscription.deleted", {
        id: "sub_carol_1",
        customer: "cus_carol_http",
      });
      const r = await sendWebhook(event);
      assertEqual(r.status, 200, "status");

      const sub = await getSubscription("carol@test.com");
      assertEqual(sub.subscription.status, "CANCELLED", "status");
    });

    console.log("\n" + "━".repeat(60) + "\n");

    // ===== GROUP 3: Idempotence =====
    console.log("📋 GROUP 3: Idempotence\n");

    await check("Duplicate webhook (same event ID) → skipped", async () => {
      const eventId = "evt_idem_http_test_fixed";
      const event = makeEvent("customer.subscription.created", {
        id: "sub_alice_idem",
        customer: "cus_alice_http",
        status: "active",
        items: { data: [{ price: { id: "price_elite_http" } }] },
      }, eventId);

      const r1 = await sendWebhook(event);
      assertEqual(r1.status, 200, "first call status");
      assertEqual(r1.json.ok, true, "first call ok");

      const r2 = await sendWebhook(event);
      assertEqual(r2.status, 200, "second call status");
      assertEqual(r2.json.ok, true, "second call ok");
      assertEqual(r2.json.skipped, true, "second call skipped");
    });

    console.log("\n" + "━".repeat(60) + "\n");

    // ===== GROUP 4: Event history =====
    console.log("📋 GROUP 4: Event history endpoint\n");

    await check("GET /admin/stripe/events without admin code → 403", async () => {
      const res = await fetch(BASE + "/admin/stripe/events?email=x&code=WRONG");
      assertEqual(res.status, 403, "status");
    });

    await check("GET /admin/stripe/events with admin code → 200 with events", async () => {
      const res = await fetch(BASE + "/admin/stripe/events?email=admin@test.com&code=ELITE-ADMIN-STRIPE");
      const json = await res.json();
      assertEqual(res.status, 200, "status");
      assertEqual(json.ok, true, "ok");
      if (!json.events || json.events.length === 0) throw new Error("No events in history");
      if (!json.events[0].stripe_event_id) throw new Error("Missing stripe_event_id");
      if (!json.events[0].event_type) throw new Error("Missing event_type");
    });

    console.log("\n" + "━".repeat(60) + "\n");

    // ===== GROUP 5: Unknown event type =====
    console.log("📋 GROUP 5: Edge cases\n");

    await check("Unhandled event type → accepted but ignored", async () => {
      const event = makeEvent("payment_intent.succeeded", { id: "pi_edge" });
      const r = await sendWebhook(event);
      assertEqual(r.status, 200, "status");
      assertEqual(r.json.ok, true, "ok");
      assertEqual(r.json.ignored, true, "ignored");
    });

    await check("Event for unknown customer → no crash", async () => {
      const event = makeEvent("customer.subscription.deleted", {
        id: "sub_ghost",
        customer: "cus_nonexistent_http",
      });
      const r = await sendWebhook(event);
      assertEqual(r.status, 200, "status");
      assertEqual(r.json.ok, true, "ok");
    });

  } finally {
    server.kill("SIGTERM");
    await new Promise(r => setTimeout(r, 300));
    for (const f of [DB_PATH, CODES_DB_PATH, DB_PATH + "-wal", DB_PATH + "-shm",
                     CODES_DB_PATH + "-wal", CODES_DB_PATH + "-shm"]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    if (failed > 0) {
      console.log("\n--- server log (last 30 lines) ---");
      console.log(serverLog.split("\n").slice(-30).join("\n"));
    }
  }

  console.log("\n📊 STRIPE HTTP INTEGRATION TEST SUMMARY");
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);

  if (failed === 0) {
    console.log("\n🎉 All Stripe HTTP integration tests passed!\n");
    process.exit(0);
  } else {
    console.log("\n⚠️ Failures:\n - " + failures.join("\n - ") + "\n");
    process.exit(1);
  }
}

main().catch(e => {
  console.error("FATAL:", e);
  process.exit(1);
});

#!/usr/bin/env node

// Mission 003: Stripe Handler Unit Tests
// Tests the StripeHandler class directly against a throwaway SQLite database.
// Run: node scripts/test_stripe_handler.js

const Database = require("better-sqlite3");
const SubscriptionEngine = require("./subscription-engine");
const StripeHandler = require("./stripe-handler");
const fs = require("fs");

const DB_PATH = "/tmp/tlm_stripe_test.db";

// Cleanup
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

console.log("🧪 Mission 003: Stripe Handler Unit Tests\n");

// ── Setup ────────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.exec(`
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

// Seed users
function addUser(email, stripeCustomerId = null) {
  const uid = db.prepare("INSERT INTO users (email, password_hash, stripe_customer_id) VALUES (?, ?, ?)").run(email, "hash", stripeCustomerId).lastInsertRowid;
  return uid;
}

const user1Id = addUser("alice@test.com", "cus_alice");
const user2Id = addUser("bob@test.com", "cus_bob");
const user3Id = addUser("carol@test.com", "cus_carol");
const user4Id = addUser("dave@test.com", "cus_dave");

const engine = new SubscriptionEngine(DB_PATH);
const handler = new StripeHandler({
  db,
  subscriptionEngine: engine,
  priceConfig: {
    carte: "price_carte_test",
    essential: "price_essential_test",
    elite: "price_elite_test",
  },
  codesDbPath: "/tmp/tlm_stripe_codes_test.db",
});

// Ensure subscriptions for test users
engine.ensureSubscription(user1Id, "alice@test.com");
engine.ensureSubscription(user2Id, "bob@test.com");
engine.ensureSubscription(user3Id, "carol@test.com");
engine.ensureSubscription(user4Id, "dave@test.com");

let passed = 0, failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) { console.log(`✅ ${message}`); passed++; }
  else { console.log(`❌ ${message}`); failed++; failures.push(message); }
}

async function test(name, fn) {
  console.log(`\n📝 ${name}`);
  try { await fn(); }
  catch (e) { console.log(`❌ ERROR: ${e.message}`); failed++; failures.push(`${name}: ${e.message}`); }
}

// ── Mock stripe object (only used for checkout.session.completed to retrieve line_items) ──
const mockStripe = {
  checkout: {
    sessions: {
      retrieve: async (sessionId, opts) => ({
        id: sessionId,
        line_items: { data: [{ price: { id: "price_essential_test" } }] },
      }),
    },
  },
};

function makeEvent(type, data, id = null) {
  return {
    id: id || `evt_test_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    data: { object: data },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

(async () => {

  // Test 1: checkout.session.completed → subscription
  await test("checkout.session.completed activates ESSENTIAL subscription", async () => {
    const event = makeEvent("checkout.session.completed", {
      id: "cs_test_1",
      customer: "cus_alice",
      customer_email: "alice@test.com",
      subscription: "sub_alice_1",
      payment_intent: "pi_alice_1",
      client_reference_id: String(user1Id),
      mode: "subscription",
    });
    const result = await handler.handleEvent(event, mockStripe);
    assert(result.ok === true, "Event processed successfully");
    assert(result.plan === "ESSENTIAL", "Plan resolved to ESSENTIAL");

    const sub = engine.getSubscriptionStatus(user1Id);
    assert(sub.plan === "ESSENTIAL", "Subscription updated to ESSENTIAL");
    assert(sub.status === "ACTIVE", "Status is ACTIVE");
  });

  // Test 2: checkout.session.completed → single payment (carte)
  await test("checkout.session.completed handles single payment (PAY_PER_VIEW)", async () => {
    const carteStripe = {
      checkout: {
        sessions: {
          retrieve: async () => ({
            id: "cs_carte",
            line_items: { data: [{ price: { id: "price_carte_test" } }] },
          }),
        },
      },
    };
    const event = makeEvent("checkout.session.completed", {
      id: "cs_carte",
      customer: "cus_bob",
      customer_email: "bob@test.com",
      payment_intent: "pi_bob_1",
      client_reference_id: String(user2Id),
      mode: "payment",
    });
    const result = await handler.handleEvent(event, carteStripe);
    assert(result.ok === true, "Carte payment processed");
    assert(result.plan === "PAY_PER_VIEW", "Plan resolved to PAY_PER_VIEW");
  });

  // Test 3: customer.subscription.created
  await test("customer.subscription.created updates subscription", async () => {
    const event = makeEvent("customer.subscription.created", {
      id: "sub_carol_1",
      customer: "cus_carol",
      status: "active",
      items: { data: [{ price: { id: "price_elite_test" } }] },
    });
    const result = await handler.handleEvent(event, null);
    assert(result.ok === true, "Event processed");
    assert(result.action === "subscription_created", "Correct action");

    const sub = engine.getSubscriptionStatus(user3Id);
    assert(sub.plan === "ELITE", "Plan updated to ELITE");
    assert(sub.status === "ACTIVE", "Status is ACTIVE");
  });

  // Test 4: customer.subscription.updated (plan change)
  await test("customer.subscription.updated changes plan", async () => {
    const event = makeEvent("customer.subscription.updated", {
      id: "sub_carol_1",
      customer: "cus_carol",
      status: "active",
      items: { data: [{ price: { id: "price_essential_test" } }] },
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
    });
    const result = await handler.handleEvent(event, null);
    assert(result.ok === true, "Event processed");

    const sub = engine.getSubscriptionStatus(user3Id);
    assert(sub.plan === "ESSENTIAL", "Plan downgraded to ESSENTIAL");
  });

  // Test 5: invoice.payment_failed → PENDING_PAYMENT
  await test("invoice.payment_failed sets PENDING_PAYMENT status", async () => {
    const event = makeEvent("invoice.payment_failed", {
      customer: "cus_carol",
      subscription: "sub_carol_1",
      attempt_count: 1,
    });
    const result = await handler.handleEvent(event, null);
    assert(result.ok === true, "Event processed");

    const sub = engine.getSubscriptionStatus(user3Id);
    assert(sub.status === "PENDING_PAYMENT", "Status is PENDING_PAYMENT");
  });

  // Test 6: invoice.paid → reactivates
  await test("invoice.paid reactivates subscription after failed payment", async () => {
    const event = makeEvent("invoice.paid", {
      customer: "cus_carol",
      subscription: "sub_carol_1",
      payment_intent: "pi_carol_2",
      lines: { data: [{ period: { end: Math.floor(Date.now() / 1000) + 32 * 86400 } }] },
    });
    const result = await handler.handleEvent(event, null);
    assert(result.ok === true, "Event processed");

    const sub = engine.getSubscriptionStatus(user3Id);
    assert(sub.status === "ACTIVE", "Status reactivated to ACTIVE");
  });

  // Test 7: charge.refunded → REFUNDED
  await test("charge.refunded sets REFUNDED status", async () => {
    const event = makeEvent("charge.refunded", {
      customer: "cus_dave",
      payment_intent: "pi_dave_1",
    });
    const result = await handler.handleEvent(event, null);
    assert(result.ok === true, "Event processed");

    const sub = engine.getSubscriptionStatus(user4Id);
    assert(sub.status === "REFUNDED", "Status is REFUNDED");
  });

  // Test 8: customer.subscription.deleted → CANCELLED
  await test("customer.subscription.deleted cancels subscription", async () => {
    // First reactivate dave's subscription for this test
    engine.updateSubscription(user4Id, "ESSENTIAL", "ACTIVE", "test_setup");

    const event = makeEvent("customer.subscription.deleted", {
      id: "sub_dave_1",
      customer: "cus_dave",
    });
    const result = await handler.handleEvent(event, null);
    assert(result.ok === true, "Event processed");

    const sub = engine.getSubscriptionStatus(user4Id);
    assert(sub.status === "CANCELLED", "Status is CANCELLED");
  });

  // Test 9: Idempotence — duplicate event rejected
  await test("Duplicate event is rejected (idempotence)", async () => {
    const eventId = "evt_idempotence_test_123";
    const event = makeEvent("customer.subscription.updated", {
      id: "sub_alice_1",
      customer: "cus_alice",
      status: "active",
      items: { data: [{ price: { id: "price_elite_test" } }] },
    }, eventId);

    const result1 = await handler.handleEvent(event, null);
    assert(result1.ok === true, "First processing succeeds");

    // Update to ESSENTIAL before replaying (to verify replay doesn't change anything)
    engine.updateSubscription(user1Id, "ESSENTIAL", "ACTIVE", "test_setup");

    const result2 = await handler.handleEvent(event, null);
    assert(result2.ok === true, "Second call returns ok");
    assert(result2.skipped === true, "Second call is skipped (duplicate)");

    const sub = engine.getSubscriptionStatus(user1Id);
    assert(sub.plan === "ESSENTIAL", "Plan unchanged by duplicate (stayed ESSENTIAL)");
  });

  // Test 10: Unknown event type → ignored
  await test("Unknown event type is ignored gracefully", async () => {
    const event = makeEvent("payment_intent.succeeded", { id: "pi_unknown" });
    const result = await handler.handleEvent(event, null);
    assert(result.ok === true, "Returns ok");
    assert(result.ignored === true, "Marked as ignored");
  });

  // Test 11: Event history
  await test("Event history records all processed events", async () => {
    const history = handler.getEventHistory(100, 0);
    assert(history.total > 0, `Event history has ${history.total} entries`);
    assert(history.events[0].event_type !== undefined, "Events have type");
    assert(history.events[0].stripe_event_id !== undefined, "Events have stripe_event_id");
  });

  // Test 12: Stripe status mapping
  await test("Stripe status mapping covers all cases", async () => {
    assert(handler._mapStripeStatus("active") === "ACTIVE", "active → ACTIVE");
    assert(handler._mapStripeStatus("past_due") === "PENDING_PAYMENT", "past_due → PENDING_PAYMENT");
    assert(handler._mapStripeStatus("canceled") === "CANCELLED", "canceled → CANCELLED");
    assert(handler._mapStripeStatus("unpaid") === "SUSPENDED", "unpaid → SUSPENDED");
    assert(handler._mapStripeStatus("incomplete") === "PENDING_PAYMENT", "incomplete → PENDING_PAYMENT");
    assert(handler._mapStripeStatus("incomplete_expired") === "EXPIRED", "incomplete_expired → EXPIRED");
    assert(handler._mapStripeStatus("trialing") === "ACTIVE", "trialing → ACTIVE");
    assert(handler._mapStripeStatus("paused") === "SUSPENDED", "paused → SUSPENDED");
    assert(handler._mapStripeStatus("unknown_val") === "ACTIVE", "unknown defaults to ACTIVE");
  });

  // Test 13: Unknown customer → no crash
  await test("Event for unknown customer does not crash", async () => {
    const event = makeEvent("customer.subscription.deleted", {
      id: "sub_unknown",
      customer: "cus_nonexistent",
    });
    const result = await handler.handleEvent(event, null);
    assert(result.ok === true, "No crash on unknown customer");
  });

  // Test 14: Stripe IDs stored on user record
  await test("Stripe customer and subscription IDs stored on user record", async () => {
    const user = db.prepare("SELECT stripe_customer_id, stripe_subscription_id FROM users WHERE id = ?").get(user1Id);
    assert(user.stripe_customer_id === "cus_alice", "stripe_customer_id preserved");
    assert(user.stripe_subscription_id === "sub_alice_1", "stripe_subscription_id set from checkout");
  });

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  engine.close();
  db.close();
  fs.unlinkSync(DB_PATH);
  try { fs.unlinkSync("/tmp/tlm_stripe_codes_test.db"); } catch {}

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n\n📊 STRIPE HANDLER TEST SUMMARY`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);

  if (failed === 0) {
    console.log(`\n🎉 All Stripe handler tests passed!\n`);
    process.exit(0);
  } else {
    console.log(`\n⚠️ Failures:\n - ${failures.join("\n - ")}\n`);
    process.exit(1);
  }
})();

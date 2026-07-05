#!/usr/bin/env node

// Mission 005.5: End-to-End Tests
// Validates the full chain: Stripe → Subscription Engine → Event Bus → Brevo → History
// Run: node scripts/test_e2e.js

const Database = require("better-sqlite3");
const fs = require("fs");
const { EventBus, EventStore, EVENT_TYPES } = require("./event-bus");
const SubscriptionEngine = require("./subscription-engine");
const StripeHandler = require("./stripe-handler");
const { BrevoSender, EmailScheduler, wireBrevoSubscribers } = require("./brevo-subscriber");

const DB_PATH = "/tmp/tlm_e2e_test.db";
const CODES_DB = "/tmp/tlm_e2e_codes.db";
for (const f of [DB_PATH, CODES_DB, DB_PATH + "-wal", DB_PATH + "-shm"]) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

console.log("Mission 005.5: End-to-End Tests\n");
console.log("Chain: Stripe -> Subscription Engine -> Event Bus -> Brevo -> History\n");

let passed = 0, failed = 0;
const failures = [];
const metrics = {};

function assert(cond, msg) {
  if (cond) { passed++; }
  else { console.log(`    FAIL  ${msg}`); failed++; failures.push(msg); }
}

async function scenario(name, fn) {
  console.log(`\n  SCENARIO: ${name}`);
  const t0 = Date.now();
  try {
    await fn();
    const elapsed = Date.now() - t0;
    metrics[name] = { elapsed, ok: true };
    console.log(`    ${elapsed}ms`);
  } catch (e) {
    const elapsed = Date.now() - t0;
    metrics[name] = { elapsed, ok: false, error: e.message };
    console.log(`    ERROR: ${e.message}`);
    failed++;
    failures.push(`${name}: ${e.message}`);
  }
}

// ── Database setup ───────────────────────────────────────────────────────────

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

// ── Wire up the full chain ───────────────────────────────────────────────────

const engine = new SubscriptionEngine(DB_PATH);
const busStore = new EventStore(db);
const bus = new EventBus({ store: busStore });

const emailsSent = [];
const brevoSender = new BrevoSender({
  apiKey: "test-e2e-key",
  httpPost: async (msg) => { emailsSent.push(msg); },
});
const emailScheduler = new EmailScheduler({ db, sender: brevoSender });

wireBrevoSubscribers(bus, emailScheduler, {
  resolveEmail: (evt) => evt.payload.email,
});

const priceConfig = {
  carte: "price_carte_e2e",
  essential: "price_essential_e2e",
  elite: "price_elite_e2e",
};

const stripeHandler = new StripeHandler({
  db,
  subscriptionEngine: engine,
  priceConfig,
  codesDbPath: CODES_DB,
});

// Helper: publish bus event after stripe handler processes
async function stripeAndPublish(event, mockStripe, eventType, payload, meta) {
  const result = await stripeHandler.handleEvent(event, mockStripe);
  if (eventType && result.ok && !result.skipped && !result.ignored) {
    await bus.publish(eventType, payload, meta);
  }
  return result;
}

function addUser(email, stripeCustomerId = null) {
  const uid = db.prepare("INSERT INTO users (email, password_hash, stripe_customer_id) VALUES (?, ?, ?)").run(email, "hash", stripeCustomerId).lastInsertRowid;
  engine.ensureSubscription(uid, email);
  return uid;
}

function makeEvent(type, data, id = null) {
  return {
    id: id || `evt_e2e_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    data: { object: data },
  };
}

const mockStripeEssential = {
  checkout: { sessions: { retrieve: async () => ({
    id: "cs_e2e", line_items: { data: [{ price: { id: "price_essential_e2e" } }] },
  })}}
};

const mockStripeElite = {
  checkout: { sessions: { retrieve: async () => ({
    id: "cs_e2e", line_items: { data: [{ price: { id: "price_elite_e2e" } }] },
  })}}
};

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 1: Full happy path — user creation → payment → subscription → email
// ══════════════════════════════════════════════════════════════════════════════

(async () => {

  await scenario("1. Full happy path: user → payment → subscription → email → history", async () => {
    const userId = addUser("alice@e2e.com", "cus_alice_e2e");
    emailsSent.length = 0;

    // Simulate USER_CREATED event
    await bus.publish("USER_CREATED", { email: "alice@e2e.com", userId }, { source: "auth", userId });

    // Stripe checkout completed
    const event = makeEvent("checkout.session.completed", {
      id: "cs_alice_e2e",
      customer: "cus_alice_e2e",
      customer_email: "alice@e2e.com",
      subscription: "sub_alice_e2e",
      payment_intent: "pi_alice_e2e",
      client_reference_id: String(userId),
      mode: "subscription",
    });
    const result = await stripeHandler.handleEvent(event, mockStripeEssential);
    assert(result.ok === true, "Stripe handler processed checkout");
    assert(result.plan === "ESSENTIAL", "Plan resolved to ESSENTIAL");

    // Publish subscription created event
    await bus.publish("SUBSCRIPTION_CREATED", {
      email: "alice@e2e.com", userId, plan: "ESSENTIAL", status: "ACTIVE",
    }, { source: "subscription-engine", userId });

    // Verify subscription
    const sub = engine.getSubscriptionStatus(userId);
    assert(sub.plan === "ESSENTIAL", "Subscription plan is ESSENTIAL");
    assert(sub.status === "ACTIVE", "Subscription status is ACTIVE");

    // Process email queue
    await emailScheduler.processPending(20);

    // Verify emails: welcome + subscription_created
    assert(emailsSent.length === 2, `2 emails sent (welcome + subscription), got ${emailsSent.length}`);
    const subjects = emailsSent.map((e) => e.subject);
    assert(subjects.some((s) => s.includes("Bienvenue")), "Welcome email sent");
    assert(subjects.some((s) => s.includes("ESSENTIAL")), "Subscription email sent");

    // Verify bus event history
    const { events: busEvents } = busStore.query(20, 0);
    assert(busEvents.length >= 2, "Bus events recorded");

    // Verify stripe event history
    const stripeHistory = stripeHandler.getEventHistory(10, 0);
    assert(stripeHistory.total >= 1, "Stripe event recorded");

    // Verify subscription history
    const subHistory = engine.getSubscriptionHistory(userId);
    assert(subHistory.history.length >= 1, "Subscription history recorded");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: Payment refused → no subscription → appropriate email
  // ══════════════════════════════════════════════════════════════════════════════

  await scenario("2. Payment refused → no subscription → payment_failed email", async () => {
    const userId = addUser("bob@e2e.com", "cus_bob_e2e");
    emailsSent.length = 0;

    // Simulate payment failure
    const event = makeEvent("invoice.payment_failed", {
      customer: "cus_bob_e2e",
      subscription: "sub_bob_e2e",
      attempt_count: 1,
    });
    const result = await stripeHandler.handleEvent(event, null);
    assert(result.ok === true, "Stripe handler processed payment failure");

    // Publish payment failed event
    await bus.publish("PAYMENT_FAILED", {
      email: "bob@e2e.com", userId, reason: "card_declined",
    }, { source: "stripe", userId });

    // Verify subscription NOT activated (still VISITOR)
    const sub = engine.getSubscriptionStatus(userId);
    assert(sub.plan === "VISITOR", "Plan remains VISITOR (no activation)");
    assert(sub.status === "PENDING_PAYMENT", "Status is PENDING_PAYMENT");

    // Process emails
    await emailScheduler.processPending(10);
    assert(emailsSent.length === 1, "1 payment_failed email sent");
    assert(emailsSent[0].subject.includes("Echec"), "Email about payment failure");

    // Verify history
    const { events } = busStore.queryByType("PAYMENT_FAILED", 10, 0);
    assert(events.length >= 1, "PAYMENT_FAILED in bus history");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 3: Renewal → subscription updated → email
  // ══════════════════════════════════════════════════════════════════════════════

  await scenario("3. Renewal → webhook → subscription updated → email", async () => {
    const userId = addUser("carol@e2e.com", "cus_carol_e2e");
    emailsSent.length = 0;

    // First, activate subscription
    engine.updateSubscription(userId, "ESSENTIAL", "ACTIVE", "test_setup");

    // Simulate invoice.paid (renewal)
    const event = makeEvent("invoice.paid", {
      customer: "cus_carol_e2e",
      subscription: "sub_carol_e2e",
      payment_intent: "pi_carol_renewal",
      lines: { data: [{ period: { end: Math.floor(Date.now() / 1000) + 32 * 86400 } }] },
    });
    const result = await stripeHandler.handleEvent(event, null);
    assert(result.ok === true, "Stripe handler processed renewal");

    // Publish subscription updated
    await bus.publish("SUBSCRIPTION_UPDATED", {
      email: "carol@e2e.com", userId, plan: "ESSENTIAL", status: "ACTIVE",
    }, { source: "subscription-engine", userId });

    // Verify subscription still active
    const sub = engine.getSubscriptionStatus(userId);
    assert(sub.status === "ACTIVE", "Status remains ACTIVE after renewal");

    // Process emails
    await emailScheduler.processPending(10);
    assert(emailsSent.length === 1, "1 subscription_updated email sent");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 4: Cancellation → webhook → subscription cancelled → email
  // ══════════════════════════════════════════════════════════════════════════════

  await scenario("4. Cancellation → webhook → subscription cancelled → email", async () => {
    const userId = addUser("dave@e2e.com", "cus_dave_e2e");
    emailsSent.length = 0;

    // Activate first
    engine.updateSubscription(userId, "ELITE", "ACTIVE", "test_setup");

    // Cancel
    const event = makeEvent("customer.subscription.deleted", {
      id: "sub_dave_cancel",
      customer: "cus_dave_e2e",
    });
    const result = await stripeHandler.handleEvent(event, null);
    assert(result.ok === true, "Stripe handler processed cancellation");

    // Publish
    await bus.publish("SUBSCRIPTION_CANCELLED", {
      email: "dave@e2e.com", userId, plan: "ELITE",
    }, { source: "subscription-engine", userId });

    // Verify
    const sub = engine.getSubscriptionStatus(userId);
    assert(sub.status === "CANCELLED", "Status is CANCELLED");

    // Email
    await emailScheduler.processPending(10);
    assert(emailsSent.length === 1, "1 cancellation email sent");
    assert(emailsSent[0].subject.includes("resilie"), "Email about cancellation");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 5: Refund → webhook → subscription updated → email
  // ══════════════════════════════════════════════════════════════════════════════

  await scenario("5. Refund → webhook → subscription refunded → email", async () => {
    const userId = addUser("eve@e2e.com", "cus_eve_e2e");
    emailsSent.length = 0;

    engine.updateSubscription(userId, "ESSENTIAL", "ACTIVE", "test_setup");

    const event = makeEvent("charge.refunded", {
      customer: "cus_eve_e2e",
      payment_intent: "pi_eve_refund",
    });
    const result = await stripeHandler.handleEvent(event, null);
    assert(result.ok === true, "Stripe handler processed refund");

    await bus.publish("PAYMENT_REFUNDED", {
      email: "eve@e2e.com", userId, amount: 990,
    }, { source: "stripe", userId });

    const sub = engine.getSubscriptionStatus(userId);
    assert(sub.status === "REFUNDED", "Status is REFUNDED");

    await emailScheduler.processPending(10);
    assert(emailsSent.length === 1, "1 refund email sent");
    assert(emailsSent[0].subject.includes("remboursement"), "Email about refund");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 6: Double payment → double webhook → no duplicate
  // ══════════════════════════════════════════════════════════════════════════════

  await scenario("6. Double webhook → no duplicate action, no duplicate email", async () => {
    const userId = addUser("frank@e2e.com", "cus_frank_e2e");
    emailsSent.length = 0;

    const eventId = "evt_e2e_double_test";
    const eventData = {
      id: "sub_frank_1",
      customer: "cus_frank_e2e",
      status: "active",
      items: { data: [{ price: { id: "price_essential_e2e" } }] },
    };

    // First webhook
    const event1 = makeEvent("customer.subscription.created", eventData, eventId);
    const r1 = await stripeHandler.handleEvent(event1, null);
    assert(r1.ok === true, "First webhook processed");
    assert(!r1.skipped, "First webhook not skipped");

    // Publish bus event
    await bus.publish("SUBSCRIPTION_CREATED", {
      email: "frank@e2e.com", userId, plan: "ESSENTIAL",
    }, { source: "engine", userId, id: "bus_frank_1" });

    // Second webhook (duplicate)
    const event2 = makeEvent("customer.subscription.created", eventData, eventId);
    const r2 = await stripeHandler.handleEvent(event2, null);
    assert(r2.ok === true, "Second webhook returns ok");
    assert(r2.skipped === true, "Second webhook skipped (idempotence)");

    // Second bus event (same id)
    await bus.publish("SUBSCRIPTION_CREATED", {
      email: "frank@e2e.com", userId, plan: "ESSENTIAL",
    }, { source: "engine", userId, id: "bus_frank_1" });

    // Process emails
    await emailScheduler.processPending(20);

    // Verify: only 1 email
    assert(emailsSent.length === 1, `Only 1 email sent despite 2 webhooks, got ${emailsSent.length}`);

    // Verify: subscription only updated once
    const sub = engine.getSubscriptionStatus(userId);
    assert(sub.plan === "ESSENTIAL", "Plan is ESSENTIAL (not applied twice)");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 7: Crash simulation → restart → no event/email lost
  // ══════════════════════════════════════════════════════════════════════════════

  await scenario("7. Crash simulation → restart → pending emails survive", async () => {
    const userId = addUser("grace@e2e.com", "cus_grace_e2e");
    emailsSent.length = 0;

    // Enqueue emails but DON'T process (simulating crash before processing)
    await bus.publish("SUBSCRIPTION_CREATED", {
      email: "grace@e2e.com", userId, plan: "ELITE",
    }, { source: "engine", userId });

    // Verify email is in queue but not sent
    const { emails: beforeCrash } = emailScheduler.getHistory(100, 0);
    const gracePending = beforeCrash.filter((e) => e.recipient === "grace@e2e.com" && e.status === "pending");
    assert(gracePending.length >= 1, "Email queued before crash");
    assert(emailsSent.length === 0, "No email sent yet (pre-crash)");

    // "Restart": create new scheduler instance from same DB (simulates process restart)
    const sender2 = new BrevoSender({
      apiKey: "test-e2e-key",
      httpPost: async (msg) => { emailsSent.push(msg); },
    });
    const scheduler2 = new EmailScheduler({ db, sender: sender2 });

    // Process pending from the "new" instance
    const results = await scheduler2.processPending(20);
    const graceResults = results.filter((r) => r.ok);
    assert(graceResults.length >= 1, "Pending emails processed after restart");
    assert(emailsSent.length >= 1, "Emails sent after restart");

    // Verify bus events survived (EventStore is in same DB)
    const { events } = busStore.queryByType("SUBSCRIPTION_CREATED", 100, 0);
    assert(events.length >= 1, "Bus events survived crash");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 8: Brevo timeout → subscription preserved → history correct
  // ══════════════════════════════════════════════════════════════════════════════

  await scenario("8. Brevo timeout → subscription preserved → no crash", async () => {
    const userId = addUser("helen@e2e.com", "cus_helen_e2e");
    emailsSent.length = 0;

    // Create a scheduler with a sender that always throws (simulates Brevo failure)
    const slowSender = new BrevoSender({
      apiKey: "test-e2e-key",
      httpPost: async () => { throw new Error("Brevo API timeout"); },
    });
    const slowScheduler = new EmailScheduler({ db, sender: slowSender });

    // Activate subscription via stripe
    const event = makeEvent("customer.subscription.created", {
      id: "sub_helen_1",
      customer: "cus_helen_e2e",
      status: "active",
      items: { data: [{ price: { id: "price_elite_e2e" } }] },
    });
    const result = await stripeHandler.handleEvent(event, null);
    assert(result.ok === true, "Stripe handler succeeded");

    // Verify subscription is active regardless of Brevo
    const sub = engine.getSubscriptionStatus(userId);
    assert(sub.plan === "ELITE", "Plan is ELITE");
    assert(sub.status === "ACTIVE", "Status is ACTIVE");

    // Enqueue and try to send (will fail due to timeout)
    slowScheduler.enqueue("helen@e2e.com", "subscription_created", { plan: "ELITE" }, { eventId: "evt_helen_timeout" });
    const sendResults = await slowScheduler.processPending(10);

    // The send should fail but not crash
    assert(sendResults.length === 1, "1 email attempted");
    assert(sendResults[0].ok === false, "Email send failed (timeout)");

    // Verify failed status in history
    const { emails } = slowScheduler.getHistory(100, 0);
    const helenFailed = emails.find((e) => e.recipient === "helen@e2e.com" && e.status === "failed");
    assert(helenFailed !== undefined, "Failed email recorded in history");

    // Subscription is still intact
    const sub2 = engine.getSubscriptionStatus(userId);
    assert(sub2.plan === "ELITE", "Plan still ELITE after Brevo failure");
    assert(sub2.status === "ACTIVE", "Status still ACTIVE after Brevo failure");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 9: Invalid webhook → rejected → no modification
  // ══════════════════════════════════════════════════════════════════════════════

  await scenario("9. Invalid webhook → rejected → no modification → history", async () => {
    const userId = addUser("ivan@e2e.com", "cus_ivan_e2e");
    emailsSent.length = 0;

    const subBefore = engine.getSubscriptionStatus(userId);

    // Unknown event type
    const event1 = makeEvent("payment_intent.created", { id: "pi_unknown" });
    const r1 = await stripeHandler.handleEvent(event1, null);
    assert(r1.ok === true, "Unknown event type returns ok");
    assert(r1.ignored === true, "Unknown event type marked ignored");

    // Event for unknown customer
    const event2 = makeEvent("customer.subscription.deleted", {
      id: "sub_ghost",
      customer: "cus_nonexistent",
    });
    const r2 = await stripeHandler.handleEvent(event2, null);
    assert(r2.ok === true, "Unknown customer doesn't crash");

    // Verify no changes to ivan's subscription
    const subAfter = engine.getSubscriptionStatus(userId);
    assert(subAfter.plan === subBefore.plan, "Plan unchanged");
    assert(subAfter.status === subBefore.status, "Status unchanged");

    // Verify events still recorded in stripe history
    const history = stripeHandler.getEventHistory(100, 0);
    const ignoredEvent = history.events.find((e) => e.result === "ignored");
    assert(ignoredEvent !== undefined, "Ignored event recorded in history");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 10: Load test — 100 payments → 100 subscriptions → 100 emails
  // ══════════════════════════════════════════════════════════════════════════════

  await scenario("10. Load test: 100 payments → 100 subscriptions → 100 emails", async () => {
    emailsSent.length = 0;
    const LOAD = 100;
    const userIds = [];

    // Create 100 users
    for (let i = 0; i < LOAD; i++) {
      const uid = addUser(`load_${i}@e2e.com`, `cus_load_${i}`);
      userIds.push(uid);
    }

    // 100 stripe webhooks
    for (let i = 0; i < LOAD; i++) {
      const event = makeEvent("customer.subscription.created", {
        id: `sub_load_${i}`,
        customer: `cus_load_${i}`,
        status: "active",
        items: { data: [{ price: { id: "price_essential_e2e" } }] },
      });
      await stripeHandler.handleEvent(event, null);
    }

    // Verify 100 subscriptions
    let activeCount = 0;
    for (const uid of userIds) {
      const sub = engine.getSubscriptionStatus(uid);
      if (sub.plan === "ESSENTIAL" && sub.status === "ACTIVE") activeCount++;
    }
    assert(activeCount === LOAD, `${activeCount}/${LOAD} subscriptions active`);

    // 100 bus events
    for (let i = 0; i < LOAD; i++) {
      await bus.publish("SUBSCRIPTION_CREATED", {
        email: `load_${i}@e2e.com`, userId: userIds[i], plan: "ESSENTIAL",
      }, { source: "engine", userId: userIds[i] });
    }

    // Process all pending emails
    let totalProcessed = 0;
    let batch;
    do {
      batch = await emailScheduler.processPending(50);
      totalProcessed += batch.length;
    } while (batch.length > 0);

    assert(totalProcessed === LOAD, `${totalProcessed}/${LOAD} emails processed`);
    assert(emailsSent.length === LOAD, `${emailsSent.length}/${LOAD} emails sent`);

    // Verify no duplicates
    const recipients = emailsSent.map((e) => e.to);
    const uniqueRecipients = new Set(recipients);
    assert(uniqueRecipients.size === LOAD, `${uniqueRecipients.size}/${LOAD} unique recipients (no duplicates)`);

    // Verify bus events
    const { events } = busStore.queryByType("SUBSCRIPTION_CREATED", 200, 0);
    assert(events.length >= LOAD, `${events.length} SUBSCRIPTION_CREATED events in bus history`);

    // Verify stripe events
    const stripeHistory = stripeHandler.getEventHistory(200, 0);
    assert(stripeHistory.total >= LOAD, `${stripeHistory.total} stripe events in history`);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Cleanup
  // ══════════════════════════════════════════════════════════════════════════════

  engine.close();
  bus.close();
  db.close();
  fs.unlinkSync(DB_PATH);
  try { fs.unlinkSync(CODES_DB); } catch {}

  // ══════════════════════════════════════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════════════════════════════════════

  console.log("\n" + "=".repeat(60));
  console.log("\nE2E TEST SUMMARY\n");

  console.log("Scenario Results:");
  for (const [name, m] of Object.entries(metrics)) {
    const status = m.ok ? "OK" : "FAIL";
    console.log(`  ${status}  ${name}  (${m.elapsed}ms)${m.error ? " — " + m.error : ""}`);
  }

  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  const totalTime = Object.values(metrics).reduce((s, m) => s + m.elapsed, 0);
  console.log(`\nTotal time: ${totalTime}ms`);
  console.log(`Avg per scenario: ${Math.round(totalTime / Object.keys(metrics).length)}ms`);

  if (failed === 0) {
    console.log("\nAll E2E tests passed!\n");
    process.exit(0);
  } else {
    console.log(`\nFailures:\n - ${failures.join("\n - ")}\n`);
    process.exit(1);
  }
})();

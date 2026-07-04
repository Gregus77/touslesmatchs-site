#!/usr/bin/env node

// Mission 002: Subscription Engine Tests
// Run: node scripts/test_subscription_engine.js

const SubscriptionEngine = require("./subscription-engine");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// Test database (separate from production)
const TEST_DB_PATH = "/tmp/tlm_test.db";

// Clean up test db
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

console.log("🧪 Mission 002: Subscription Engine Tests\n");
console.log(`📁 Test database: ${TEST_DB_PATH}\n`);

// Initialize test database
const testDb = new Database(TEST_DB_PATH);
testDb.exec(`
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
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE subscription_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    old_plan TEXT,
    new_plan TEXT,
    old_status TEXT,
    new_status TEXT,
    reason TEXT,
    details TEXT,
    triggered_by TEXT,
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

testDb.close();

// Create engine
const engine = new SubscriptionEngine(TEST_DB_PATH);
const db = new Database(TEST_DB_PATH);

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ ${message}`);
    testsPassed++;
  } else {
    console.log(`❌ ${message}`);
    testsFailed++;
  }
}

function test(name, fn) {
  console.log(`\n📝 ${name}`);
  try {
    fn();
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    testsFailed++;
  }
}

// Test 1: Create users
test("Create test users", () => {
  db.prepare(`INSERT INTO users (email, password_hash) VALUES (?, ?)`).run("visitor@test.com", "hash1");
  db.prepare(`INSERT INTO users (email, password_hash) VALUES (?, ?)`).run("elite@test.com", "hash2");
  db.prepare(`INSERT INTO users (email, password_hash) VALUES (?, ?)`).run("essential@test.com", "hash3");
  db.prepare(`INSERT INTO users (email, password_hash) VALUES (?, ?)`).run("payperview@test.com", "hash4");

  const count = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  assert(count === 4, "Created 4 test users");
});

// Test 2: Ensure subscriptions
test("Ensure subscriptions are created", () => {
  const userId1 = db.prepare("SELECT id FROM users WHERE email = ?").get("visitor@test.com").id;
  const userId2 = db.prepare("SELECT id FROM users WHERE email = ?").get("elite@test.com").id;

  engine.ensureSubscription(userId1, "visitor@test.com");
  engine.ensureSubscription(userId2, "elite@test.com");

  const count = db.prepare("SELECT COUNT(*) as c FROM subscriptions").get().c;
  assert(count === 2, "Created 2 subscriptions");

  const sub1 = db.prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(userId1);
  assert(sub1.plan === "VISITOR", "Default plan is VISITOR");
  assert(sub1.subscription_status === "ACTIVE", "Default status is ACTIVE");
});

// Test 3: Update subscription
test("Update subscription plan and status", () => {
  const userId = db.prepare("SELECT id FROM users WHERE email = ?").get("elite@test.com").id;

  const result = engine.updateSubscription(userId, "ELITE", "ACTIVE", "upgrade", { test: true });

  assert(result.plan === "ELITE", "Plan updated to ELITE");
  assert(result.status === "ACTIVE", "Status is ACTIVE");

  const historyCount = db.prepare("SELECT COUNT(*) as c FROM subscription_history WHERE user_id = ?").get(userId).c;
  assert(historyCount > 0, "Change logged to history");
});

// Test 4: Record purchase
test("Record analysis purchase", () => {
  const userId = db.prepare("SELECT id FROM users WHERE email = ?").get("payperview@test.com").id;
  engine.ensureSubscription(userId, "payperview@test.com");

  const purchase = engine.recordAnalysisPurchase(userId, "analysis_123", "ligue1_20260704_psg_om", "charge_abc123", 100);

  assert(purchase.userId === userId, "Purchase recorded with correct user_id");
  assert(purchase.amount === 100, "Purchase amount is 100 cents (1€)");
  assert(purchase.status === "completed", "Purchase status is completed");
});

// Test 5: Get by email
test("Get subscription by email", () => {
  const sub = engine.getByEmail("elite@test.com");

  assert(sub !== null, "Subscription found by email");
  assert(sub.plan === "ELITE", "Correct plan retrieved");
  assert(sub.user_id > 0, "user_id is set");
});

// Test 6: Has access to analysis
test("Check analysis access", () => {
  const eliteUserId = db.prepare("SELECT id FROM users WHERE email = ?").get("elite@test.com").id;
  const visitorUserId = db.prepare("SELECT id FROM users WHERE email = ?").get("visitor@test.com").id;
  const payPerViewUserId = db.prepare("SELECT id FROM users WHERE email = ?").get("payperview@test.com").id;

  assert(engine.hasAccessToAnalysis(eliteUserId, "any_analysis", "ELITE") === true, "ELITE has access to any analysis");
  assert(engine.hasAccessToAnalysis(visitorUserId, "any_analysis", "VISITOR") === false, "VISITOR has no access");
  assert(engine.hasAccessToAnalysis(payPerViewUserId, "analysis_123", "PAY_PER_VIEW") === true, "PAY_PER_VIEW has access to purchased analysis");
  assert(engine.hasAccessToAnalysis(payPerViewUserId, "analysis_999", "PAY_PER_VIEW") === false, "PAY_PER_VIEW has no access to unpurchased analysis");
});

// Test 7: Get purchase history
test("Get purchase history", () => {
  const payPerViewUserId = db.prepare("SELECT id FROM users WHERE email = ?").get("payperview@test.com").id;

  const history = engine.getAnalysisPurchases(payPerViewUserId, 10, 0);

  assert(history.total === 1, "One purchase in history");
  assert(history.purchases.length === 1, "Purchase retrieved");
  assert(history.purchases[0].analysis_id === "analysis_123", "Correct analysis_id in history");
});

// Test 8: Get subscription history
test("Get subscription history", () => {
  const eliteUserId = db.prepare("SELECT id FROM users WHERE email = ?").get("elite@test.com").id;

  const history = engine.getSubscriptionHistory(eliteUserId, 10, 0);

  assert(history.total > 0, "History has entries");
  assert(history.history[0].new_plan === "ELITE" || history.history[0].new_status === "ACTIVE", "History contains subscription changes");
});

// Test 9: Subscription expiry auto-update
test("Subscription expiry handling", () => {
  const userId = db.prepare("SELECT id FROM users WHERE email = ?").get("essential@test.com").id;
  engine.ensureSubscription(userId, "essential@test.com");

  // Set end date to past
  db.prepare(`UPDATE subscriptions SET subscription_end_date = ? WHERE user_id = ?`)
    .run("2026-01-01T00:00:00Z", userId);

  const status = engine.getSubscriptionStatus(userId);
  assert(status.isExpired === true, "Subscription correctly identified as expired");
});

// Test 10: Daily limits
test("Daily analysis limits", () => {
  const essentialUserId = db.prepare("SELECT id FROM users WHERE email = ?").get("essential@test.com").id;

  engine.updateSubscription(essentialUserId, "ESSENTIAL", "ACTIVE", "test");
  const status = engine.getSubscriptionStatus(essentialUserId);

  assert(status.dailyLimit === 10, "ESSENTIAL daily limit is 10");
  assert(status.analysesToday === 0, "No analyses accessed today");
});

// Test 11: ELITE daily limits
test("ELITE tier limits", () => {
  const eliteUserId = db.prepare("SELECT id FROM users WHERE email = ?").get("elite@test.com").id;
  const status = engine.getSubscriptionStatus(eliteUserId);

  assert(status.dailyLimit === 30, "ELITE daily limit is 30");
});

// Cleanup
console.log("\n\n🧹 Cleaning up...");
engine.close();
db.close();
fs.unlinkSync(TEST_DB_PATH);

// Summary
console.log(`\n📊 TEST SUMMARY`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`📈 Total: ${testsPassed + testsFailed}`);

if (testsFailed === 0) {
  console.log(`\n🎉 All tests passed!\n`);
  process.exit(0);
} else {
  console.log(`\n⚠️ ${testsFailed} test(s) failed!\n`);
  process.exit(1);
}

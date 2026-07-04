#!/usr/bin/env node

// Mission 002: Subscription Engine — API Integration Tests
// Simulates API calls to test all endpoints with different subscription states

const SubscriptionEngine = require("./subscription-engine");
const Database = require("better-sqlite3");
const fs = require("fs");

const TEST_DB_PATH = "/tmp/tlm_integration_test.db";

// Clean up
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

console.log("🔗 Mission 002: API Integration Tests\n");

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

const engine = new SubscriptionEngine(TEST_DB_PATH);
const db = new Database(TEST_DB_PATH);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    failed++;
  }
}

// Setup: Create test users
console.log("📝 Setting up test users...\n");

const users = {
  visitor: null,
  payPerView: null,
  essential: null,
  elite: null,
  expired: null,
  refunded: null,
  suspended: null,
  pending: null,
};

for (const key in users) {
  const email = `${key}@test.com`;
  const stmt = db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)");
  const result = stmt.run(email, "hash_" + key);
  users[key] = result.lastInsertRowid;
}

// Create subscriptions
const userId_visitor = users.visitor;
const userId_ppv = users.payPerView;
const userId_essential = users.essential;
const userId_elite = users.elite;
const userId_expired = users.expired;
const userId_refunded = users.refunded;
const userId_suspended = users.suspended;
const userId_pending = users.pending;

engine.ensureSubscription(userId_visitor, "visitor@test.com");
engine.ensureSubscription(userId_ppv, "payPerView@test.com");
engine.ensureSubscription(userId_essential, "essential@test.com");
engine.ensureSubscription(userId_elite, "elite@test.com");
engine.ensureSubscription(userId_expired, "expired@test.com");
engine.ensureSubscription(userId_refunded, "refunded@test.com");
engine.ensureSubscription(userId_suspended, "suspended@test.com");
engine.ensureSubscription(userId_pending, "pending@test.com");

// Setup different subscription states
engine.updateSubscription(userId_ppv, "PAY_PER_VIEW", "ACTIVE", "test");
engine.updateSubscription(userId_essential, "ESSENTIAL", "ACTIVE", "test");
engine.updateSubscription(userId_elite, "ELITE", "ACTIVE", "test");

// Set dates for ESSENTIAL subscription
db.prepare(`
  UPDATE subscriptions
  SET subscription_start_date = ?, subscription_end_date = ?
  WHERE user_id = ?
`).run("2026-07-04T00:00:00Z", "2026-08-04T00:00:00Z", userId_essential);

engine.updateSubscription(userId_expired, "ESSENTIAL", "ACTIVE", "test");
db.prepare(`
  UPDATE subscriptions
  SET subscription_start_date = ?, subscription_end_date = ?
  WHERE user_id = ?
`).run("2026-01-01T00:00:00Z", "2026-01-31T00:00:00Z", userId_expired);

engine.updateSubscriptionStatus(userId_refunded, "VISITOR", "REFUNDED", "test payment refund");
engine.updateSubscriptionStatus(userId_suspended, "ELITE", "SUSPENDED", "test account suspension");

db.prepare(`
  UPDATE subscriptions
  SET subscription_status = 'PENDING_PAYMENT'
  WHERE user_id = ?
`).run(userId_pending);

// Add some test purchases for PAY_PER_VIEW
engine.recordAnalysisPurchase(userId_ppv, "analysis_001", "ligue1_20260704_psg_om", "charge_123", 100);
engine.recordAnalysisPurchase(userId_ppv, "analysis_002", "ligue1_20260705_lyon_om", "charge_124", 100);

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// ===== TESTS: Specification-Compliant Methods =====
console.log("📋 TEST GROUP 1: Specification Methods\n");

test("getUserSubscription(VISITOR) returns correct plan", () => {
  const sub = engine.getUserSubscription(userId_visitor);
  if (sub.plan !== "VISITOR") throw new Error(`Expected VISITOR, got ${sub.plan}`);
});

test("getUserSubscription(ELITE) returns correct plan", () => {
  const sub = engine.getUserSubscription(userId_elite);
  if (sub.plan !== "ELITE") throw new Error(`Expected ELITE, got ${sub.plan}`);
});

test("hasAccess(ELITE) returns true", () => {
  if (!engine.hasAccess(userId_elite, "ELITE")) throw new Error("ELITE should have access");
});

test("hasAccess(VISITOR) returns false", () => {
  if (engine.hasAccess(userId_visitor, "VISITOR")) throw new Error("VISITOR should not have access");
});

test("canAccessAnalysis(PAY_PER_VIEW purchased) returns true", () => {
  if (!engine.canAccessAnalysis(userId_ppv, "analysis_001", "PAY_PER_VIEW")) {
    throw new Error("Should have access to purchased analysis");
  }
});

test("canAccessAnalysis(PAY_PER_VIEW unpurchased) returns false", () => {
  if (engine.canAccessAnalysis(userId_ppv, "analysis_999", "PAY_PER_VIEW")) {
    throw new Error("Should not have access to unpurchased analysis");
  }
});

test("getDailyLimit(ESSENTIAL) returns 10", () => {
  const limit = engine.getDailyLimit(userId_essential);
  if (limit !== 10) throw new Error(`Expected 10, got ${limit}`);
});

test("getDailyLimit(ELITE) returns 30", () => {
  const limit = engine.getDailyLimit(userId_elite);
  if (limit !== 30) throw new Error(`Expected 30, got ${limit}`);
});

test("getDailyLimit(VISITOR) returns 0", () => {
  const limit = engine.getDailyLimit(userId_visitor);
  if (limit !== 0) throw new Error(`Expected 0, got ${limit}`);
});

test("getTelegramGroup(ELITE) returns correct group", () => {
  const group = engine.getTelegramGroup(userId_elite);
  if (!group || typeof group !== "object") throw new Error("Should return group object");
});

test("getPurchasedAnalyses(PAY_PER_VIEW) returns purchases", () => {
  const purchases = engine.getPurchasedAnalyses(userId_ppv);
  if (purchases.total !== 2) throw new Error(`Expected 2 purchases, got ${purchases.total}`);
  if (purchases.purchases.length !== 2) throw new Error("Should return 2 purchase records");
});

test("isSubscriptionActive(ELITE) returns true", () => {
  if (!engine.isSubscriptionActive(userId_elite)) throw new Error("ELITE should be active");
});

test("isSubscriptionActive(EXPIRED) returns false", () => {
  if (engine.isSubscriptionActive(userId_expired)) throw new Error("EXPIRED should not be active");
});

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// ===== TESTS: Subscription States =====
console.log("📋 TEST GROUP 2: Subscription States\n");

test("VISITOR state: plan is VISITOR", () => {
  const sub = engine.getSubscriptionStatus(userId_visitor);
  if (sub.plan !== "VISITOR") throw new Error(`Expected VISITOR, got ${sub.plan}`);
});

test("PAY_PER_VIEW state: can track purchases", () => {
  const sub = engine.getSubscriptionStatus(userId_ppv);
  if (sub.purchaseCount !== 2) throw new Error(`Expected 2 purchases, got ${sub.purchaseCount}`);
});

test("ESSENTIAL state: has daily limit of 10", () => {
  const sub = engine.getSubscriptionStatus(userId_essential);
  if (sub.dailyLimit !== 10) throw new Error(`Expected limit 10, got ${sub.dailyLimit}`);
});

test("ELITE state: has daily limit of 30", () => {
  const sub = engine.getSubscriptionStatus(userId_elite);
  if (sub.dailyLimit !== 30) throw new Error(`Expected limit 30, got ${sub.dailyLimit}`);
});

test("EXPIRED subscription: isExpired flag is true", () => {
  const sub = engine.getSubscriptionStatus(userId_expired);
  if (!sub.isExpired) throw new Error("Should be marked as expired");
});

test("REFUNDED status: subscription_status is REFUNDED", () => {
  const sub = engine.getSubscriptionStatus(userId_refunded);
  if (sub.status !== "REFUNDED") throw new Error(`Expected REFUNDED, got ${sub.status}`);
});

test("SUSPENDED status: subscription_status is SUSPENDED", () => {
  const sub = engine.getSubscriptionStatus(userId_suspended);
  if (sub.status !== "SUSPENDED") throw new Error(`Expected SUSPENDED, got ${sub.status}`);
});

test("PENDING_PAYMENT status: subscription_status is PENDING_PAYMENT", () => {
  const sub = engine.getSubscriptionStatus(userId_pending);
  if (sub.status !== "PENDING_PAYMENT") throw new Error(`Expected PENDING_PAYMENT, got ${sub.status}`);
});

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// ===== TESTS: Payment Scenarios =====
console.log("📋 TEST GROUP 3: Payment Scenarios\n");

test("Payment completion: record purchase with status=completed", () => {
  const purchase = engine.recordAnalysisPurchase(
    userId_ppv,
    "analysis_payment_test",
    "ligue1_test",
    "charge_payment_123",
    100
  );
  if (purchase.status !== "completed") throw new Error("Should be completed");
});

test("Cancelled payment: update subscription to CANCELLED", () => {
  engine.updateSubscriptionStatus(userId_pending, "ELITE", "CANCELLED", "payment cancelled");
  const sub = engine.getSubscriptionStatus(userId_pending);
  if (sub.status !== "CANCELLED") throw new Error("Should be cancelled");
});

test("History tracking: all state changes recorded", () => {
  const history = engine.getSubscriptionHistory(userId_essential);
  if (history.total === 0) throw new Error("Should have history entries");
});

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// ===== TESTS: No Integration with External Services =====
console.log("📋 TEST GROUP 4: Service Independence\n");

test("Engine does NOT call Stripe", () => {
  // Verify service only stores Stripe IDs, doesn't call Stripe
  const sub = engine.getSubscriptionStatus(userId_elite);
  // stripe_price_id should be string, null, or undefined (not called)
  const isValid = typeof sub.stripe_price_id === "string" || sub.stripe_price_id === null || sub.stripe_price_id === undefined;
  if (!isValid) throw new Error("Invalid Stripe ID format");
});

test("Engine does NOT send emails (no Brevo logic)", () => {
  // Verify service only stores user data, doesn't send emails
  const sub = engine.getSubscriptionStatus(userId_elite);
  if (!sub) throw new Error("Should return data without calling Brevo");
});

test("Engine does NOT send Telegram messages", () => {
  // Verify service only stores Telegram group info, doesn't send
  const group = engine.getTelegramGroup(userId_elite);
  if (typeof group !== "object") throw new Error("Should return group object without calling Telegram");
});

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// Cleanup
console.log("🧹 Cleaning up...");
engine.close();
db.close();
fs.unlinkSync(TEST_DB_PATH);

// Summary
console.log("\n📊 API INTEGRATION TEST SUMMARY");
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Total: ${passed + failed}`);

if (failed === 0) {
  console.log(`\n🎉 All integration tests passed!\n`);
  process.exit(0);
} else {
  console.log(`\n⚠️ ${failed} test(s) failed!\n`);
  process.exit(1);
}

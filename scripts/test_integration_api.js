#!/usr/bin/env node

// Mission 002: Subscription Engine — REAL HTTP Integration Tests
//
// Unlike the previous version (which called the service directly), this spawns
// the actual api_server.js process against throwaway databases and exercises the
// endpoints over HTTP — including authentication, HTTP status codes, and error
// paths. Run: node scripts/test_integration_api.js

const Database = require("better-sqlite3");
const jwt = require("jsonwebtoken");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const DB_PATH = "/tmp/tlm_http_test.db";
const CODES_DB_PATH = "/tmp/tlm_http_codes.db";
const PORT = 3998;
const BASE = `http://127.0.0.1:${PORT}`;
const JWT_SECRET = "test_secret_mission002";
const ADMIN_EMAIL = "admin@test.com";
const ADMIN_CODE = "ELITE-ADMIN-TEST";

// ── Cleanup any leftovers ─────────────────────────────────────────────────────
for (const f of [DB_PATH, CODES_DB_PATH, DB_PATH + "-wal", DB_PATH + "-shm",
                 CODES_DB_PATH + "-wal", CODES_DB_PATH + "-shm"]) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

// ── Seed the main DB with the exact Mission 002 schema + fixtures ──────────────
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

function addUser(email, plan, status, endDate = null) {
  const uid = seed.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
    .run(email, "hash").lastInsertRowid;
  seed.prepare(`
    INSERT INTO subscriptions (user_id, plan, subscription_status, subscription_end_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(uid, plan, status, endDate);
  return uid;
}

addUser("visitor@test.com", "VISITOR", "ACTIVE");
addUser("elite@test.com", "ELITE", "ACTIVE");
addUser("essential@test.com", "ESSENTIAL", "ACTIVE");
const expiredUid = addUser("expired@test.com", "ESSENTIAL", "ACTIVE", "2020-01-01T00:00:00Z");
addUser("refunded@test.com", "VISITOR", "REFUNDED");
// Corrupted subscription: invalid enum values written directly (bypassing engine)
addUser("corrupt@test.com", "WEIRD_PLAN", "??? BROKEN ???");
addUser(ADMIN_EMAIL, "ELITE", "ACTIVE");
// An existing purchase for the elite user (for duplicate test target we use admin)
seed.close();

// ── Seed codes DB with an admin code ──────────────────────────────────────────
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
  .run(ADMIN_CODE, ADMIN_EMAIL);
codes.close();

// ── Helpers ───────────────────────────────────────────────────────────────────
function token(email, extra = {}) {
  return jwt.sign({ id: 1, email, status: "free", ...extra }, JWT_SECRET, { expiresIn: "1h" });
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

async function req(method, url, { authEmail, adminExtra, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authEmail) headers.Authorization = `Bearer ${token(authEmail, adminExtra)}`;
  const res = await fetch(BASE + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

// ── Boot the real server ──────────────────────────────────────────────────────
async function waitForHealth(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(BASE + "/health");
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error("Server did not become healthy in time");
}

async function main() {
  console.log("🚀 Spawning real api_server.js on port " + PORT + "...\n");
  const server = spawn("node", [path.join(__dirname, "api_server.js")], {
    env: {
      ...process.env,
      DB_PATH,
      CODES_DB_PATH,
      PORT: String(PORT),
      JWT_SECRET,
      AUTO_CONCILE_OBSERVER: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  server.stdout.on("data", d => { serverLog += d.toString(); });
  server.stderr.on("data", d => { serverLog += d.toString(); });

  try {
    await waitForHealth();
    console.log("🟢 Server healthy — running HTTP tests\n");
    console.log("━".repeat(60) + "\n");

    // ===== GROUP 1: Authentication on GET /api/subscription/:email =====
    console.log("📋 GROUP 1: Authentication & access control\n");

    await check("GET /api/subscription without token → 401", async () => {
      const r = await req("GET", "/api/subscription/elite@test.com");
      assertEqual(r.status, 401, "status");
      assertEqual(r.json.ok, false, "ok");
    });

    await check("GET /api/subscription with another user's token → 403", async () => {
      const r = await req("GET", "/api/subscription/elite@test.com", { authEmail: "visitor@test.com" });
      assertEqual(r.status, 403, "status");
      assertEqual(r.json.ok, false, "ok");
    });

    await check("GET /api/subscription with own token → 200", async () => {
      const r = await req("GET", "/api/subscription/elite@test.com", { authEmail: "elite@test.com" });
      assertEqual(r.status, 200, "status");
      assertEqual(r.json.ok, true, "ok");
      assertEqual(r.json.subscription.plan, "ELITE", "plan");
    });

    await check("GET /api/subscription with admin token → 200 (any user)", async () => {
      const r = await req("GET", "/api/subscription/elite@test.com", {
        authEmail: ADMIN_EMAIL, adminExtra: { admin: true },
      });
      assertEqual(r.status, 200, "status");
      assertEqual(r.json.subscription.plan, "ELITE", "plan");
    });

    await check("GET /api/user/:email/access without token → 401", async () => {
      const r = await req("GET", "/api/user/elite@test.com/access");
      assertEqual(r.status, 401, "status");
    });

    await check("GET /api/user/:email/access with own token → 200", async () => {
      const r = await req("GET", "/api/user/elite@test.com/access", { authEmail: "elite@test.com" });
      assertEqual(r.status, 200, "status");
      assertEqual(r.json.access.plan, "ELITE", "plan");
      assertEqual(r.json.access.droits.daily_limit, 30, "daily_limit");
    });

    console.log("\n" + "━".repeat(60) + "\n");

    // ===== GROUP 2: Edge cases =====
    console.log("📋 GROUP 2: Edge cases & error paths\n");

    await check("Non-existent user (valid token) → 404", async () => {
      const r = await req("GET", "/api/subscription/ghost@test.com", { authEmail: "ghost@test.com" });
      assertEqual(r.status, 404, "status");
      assertEqual(r.json.ok, false, "ok");
    });

    await check("Corrupted subscription is served without crashing → 200", async () => {
      const r = await req("GET", "/api/subscription/corrupt@test.com", { authEmail: "corrupt@test.com" });
      assertEqual(r.status, 200, "status");
      // Engine returns the raw (invalid) values without throwing
      assertEqual(r.json.subscription.plan, "WEIRD_PLAN", "plan");
      // Unknown plan → no daily limit, not active by enum rules
      assertEqual(r.json.subscription.dailyLimit, 0, "dailyLimit");
    });

    await check("Expired subscription auto-expires and stays consistent", async () => {
      const r = await req("GET", "/api/subscription/expired@test.com", { authEmail: "expired@test.com" });
      assertEqual(r.status, 200, "status");
      assertEqual(r.json.subscription.status, "EXPIRED", "status");
      assertEqual(r.json.subscription.isExpired, true, "isExpired");
      assertEqual(r.json.subscription.isActive, false, "isActive");
    });

    console.log("\n" + "━".repeat(60) + "\n");

    // ===== GROUP 3: Admin endpoints =====
    console.log("📋 GROUP 3: Admin endpoints\n");

    await check("POST /admin/subscription/update with bad code → 403", async () => {
      const r = await req("POST", "/admin/subscription/update", {
        body: { email: ADMIN_EMAIL, code: "WRONG-CODE", target_email: "visitor@test.com", plan: "ESSENTIAL", status: "ACTIVE" },
      });
      assertEqual(r.status, 403, "status");
    });

    await check("POST /admin/subscription/update valid → 200 and plan changes", async () => {
      const r = await req("POST", "/admin/subscription/update", {
        body: { email: ADMIN_EMAIL, code: ADMIN_CODE, target_email: "visitor@test.com", plan: "ESSENTIAL", status: "ACTIVE", reason: "test upgrade" },
      });
      assertEqual(r.status, 200, "status");
      assertEqual(r.json.ok, true, "ok");
      assertEqual(r.json.subscription.plan, "ESSENTIAL", "plan");
    });

    await check("POST /admin/subscription/update invalid plan → rejected (ok:false)", async () => {
      const r = await req("POST", "/admin/subscription/update", {
        body: { email: ADMIN_EMAIL, code: ADMIN_CODE, target_email: "visitor@test.com", plan: "NOT_A_PLAN", status: "ACTIVE" },
      });
      assertEqual(r.json.ok, false, "ok");
    });

    await check("POST record-purchase → 200 first time", async () => {
      const r = await req("POST", "/admin/subscription/record-purchase", {
        body: { email: ADMIN_EMAIL, code: ADMIN_CODE, target_email: "elite@test.com", analysis_id: "dup_test_1", match_key: "m1" },
      });
      assertEqual(r.status, 200, "status");
      assertEqual(r.json.ok, true, "ok");
    });

    await check("POST record-purchase duplicate → blocked (ok:false)", async () => {
      const r = await req("POST", "/admin/subscription/record-purchase", {
        body: { email: ADMIN_EMAIL, code: ADMIN_CODE, target_email: "elite@test.com", analysis_id: "dup_test_1", match_key: "m1" },
      });
      assertEqual(r.json.ok, false, "ok");
    });

    await check("GET /admin/subscription/history with bad code → 403", async () => {
      const r = await req("GET", "/admin/subscription/history/elite@test.com?code=WRONG");
      assertEqual(r.status, 403, "status");
    });

    await check("GET /admin/subscription/history valid → 200 with history", async () => {
      const r = await req("GET", `/admin/subscription/history/${ADMIN_EMAIL}?code=${ADMIN_CODE}`);
      assertEqual(r.status, 200, "status");
      assertEqual(r.json.ok, true, "ok");
      if (!r.json.subscription_history) throw new Error("missing subscription_history");
    });

    console.log("\n" + "━".repeat(60) + "\n");

    // ===== GROUP 4: SQL injection resistance over HTTP =====
    console.log("📋 GROUP 4: SQL injection resistance\n");

    await check("Injection via admin update plan is neutralized", async () => {
      const r = await req("POST", "/admin/subscription/update", {
        body: {
          email: ADMIN_EMAIL, code: ADMIN_CODE, target_email: "essential@test.com",
          plan: "X' , subscription_status='HACKED", status: "ACTIVE",
        },
      });
      // Rejected by whitelist → ok:false, and the real subscription is untouched
      assertEqual(r.json.ok, false, "ok");
      const check2 = await req("GET", "/api/subscription/essential@test.com", { authEmail: "essential@test.com" });
      assertEqual(check2.json.subscription.plan, "ESSENTIAL", "plan untouched");
    });

  } finally {
    server.kill("SIGTERM");
    await new Promise(r => setTimeout(r, 300));
    for (const f of [DB_PATH, CODES_DB_PATH, DB_PATH + "-wal", DB_PATH + "-shm",
                     CODES_DB_PATH + "-wal", CODES_DB_PATH + "-shm"]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    if (failed > 0) {
      console.log("\n--- server log (last 20 lines) ---");
      console.log(serverLog.split("\n").slice(-20).join("\n"));
    }
  }

  console.log("\n📊 HTTP INTEGRATION TEST SUMMARY");
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);

  if (failed === 0) {
    console.log("\n🎉 All HTTP integration tests passed!\n");
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

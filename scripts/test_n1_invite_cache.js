#!/usr/bin/env node

// Tests N1 — InviteLinkManager cache fix
// Validates: memberLimit:1 never cached, composite key, no cache poisoning
// Run: node scripts/test_n1_invite_cache.js

const Database = require("better-sqlite3");
const fs = require("fs");
const { EventBus, EventStore } = require("./event-bus");
const {
  TelegramBotClient,
  TelegramEventStore,
  InviteLinkManager,
  TelegramSubscriber,
  wireTelegramSubscribers,
} = require("./telegram-subscriber");

const DB_PATH = "/tmp/tlm_n1_test.db";
for (const f of [DB_PATH, DB_PATH + "-wal", DB_PATH + "-shm"]) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

console.log("Test N1 — InviteLinkManager cache fix\n");

let passed = 0, failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) { passed++; }
  else { console.log(`    FAIL  ${msg}`); failed++; failures.push(msg); }
}

async function test(name, fn) {
  console.log(`\n  TEST: ${name}`);
  try {
    await fn();
    console.log(`    OK`);
  } catch (e) {
    console.log(`    ERROR: ${e.message}`);
    failed++;
    failures.push(`${name}: ${e.message}`);
  }
}

// ── Mock setup ──────────────────────────────────────────────────────────────

const apiCalls = [];
let linkCounter = 0;
let apiShouldFail = false;

function resetMocks() {
  apiCalls.length = 0;
  linkCounter = 0;
  apiShouldFail = false;
}

const mockHttpCall = async (method, params) => {
  apiCalls.push({ method, params });
  if (apiShouldFail) throw new Error("ETELEGRAM_400: Bad Request: chat not found");
  if (method === "createChatInviteLink") {
    linkCounter++;
    return {
      ok: true,
      result: { invite_link: `https://t.me/+link_${linkCounter}` },
    };
  }
  return { ok: true, result: true };
};

const client = new TelegramBotClient({ token: "test-token", httpCall: mockHttpCall });

// ══════════════════════════════════════════════════════════════════════════════

(async () => {

  // ── Criterion 1: memberLimit:1 never uses cache ───────────────────────────

  await test("C1a. memberLimit:1 — two calls produce two different links", async () => {
    resetMocks();
    const mgr = new InviteLinkManager({ client, memberLimit: 1 });

    const r1 = await mgr.getOrCreate("-100group");
    const r2 = await mgr.getOrCreate("-100group");

    assert(r1.ok === true, "First link OK");
    assert(r2.ok === true, "Second link OK");
    assert(r1.link !== r2.link, `Links differ: ${r1.link} vs ${r2.link}`);
    assert(!r1.cached, "First not cached");
    assert(!r2.cached, "Second not cached");

    const createCalls = apiCalls.filter((c) => c.method === "createChatInviteLink");
    assert(createCalls.length === 2, `2 API calls made, got ${createCalls.length}`);
  });

  await test("C1b. memberLimit:1 via opts — bypasses cache", async () => {
    resetMocks();
    const mgr = new InviteLinkManager({ client, memberLimit: 10 });

    const r1 = await mgr.getOrCreate("-100group", { memberLimit: 1 });
    const r2 = await mgr.getOrCreate("-100group", { memberLimit: 1 });

    assert(r1.link !== r2.link, "Per-call memberLimit:1 produces unique links");
    assert(!r1.cached, "Not cached");
    assert(!r2.cached, "Not cached");
  });

  // ── Criterion 2: incompatible requests don't share cache ──────────────────

  await test("C2. Different memberLimits on same chat → different links, no cross-cache", async () => {
    resetMocks();
    const mgr = new InviteLinkManager({ client, memberLimit: 10 });

    const r10 = await mgr.getOrCreate("-100group", { memberLimit: 10 });
    const r50 = await mgr.getOrCreate("-100group", { memberLimit: 50 });

    assert(r10.link !== r50.link, "Different limits produce different links");

    const r10b = await mgr.getOrCreate("-100group", { memberLimit: 10 });
    assert(r10b.cached === true, "memberLimit:10 served from cache");
    assert(r10b.link === r10.link, "Same link for same config");

    const r50b = await mgr.getOrCreate("-100group", { memberLimit: 50 });
    assert(r50b.cached === true, "memberLimit:50 served from cache");
    assert(r50b.link === r50.link, "Same link for same config");
  });

  // ── Criterion 3: identical requests still use cache ───────────────────────

  await test("C3. Identical requests with memberLimit>1 use cache", async () => {
    resetMocks();
    const mgr = new InviteLinkManager({ client, memberLimit: 20 });

    const r1 = await mgr.getOrCreate("-100group");
    const callsAfter = apiCalls.length;

    const r2 = await mgr.getOrCreate("-100group");
    assert(r2.cached === true, "Second call is cached");
    assert(r2.link === r1.link, "Same link returned");
    assert(apiCalls.length === callsAfter, "No extra API call");
  });

  // ── Criterion 4: errors don't poison the cache ────────────────────────────

  await test("C4a. API error → not cached, next call retries", async () => {
    resetMocks();
    const mgr = new InviteLinkManager({ client, memberLimit: 10 });

    apiShouldFail = true;
    const r1 = await mgr.getOrCreate("-100group");
    assert(r1.ok === false, "First call fails");

    apiShouldFail = false;
    const r2 = await mgr.getOrCreate("-100group");
    assert(r2.ok === true, "Second call succeeds after error");
    assert(r2.link !== undefined, "Link returned");
    assert(!r2.cached, "Not from cache (cache was not poisoned)");
  });

  await test("C4b. Error on memberLimit:1 → no side effect on cache", async () => {
    resetMocks();
    const mgr = new InviteLinkManager({ client, memberLimit: 10 });

    const rCached = await mgr.getOrCreate("-100group", { memberLimit: 10 });
    assert(rCached.ok === true, "Initial cache populated");

    apiShouldFail = true;
    const rFail = await mgr.getOrCreate("-100group", { memberLimit: 1 });
    assert(rFail.ok === false, "memberLimit:1 fails");

    apiShouldFail = false;
    const rStillCached = await mgr.getOrCreate("-100group", { memberLimit: 10 });
    assert(rStillCached.cached === true, "memberLimit:10 cache untouched by failed memberLimit:1");
    assert(rStillCached.link === rCached.link, "Same cached link");
  });

  // ── Criterion 5: invalidation works with composite keys ──────────────────

  await test("C5. invalidate(chatId) clears all limits for that chat", async () => {
    resetMocks();
    const mgr = new InviteLinkManager({ client, memberLimit: 10 });

    await mgr.getOrCreate("-100a", { memberLimit: 10 });
    await mgr.getOrCreate("-100a", { memberLimit: 50 });
    await mgr.getOrCreate("-100b", { memberLimit: 10 });

    mgr.invalidate("-100a");

    const ra10 = await mgr.getOrCreate("-100a", { memberLimit: 10 });
    assert(!ra10.cached, "Chat A limit:10 invalidated");

    const ra50 = await mgr.getOrCreate("-100a", { memberLimit: 50 });
    assert(!ra50.cached, "Chat A limit:50 invalidated");

    const rb10 = await mgr.getOrCreate("-100b", { memberLimit: 10 });
    assert(rb10.cached === true, "Chat B untouched");
  });

  // ── Criterion 6: concurrent memberLimit:1 calls → each gets unique link ──

  await test("C6. 100 concurrent memberLimit:1 calls → 100 unique links, 100 API calls", async () => {
    resetMocks();
    const mgr = new InviteLinkManager({ client, memberLimit: 1 });

    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(mgr.getOrCreate("-100load"));
    }
    const results = await Promise.all(promises);

    const links = new Set(results.map((r) => r.link));
    assert(links.size === 100, `100 unique links, got ${links.size}`);

    const createCalls = apiCalls.filter((c) => c.method === "createChatInviteLink");
    assert(createCalls.length === 100, `100 API calls, got ${createCalls.length}`);
  });

  // ── Criterion 7: concurrent memberLimit>1 calls → still coalesced ────────

  await test("C7. 100 concurrent memberLimit:10 calls → coalesced to 1 API call", async () => {
    resetMocks();
    const mgr = new InviteLinkManager({ client, memberLimit: 10 });

    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(mgr.getOrCreate("-100load"));
    }
    const results = await Promise.all(promises);

    const links = new Set(results.map((r) => r.link));
    assert(links.size === 1, `1 unique link (coalesced), got ${links.size}`);

    const createCalls = apiCalls.filter((c) => c.method === "createChatInviteLink");
    assert(createCalls.length === 1, `1 API call (coalesced), got ${createCalls.length}`);
  });

  // ── Full chain: TelegramSubscriber + InviteLinkManager memberLimit:1 ─────

  await test("C8. Full chain: 3 users subscribe → 3 unique invite links", async () => {
    resetMocks();
    const db = Database(DB_PATH);
    db.pragma("journal_mode = WAL");

    const ENV = {
      TELEGRAM_GROUP_ESSENTIAL: "-100essential",
    };

    const store = new TelegramEventStore(db);
    const mgr = new InviteLinkManager({ client, memberLimit: 1 });
    const sub = new TelegramSubscriber({
      client, store, inviteManager: mgr, env: ENV,
      resolveTelegramUserId: async (evt) => evt.payload.telegramUserId || null,
    });

    const links = [];
    for (let i = 0; i < 3; i++) {
      const envelope = {
        id: `bus_test_${i}`,
        type: "SUBSCRIPTION_CREATED",
        payload: { email: `user${i}@test.com`, userId: i, plan: "ESSENTIAL", telegramUserId: `tg_${i}` },
        meta: { source: "test" },
      };
      const result = await sub.handleSubscriptionCreated(envelope);
      links.push(result.inviteLink);
    }

    const uniqueLinks = new Set(links);
    assert(uniqueLinks.size === 3, `3 unique links for 3 users, got ${uniqueLinks.size}`);

    const { events } = store.getHistory(100, 0);
    const invites = events.filter((e) => e.action === "invite" && e.result === "success");
    assert(invites.length === 3, `3 successful invites logged, got ${invites.length}`);
  });

  // ══════════════════════════════════════════════════════════════════════════════

  console.log("\n" + "=".repeat(60));
  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(` - ${f}`);
    process.exit(1);
  } else {
    console.log("\nAll N1 tests passed!");
    process.exit(0);
  }
})();

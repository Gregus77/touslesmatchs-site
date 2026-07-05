#!/usr/bin/env node

// Mission 006: Telegram Subscriber Tests
// Run: node scripts/test_telegram_subscriber.js

const Database = require("better-sqlite3");
const fs = require("fs");
const { EventBus, EventStore, EVENT_TYPES } = require("./event-bus");
const {
  TelegramBotClient,
  TelegramEventStore,
  InviteLinkManager,
  TelegramSubscriber,
  PLAN_GROUPS,
  PLAN_HIERARCHY,
  EVENT_HANDLERS,
  getGroupChatId,
  getAllGroupChatIds,
  wireTelegramSubscribers,
} = require("./telegram-subscriber");

const DB_PATH = "/tmp/tlm_tg_test.db";
for (const f of [DB_PATH, DB_PATH + "-wal", DB_PATH + "-shm"]) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

console.log("Mission 006: Telegram Subscriber Tests\n");

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
    console.log(`    ${e.stack}`);
    failed++;
    failures.push(`${name}: ${e.message}`);
  }
}

// ── Setup ───────────────────────────────────────────────────────────────────

const db = Database(DB_PATH);
db.pragma("journal_mode = WAL");

const ENV = {
  TELEGRAM_GROUP_PAY_PER_VIEW: "-1001234500001",
  TELEGRAM_GROUP_ESSENTIAL: "-1001234500002",
  TELEGRAM_GROUP_ELITE: "-1001234500003",
};

const apiCalls = [];
let linkCounter = 0;
let apiShouldFail = false;
let apiFailError = null;
let apiDelay = 0;
let memberStatuses = {};

function resetMocks() {
  apiCalls.length = 0;
  linkCounter = 0;
  apiShouldFail = false;
  apiFailError = null;
  apiDelay = 0;
  memberStatuses = {};
}

const mockHttpCall = async (method, params) => {
  apiCalls.push({ method, params, ts: Date.now() });

  if (apiDelay > 0) await new Promise((r) => setTimeout(r, apiDelay));

  if (apiShouldFail) {
    const err = apiFailError || "Telegram API error";
    throw new Error(err);
  }

  if (method === "createChatInviteLink") {
    linkCounter++;
    return {
      ok: true,
      result: { invite_link: `https://t.me/+invite_${linkCounter}_${params.chat_id}` },
    };
  }
  if (method === "banChatMember") {
    const key = `${params.chat_id}_${params.user_id}`;
    if (memberStatuses[key] === "not_found") {
      throw new Error("ETELEGRAM_400: Bad Request: user not found");
    }
    memberStatuses[key] = "banned";
    return { ok: true, result: true };
  }
  if (method === "unbanChatMember") {
    const key = `${params.chat_id}_${params.user_id}`;
    delete memberStatuses[key];
    return { ok: true, result: true };
  }
  if (method === "getChatMember") {
    const key = `${params.chat_id}_${params.user_id}`;
    return {
      ok: true,
      result: { status: memberStatuses[key] || "left", user: { id: params.user_id } },
    };
  }
  return { ok: true, result: true };
};

function makeEnvelope(eventType, payload, meta = {}) {
  return {
    id: `bus_${eventType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: eventType,
    payload,
    meta: { source: "test", ...meta },
    ts: new Date().toISOString(),
  };
}

const client = new TelegramBotClient({ token: "test-bot-token", httpCall: mockHttpCall });
const store = new TelegramEventStore(db);
const inviteManager = new InviteLinkManager({
  client,
  expireSeconds: 3600,
  memberLimit: 1,
});

const subscriber = new TelegramSubscriber({
  client,
  store,
  inviteManager,
  env: ENV,
  resolveTelegramUserId: async (evt) => evt.payload.telegramUserId || null,
});

// Bus setup
const busStore = new EventStore(db);
const bus = new EventBus({ store: busStore });

// ══════════════════════════════════════════════════════════════════════════════

(async () => {

  // ── UNIT TESTS ──────────────────────────────────────────────────────────────

  await scenario("U1. Plan → Group mapping", async () => {
    assert(getGroupChatId("ESSENTIAL", ENV) === "-1001234500002", "ESSENTIAL maps to correct chat_id");
    assert(getGroupChatId("ELITE", ENV) === "-1001234500003", "ELITE maps to correct chat_id");
    assert(getGroupChatId("PAY_PER_VIEW", ENV) === "-1001234500001", "PAY_PER_VIEW maps to correct chat_id");
    assert(getGroupChatId("UNKNOWN", ENV) === null, "Unknown plan returns null");
    assert(getGroupChatId("ESSENTIAL", {}) === null, "Missing env returns null");

    const all = getAllGroupChatIds(ENV);
    assert(all.length === 3, "3 groups configured");
    assert(all[0].plan === "PAY_PER_VIEW", "First is PAY_PER_VIEW");
    assert(all[2].plan === "ELITE", "Last is ELITE");
  });

  await scenario("U2. TelegramBotClient without token", async () => {
    const noTokenClient = new TelegramBotClient({ token: "" });
    const result = await noTokenClient.call("sendMessage", { chat_id: "123", text: "test" });
    assert(result.ok === false, "Fails without token");
    assert(result.skipped === true, "Marked as skipped");
  });

  await scenario("U3. InviteLinkManager caching", async () => {
    resetMocks();
    const mgr = new InviteLinkManager({ client, expireSeconds: 3600, memberLimit: 1 });

    const r1 = await mgr.getOrCreate("-100test");
    assert(r1.ok === true, "First link created");
    assert(r1.link.includes("invite_"), "Link contains invite");
    assert(!r1.cached, "First call not cached");

    const callsBefore = apiCalls.length;
    const r2 = await mgr.getOrCreate("-100test");
    assert(r2.ok === true, "Cached link returned");
    assert(r2.cached === true, "Marked as cached");
    assert(apiCalls.length === callsBefore, "No API call for cached link");
    assert(r2.link === r1.link, "Same link returned");

    mgr.invalidate("-100test");
    const r3 = await mgr.getOrCreate("-100test");
    assert(!r3.cached, "After invalidation, new link created");
    assert(r3.link !== r1.link, "Different link after invalidation");
  });

  await scenario("U4. TelegramEventStore CRUD", async () => {
    resetMocks();
    store.log({
      busEventId: "bus_test_1", userId: 42, email: "test@e2e.com",
      telegramUserId: "tg_42", groupPlan: "ESSENTIAL", chatId: "-100",
      action: "invite", result: "success", inviteLink: "https://t.me/+test",
    });

    const { events, total } = store.getHistory(10, 0);
    assert(total >= 1, "At least 1 event in history");
    const found = events.find((e) => e.bus_event_id === "bus_test_1");
    assert(found !== undefined, "Event found by bus_event_id");
    assert(found.action === "invite", "Action is invite");
    assert(found.result === "success", "Result is success");
    assert(found.invite_link === "https://t.me/+test", "Invite link stored");

    const userHistory = store.getUserHistory(42, 10);
    assert(userHistory.length >= 1, "User history has events");
  });

  // ── INTEGRATION: INVITATION ─────────────────────────────────────────────────

  await scenario("1. Invitation: SUBSCRIPTION_CREATED → invite to group", async () => {
    resetMocks();
    const envelope = makeEnvelope("SUBSCRIPTION_CREATED", {
      email: "alice@test.com", userId: 1, plan: "ESSENTIAL",
      telegramUserId: "tg_alice",
    });

    const result = await subscriber.handleSubscriptionCreated(envelope);
    assert(result.result === "success", "Invite succeeded");
    assert(result.inviteLink.includes("invite_"), "Invite link generated");
    assert(result.groupPlan === "ESSENTIAL", "Group is ESSENTIAL");
    assert(result.chatId === ENV.TELEGRAM_GROUP_ESSENTIAL, "Correct chat_id");

    const calls = apiCalls.filter((c) => c.method === "createChatInviteLink");
    assert(calls.length === 1, "1 API call to create invite link");
    assert(calls[0].params.chat_id === ENV.TELEGRAM_GROUP_ESSENTIAL, "API called with correct chat_id");
  });

  // ── INTEGRATION: MOVE ───────────────────────────────────────────────────────

  await scenario("2. Move: SUBSCRIPTION_UPDATED → remove old + invite new", async () => {
    resetMocks();
    inviteManager.invalidateAll();
    const envelope = makeEnvelope("SUBSCRIPTION_UPDATED", {
      email: "bob@test.com", userId: 2, plan: "ELITE", oldPlan: "ESSENTIAL",
      telegramUserId: "tg_bob",
    });

    const results = await subscriber.handleSubscriptionUpdated(envelope);
    assert(Array.isArray(results), "Returns array of results");
    assert(results.length === 2, "2 actions: remove + invite");

    const removeResult = results[0];
    assert(removeResult.action === "remove", "First action is remove");
    assert(removeResult.groupPlan === "ESSENTIAL", "Removed from ESSENTIAL");
    assert(removeResult.result === "success", "Remove succeeded");

    const inviteResult = results[1];
    assert(inviteResult.action === "invite", "Second action is invite");
    assert(inviteResult.groupPlan === "ELITE", "Invited to ELITE");
    assert(inviteResult.result === "success", "Invite succeeded");

    const banCalls = apiCalls.filter((c) => c.method === "banChatMember");
    assert(banCalls.length === 1, "1 ban call");
    assert(banCalls[0].params.chat_id === ENV.TELEGRAM_GROUP_ESSENTIAL, "Ban from ESSENTIAL group");

    const unbanCalls = apiCalls.filter((c) => c.method === "unbanChatMember");
    assert(unbanCalls.length === 1, "1 unban call after removal");
  });

  // ── INTEGRATION: REMOVE (CANCELLATION) ────────────────────────────────────

  await scenario("3. Remove: SUBSCRIPTION_CANCELLED → remove from group", async () => {
    resetMocks();
    const envelope = makeEnvelope("SUBSCRIPTION_CANCELLED", {
      email: "charlie@test.com", userId: 3, plan: "ELITE",
      telegramUserId: "tg_charlie",
    });

    const result = await subscriber.handleSubscriptionCancelled(envelope);
    assert(result.action === "remove", "Action is remove");
    assert(result.result === "success", "Remove succeeded");
    assert(result.groupPlan === "ELITE", "Removed from ELITE");
  });

  // ── INTEGRATION: REFUND ───────────────────────────────────────────────────

  await scenario("4. Refund: PAYMENT_REFUNDED → remove from group", async () => {
    resetMocks();
    const envelope = makeEnvelope("PAYMENT_REFUNDED", {
      email: "diana@test.com", userId: 4, plan: "ESSENTIAL",
      telegramUserId: "tg_diana",
    });

    const result = await subscriber.handlePaymentRefunded(envelope);
    assert(result.action === "remove", "Action is remove");
    assert(result.result === "success", "Remove succeeded");
    assert(result.groupPlan === "ESSENTIAL", "Removed from ESSENTIAL");
  });

  // ── INTEGRATION: EXPIRATION ───────────────────────────────────────────────

  await scenario("5. Expiration: SUBSCRIPTION_EXPIRED → remove from group", async () => {
    resetMocks();
    const envelope = makeEnvelope("SUBSCRIPTION_EXPIRED", {
      email: "eve@test.com", userId: 5, plan: "PAY_PER_VIEW",
      telegramUserId: "tg_eve",
    });

    const result = await subscriber.handleSubscriptionExpired(envelope);
    assert(result.action === "remove", "Action is remove");
    assert(result.result === "success", "Remove succeeded");
    assert(result.groupPlan === "PAY_PER_VIEW", "Removed from PAY_PER_VIEW");
  });

  // ── EDGE CASE: DUPLICATE ──────────────────────────────────────────────────

  await scenario("6. Duplicate: same subscription event → idempotent", async () => {
    resetMocks();
    inviteManager.invalidateAll();
    const envelope = makeEnvelope("SUBSCRIPTION_CREATED", {
      email: "frank@test.com", userId: 6, plan: "ESSENTIAL",
      telegramUserId: "tg_frank",
    });

    const r1 = await subscriber.handleSubscriptionCreated(envelope);
    assert(r1.result === "success", "First invite succeeds");
    const callsAfterFirst = apiCalls.length;

    const r2 = await subscriber.handleSubscriptionCreated(envelope);
    assert(r2.result === "success", "Second invite succeeds (cached link)");
    assert(apiCalls.length === callsAfterFirst, "No extra API call (link cached)");

    const { events } = store.getHistory(100, 0);
    const frankEvents = events.filter((e) => e.email === "frank@test.com" && e.action === "invite");
    assert(frankEvents.length === 2, "Both invites logged in history");
  });

  // ── ERROR: TIMEOUT ────────────────────────────────────────────────────────

  await scenario("7. Timeout: Telegram API slow → error logged, no crash", async () => {
    resetMocks();
    inviteManager.invalidateAll();
    apiShouldFail = true;
    apiFailError = "Telegram API timeout";

    const envelope = makeEnvelope("SUBSCRIPTION_CREATED", {
      email: "grace@test.com", userId: 7, plan: "ELITE",
      telegramUserId: "tg_grace",
    });

    const result = await subscriber.handleSubscriptionCreated(envelope);
    assert(result.result === "failed", "Invite failed");
    assert(result.error.includes("timeout"), "Error mentions timeout");

    const { events } = store.getHistory(100, 0);
    const graceEvents = events.filter((e) => e.email === "grace@test.com");
    assert(graceEvents.length >= 1, "Failure logged in history");
    assert(graceEvents[0].result === "failed", "Status is failed");

    apiShouldFail = false;
  });

  // ── ERROR: TELEGRAM API ERROR ─────────────────────────────────────────────

  await scenario("8. Telegram error: API returns error → logged, no crash", async () => {
    resetMocks();
    inviteManager.invalidateAll();
    apiShouldFail = true;
    apiFailError = "ETELEGRAM_429: Too Many Requests: retry after 30";

    const envelope = makeEnvelope("SUBSCRIPTION_CREATED", {
      email: "henry@test.com", userId: 8, plan: "ESSENTIAL",
      telegramUserId: "tg_henry",
    });

    const result = await subscriber.handleSubscriptionCreated(envelope);
    assert(result.result === "failed", "Invite failed on quota");
    assert(result.error.includes("429"), "Error contains 429");

    apiShouldFail = false;
  });

  // ── ERROR: USER NOT IN GROUP ──────────────────────────────────────────────

  await scenario("9. User absent: remove user not in group → skipped", async () => {
    resetMocks();
    memberStatuses[`${ENV.TELEGRAM_GROUP_ESSENTIAL}_tg_igor`] = "not_found";

    const envelope = makeEnvelope("SUBSCRIPTION_CANCELLED", {
      email: "igor@test.com", userId: 9, plan: "ESSENTIAL",
      telegramUserId: "tg_igor",
    });

    const result = await subscriber.handleSubscriptionCancelled(envelope);
    assert(result.action === "remove", "Action is remove");
    assert(result.result === "skipped", "Remove skipped (user not found)");
    assert(result.error.includes("not in group"), "Error explains why");
  });

  // ── ERROR: NO TELEGRAM USER ID ────────────────────────────────────────────

  await scenario("10. No Telegram ID: remove without telegram_user_id → skipped", async () => {
    resetMocks();
    const envelope = makeEnvelope("SUBSCRIPTION_CANCELLED", {
      email: "jane@test.com", userId: 10, plan: "ELITE",
    });

    const result = await subscriber.handleSubscriptionCancelled(envelope);
    assert(result.result === "skipped", "Remove skipped");
    assert(result.error.includes("telegram_user_id"), "Error mentions missing ID");
  });

  // ── ERROR: GROUP NOT CONFIGURED ───────────────────────────────────────────

  await scenario("11. Group missing: plan without configured group → skipped", async () => {
    resetMocks();
    const subNoGroups = new TelegramSubscriber({
      client, store, inviteManager,
      env: {},
      resolveTelegramUserId: async (evt) => evt.payload.telegramUserId || null,
    });

    const envelope = makeEnvelope("SUBSCRIPTION_CREATED", {
      email: "karl@test.com", userId: 11, plan: "ESSENTIAL",
      telegramUserId: "tg_karl",
    });

    const result = await subNoGroups.handleSubscriptionCreated(envelope);
    assert(result.result === "skipped", "Invite skipped");
    assert(result.error.includes("No chat_id"), "Error mentions missing chat_id");
  });

  // ── ERROR: INVITE LINK EXPIRED → REGENERATION ────────────────────────────

  await scenario("12. Link expired: cache invalidated → new link created", async () => {
    resetMocks();

    const shortMgr = new InviteLinkManager({
      client,
      expireSeconds: 1,
      memberLimit: 1,
    });

    const r1 = await shortMgr.getOrCreate("-100expire_test");
    assert(r1.ok === true, "First link created");
    const firstLink = r1.link;

    await new Promise((r) => setTimeout(r, 1100));

    const r2 = await shortMgr.getOrCreate("-100expire_test");
    assert(r2.ok === true, "New link after expiry");
    assert(!r2.cached, "Not from cache");
    assert(r2.link !== firstLink, "Different link generated");
  });

  // ── BUS WIRING ────────────────────────────────────────────────────────────

  await scenario("13. Bus wiring: events flow through subscriber", async () => {
    resetMocks();
    inviteManager.invalidateAll();

    const wireSub = new TelegramSubscriber({
      client, store, inviteManager, env: ENV,
      resolveTelegramUserId: async (evt) => evt.payload.telegramUserId || null,
    });

    const handlers = wireTelegramSubscribers(bus, wireSub, { timeout: 5000 });
    assert(handlers.length === Object.keys(EVENT_HANDLERS).length, `${handlers.length} handlers wired`);

    await bus.publish("SUBSCRIPTION_CREATED", {
      email: "lisa@test.com", userId: 13, plan: "ELITE",
      telegramUserId: "tg_lisa",
    }, { source: "test" });

    await new Promise((r) => setTimeout(r, 50));

    const { events } = store.getHistory(100, 0);
    const lisaEvents = events.filter((e) => e.email === "lisa@test.com");
    assert(lisaEvents.length >= 1, "Lisa invite logged via bus");
    assert(lisaEvents[0].action === "invite", "Action is invite");
    assert(lisaEvents[0].result === "success", "Invite succeeded via bus");

    for (const h of handlers) {
      bus.unsubscribe(h.eventType, h.handler);
    }
  });

  // ── USER_CREATED ──────────────────────────────────────────────────────────

  await scenario("14. USER_CREATED → logged, no group action", async () => {
    resetMocks();
    const callsBefore = apiCalls.length;

    const envelope = makeEnvelope("USER_CREATED", {
      email: "mike@test.com", userId: 14,
    });

    await subscriber.handleUserCreated(envelope);
    assert(apiCalls.length === callsBefore, "No Telegram API call for user_created");

    const { events } = store.getHistory(100, 0);
    const mikeEvents = events.filter((e) => e.email === "mike@test.com");
    assert(mikeEvents.length >= 1, "User registration logged");
    assert(mikeEvents[0].action === "user_registered", "Action is user_registered");
  });

  // ── RESTART: HISTORY SURVIVES ─────────────────────────────────────────────

  await scenario("15. Restart: telegram_events persist after reconnection", async () => {
    const histBefore = store.getHistory(1000, 0);
    const totalBefore = histBefore.total;

    const store2 = new TelegramEventStore(db);
    const histAfter = store2.getHistory(1000, 0);
    assert(histAfter.total === totalBefore, `History preserved: ${totalBefore} events`);
  });

  // ── LOAD TEST ─────────────────────────────────────────────────────────────

  await scenario("16. Load: 100 users → 100 invitations → 100 logged", async () => {
    resetMocks();
    inviteManager.invalidateAll();
    const t0 = Date.now();

    const promises = [];
    for (let i = 0; i < 100; i++) {
      const plan = PLAN_HIERARCHY[i % 3];
      const envelope = makeEnvelope("SUBSCRIPTION_CREATED", {
        email: `load_${i}@test.com`,
        userId: 1000 + i,
        plan,
        telegramUserId: `tg_load_${i}`,
      });
      promises.push(subscriber.handleSubscriptionCreated(envelope));
    }

    const results = await Promise.all(promises);
    const elapsed = Date.now() - t0;

    const successes = results.filter((r) => r.result === "success").length;
    assert(successes === 100, `100 invitations succeeded, got ${successes}`);

    const { events } = store.getHistory(1000, 0);
    const loadEvents = events.filter((e) => e.email && e.email.startsWith("load_"));
    assert(loadEvents.length === 100, `100 events logged, got ${loadEvents.length}`);

    const inviteCalls = apiCalls.filter((c) => c.method === "createChatInviteLink").length;
    assert(inviteCalls === 3, `Only 3 API calls (1 per group, rest cached), got ${inviteCalls}`);

    console.log(`    Load: ${elapsed}ms for 100 invitations (${(100 / (elapsed / 1000)).toFixed(0)} inv/sec)`);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════════════

  console.log("\n" + "=".repeat(60));
  console.log("\nTELEGRAM SUBSCRIBER TEST SUMMARY\n");

  console.log("Scenario Results:");
  for (const [name, m] of Object.entries(metrics)) {
    console.log(`  ${m.ok ? "OK" : "FAIL"}  ${name}  (${m.elapsed}ms)`);
  }

  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  const totalTime = Object.values(metrics).reduce((s, m) => s + m.elapsed, 0);
  console.log(`\nTotal time: ${totalTime}ms`);
  console.log(`Avg per scenario: ${Math.round(totalTime / Object.keys(metrics).length)}ms`);

  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(` - ${f}`);
    process.exit(1);
  } else {
    console.log("\nAll Telegram Subscriber tests passed!");
    process.exit(0);
  }

  await bus.close();

})();

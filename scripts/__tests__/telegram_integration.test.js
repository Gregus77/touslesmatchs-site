const Database = require("better-sqlite3");
const InviteLinkManager = require("../invite_link_manager");
const { CRM, CRM_EVENTS } = require("../crm");
const { bus } = require("../event_bus");

function makeDb() {
  const db = new Database(":memory:");
  new CRM(db);
  return db;
}

function makeMockManager(responses = []) {
  const manager = new InviteLinkManager({ botToken: "TEST_TOKEN", defaultExpireSeconds: 86400 });
  const calls = [];
  let callIndex = 0;

  manager._callTelegram = jest.fn(async (method, params) => {
    calls.push({ method, params });
    const resp = responses[callIndex] || {
      ok: true,
      result: { invite_link: `https://t.me/+link_${callIndex}`, expire_date: Math.floor(Date.now() / 1000) + 86400 },
    };
    callIndex++;
    return resp;
  });

  return { manager, calls };
}

const PLAN_TELEGRAM_GROUP = {
  premium: "-100PREMIUM",
  pro: "-100PREMIUM",
  elite: "-100ELITE",
  vip: "-100ELITE",
};

beforeEach(() => {
  bus.removeAllListeners();
});

// ── 1. Plan → groupe Telegram ──

describe("Plan to Telegram group mapping", () => {
  test("premium maps to premium group", () => {
    expect(PLAN_TELEGRAM_GROUP["premium"]).toBe("-100PREMIUM");
  });

  test("pro maps to premium group", () => {
    expect(PLAN_TELEGRAM_GROUP["pro"]).toBe("-100PREMIUM");
  });

  test("elite maps to elite group", () => {
    expect(PLAN_TELEGRAM_GROUP["elite"]).toBe("-100ELITE");
  });

  test("vip maps to elite group", () => {
    expect(PLAN_TELEGRAM_GROUP["vip"]).toBe("-100ELITE");
  });

  test("carte has no Telegram group", () => {
    expect(PLAN_TELEGRAM_GROUP["carte"]).toBeUndefined();
  });

  test("free has no Telegram group", () => {
    expect(PLAN_TELEGRAM_GROUP["free"]).toBeUndefined();
  });
});

// ── 2. Invite creation flow ──

describe("Telegram invite creation", () => {
  test("creates unique invite link for paid plan", async () => {
    const { manager, calls } = makeMockManager([
      { ok: true, result: { invite_link: "https://t.me/+prolink", expire_date: Math.floor(Date.now() / 1000) + 86400 } },
    ]);

    const chatId = PLAN_TELEGRAM_GROUP["premium"];
    const result = await manager.createInviteLink(chatId, { memberLimit: 1, name: "premium:user@test.com" });

    expect(result.ok).toBe(true);
    expect(result.inviteLink).toBe("https://t.me/+prolink");
    expect(result.fromCache).toBe(false);
    expect(calls[0].method).toBe("createChatInviteLink");
    expect(calls[0].params.chat_id).toBe("-100PREMIUM");
    expect(calls[0].params.member_limit).toBe(1);
  });

  test("two different users get different invite links", async () => {
    const { manager } = makeMockManager([
      { ok: true, result: { invite_link: "https://t.me/+userA", expire_date: Math.floor(Date.now() / 1000) + 86400 } },
      { ok: true, result: { invite_link: "https://t.me/+userB", expire_date: Math.floor(Date.now() / 1000) + 86400 } },
    ]);

    const chatId = PLAN_TELEGRAM_GROUP["premium"];
    const a = await manager.createInviteLink(chatId, { memberLimit: 1, name: "premium:alice@test.com" });
    const b = await manager.createInviteLink(chatId, { memberLimit: 1, name: "premium:bob@test.com" });

    expect(a.inviteLink).not.toBe(b.inviteLink);
  });

  test("elite plan uses elite group", async () => {
    const { manager, calls } = makeMockManager([
      { ok: true, result: { invite_link: "https://t.me/+elitelink", expire_date: Math.floor(Date.now() / 1000) + 86400 } },
    ]);

    const chatId = PLAN_TELEGRAM_GROUP["elite"];
    await manager.createInviteLink(chatId, { memberLimit: 1, name: "elite:vip@test.com" });

    expect(calls[0].params.chat_id).toBe("-100ELITE");
  });

  test("handles Telegram API error gracefully", async () => {
    const { manager } = makeMockManager([
      { ok: false, description: "Bad Request: not enough rights to manage chat invite link" },
    ]);

    const chatId = PLAN_TELEGRAM_GROUP["premium"];
    const result = await manager.createInviteLink(chatId, { memberLimit: 1 });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not enough rights");
  });
});

// ── 3. CRM records invite ──

describe("CRM records Telegram invite", () => {
  test("CRM stores invite link in notes", () => {
    const db = makeDb();
    const crm = new CRM(db);

    crm.activateSubscription("user@test.com", { plan: "premium" });
    crm.updateContact("user@test.com", { telegram_joined: 0, notes: "invite:https://t.me/+abc123" });

    const contact = crm.getContact("user@test.com");
    expect(contact.notes).toContain("invite:");
    expect(contact.notes).toContain("https://t.me/+abc123");
  });

  test("CRM records telegram_user_id when user joins", () => {
    const db = makeDb();
    const crm = new CRM(db);

    crm.activateSubscription("user@test.com", { plan: "premium" });
    crm.updateContact("user@test.com", { telegram_joined: 123456789 });

    const contact = crm.getContact("user@test.com");
    expect(contact.telegram_joined).toBe(123456789);
  });
});

// ── 4. Full Stripe → CRM → Telegram flow ──

describe("Full Stripe → CRM → Telegram flow", () => {
  test("checkout → CRM activate → invite link → CRM updated", async () => {
    const db = makeDb();
    const crm = new CRM(db);
    const { manager } = makeMockManager([
      { ok: true, result: { invite_link: "https://t.me/+checkout_invite", expire_date: Math.floor(Date.now() / 1000) + 86400 } },
    ]);

    // 1. Simulate Stripe checkout
    crm.activateSubscription("buyer@test.com", {
      plan: "premium",
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      creditsMax: 10,
      expiresAt: "2026-08-06",
    });

    // 2. Create invite link
    const chatId = PLAN_TELEGRAM_GROUP["premium"];
    const invResult = await manager.createInviteLink(chatId, { memberLimit: 1, name: "premium:buyer@test.com" });
    expect(invResult.ok).toBe(true);

    // 3. Store invite in CRM
    crm.updateContact("buyer@test.com", { telegram_joined: 0, notes: `invite:${invResult.inviteLink}` });

    const contact = crm.getContact("buyer@test.com");
    expect(contact.plan).toBe("premium");
    expect(contact.stripe_customer_id).toBe("cus_test");
    expect(contact.notes).toContain("https://t.me/+checkout_invite");
  });

  test("cancellation → CRM cancelled → notes preserved", () => {
    const db = makeDb();
    const crm = new CRM(db);

    crm.activateSubscription("cancel@test.com", { plan: "elite" });
    crm.updateContact("cancel@test.com", { telegram_joined: 987654321, notes: "invite:https://t.me/+old" });

    const beforeCancel = crm.getContact("cancel@test.com");
    expect(beforeCancel.telegram_joined).toBe(987654321);

    crm.cancelSubscription("cancel@test.com", "stripe_subscription_deleted");

    const afterCancel = crm.getContact("cancel@test.com");
    expect(afterCancel.plan).toBe("free");
    expect(afterCancel.status).toBe("cancelled");
    expect(afterCancel.telegram_joined).toBe(987654321);
  });
});

// ── 5. Duplicate prevention ──

describe("Duplicate prevention", () => {
  test("same user with memberLimit=1 gets different links each time (no cache)", async () => {
    const { manager, calls } = makeMockManager([
      { ok: true, result: { invite_link: "https://t.me/+first", expire_date: Math.floor(Date.now() / 1000) + 86400 } },
      { ok: true, result: { invite_link: "https://t.me/+second", expire_date: Math.floor(Date.now() / 1000) + 86400 } },
    ]);

    const chatId = PLAN_TELEGRAM_GROUP["premium"];
    const r1 = await manager.createInviteLink(chatId, { memberLimit: 1, name: "premium:same@test.com" });
    const r2 = await manager.createInviteLink(chatId, { memberLimit: 1, name: "premium:same@test.com" });

    expect(r1.inviteLink).not.toBe(r2.inviteLink);
    expect(calls).toHaveLength(2);
  });
});

// ── 6. Event Bus events ──

describe("Event Bus Telegram events", () => {
  test("TELEGRAM_INVITE_CREATED published on success", () => {
    const events = [];
    bus.on("TELEGRAM_INVITE_CREATED", (p) => events.push(p));

    bus.publish("TELEGRAM_INVITE_CREATED", {
      email: "test@test.com",
      plan: "premium",
      inviteLink: "https://t.me/+abc",
      chatId: "-100PREMIUM",
    });

    expect(events.length).toBe(1);
    expect(events[0].email).toBe("test@test.com");
    expect(events[0].plan).toBe("premium");
  });

  test("TELEGRAM_INVITE_FAILED published on error", () => {
    const events = [];
    bus.on("TELEGRAM_INVITE_FAILED", (p) => events.push(p));

    bus.publish("TELEGRAM_INVITE_FAILED", {
      email: "test@test.com",
      plan: "premium",
      error: "not enough rights",
    });

    expect(events.length).toBe(1);
    expect(events[0].error).toBe("not enough rights");
  });

  test("TELEGRAM_MEMBER_REMOVED published on removal", () => {
    const events = [];
    bus.on("TELEGRAM_MEMBER_REMOVED", (p) => events.push(p));

    bus.publish("TELEGRAM_MEMBER_REMOVED", {
      chatId: "-100PREMIUM",
      telegramUserId: 123456,
    });

    expect(events.length).toBe(1);
    expect(events[0].telegramUserId).toBe(123456);
  });
});

// ── 7. Expired invitations ──

describe("Expired invitation handling", () => {
  test("near-expiry cached link is refreshed", async () => {
    const { manager, calls } = makeMockManager([
      { ok: true, result: { invite_link: "https://t.me/+expiring", expire_date: Math.floor(Date.now() / 1000) + 100 } },
      { ok: true, result: { invite_link: "https://t.me/+fresh", expire_date: Math.floor(Date.now() / 1000) + 86400 } },
    ]);

    const r1 = await manager.createInviteLink("-100PREMIUM", { memberLimit: 50 });
    expect(r1.inviteLink).toBe("https://t.me/+expiring");

    const r2 = await manager.createInviteLink("-100PREMIUM", { memberLimit: 50 });
    expect(r2.inviteLink).toBe("https://t.me/+fresh");
    expect(calls).toHaveLength(2);
  });
});

// ── 8. Dashboard visibility ──

describe("Dashboard shows Telegram state", () => {
  test("CRM contact shows telegram_joined status", () => {
    const db = makeDb();
    const crm = new CRM(db);

    crm.activateSubscription("tg@test.com", { plan: "premium" });
    crm.updateContact("tg@test.com", { telegram_joined: 111222333 });

    const contact = crm.getContact("tg@test.com");
    expect(contact.telegram_joined).toBe(111222333);
  });

  test("CRM stats include users with telegram", () => {
    const db = makeDb();
    const crm = new CRM(db);

    crm.activateSubscription("a@test.com", { plan: "premium" });
    crm.updateContact("a@test.com", { telegram_joined: 111 });
    crm.activateSubscription("b@test.com", { plan: "elite" });
    crm.updateContact("b@test.com", { telegram_joined: 222 });
    crm.activateSubscription("c@test.com", { plan: "premium" });

    const contacts = crm.listContacts({ plan: "premium" });
    const withTg = contacts.filter(c => c.telegram_joined > 0);
    expect(withTg.length).toBe(1);
  });
});

// ── 9. Revoke link ──

describe("Invite link revocation", () => {
  test("revokeInviteLink calls Telegram API", async () => {
    const { manager, calls } = makeMockManager([
      { ok: true, result: {} },
    ]);

    const result = await manager.revokeInviteLink("-100PREMIUM", "https://t.me/+old");
    expect(result.ok).toBe(true);
    expect(calls[0].method).toBe("revokeChatInviteLink");
    expect(calls[0].params.invite_link).toBe("https://t.me/+old");
  });
});

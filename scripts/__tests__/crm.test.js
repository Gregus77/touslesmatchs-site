const Database = require("better-sqlite3");
const { CRM, CRM_EVENTS, PLAN_HIERARCHY } = require("../crm");
const { bus } = require("../event_bus");

function makeDb() {
  return new Database(":memory:");
}

function makeCRM(db) {
  return new CRM(db || makeDb());
}

describe("CRM — Core CRUD", () => {
  let crm;

  beforeEach(() => {
    crm = makeCRM();
    bus.removeAllListeners();
  });

  test("getContact returns null for unknown email", () => {
    expect(crm.getContact("unknown@test.com")).toBeNull();
  });

  test("getContact returns null for empty/falsy email", () => {
    expect(crm.getContact("")).toBeNull();
    expect(crm.getContact(null)).toBeNull();
    expect(crm.getContact(undefined)).toBeNull();
  });

  test("findOrCreateContact creates a new contact", () => {
    const { contact, created } = crm.findOrCreateContact("Test@Example.com", { plan: "premium", source: "stripe" });
    expect(created).toBe(true);
    expect(contact.email).toBe("test@example.com");
    expect(contact.plan).toBe("premium");
    expect(contact.source).toBe("stripe");
  });

  test("findOrCreateContact returns existing contact without overwriting", () => {
    crm.findOrCreateContact("user@test.com", { plan: "premium" });
    const { contact, created } = crm.findOrCreateContact("user@test.com", { plan: "elite" });
    expect(created).toBe(false);
    expect(contact.plan).toBe("premium");
  });

  test("findOrCreateContact normalizes email case and whitespace", () => {
    crm.findOrCreateContact("  USER@Test.COM  ");
    const contact = crm.getContact("user@test.com");
    expect(contact).not.toBeNull();
    expect(contact.email).toBe("user@test.com");
  });

  test("findOrCreateContact emits CONTACT_CREATED event", () => {
    const events = [];
    bus.on(CRM_EVENTS.CONTACT_CREATED, (data) => events.push(data));

    crm.findOrCreateContact("new@test.com");
    expect(events).toHaveLength(1);
    expect(events[0].email).toBe("new@test.com");
  });

  test("findOrCreateContact does NOT emit event for existing contact", () => {
    crm.findOrCreateContact("existing@test.com");
    const events = [];
    bus.on(CRM_EVENTS.CONTACT_CREATED, (data) => events.push(data));
    crm.findOrCreateContact("existing@test.com");
    expect(events).toHaveLength(0);
  });

  test("updateContact updates allowed fields", () => {
    crm.findOrCreateContact("user@test.com");
    const updated = crm.updateContact("user@test.com", { plan: "elite", lang: "en", notes: "VIP client" });
    expect(updated.plan).toBe("elite");
    expect(updated.lang).toBe("en");
    expect(updated.notes).toBe("VIP client");
  });

  test("updateContact ignores non-allowed fields", () => {
    crm.findOrCreateContact("user@test.com");
    const updated = crm.updateContact("user@test.com", { id: 999, created_at: "hacked", plan: "elite" });
    expect(updated.id).not.toBe(999);
    expect(updated.plan).toBe("elite");
  });

  test("updateContact returns null for unknown email", () => {
    expect(crm.updateContact("ghost@test.com", { plan: "elite" })).toBeNull();
  });

  test("updateContact emits CONTACT_UPDATED event", () => {
    crm.findOrCreateContact("user@test.com");
    const events = [];
    bus.on(CRM_EVENTS.CONTACT_UPDATED, (data) => events.push(data));
    crm.updateContact("user@test.com", { plan: "premium" });
    expect(events).toHaveLength(1);
    expect(events[0].fields).toContain("plan");
  });

  test("getContactById works after creation", () => {
    const { contact } = crm.findOrCreateContact("user@test.com");
    const found = crm.getContactById(contact.id);
    expect(found.email).toBe("user@test.com");
  });
});

describe("CRM — Plan Management", () => {
  let crm;

  beforeEach(() => {
    crm = makeCRM();
    bus.removeAllListeners();
  });

  test("changePlan updates plan and records history", () => {
    crm.findOrCreateContact("user@test.com", { plan: "free" });
    const updated = crm.changePlan("user@test.com", "premium", "stripe_checkout");
    expect(updated.plan).toBe("premium");

    const history = crm.getPlanHistory("user@test.com");
    expect(history).toHaveLength(1);
    expect(history[0].old_plan).toBe("free");
    expect(history[0].new_plan).toBe("premium");
    expect(history[0].reason).toBe("stripe_checkout");
  });

  test("changePlan returns contact unchanged when same plan", () => {
    crm.findOrCreateContact("user@test.com", { plan: "premium" });
    const result = crm.changePlan("user@test.com", "premium");
    expect(result.plan).toBe("premium");
    expect(crm.getPlanHistory("user@test.com")).toHaveLength(0);
  });

  test("changePlan returns null for unknown contact", () => {
    expect(crm.changePlan("ghost@test.com", "premium")).toBeNull();
  });

  test("changePlan emits PLAN_CHANGED with direction", () => {
    crm.findOrCreateContact("user@test.com", { plan: "free" });
    const events = [];
    bus.on(CRM_EVENTS.PLAN_CHANGED, (data) => events.push(data));

    crm.changePlan("user@test.com", "premium");
    expect(events[0].direction).toBe("upgrade");

    crm.changePlan("user@test.com", "carte");
    expect(events[1].direction).toBe("downgrade");
  });

  test("PLAN_HIERARCHY ordering is correct", () => {
    expect(PLAN_HIERARCHY.free).toBeLessThan(PLAN_HIERARCHY.lead);
    expect(PLAN_HIERARCHY.lead).toBeLessThan(PLAN_HIERARCHY.carte);
    expect(PLAN_HIERARCHY.carte).toBeLessThan(PLAN_HIERARCHY.premium);
    expect(PLAN_HIERARCHY.premium).toBeLessThan(PLAN_HIERARCHY.elite);
    expect(PLAN_HIERARCHY.elite).toBeLessThan(PLAN_HIERARCHY.vip);
  });
});

describe("CRM — Subscription Lifecycle", () => {
  let crm;

  beforeEach(() => {
    crm = makeCRM();
    bus.removeAllListeners();
  });

  test("activateSubscription creates contact if not exists", () => {
    const result = crm.activateSubscription("new@test.com", {
      plan: "premium",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_456",
      code: "ABC123",
      creditsMax: 10,
      expiresAt: "2027-01-01",
    });
    expect(result.plan).toBe("premium");
    expect(result.stripe_customer_id).toBe("cus_123");
    expect(result.code).toBe("ABC123");
    expect(result.credits_max).toBe(10);
    expect(result.credits_used).toBe(0);
    expect(result.status).toBe("active");
  });

  test("activateSubscription resets credits", () => {
    crm.findOrCreateContact("user@test.com", { plan: "premium" });
    crm.updateContact("user@test.com", { credits_used: 5 });
    crm.activateSubscription("user@test.com", { plan: "premium", creditsMax: 10 });
    const contact = crm.getContact("user@test.com");
    expect(contact.credits_used).toBe(0);
  });

  test("activateSubscription emits SUBSCRIPTION_ACTIVATED", () => {
    const events = [];
    bus.on(CRM_EVENTS.SUBSCRIPTION_ACTIVATED, (data) => events.push(data));
    crm.activateSubscription("user@test.com", { plan: "elite" });
    expect(events).toHaveLength(1);
    expect(events[0].plan).toBe("elite");
  });

  test("cancelSubscription downgrades to free", () => {
    crm.activateSubscription("user@test.com", { plan: "premium" });
    const result = crm.cancelSubscription("user@test.com");
    expect(result.plan).toBe("free");
    expect(result.status).toBe("cancelled");
    expect(result.stripe_subscription_id).toBe("");
  });

  test("cancelSubscription records plan history", () => {
    crm.activateSubscription("user@test.com", { plan: "elite" });
    crm.cancelSubscription("user@test.com");
    const history = crm.getPlanHistory("user@test.com");
    const cancel = history.find((h) => h.new_plan === "free" && h.reason === "stripe_cancelled");
    expect(cancel).toBeDefined();
    expect(cancel.old_plan).toBe("elite");
  });

  test("cancelSubscription returns null for unknown contact", () => {
    expect(crm.cancelSubscription("ghost@test.com")).toBeNull();
  });

  test("cancelSubscription emits SUBSCRIPTION_CANCELLED", () => {
    crm.activateSubscription("user@test.com", { plan: "premium" });
    const events = [];
    bus.on(CRM_EVENTS.SUBSCRIPTION_CANCELLED, (data) => events.push(data));
    crm.cancelSubscription("user@test.com");
    expect(events).toHaveLength(1);
    expect(events[0].old_plan).toBe("premium");
  });
});

describe("CRM — Credits", () => {
  let crm;

  beforeEach(() => {
    crm = makeCRM();
    bus.removeAllListeners();
  });

  test("useCredit increments credits_used", () => {
    crm.activateSubscription("user@test.com", { plan: "premium", creditsMax: 5 });
    const result = crm.useCredit("user@test.com");
    expect(result.ok).toBe(true);
    expect(result.credits_left).toBe(4);
  });

  test("useCredit resets on new day", () => {
    crm.activateSubscription("user@test.com", { plan: "premium", creditsMax: 5 });
    crm.updateContact("user@test.com", { credits_used: 4, credits_date: "2020-01-01" });
    const result = crm.useCredit("user@test.com");
    expect(result.ok).toBe(true);
  });

  test("useCredit returns error when exhausted", () => {
    crm.activateSubscription("user@test.com", { plan: "premium", creditsMax: 2 });
    crm.useCredit("user@test.com");
    crm.useCredit("user@test.com");
    const result = crm.useCredit("user@test.com");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("credits_exhausted");
  });

  test("useCredit returns error for unknown contact", () => {
    const result = crm.useCredit("ghost@test.com");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("contact_not_found");
  });

  test("useCredit increments total_analyses", () => {
    crm.activateSubscription("user@test.com", { plan: "premium", creditsMax: 10 });
    crm.useCredit("user@test.com");
    crm.useCredit("user@test.com");
    const contact = crm.getContact("user@test.com");
    expect(contact.total_analyses).toBe(2);
  });

  test("getCreditsLeft returns correct value", () => {
    crm.activateSubscription("user@test.com", { plan: "premium", creditsMax: 5 });
    expect(crm.getCreditsLeft("user@test.com")).toBe(5);
    crm.useCredit("user@test.com");
    expect(crm.getCreditsLeft("user@test.com")).toBe(4);
  });

  test("getCreditsLeft returns 0 for unknown contact", () => {
    expect(crm.getCreditsLeft("ghost@test.com")).toBe(0);
  });

  test("getCreditsLeft resets on new day", () => {
    crm.activateSubscription("user@test.com", { plan: "premium", creditsMax: 5 });
    crm.useCredit("user@test.com");
    crm.useCredit("user@test.com");
    crm.updateContact("user@test.com", { credits_date: "2020-01-01" });
    expect(crm.getCreditsLeft("user@test.com")).toBe(5);
  });
});

describe("CRM — Lead Registration", () => {
  let crm;

  beforeEach(() => {
    crm = makeCRM();
    bus.removeAllListeners();
  });

  test("registerLead creates contact with plan=lead", () => {
    const result = crm.registerLead("lead@test.com", { source: "tiktok", lang: "en" });
    expect(result.plan).toBe("lead");
    expect(result.source).toBe("tiktok");
    expect(result.lang).toBe("en");
  });

  test("registerLead upgrades free contact to lead", () => {
    crm.findOrCreateContact("user@test.com", { plan: "free" });
    crm.registerLead("user@test.com");
    const contact = crm.getContact("user@test.com");
    expect(contact.plan).toBe("lead");
  });

  test("registerLead does NOT downgrade premium to lead", () => {
    crm.findOrCreateContact("user@test.com", { plan: "premium" });
    crm.registerLead("user@test.com");
    const contact = crm.getContact("user@test.com");
    expect(contact.plan).toBe("premium");
  });

  test("registerLead stores UTM data", () => {
    crm.registerLead("utm@test.com", {
      source: "tiktok",
      utm: { source: "tiktok", medium: "social", campaign: "summer2026" },
    });
    const contact = crm.getContact("utm@test.com");
    expect(contact.utm_source).toBe("tiktok");
    expect(contact.utm_medium).toBe("social");
    expect(contact.utm_campaign).toBe("summer2026");
  });

  test("registerLead emits LEAD_REGISTERED", () => {
    const events = [];
    bus.on(CRM_EVENTS.LEAD_REGISTERED, (data) => events.push(data));
    crm.registerLead("lead@test.com", { source: "instagram" });
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("instagram");
  });
});

describe("CRM — Referrals", () => {
  let crm;

  beforeEach(() => {
    crm = makeCRM();
    bus.removeAllListeners();
  });

  test("creditReferral adds months_earned", () => {
    crm.findOrCreateContact("ref@test.com");
    crm.creditReferral("ref@test.com", 2);
    const contact = crm.getContact("ref@test.com");
    expect(contact.months_earned).toBe(2);
  });

  test("creditReferral accumulates months", () => {
    crm.findOrCreateContact("ref@test.com");
    crm.creditReferral("ref@test.com", 1);
    crm.creditReferral("ref@test.com", 3);
    const contact = crm.getContact("ref@test.com");
    expect(contact.months_earned).toBe(4);
  });

  test("creditReferral returns null for unknown contact", () => {
    expect(crm.creditReferral("ghost@test.com")).toBeNull();
  });

  test("creditReferral emits REFERRAL_CREDITED", () => {
    crm.findOrCreateContact("ref@test.com");
    const events = [];
    bus.on(CRM_EVENTS.REFERRAL_CREDITED, (data) => events.push(data));
    crm.creditReferral("ref@test.com", 2);
    expect(events).toHaveLength(1);
    expect(events[0].months).toBe(2);
  });
});

describe("CRM — Queries", () => {
  let crm;

  beforeEach(() => {
    crm = makeCRM();
    bus.removeAllListeners();
    crm.findOrCreateContact("free1@test.com", { plan: "free" });
    crm.findOrCreateContact("free2@test.com", { plan: "free" });
    crm.findOrCreateContact("premium1@test.com", { plan: "premium" });
    crm.findOrCreateContact("elite1@test.com", { plan: "elite" });
  });

  test("listContacts returns all contacts", () => {
    const all = crm.listContacts();
    expect(all).toHaveLength(4);
  });

  test("listContacts filters by plan", () => {
    const free = crm.listContacts({ plan: "free" });
    expect(free).toHaveLength(2);
  });

  test("listContacts supports pagination", () => {
    const page1 = crm.listContacts({ limit: 2, offset: 0 });
    const page2 = crm.listContacts({ limit: 2, offset: 2 });
    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    expect(page1[0].email).not.toBe(page2[0].email);
  });

  test("countContacts returns total", () => {
    expect(crm.countContacts()).toBe(4);
  });

  test("countContacts filters by plan", () => {
    expect(crm.countContacts("free")).toBe(2);
    expect(crm.countContacts("premium")).toBe(1);
    expect(crm.countContacts("vip")).toBe(0);
  });

  test("getContactStats returns breakdown", () => {
    const stats = crm.getContactStats();
    expect(stats.total).toBe(4);
    expect(stats.byPlan.free).toBe(2);
    expect(stats.byPlan.premium).toBe(1);
    expect(stats.byPlan.elite).toBe(1);
    expect(stats.active).toBe(4);
    expect(stats.cancelled).toBe(0);
  });

  test("searchContacts finds by email substring", () => {
    const results = crm.searchContacts("premium");
    expect(results).toHaveLength(1);
    expect(results[0].email).toBe("premium1@test.com");
  });

  test("searchContacts returns empty for no match", () => {
    expect(crm.searchContacts("zzzzz")).toHaveLength(0);
  });

  test("getContactEvents returns events for contact", () => {
    const events = crm.getContactEvents("free1@test.com");
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].event_type).toBe(CRM_EVENTS.CONTACT_CREATED);
  });

  test("getContactEvents returns empty for unknown", () => {
    expect(crm.getContactEvents("ghost@test.com")).toHaveLength(0);
  });
});

describe("CRM — Brevo Sync", () => {
  let crm;

  beforeEach(() => {
    crm = makeCRM();
    bus.removeAllListeners();
  });

  test("markBrevoSynced sets flag", () => {
    crm.findOrCreateContact("user@test.com");
    crm.markBrevoSynced("user@test.com");
    const contact = crm.getContact("user@test.com");
    expect(contact.brevo_synced).toBe(1);
    expect(contact.brevo_synced_at).toBeTruthy();
  });

  test("getUnsyncedContacts returns only unsynced", () => {
    crm.findOrCreateContact("synced@test.com");
    crm.findOrCreateContact("unsynced@test.com");
    crm.markBrevoSynced("synced@test.com");

    const unsynced = crm.getUnsyncedContacts();
    expect(unsynced).toHaveLength(1);
    expect(unsynced[0].email).toBe("unsynced@test.com");
  });
});

describe("CRM — Legacy Import", () => {
  let crm;

  beforeEach(() => {
    crm = makeCRM();
    bus.removeAllListeners();
  });

  test("importFromLegacy creates new contact with all fields", () => {
    const result = crm.importFromLegacy({
      email: "legacy@test.com",
      plan: "premium",
      code: "LEG123",
      creditsMax: 10,
      expiresAt: "2027-06-01",
      stripeCustomerId: "cus_legacy",
      source: "migration",
      lang: "fr",
      country: "FR",
    });
    expect(result.plan).toBe("premium");
    expect(result.code).toBe("LEG123");
    expect(result.credits_max).toBe(10);
    expect(result.stripe_customer_id).toBe("cus_legacy");
  });

  test("importFromLegacy upgrades plan if higher", () => {
    crm.findOrCreateContact("existing@test.com", { plan: "carte" });
    crm.importFromLegacy({ email: "existing@test.com", plan: "elite" });
    const contact = crm.getContact("existing@test.com");
    expect(contact.plan).toBe("elite");
  });

  test("importFromLegacy does NOT downgrade plan", () => {
    crm.findOrCreateContact("existing@test.com", { plan: "elite" });
    crm.importFromLegacy({ email: "existing@test.com", plan: "carte" });
    const contact = crm.getContact("existing@test.com");
    expect(contact.plan).toBe("elite");
  });
});

describe("CRM — Event Logging", () => {
  let crm;

  beforeEach(() => {
    crm = makeCRM();
    bus.removeAllListeners();
  });

  test("all lifecycle operations create crm_events entries", () => {
    crm.activateSubscription("user@test.com", { plan: "premium" });
    crm.useCredit("user@test.com");
    crm.cancelSubscription("user@test.com");

    const events = crm.getContactEvents("user@test.com", 100);
    const types = events.map((e) => e.event_type);
    expect(types).toContain(CRM_EVENTS.CONTACT_CREATED);
    expect(types).toContain(CRM_EVENTS.SUBSCRIPTION_ACTIVATED);
    expect(types).toContain(CRM_EVENTS.CREDIT_USED);
    expect(types).toContain(CRM_EVENTS.SUBSCRIPTION_CANCELLED);
  });

  test("event payload is stored as JSON", () => {
    crm.findOrCreateContact("user@test.com");
    const events = crm.getContactEvents("user@test.com");
    const payload = JSON.parse(events[0].payload);
    expect(payload).toHaveProperty("source");
  });
});

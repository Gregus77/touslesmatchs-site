#!/usr/bin/env node

// Mission 005: Brevo Subscriber Tests
// Run: node scripts/test_brevo_subscriber.js

const Database = require("better-sqlite3");
const { EventBus, EventStore } = require("./event-bus");
const { BrevoSender, EmailScheduler, TEMPLATES, EVENT_TO_TEMPLATE, FOLLOWUP_SCHEDULE, wireBrevoSubscribers } = require("./brevo-subscriber");
const fs = require("fs");

const DB_PATH = "/tmp/tlm_brevo_test.db";
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

console.log("Mission 005: Brevo Subscriber Tests\n");

let passed = 0, failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) { console.log(`  PASS  ${message}`); passed++; }
  else { console.log(`  FAIL  ${message}`); failed++; failures.push(message); }
}

async function test(name, fn) {
  console.log(`\n  ${name}`);
  try { await fn(); }
  catch (e) { console.log(`  ERROR: ${e.message}\n${e.stack}`); failed++; failures.push(`${name}: ${e.message}`); }
}

// ── Setup ────────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
const busStore = new EventStore(db);

(async () => {

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 1: BrevoSender
  // ══════════════════════════════════════════════════════════════════════════════

  await test("BrevoSender — successful send via mock", async () => {
    const sent = [];
    const sender = new BrevoSender({
      apiKey: "test-key",
      httpPost: async (msg) => { sent.push(msg); },
    });
    const result = await sender.send("user@test.com", "Hello", "<p>Hi</p>");
    assert(result.ok === true, "Send succeeded");
    assert(sent.length === 1, "httpPost called once");
    assert(sent[0].to === "user@test.com", "Recipient correct");
    assert(sent[0].subject === "Hello", "Subject correct");
  });

  await test("BrevoSender — no API key returns skipped", async () => {
    const sender = new BrevoSender({ apiKey: "" });
    const result = await sender.send("user@test.com", "Hello", "<p>Hi</p>");
    assert(result.ok === false, "Not ok");
    assert(result.skipped === true, "Skipped (no key)");
  });

  await test("BrevoSender — Brevo API error is captured", async () => {
    const sender = new BrevoSender({
      apiKey: "test-key",
      httpPost: async () => { throw new Error("Brevo API 429: rate limited"); },
    });
    const result = await sender.send("user@test.com", "Hello", "<p>Hi</p>");
    assert(result.ok === false, "Send failed");
    assert(result.error === "Brevo API 429: rate limited", "Error captured");
  });

  await test("BrevoSender — missing recipient returns error", async () => {
    const sender = new BrevoSender({ apiKey: "test-key" });
    const result = await sender.send("", "Hello", "<p>Hi</p>");
    assert(result.ok === false, "Not ok");
    assert(result.error === "Missing recipient or subject", "Error correct");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 2: Email templates
  // ══════════════════════════════════════════════════════════════════════════════

  await test("All event templates exist", async () => {
    for (const [eventType, templateKey] of Object.entries(EVENT_TO_TEMPLATE)) {
      const tpl = TEMPLATES[templateKey];
      assert(tpl !== undefined, `Template '${templateKey}' exists for ${eventType}`);
      assert(typeof tpl.build === "function", `Template '${templateKey}' has build()`);
      assert(tpl.subject !== undefined, `Template '${templateKey}' has subject`);
    }
  });

  await test("Templates produce valid HTML with data", async () => {
    const html = TEMPLATES.subscription_created.build({ plan: "ELITE" });
    assert(html.includes("ELITE"), "Plan name in HTML");
    assert(html.includes("joueurs-info-service"), "ANJ disclaimer present");
  });

  await test("Dynamic subject works", async () => {
    const subj = TEMPLATES.subscription_created.subject({ plan: "ESSENTIAL" });
    assert(subj.includes("ESSENTIAL"), "Plan in subject");
  });

  await test("Followup templates exist", async () => {
    assert(TEMPLATES.followup_j1 !== undefined, "followup_j1 exists");
    assert(TEMPLATES.followup_j3 !== undefined, "followup_j3 exists");
    assert(TEMPLATES.followup_j7 !== undefined, "followup_j7 exists");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 3: EmailScheduler — enqueue & dedup
  // ══════════════════════════════════════════════════════════════════════════════

  const mockSender = new BrevoSender({
    apiKey: "test-key",
    httpPost: async () => {},
  });
  const scheduler = new EmailScheduler({ db, sender: mockSender });

  await test("Enqueue an email", async () => {
    const result = scheduler.enqueue("alice@test.com", "welcome", { plan: "VISITOR" }, { eventId: "evt_1" });
    assert(result.ok === true, "Enqueued");
    assert(typeof result.id === "number", "Got row ID");
  });

  await test("Duplicate email is rejected", async () => {
    const result = scheduler.enqueue("alice@test.com", "welcome", {}, { eventId: "evt_1" });
    assert(result.ok === true, "Returns ok");
    assert(result.skipped === true, "Skipped as duplicate");
    assert(result.reason === "duplicate", "Reason is duplicate");
  });

  await test("Different event ID is not a duplicate", async () => {
    const result = scheduler.enqueue("alice@test.com", "welcome", {}, { eventId: "evt_2" });
    assert(result.ok === true, "Enqueued");
    assert(result.skipped === undefined, "Not skipped");
  });

  await test("Different template for same event is not a duplicate", async () => {
    const result = scheduler.enqueue("alice@test.com", "followup_j1", {}, { eventId: "evt_1" });
    assert(result.ok === true, "Enqueued");
    assert(result.skipped === undefined, "Not skipped");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 4: EmailScheduler — process pending
  // ══════════════════════════════════════════════════════════════════════════════

  await test("Process pending emails", async () => {
    const results = await scheduler.processPending(10);
    assert(results.length === 3, `Processed ${results.length} emails (expected 3 non-duplicate pending)`);
    assert(results.every((r) => r.ok), "All sent successfully");
  });

  await test("Already sent emails are not reprocessed", async () => {
    const results = await scheduler.processPending(10);
    assert(results.length === 0, "No pending emails left");
  });

  await test("Failed send is recorded", async () => {
    const failSender = new BrevoSender({
      apiKey: "test-key",
      httpPost: async () => { throw new Error("network error"); },
    });
    const failScheduler = new EmailScheduler({ db, sender: failSender });
    failScheduler.enqueue("fail@test.com", "welcome", {}, { eventId: "evt_fail" });
    const results = await failScheduler.processPending(10);
    assert(results.length === 1, "One email processed");
    assert(results[0].ok === false, "Marked as failed");
    assert(results[0].error === "network error", "Error stored");
  });

  await test("Unknown template is handled", async () => {
    scheduler.enqueue("bob@test.com", "nonexistent_template", {}, { eventId: "evt_unk_tpl" });
    const results = await scheduler.processPending(10);
    assert(results.length === 1, "Processed 1");
    assert(results[0].ok === false, "Failed");
    assert(results[0].error.includes("Unknown template"), "Error describes unknown template");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 5: EmailScheduler — delayed emails
  // ══════════════════════════════════════════════════════════════════════════════

  await test("Delayed email is not processed before scheduled time", async () => {
    scheduler.enqueue("delayed@test.com", "followup_j1", {}, {
      eventId: "evt_delayed",
      delayMs: 24 * 3600 * 1000, // +1 day
    });
    const results = await scheduler.processPending(10);
    const delayedResult = results.find((r) => r.id);
    assert(results.length === 0, "Delayed email not yet due");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 6: EmailScheduler — history
  // ══════════════════════════════════════════════════════════════════════════════

  await test("Email history returns all entries", async () => {
    const { emails, total } = scheduler.getHistory(100, 0);
    assert(total >= 5, `History has ${total} entries`);
    assert(emails[0].template_key !== undefined, "Has template_key");
    assert(emails[0].recipient !== undefined, "Has recipient");
    assert(emails[0].status !== undefined, "Has status");
  });

  await test("History includes sent and failed statuses", async () => {
    const { emails } = scheduler.getHistory(100, 0);
    const statuses = [...new Set(emails.map((e) => e.status))];
    assert(statuses.includes("sent"), "Has 'sent' status");
    assert(statuses.includes("failed"), "Has 'failed' status");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 7: Full integration — Event Bus → Brevo
  // ══════════════════════════════════════════════════════════════════════════════

  await test("Event Bus USER_CREATED → welcome email enqueued", async () => {
    const db2 = new Database(":memory:");
    const store2 = new EventStore(db2);
    const bus = new EventBus({ store: store2 });
    const sent = [];
    const sender2 = new BrevoSender({
      apiKey: "test-key",
      httpPost: async (msg) => { sent.push(msg); },
    });
    const sched2 = new EmailScheduler({ db: db2, sender: sender2 });

    wireBrevoSubscribers(bus, sched2, {
      resolveEmail: (evt) => evt.payload.email,
    });

    await bus.publish("USER_CREATED", { email: "newuser@test.com" }, { source: "auth", userId: 1 });

    const results = await sched2.processPending(20);
    assert(results.length === 1, "1 immediate email queued");
    assert(results[0].ok === true, "Email sent");
    assert(sent.length === 1, "httpPost called");
    assert(sent[0].to === "newuser@test.com", "Correct recipient");
    assert(sent[0].subject === "Bienvenue sur TousLesMatchs", "Welcome subject");

    bus.close();
    db2.close();
  });

  await test("Event Bus USER_CREATED → followup J1/J3/J7 scheduled", async () => {
    const db2 = new Database(":memory:");
    const store2 = new EventStore(db2);
    const bus = new EventBus({ store: store2 });
    const sender2 = new BrevoSender({ apiKey: "test-key", httpPost: async () => {} });
    const sched2 = new EmailScheduler({ db: db2, sender: sender2 });

    wireBrevoSubscribers(bus, sched2, {
      resolveEmail: (evt) => evt.payload.email,
    });

    await bus.publish("USER_CREATED", { email: "fu@test.com" }, { source: "auth", userId: 2 });

    const { emails } = sched2.getHistory(100, 0);
    const fuEmails = emails.filter((e) => e.recipient === "fu@test.com");
    assert(fuEmails.length === 4, `4 emails queued (1 welcome + 3 followups), got ${fuEmails.length}`);

    const templates = fuEmails.map((e) => e.template_key).sort();
    assert(templates.includes("followup_j1"), "J+1 followup queued");
    assert(templates.includes("followup_j3"), "J+3 followup queued");
    assert(templates.includes("followup_j7"), "J+7 followup queued");
    assert(templates.includes("welcome"), "Welcome queued");

    const pending = await sched2.processPending(20);
    assert(pending.length === 1, "Only welcome is due now (followups are delayed)");

    bus.close();
    db2.close();
  });

  await test("Event Bus SUBSCRIPTION_CREATED → subscription email enqueued", async () => {
    const db2 = new Database(":memory:");
    const store2 = new EventStore(db2);
    const bus = new EventBus({ store: store2 });
    const sent = [];
    const sender2 = new BrevoSender({ apiKey: "test-key", httpPost: async (msg) => { sent.push(msg); } });
    const sched2 = new EmailScheduler({ db: db2, sender: sender2 });

    wireBrevoSubscribers(bus, sched2, { resolveEmail: (evt) => evt.payload.email });

    await bus.publish("SUBSCRIPTION_CREATED", { email: "sub@test.com", plan: "ELITE" }, { source: "engine" });
    await sched2.processPending(10);

    assert(sent.length === 1, "One email sent");
    assert(sent[0].subject.includes("ELITE"), "Subject contains plan");

    bus.close();
    db2.close();
  });

  await test("Event Bus PAYMENT_FAILED → payment failed email enqueued", async () => {
    const db2 = new Database(":memory:");
    const store2 = new EventStore(db2);
    const bus = new EventBus({ store: store2 });
    const sent = [];
    const sender2 = new BrevoSender({ apiKey: "test-key", httpPost: async (msg) => { sent.push(msg); } });
    const sched2 = new EmailScheduler({ db: db2, sender: sender2 });

    wireBrevoSubscribers(bus, sched2, { resolveEmail: (evt) => evt.payload.email });

    await bus.publish("PAYMENT_FAILED", { email: "fail@test.com", reason: "card_declined" }, { source: "stripe" });
    await sched2.processPending(10);

    assert(sent.length === 1, "One email sent");
    assert(sent[0].subject.includes("Echec"), "Subject about payment failure");
    assert(sent[0].htmlContent.includes("card_declined"), "Reason in HTML");

    bus.close();
    db2.close();
  });

  await test("Event without email does not enqueue", async () => {
    const db2 = new Database(":memory:");
    const store2 = new EventStore(db2);
    const bus = new EventBus({ store: store2 });
    const sender2 = new BrevoSender({ apiKey: "test-key", httpPost: async () => {} });
    const sched2 = new EmailScheduler({ db: db2, sender: sender2 });

    wireBrevoSubscribers(bus, sched2, { resolveEmail: (evt) => evt.payload.email });

    await bus.publish("PAYMENT_REFUNDED", { userId: 5 }, { source: "stripe" });
    const { emails } = sched2.getHistory(100, 0);
    assert(emails.length === 0, "No email enqueued (no email in payload)");

    bus.close();
    db2.close();
  });

  await test("Duplicate event does not enqueue duplicate email", async () => {
    const db2 = new Database(":memory:");
    const store2 = new EventStore(db2);
    const bus = new EventBus({ store: store2 });
    const sender2 = new BrevoSender({ apiKey: "test-key", httpPost: async () => {} });
    const sched2 = new EmailScheduler({ db: db2, sender: sender2 });

    wireBrevoSubscribers(bus, sched2, { resolveEmail: (evt) => evt.payload.email });

    const meta = { source: "engine", id: "evt_dedup_test" };
    await bus.publish("SUBSCRIPTION_CANCELLED", { email: "dup@test.com", plan: "ESSENTIAL" }, meta);
    await bus.publish("SUBSCRIPTION_CANCELLED", { email: "dup@test.com", plan: "ESSENTIAL" }, meta);

    const { emails } = sched2.getHistory(100, 0);
    const cancelEmails = emails.filter((e) => e.template_key === "subscription_cancelled");
    assert(cancelEmails.length === 1, "Only 1 email enqueued despite 2 publishes with same event ID");

    bus.close();
    db2.close();
  });

  await test("Brevo timeout subscriber does not block bus", async () => {
    const db2 = new Database(":memory:");
    const store2 = new EventStore(db2);
    const bus = new EventBus({ store: store2 });
    const sender2 = new BrevoSender({
      apiKey: "test-key",
      httpPost: async () => { await new Promise((r) => setTimeout(r, 500)); },
    });
    const sched2 = new EmailScheduler({ db: db2, sender: sender2 });

    let otherHandlerCalled = false;
    bus.subscribe("SUBSCRIPTION_EXPIRED", () => { otherHandlerCalled = true; }, { timeout: 100 });

    wireBrevoSubscribers(bus, sched2, {
      resolveEmail: (evt) => evt.payload.email,
      timeout: 100, // will not trigger since enqueue is sync
    });

    await bus.publish("SUBSCRIPTION_EXPIRED", { email: "timeout@test.com" }, { source: "engine" });
    assert(otherHandlerCalled === true, "Other handler still ran");

    bus.close();
    db2.close();
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 8: All 7 event types produce emails
  // ══════════════════════════════════════════════════════════════════════════════

  await test("All 7 event types produce the correct template", async () => {
    const db2 = new Database(":memory:");
    const store2 = new EventStore(db2);
    const bus = new EventBus({ store: store2 });
    const sender2 = new BrevoSender({ apiKey: "test-key", httpPost: async () => {} });
    const sched2 = new EmailScheduler({ db: db2, sender: sender2 });

    wireBrevoSubscribers(bus, sched2, { resolveEmail: (evt) => evt.payload.email });

    const events = [
      ["USER_CREATED", { email: "a@t.com" }],
      ["SUBSCRIPTION_CREATED", { email: "b@t.com", plan: "ELITE" }],
      ["SUBSCRIPTION_UPDATED", { email: "c@t.com", plan: "ESSENTIAL" }],
      ["SUBSCRIPTION_CANCELLED", { email: "d@t.com" }],
      ["SUBSCRIPTION_EXPIRED", { email: "e@t.com" }],
      ["PAYMENT_FAILED", { email: "f@t.com" }],
      ["PAYMENT_REFUNDED", { email: "g@t.com", amount: 990 }],
    ];

    for (const [type, payload] of events) {
      await bus.publish(type, payload, { source: "test", id: `evt_all_${type}` });
    }

    const { emails } = sched2.getHistory(100, 0);
    const immediateTemplates = emails
      .filter((e) => !e.template_key.startsWith("followup_"))
      .map((e) => e.template_key)
      .sort();

    assert(immediateTemplates.length === 7, `7 immediate templates queued, got ${immediateTemplates.length}`);
    assert(immediateTemplates.includes("welcome"), "welcome");
    assert(immediateTemplates.includes("subscription_created"), "subscription_created");
    assert(immediateTemplates.includes("subscription_updated"), "subscription_updated");
    assert(immediateTemplates.includes("subscription_cancelled"), "subscription_cancelled");
    assert(immediateTemplates.includes("subscription_expired"), "subscription_expired");
    assert(immediateTemplates.includes("payment_failed"), "payment_failed");
    assert(immediateTemplates.includes("payment_refunded"), "payment_refunded");

    bus.close();
    db2.close();
  });

  // ── Cleanup ────────────────────────────────────────────────────────────────
  busStore.close();
  db.close();
  fs.unlinkSync(DB_PATH);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n\nBREVO SUBSCRIBER TEST SUMMARY`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  if (failed === 0) {
    console.log(`\nAll Brevo subscriber tests passed!\n`);
    process.exit(0);
  } else {
    console.log(`\nFailures:\n - ${failures.join("\n - ")}\n`);
    process.exit(1);
  }
})();

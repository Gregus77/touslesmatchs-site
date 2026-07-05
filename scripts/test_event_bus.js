#!/usr/bin/env node

// Mission 004: Event Bus Tests
// Run: node scripts/test_event_bus.js

const Database = require("better-sqlite3");
const { EventBus, EventStore, InProcessProvider, EVENT_TYPES } = require("./event-bus");
const fs = require("fs");

const DB_PATH = "/tmp/tlm_event_bus_test.db";
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

console.log("Mission 004: Event Bus Tests\n");

let passed = 0, failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) { console.log(`  PASS  ${message}`); passed++; }
  else { console.log(`  FAIL  ${message}`); failed++; failures.push(message); }
}

async function test(name, fn) {
  console.log(`\n  ${name}`);
  try { await fn(); }
  catch (e) { console.log(`  ERROR: ${e.message}`); failed++; failures.push(`${name}: ${e.message}`); }
}

// ── Setup ────────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
const store = new EventStore(db);
const bus = new EventBus({ store });

// ══════════════════════════════════════════════════════════════════════════════
// GROUP 1: Basic publish / subscribe
// ══════════════════════════════════════════════════════════════════════════════

(async () => {

  await test("Publish to a single subscriber", async () => {
    let received = null;
    const handler = (evt) => { received = evt; };
    bus.subscribe("USER_CREATED", handler);

    const result = await bus.publish("USER_CREATED", { email: "alice@test.com" }, { source: "auth", userId: 1 });
    assert(result.delivered === 1, "Delivered to 1 subscriber");
    assert(received !== null, "Handler was called");
    assert(received.type === "USER_CREATED", "Event type correct");
    assert(received.payload.email === "alice@test.com", "Payload correct");
    assert(received.source === "auth", "Source correct");
    assert(received.userId === 1, "userId correct");
    assert(typeof received.id === "string", "Event has an id");
    assert(typeof received.timestamp === "string", "Event has a timestamp");

    bus.unsubscribe("USER_CREATED", handler);
  });

  await test("Publish to multiple subscribers", async () => {
    const calls = [];
    const h1 = (evt) => { calls.push("h1:" + evt.type); };
    const h2 = (evt) => { calls.push("h2:" + evt.type); };
    const h3 = (evt) => { calls.push("h3:" + evt.type); };

    bus.subscribe("PAYMENT_SUCCEEDED", h1);
    bus.subscribe("PAYMENT_SUCCEEDED", h2);
    bus.subscribe("PAYMENT_SUCCEEDED", h3);

    const result = await bus.publish("PAYMENT_SUCCEEDED", { amount: 990 }, { source: "stripe" });
    assert(result.delivered === 3, "Delivered to 3 subscribers");
    assert(calls.length === 3, "All 3 handlers called");
    assert(calls[0] === "h1:PAYMENT_SUCCEEDED", "Handler 1 called first");
    assert(calls[1] === "h2:PAYMENT_SUCCEEDED", "Handler 2 called second");
    assert(calls[2] === "h3:PAYMENT_SUCCEEDED", "Handler 3 called third");

    bus.unsubscribe("PAYMENT_SUCCEEDED", h1);
    bus.unsubscribe("PAYMENT_SUCCEEDED", h2);
    bus.unsubscribe("PAYMENT_SUCCEEDED", h3);
  });

  await test("Publish with no subscribers", async () => {
    const result = await bus.publish("SUBSCRIPTION_EXPIRED", { userId: 99 }, { source: "engine" });
    assert(result.delivered === 0, "Delivered to 0 subscribers");
    assert(Array.isArray(result.results), "Results is an array");
    assert(result.results.length === 0, "Results array is empty");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 2: Error isolation
  // ══════════════════════════════════════════════════════════════════════════════

  await test("Error in one subscriber does not block others", async () => {
    const calls = [];
    const good1 = (evt) => { calls.push("good1"); };
    const bad = () => { throw new Error("subscriber crash"); };
    const good2 = (evt) => { calls.push("good2"); };

    bus.subscribe("PAYMENT_FAILED", good1);
    bus.subscribe("PAYMENT_FAILED", bad);
    bus.subscribe("PAYMENT_FAILED", good2);

    const result = await bus.publish("PAYMENT_FAILED", { reason: "card_declined" }, { source: "stripe" });
    assert(result.delivered === 3, "All 3 handlers attempted");
    assert(calls.includes("good1"), "First good handler ran");
    assert(calls.includes("good2"), "Second good handler ran after error");
    assert(result.results[1].ok === false, "Failing handler marked as not ok");
    assert(result.results[1].error === "subscriber crash", "Error message captured");
    assert(result.results[0].ok === true, "First handler ok");
    assert(result.results[2].ok === true, "Third handler ok");

    bus.unsubscribe("PAYMENT_FAILED", good1);
    bus.unsubscribe("PAYMENT_FAILED", bad);
    bus.unsubscribe("PAYMENT_FAILED", good2);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 3: Event ordering
  // ══════════════════════════════════════════════════════════════════════════════

  await test("Events are delivered in subscription order", async () => {
    const order = [];
    bus.subscribe("SUBSCRIPTION_CREATED", () => order.push(1));
    bus.subscribe("SUBSCRIPTION_CREATED", () => order.push(2));
    bus.subscribe("SUBSCRIPTION_CREATED", () => order.push(3));

    await bus.publish("SUBSCRIPTION_CREATED", { plan: "ESSENTIAL" }, { source: "engine" });
    assert(order[0] === 1, "First subscriber called first");
    assert(order[1] === 2, "Second subscriber called second");
    assert(order[2] === 3, "Third subscriber called third");
  });

  await test("Sequential publishes maintain order", async () => {
    const received = [];
    const handler = (evt) => { received.push(evt.payload.seq); };
    bus.subscribe("SUBSCRIPTION_UPDATED", handler);

    await bus.publish("SUBSCRIPTION_UPDATED", { seq: 1 }, { source: "engine" });
    await bus.publish("SUBSCRIPTION_UPDATED", { seq: 2 }, { source: "engine" });
    await bus.publish("SUBSCRIPTION_UPDATED", { seq: 3 }, { source: "engine" });

    assert(received[0] === 1, "First event received first");
    assert(received[1] === 2, "Second event received second");
    assert(received[2] === 3, "Third event received third");

    bus.unsubscribe("SUBSCRIPTION_UPDATED", handler);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 4: Unsubscribe
  // ══════════════════════════════════════════════════════════════════════════════

  await test("Unsubscribe removes handler", async () => {
    let callCount = 0;
    const handler = () => { callCount++; };
    bus.subscribe("SUBSCRIPTION_CANCELLED", handler);

    await bus.publish("SUBSCRIPTION_CANCELLED", {}, { source: "engine" });
    assert(callCount === 1, "Handler called once before unsubscribe");

    bus.unsubscribe("SUBSCRIPTION_CANCELLED", handler);

    await bus.publish("SUBSCRIPTION_CANCELLED", {}, { source: "engine" });
    assert(callCount === 1, "Handler not called after unsubscribe");
  });

  await test("Unsubscribe non-existent handler returns false", async () => {
    const handler = () => {};
    const result = bus.unsubscribe("SUBSCRIPTION_CANCELLED", handler);
    assert(result === false, "Returns false for unknown handler");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 5: Type validation
  // ══════════════════════════════════════════════════════════════════════════════

  await test("Publishing unknown event type throws in strict mode", async () => {
    let threw = false;
    try {
      await bus.publish("UNKNOWN_EVENT_TYPE", {});
    } catch (e) {
      threw = true;
      assert(e.message.includes("Unknown event type"), "Error message is descriptive");
    }
    assert(threw, "Exception was thrown");
  });

  await test("Subscribing to unknown event type throws in strict mode", async () => {
    let threw = false;
    try {
      bus.subscribe("BOGUS_TYPE", () => {});
    } catch (e) {
      threw = true;
    }
    assert(threw, "Exception was thrown");
  });

  await test("Non-strict bus allows custom event types", async () => {
    const flexBus = new EventBus({ strictTypes: false });
    let received = null;
    flexBus.subscribe("CUSTOM_EVENT", (evt) => { received = evt; });
    await flexBus.publish("CUSTOM_EVENT", { data: 42 });
    assert(received !== null, "Custom event delivered");
    assert(received.payload.data === 42, "Payload correct");
    flexBus.close();
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 6: Async subscribers
  // ══════════════════════════════════════════════════════════════════════════════

  await test("Async subscriber is awaited", async () => {
    let completed = false;
    const asyncHandler = async (evt) => {
      await new Promise((r) => setTimeout(r, 10));
      completed = true;
    };
    bus.subscribe("ANALYSIS_PURCHASED", asyncHandler);

    await bus.publish("ANALYSIS_PURCHASED", { matchKey: "test_match" }, { source: "checkout" });
    assert(completed === true, "Async handler completed before publish returned");

    bus.unsubscribe("ANALYSIS_PURCHASED", asyncHandler);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 7: Event Store (persistence)
  // ══════════════════════════════════════════════════════════════════════════════

  await test("Events are persisted to store", async () => {
    const { events, total } = store.query(100, 0);
    assert(total > 0, `Store has ${total} events`);
    const userCreated = events.find((e) => e.event_type === "USER_CREATED");
    assert(userCreated !== undefined, "First event type correct");
    assert(userCreated.source === "auth", "Source stored");
    assert(userCreated.result === "delivered", "Result stored as delivered");
  });

  await test("Failed subscriber recorded as partial_failure", async () => {
    const { events } = store.query(100, 0);
    const failedEvt = events.find((e) => e.result === "partial_failure");
    assert(failedEvt !== null, "Found partial_failure event");
    assert(failedEvt.event_type === "PAYMENT_FAILED", "Correct type for partial failure");
    assert(failedEvt.error.includes("subscriber crash"), "Error message stored");
  });

  await test("Query by type filters correctly", async () => {
    const { events, total } = store.queryByType("USER_CREATED", 10, 0);
    assert(total >= 1, "At least 1 USER_CREATED event");
    assert(events.every((e) => e.event_type === "USER_CREATED"), "All results are USER_CREATED");
  });

  await test("Event with no subscribers stored with subscriber_count 0", async () => {
    const { events } = store.queryByType("SUBSCRIPTION_EXPIRED", 10, 0);
    assert(events.length >= 1, "SUBSCRIPTION_EXPIRED event stored");
    assert(events[0].subscriber_count === 0, "subscriber_count is 0");
  });

  await test("Store records event envelope fields", async () => {
    const { events } = store.queryByType("PAYMENT_SUCCEEDED", 10, 0);
    assert(events.length >= 1, "PAYMENT_SUCCEEDED event found");
    const evt = events[0];
    assert(evt.event_id.startsWith("evt_"), "event_id has correct prefix");
    assert(evt.payload !== null, "Payload stored");
    const parsed = JSON.parse(evt.payload);
    assert(parsed.amount === 990, "Payload content correct");
    assert(evt.created_at !== null, "created_at set");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 8: Provider swap
  // ══════════════════════════════════════════════════════════════════════════════

  await test("Provider can be swapped at runtime", async () => {
    const customProvider = new InProcessProvider();
    const swapBus = new EventBus({ strictTypes: false });

    let called = false;
    customProvider.subscribe("TEST_EVENT", () => { called = true; });
    swapBus.setProvider(customProvider);

    await swapBus.publish("TEST_EVENT", {});
    assert(called === true, "New provider receives events after swap");
    swapBus.close();
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 9: All event types
  // ══════════════════════════════════════════════════════════════════════════════

  await test("All 9 event types are defined", async () => {
    const types = Object.keys(EVENT_TYPES);
    assert(types.length === 9, `${types.length} event types defined`);
    assert(types.includes("USER_CREATED"), "USER_CREATED");
    assert(types.includes("SUBSCRIPTION_CREATED"), "SUBSCRIPTION_CREATED");
    assert(types.includes("SUBSCRIPTION_UPDATED"), "SUBSCRIPTION_UPDATED");
    assert(types.includes("SUBSCRIPTION_CANCELLED"), "SUBSCRIPTION_CANCELLED");
    assert(types.includes("SUBSCRIPTION_EXPIRED"), "SUBSCRIPTION_EXPIRED");
    assert(types.includes("PAYMENT_SUCCEEDED"), "PAYMENT_SUCCEEDED");
    assert(types.includes("PAYMENT_FAILED"), "PAYMENT_FAILED");
    assert(types.includes("PAYMENT_REFUNDED"), "PAYMENT_REFUNDED");
    assert(types.includes("ANALYSIS_PURCHASED"), "ANALYSIS_PURCHASED");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 10: Envelope structure
  // ══════════════════════════════════════════════════════════════════════════════

  await test("Envelope contains all required fields", async () => {
    let envelope = null;
    const handler = (evt) => { envelope = evt; };
    bus.subscribe("PAYMENT_REFUNDED", handler);

    await bus.publish("PAYMENT_REFUNDED", { amount: 100 }, { source: "stripe", userId: 42, id: "evt_custom_id" });
    assert(envelope.id === "evt_custom_id", "Custom id used");
    assert(envelope.type === "PAYMENT_REFUNDED", "Type set");
    assert(envelope.source === "stripe", "Source set");
    assert(envelope.userId === 42, "userId set");
    assert(envelope.payload.amount === 100, "Payload set");
    assert(typeof envelope.timestamp === "string", "Timestamp set");

    bus.unsubscribe("PAYMENT_REFUNDED", handler);
  });

  // ── Cleanup ────────────────────────────────────────────────────────────────
  bus.close();
  db.close();
  fs.unlinkSync(DB_PATH);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n\nEVENT BUS TEST SUMMARY`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  if (failed === 0) {
    console.log(`\nAll Event Bus tests passed!\n`);
    process.exit(0);
  } else {
    console.log(`\nFailures:\n - ${failures.join("\n - ")}\n`);
    process.exit(1);
  }
})();

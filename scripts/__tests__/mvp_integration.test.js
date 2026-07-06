const Database = require("better-sqlite3");
const { CRM, CRM_EVENTS } = require("../crm");
const { LearningEngine, LEARNING_EVENTS } = require("../learning_engine");
const { LearningBridge } = require("../learning_bridge");
const { SnapshotStore } = require("../snapshot_store");
const { PublicationEngine } = require("../publication_engine");
const { HermesDashboard } = require("../hermes_dashboard");
const { bus, EVENT_NAMES } = require("../event_bus");

function makeFullDb() {
  const db = new Database(":memory:");
  new SnapshotStore(db);
  new LearningEngine(db);
  new CRM(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS concile_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_key TEXT NOT NULL,
      home TEXT NOT NULL,
      away TEXT NOT NULL,
      competition TEXT DEFAULT '',
      analysed_at TEXT DEFAULT (datetime('now')),
      best_bet TEXT NOT NULL,
      confidence INTEGER DEFAULT 0,
      raison TEXT DEFAULT '',
      consensus_votes INTEGER DEFAULT 0,
      agents_json TEXT DEFAULT '[]',
      outcome TEXT DEFAULT NULL,
      final_score_home INTEGER DEFAULT NULL,
      final_score_away INTEGER DEFAULT NULL,
      resolved_at TEXT DEFAULT NULL,
      result_source TEXT DEFAULT NULL,
      sport TEXT DEFAULT 'Football'
    );
  `);
  return db;
}

function makeEnv() {
  return {
    OPENROUTER_API_KEY: "test",
    TELEGRAM_BOT_TOKEN: "test",
    STRIPE_SECRET_KEY: "test",
    BREVO_API_KEY: "test",
    API_SPORTS_KEY: "test",
  };
}

beforeEach(() => {
  bus.removeAllListeners();
});

// ── 1. Stripe → CRM ──

describe("Stripe webhook → CRM integration", () => {
  test("checkout.session.completed activates CRM subscription", () => {
    const db = makeFullDb();
    const crm = new CRM(db);

    crm.activateSubscription("user@test.com", {
      plan: "premium",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_456",
      creditsMax: 10,
      expiresAt: "2026-08-06",
      stripeEventId: "evt_789",
    });

    const contact = crm.getContact("user@test.com");
    expect(contact).not.toBeNull();
    expect(contact.plan).toBe("premium");
    expect(contact.stripe_customer_id).toBe("cus_123");
    expect(contact.stripe_subscription_id).toBe("sub_456");
    expect(contact.credits_max).toBe(10);
  });

  test("subscription.deleted cancels CRM subscription", () => {
    const db = makeFullDb();
    const crm = new CRM(db);

    crm.activateSubscription("user@test.com", { plan: "premium" });
    crm.cancelSubscription("user@test.com", "stripe_subscription_deleted");

    const contact = crm.getContact("user@test.com");
    expect(contact.plan).toBe("free");
    expect(contact.status).toBe("cancelled");
  });

  test("refund cancels CRM subscription", () => {
    const db = makeFullDb();
    const crm = new CRM(db);

    crm.activateSubscription("user@test.com", { plan: "elite" });
    crm.cancelSubscription("user@test.com", "stripe_refund");

    const contact = crm.getContact("user@test.com");
    expect(contact.plan).toBe("free");
  });

  test("renewal updates CRM expiry", () => {
    const db = makeFullDb();
    const crm = new CRM(db);

    crm.activateSubscription("user@test.com", { plan: "premium", expiresAt: "2026-07-01" });
    crm.updateContact("user@test.com", { expires_at: "2026-08-01", credits_used: 0 });

    const contact = crm.getContact("user@test.com");
    expect(contact.expires_at).toBe("2026-08-01");
    expect(contact.credits_used).toBe(0);
  });
});

// ── 2. CRM → Event Bus ──

describe("CRM → Event Bus events", () => {
  test("activateSubscription publishes SUBSCRIPTION_ACTIVATED", () => {
    const db = makeFullDb();
    const crm = new CRM(db);
    const events = [];
    bus.on(CRM_EVENTS.SUBSCRIPTION_ACTIVATED, (p) => events.push(p));

    crm.activateSubscription("sub@test.com", { plan: "pro" });

    expect(events.length).toBe(1);
    expect(events[0].email).toBe("sub@test.com");
    expect(events[0].plan).toBe("pro");
  });

  test("cancelSubscription publishes SUBSCRIPTION_CANCELLED", () => {
    const db = makeFullDb();
    const crm = new CRM(db);
    crm.activateSubscription("sub@test.com", { plan: "pro" });

    const events = [];
    bus.on(CRM_EVENTS.SUBSCRIPTION_CANCELLED, (p) => events.push(p));
    crm.cancelSubscription("sub@test.com");

    expect(events.length).toBe(1);
    expect(events[0].old_plan).toBe("pro");
  });

  test("registerLead publishes LEAD_REGISTERED", () => {
    const db = makeFullDb();
    const crm = new CRM(db);
    const events = [];
    bus.on(CRM_EVENTS.LEAD_REGISTERED, (p) => events.push(p));

    crm.registerLead("lead@test.com", { source: "tiktok" });

    expect(events.length).toBe(1);
    expect(events[0].source).toBe("tiktok");
  });
});

// ── 3. Publication Engine → Event Bus → Telegram ──

describe("Publication Engine → Event Bus flow", () => {
  test("PUBLISH fires OFFICIAL_PREDICTION_PUBLISHED on event bus", () => {
    const db = makeFullDb();
    const ss = new SnapshotStore(db);
    const pubEngine = new PublicationEngine({ snapshotStore: ss });
    const events = [];
    bus.on(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, (s) => events.push(s));

    const analysis = {
      match_key: "Arsenal_Chelsea",
      best_bet: "Under 2.5 buts",
      confidence: 82,
      consensus_votes: 4,
      total_agents: 5,
      raison: "test",
      agents: [{ name: "Bot1", bet: "Under 2.5 buts", confidence: 80 }],
    };
    const match = { id: "12345", home: "Arsenal", away: "Chelsea", minute: 45, competition: "PL", sport: "Football" };

    pubEngine.process(analysis, match);

    expect(events.length).toBe(1);
    expect(events[0].home).toBe("Arsenal");
    expect(events[0].selection).toBe("Under 2.5 buts");
  });
});

// ── 4. Learning Engine auto-learning ──

describe("Learning Engine auto-learning after match", () => {
  test("evaluateMatch records result and updates stats", () => {
    const db = makeFullDb();
    const ss = new SnapshotStore(db);
    const engine = new LearningEngine(db);

    const analysis = {
      match_key: "Arsenal_Chelsea",
      best_bet: "Under 2.5 buts",
      confidence: 82,
      consensus_votes: 4,
      total_agents: 5,
      raison: "test",
      agents: [
        { name: "Bot1", bet: "Under 2.5 buts", confidence: 80 },
        { name: "Bot2", bet: "Over 2.5 buts", confidence: 60 },
      ],
    };
    const match = { id: "12345", home: "Arsenal", away: "Chelsea", competition: "PL", sport: "Football" };
    ss.createSnapshot(analysis, match, 50);

    const snap = db.prepare("SELECT * FROM official_prediction_snapshots LIMIT 1").get();
    const result = engine.evaluateMatch(snap, 1, 0);

    expect(result).not.toBeNull();
    expect(result.outcome).toBe("win");

    const stats = engine.getAgentStats();
    const bot1 = stats.find(s => s.agent_name === "Bot1");
    expect(bot1.wins).toBe(1);
    const bot2 = stats.find(s => s.agent_name === "Bot2");
    expect(bot2.losses).toBe(1);
  });

  test("MATCH_EVALUATED event fires on evaluation", () => {
    const db = makeFullDb();
    const ss = new SnapshotStore(db);
    const engine = new LearningEngine(db);
    const events = [];
    bus.on(LEARNING_EVENTS.MATCH_EVALUATED, (p) => events.push(p));

    const analysis = {
      match_key: "Lyon_PSG",
      best_bet: "Under 2.5 buts",
      confidence: 75,
      consensus_votes: 3,
      total_agents: 5,
      raison: "test",
      agents: [{ name: "Bot1", bet: "Under 2.5 buts", confidence: 75 }],
    };
    ss.createSnapshot(analysis, { id: "99", home: "Lyon", away: "PSG", competition: "L1", sport: "Football" }, 45);

    const snap = db.prepare("SELECT * FROM official_prediction_snapshots LIMIT 1").get();
    engine.evaluateMatch(snap, 0, 0);

    expect(events.length).toBe(1);
    expect(events[0].outcome).toBe("win");
  });
});

// ── 5. Learning Bridge → Hermès Chief ──

describe("Learning Bridge → Hermès decision", () => {
  test("formatAgentVoteLine uses Learning Engine weights", () => {
    const db = makeFullDb();
    const bridge = new LearningBridge(db);

    db.prepare(`
      INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight, roi, precision_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run("Groq", 20, 14, 6, 70, 1.10, 12.5, 80);

    const line = bridge.formatAgentVoteLine({ name: "Groq", bet: "Under 2.5 buts", confidence: 78 }, {});
    expect(line).toContain("Learning Engine");
    expect(line).toContain("poids 1.10");
  });

  test("getWeightedAgentContext returns proper weight", () => {
    const db = makeFullDb();
    const bridge = new LearningBridge(db);

    db.prepare(`
      INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight, roi, precision_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run("DeepSeek", 25, 20, 5, 80, 1.20, 18, 85);

    const ctx = bridge.getWeightedAgentContext("DeepSeek");
    expect(ctx.source).toBe("learning_engine");
    expect(ctx.rawWeight).toBe(1.20);
    expect(ctx.weight).toBeGreaterThan(50);
  });
});

// ── 6. Dashboard reads all modules correctly ──

describe("Dashboard reads all modules", () => {
  test("getFullDashboard includes all sections", () => {
    const db = makeFullDb();
    const env = makeEnv();
    const dashboard = new HermesDashboard(db, env);
    const full = dashboard.getFullDashboard();

    expect(full.health).toBeDefined();
    expect(full.infrastructure).toBeDefined();
    expect(full.payments).toBeDefined();
    expect(full.agents).toBeDefined();
    expect(full.competitions).toBeDefined();
    expect(full.learningEngine).toBeDefined();
    expect(full.publications).toBeDefined();
    expect(full.journal).toBeDefined();
  });

  test("dashboard reflects CRM data via Learning Engine", () => {
    const db = makeFullDb();
    const engine = new LearningEngine(db);

    db.prepare(`
      INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("TestBot", 10, 7, 3, 70, 1.05);

    const dashboard = new HermesDashboard(db, makeEnv());
    const agents = dashboard.getAgents();
    const testBot = agents.find(a => a.name === "TestBot");
    expect(testBot).toBeDefined();
    expect(testBot.winrate).toBe(70);
    expect(testBot.weight).toBe(1.05);
  });
});

// ── 7. Full flow: Stripe → CRM → Publication → Event Bus → Learning ──

describe("Full MVP flow integration", () => {
  test("complete flow: subscribe → publish → learn → dashboard", () => {
    const db = makeFullDb();
    const crm = new CRM(db);
    const ss = new SnapshotStore(db);
    const engine = new LearningEngine(db);
    const bridge = new LearningBridge(db);
    const pubEngine = new PublicationEngine({ snapshotStore: ss });
    const dashboard = new HermesDashboard(db, makeEnv());

    // 1. User subscribes (Stripe → CRM)
    crm.activateSubscription("pro@test.com", { plan: "premium", stripeCustomerId: "cus_flow" });
    const contact = crm.getContact("pro@test.com");
    expect(contact.plan).toBe("premium");

    // 2. Concile publishes prediction (Publication Engine → Event Bus)
    const pubEvents = [];
    bus.on(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, (s) => pubEvents.push(s));

    const analysis = {
      match_key: "Real_Barca",
      best_bet: "Under 2.5 buts",
      confidence: 85,
      consensus_votes: 4,
      total_agents: 5,
      raison: "Clasico defensif",
      agents: [
        { name: "Agent1", bet: "Under 2.5 buts", confidence: 85 },
        { name: "Agent2", bet: "Under 2.5 buts", confidence: 80 },
      ],
    };
    pubEngine.process(analysis, { id: "CL1", home: "Real", away: "Barca", minute: 50, competition: "La Liga", sport: "Football" });
    expect(pubEvents.length).toBe(1);

    // 3. Match finishes → Learning Engine evaluates (auto-learn)
    const snap = db.prepare("SELECT * FROM official_prediction_snapshots LIMIT 1").get();
    const result = engine.evaluateMatch(snap, 1, 0);
    expect(result.outcome).toBe("win");

    // 4. Learning Engine updates weights
    engine.recalculateROI();
    const changes = engine.recalculateWeights();

    // 5. Bridge reads updated data for next Concile
    const agent1Ctx = bridge.getWeightedAgentContext("Agent1");
    expect(agent1Ctx.source).toBe("neutral");

    // 6. Dashboard shows everything
    const full = dashboard.getFullDashboard();
    expect(full.learningEngine.totalMatches).toBe(1);
    expect(full.learningEngine.totalWins).toBe(1);
    expect(full.agents.length).toBe(2);
    expect(full.publications.totalSnapshots).toBe(1);

    // 7. CRM stats available
    const stats = crm.getContactStats();
    expect(stats.total).toBe(1);
    expect(stats.byPlan.premium).toBe(1);
  });
});

// ── 8. Event Bus event propagation ──

describe("Event Bus propagation across modules", () => {
  test("CRM events are captured in bus history", () => {
    const db = makeFullDb();
    const crm = new CRM(db);

    crm.registerLead("test@bus.com", { source: "organic" });
    crm.activateSubscription("test@bus.com", { plan: "pro" });

    const history = bus.getHistory(null, 20);
    const crmEvents = history.filter(e =>
      [CRM_EVENTS.LEAD_REGISTERED, CRM_EVENTS.CONTACT_CREATED, CRM_EVENTS.SUBSCRIPTION_ACTIVATED, CRM_EVENTS.PLAN_CHANGED, CRM_EVENTS.CONTACT_UPDATED].includes(e.name)
    );
    expect(crmEvents.length).toBeGreaterThan(0);
  });

  test("Publication events are captured in bus history", () => {
    const db = makeFullDb();
    const ss = new SnapshotStore(db);
    const pubEngine = new PublicationEngine({ snapshotStore: ss });

    pubEngine.process(
      { match_key: "A_B", best_bet: "Under 2.5 buts", confidence: 90, consensus_votes: 5, total_agents: 5, raison: "test", agents: [{ name: "X", bet: "Under 2.5 buts", confidence: 90 }] },
      { id: "1", home: "A", away: "B", minute: 60, competition: "L1", sport: "Football" }
    );

    const history = bus.getHistory(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, 5);
    expect(history.length).toBeGreaterThan(0);
  });

  test("Learning events are captured in bus history", () => {
    const db = makeFullDb();
    const ss = new SnapshotStore(db);
    const engine = new LearningEngine(db);

    ss.createSnapshot(
      { match_key: "C_D", best_bet: "Under 2.5 buts", confidence: 80, consensus_votes: 4, total_agents: 5, raison: "t", agents: [{ name: "Y", bet: "Under 2.5 buts", confidence: 80 }] },
      { id: "2", home: "C", away: "D", competition: "PL", sport: "Football" },
      55
    );

    const snap = db.prepare("SELECT * FROM official_prediction_snapshots LIMIT 1").get();
    engine.evaluateMatch(snap, 0, 1);

    const history = bus.getHistory(LEARNING_EVENTS.MATCH_EVALUATED, 5);
    expect(history.length).toBeGreaterThan(0);
  });
});

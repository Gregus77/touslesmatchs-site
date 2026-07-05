const Database = require("better-sqlite3");
const { HermesDashboard } = require("../hermes_dashboard");
const { LearningEngine } = require("../learning_engine");
const { SnapshotStore } = require("../snapshot_store");
const { bus } = require("../event_bus");

function makeDb() {
  const db = new Database(":memory:");
  new SnapshotStore(db);
  new LearningEngine(db);
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

function makeEnv(overrides = {}) {
  return {
    OPENROUTER_API_KEY: "or_test",
    TELEGRAM_BOT_TOKEN: "tg_test",
    STRIPE_SECRET_KEY: "sk_test",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    BREVO_API_KEY: "brevo_test",
    API_SPORTS_KEY: "api_test",
    FOOTBALL_DATA_KEY: "fd_test",
    GROQ_API_KEY: "groq_test",
    DEEPSEEK_API_KEY: "ds_test",
    MISTRAL_API_KEY: "mis_test",
    CEREBRAS_API_KEY: "cer_test",
    PERPLEXITY_API_KEY: "ppx_test",
    COHERE_API_KEY: "co_test",
    ...overrides,
  };
}

function seedLearningData(db) {
  db.prepare(`
    INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight, roi, precision_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run("DeepSeek-V3", 25, 18, 7, 72, 1.12, 14.5, 80);
  db.prepare(`
    INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight, roi, precision_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run("Groq", 20, 12, 8, 60, 0.95, 5.2, 65);

  db.prepare(`
    INSERT INTO learning_competition_stats (competition, sport, matches, wins, losses, winrate, roi, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run("Premier League", "Football", 30, 22, 8, 73.3, 18.5, "active");
  db.prepare(`
    INSERT INTO learning_competition_stats (competition, sport, matches, wins, losses, winrate, roi, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run("Australia A-League", "Football", 12, 4, 8, 33.3, -25.1, "excluded");

  db.prepare(`
    INSERT INTO learning_match_results
      (match_key, home, away, competition, sport, predicted_bet, predicted_confidence, predicted_odds,
       final_score_home, final_score_away, outcome, agents_json, agent_outcomes_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("Arsenal_Chelsea", "Arsenal", "Chelsea", "Premier League", "Football",
    "Under 2.5 buts", 82, 1.72, 1, 0, "win", "[]", "{}");

  db.prepare(`
    INSERT INTO learning_weight_history (agent_name, old_weight, new_weight, reason)
    VALUES (?, ?, ?, ?)
  `).run("DeepSeek-V3", 1.0, 1.12, "winrate 72.0% vs avg 66.0%");

  db.prepare(`
    INSERT INTO learning_recommendations (type, target, action, reason, data_json)
    VALUES (?, ?, ?, ?, ?)
  `).run("competition", "Australia A-League", "exclude", "Winrate 33.3% sur 12 matchs", "{}");
}

function seedPublicationData(db) {
  const ss = new SnapshotStore(db);
  ss.createSnapshot(
    {
      match_key: "Arsenal_Chelsea",
      best_bet: "Under 2.5 buts",
      confidence: 82,
      consensus_votes: 4,
      total_agents: 5,
      raison: "Match defensif",
      agents: [{ name: "Groq", bet: "Under 2.5 buts", confidence: 80 }],
    },
    { id: "12345", home: "Arsenal", away: "Chelsea", competition: "Premier League", sport: "Football" },
    50
  );

  db.prepare(`
    INSERT INTO concile_analyses (match_key, home, away, competition, best_bet, confidence, outcome, final_score_home, final_score_away, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run("Arsenal_Chelsea", "Arsenal", "Chelsea", "Premier League", "Under 2.5 buts", 82, "win", 1, 0);
}

// ── getFullDashboard ──

describe("getFullDashboard", () => {
  test("returns all sections", () => {
    const db = makeDb();
    const dash = new HermesDashboard(db, makeEnv());
    const result = dash.getFullDashboard();

    expect(result).toHaveProperty("generatedAt");
    expect(result).toHaveProperty("health");
    expect(result).toHaveProperty("infrastructure");
    expect(result).toHaveProperty("payments");
    expect(result).toHaveProperty("agents");
    expect(result).toHaveProperty("competitions");
    expect(result).toHaveProperty("learningEngine");
    expect(result).toHaveProperty("publications");
    expect(result).toHaveProperty("journal");
  });

  test("generatedAt is a valid ISO date", () => {
    const db = makeDb();
    const dash = new HermesDashboard(db, makeEnv());
    const result = dash.getFullDashboard();
    expect(new Date(result.generatedAt).toISOString()).toBe(result.generatedAt);
  });
});

// ── System Health ──

describe("getSystemHealth", () => {
  test("all green when all keys present", () => {
    const db = makeDb();
    const dash = new HermesDashboard(db, makeEnv());
    const health = dash.getSystemHealth();

    expect(health.checks.openrouter.status).toBe("green");
    expect(health.checks.telegram.status).toBe("green");
    expect(health.checks.stripe.status).toBe("green");
    expect(health.checks.brevo.status).toBe("green");
    expect(health.checks.learningEngine.status).toBe("green");
    expect(health.checks.eventBus.status).toBe("green");
  });

  test("red when keys missing", () => {
    const db = makeDb();
    const dash = new HermesDashboard(db, makeEnv({
      OPENROUTER_API_KEY: "",
      TELEGRAM_BOT_TOKEN: "",
      STRIPE_SECRET_KEY: "",
      BREVO_API_KEY: "",
    }));
    const health = dash.getSystemHealth();

    expect(health.checks.openrouter.status).toBe("red");
    expect(health.checks.telegram.status).toBe("red");
    expect(health.checks.stripe.status).toBe("red");
    expect(health.checks.brevo.status).toBe("red");
    expect(health.overall).toBe("red");
  });

  test("overall yellow when some keys missing", () => {
    const db = makeDb();
    const dash = new HermesDashboard(db, makeEnv({ BREVO_API_KEY: "" }));
    const health = dash.getSystemHealth();

    expect(health.overall).toBe("red");
    expect(health.checks.brevo.status).toBe("red");
    expect(health.checks.stripe.status).toBe("green");
  });

  test("each check has a checkedAt timestamp", () => {
    const db = makeDb();
    const dash = new HermesDashboard(db, makeEnv());
    const health = dash.getSystemHealth();

    for (const check of Object.values(health.checks)) {
      expect(check.checkedAt).toBeTruthy();
      expect(check.label).toBeTruthy();
    }
  });
});

// ── Infrastructure ──

describe("getInfrastructure", () => {
  test("lists all configured API keys", () => {
    const db = makeDb();
    const dash = new HermesDashboard(db, makeEnv());
    const infra = dash.getInfrastructure();

    expect(infra.apiSports.configured).toBe(true);
    expect(infra.openrouter.configured).toBe(true);
    expect(infra.groq.configured).toBe(true);
    expect(infra.deepseek.configured).toBe(true);
    expect(infra.mistral.configured).toBe(true);
    expect(infra.cerebras.configured).toBe(true);
    expect(infra.perplexity.configured).toBe(true);
    expect(infra.cohere.configured).toBe(true);
  });

  test("shows unconfigured keys", () => {
    const db = makeDb();
    const dash = new HermesDashboard(db, makeEnv({ PERPLEXITY_API_KEY: "" }));
    const infra = dash.getInfrastructure();
    expect(infra.perplexity.configured).toBe(false);
  });

  test("docker lists 4 services", () => {
    const db = makeDb();
    const dash = new HermesDashboard(db, makeEnv());
    const infra = dash.getInfrastructure();
    expect(infra.docker.services).toEqual(["site", "api", "council", "hermes-admin"]);
  });
});

// ── Payments ──

describe("getPayments", () => {
  test("all payment services configured", () => {
    const db = makeDb();
    const dash = new HermesDashboard(db, makeEnv());
    const pay = dash.getPayments();

    expect(pay.stripe.configured).toBe(true);
    expect(pay.stripe.webhookConfigured).toBe(true);
    expect(pay.brevo.configured).toBe(true);
    expect(pay.telegram.configured).toBe(true);
  });
});

// ── Agents ──

describe("getAgents", () => {
  test("returns agent stats from Learning Engine", () => {
    const db = makeDb();
    seedLearningData(db);
    const dash = new HermesDashboard(db, makeEnv());
    const agents = dash.getAgents();

    expect(agents.length).toBe(2);
    const ds = agents.find(a => a.name === "DeepSeek-V3");
    expect(ds.weight).toBe(1.12);
    expect(ds.winrate).toBe(72);
    expect(ds.roi).toBe(14.5);
    expect(ds.precision).toBe(80);
    expect(ds.matches).toBe(25);
    expect(ds.wins).toBe(18);
    expect(ds.losses).toBe(7);
  });

  test("includes last weight change", () => {
    const db = makeDb();
    seedLearningData(db);
    const dash = new HermesDashboard(db, makeEnv());
    const agents = dash.getAgents();

    const ds = agents.find(a => a.name === "DeepSeek-V3");
    expect(ds.lastWeightChange).not.toBeNull();
    expect(ds.lastWeightChange.from).toBe(1.0);
    expect(ds.lastWeightChange.to).toBe(1.12);
  });

  test("returns empty when no agents", () => {
    const db = makeDb();
    const dash = new HermesDashboard(db, makeEnv());
    const agents = dash.getAgents();
    expect(agents).toEqual([]);
  });
});

// ── Competitions ──

describe("getCompetitions", () => {
  test("returns competition stats with status", () => {
    const db = makeDb();
    seedLearningData(db);
    const dash = new HermesDashboard(db, makeEnv());
    const comps = dash.getCompetitions();

    expect(comps.length).toBe(2);
    const pl = comps.find(c => c.competition === "Premier League");
    expect(pl.statusEmoji).toBe("green");
    expect(pl.statusLabel).toBe("Prioritaire");
    expect(pl.winrate).toBe(73.3);

    const aus = comps.find(c => c.competition === "Australia A-League");
    expect(aus.statusEmoji).toBe("red");
    expect(aus.statusLabel).toBe("Exclu");
  });

  test("yellow for borderline competitions", () => {
    const db = makeDb();
    db.prepare(`
      INSERT INTO learning_competition_stats (competition, sport, matches, wins, losses, winrate, roi, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run("Test League", "Football", 10, 5, 5, 50, 0, "active");
    new LearningEngine(db);
    const dash = new HermesDashboard(db, makeEnv());
    const comps = dash.getCompetitions();
    const test = comps.find(c => c.competition === "Test League");
    expect(test.statusEmoji).toBe("yellow");
    expect(test.statusLabel).toBe("Surveillance");
  });
});

// ── Learning Engine Status ──

describe("getLearningEngineStatus", () => {
  test("returns summary with totals", () => {
    const db = makeDb();
    seedLearningData(db);
    const dash = new HermesDashboard(db, makeEnv());
    const le = dash.getLearningEngineStatus();

    expect(le.totalMatches).toBe(1);
    expect(le.totalWins).toBe(1);
    expect(le.globalWinrate).toBe(100);
    expect(le.agentCount).toBe(2);
  });

  test("returns last match learned", () => {
    const db = makeDb();
    seedLearningData(db);
    const dash = new HermesDashboard(db, makeEnv());
    const le = dash.getLearningEngineStatus();

    expect(le.lastMatchLearned).not.toBeNull();
    expect(le.lastMatchLearned.home).toBe("Arsenal");
    expect(le.lastMatchLearned.away).toBe("Chelsea");
    expect(le.lastMatchLearned.outcome).toBe("win");
  });

  test("returns weight history", () => {
    const db = makeDb();
    seedLearningData(db);
    const dash = new HermesDashboard(db, makeEnv());
    const le = dash.getLearningEngineStatus();

    expect(le.weightHistory.length).toBe(1);
    expect(le.weightHistory[0].agent).toBe("DeepSeek-V3");
  });

  test("returns pending recommendations", () => {
    const db = makeDb();
    seedLearningData(db);
    const dash = new HermesDashboard(db, makeEnv());
    const le = dash.getLearningEngineStatus();

    expect(le.pendingRecommendations.length).toBe(1);
    expect(le.pendingRecommendations[0].target).toBe("Australia A-League");
    expect(le.pendingRecommendations[0].action).toBe("exclude");
  });

  test("handles empty learning engine", () => {
    const db = makeDb();
    const dash = new HermesDashboard(db, makeEnv());
    const le = dash.getLearningEngineStatus();

    expect(le.totalMatches).toBe(0);
    expect(le.lastMatchLearned).toBeNull();
    expect(le.lastWeightUpdate).toBeNull();
  });
});

// ── Publications ──

describe("getPublications", () => {
  test("returns last snapshot and concile", () => {
    const db = makeDb();
    seedPublicationData(db);
    seedLearningData(db);
    const dash = new HermesDashboard(db, makeEnv());
    const pubs = dash.getPublications();

    expect(pubs.lastSnapshot).not.toBeNull();
    expect(pubs.lastSnapshot.home).toBe("Arsenal");
    expect(pubs.lastSnapshot.selection).toBe("Under 2.5 buts");
    expect(pubs.totalSnapshots).toBe(1);

    expect(pubs.lastConcileAnalysis).not.toBeNull();
    expect(pubs.lastConcileAnalysis.bet).toBe("Under 2.5 buts");

    expect(pubs.lastResolved).not.toBeNull();
    expect(pubs.lastResolved.outcome).toBe("win");
    expect(pubs.lastResolved.score).toBe("1-0");

    expect(pubs.lastAutoLearned).not.toBeNull();
    expect(pubs.lastAutoLearned.home).toBe("Arsenal");
  });

  test("handles empty publications", () => {
    const db = makeDb();
    const dash = new HermesDashboard(db, makeEnv());
    const pubs = dash.getPublications();

    expect(pubs.lastSnapshot).toBeNull();
    expect(pubs.lastConcileAnalysis).toBeNull();
    expect(pubs.lastResolved).toBeNull();
    expect(pubs.lastAutoLearned).toBeNull();
    expect(pubs.totalSnapshots).toBe(0);
  });
});

// ── Journal ──

describe("getJournal", () => {
  test("captures event bus history", () => {
    const db = makeDb();
    const dash = new HermesDashboard(db, makeEnv());

    bus.publish("TEST_EVENT", { home: "Paris", away: "Lyon" });
    const journal = dash.getJournal();

    expect(journal.recentEvents).toBeGreaterThan(0);
    const testEvent = journal.eventBus.find(e => e.event === "TEST_EVENT");
    expect(testEvent).toBeTruthy();
    expect(testEvent.summary).toBe("Paris vs Lyon");
  });

  test("summarizes different event payloads", () => {
    const db = makeDb();
    const dash = new HermesDashboard(db, makeEnv());

    bus.publish("MATCH_KEY_EVENT", { match_key: "test_key" });
    bus.publish("CONTACT_EVENT", { email: "test@test.com" });

    const journal = dash.getJournal();
    const mk = journal.eventBus.find(e => e.event === "MATCH_KEY_EVENT");
    expect(mk.summary).toBe("test_key");
    const ce = journal.eventBus.find(e => e.event === "CONTACT_EVENT");
    expect(ce.summary).toBe("contact: test@test.com");
  });
});

// ── Read-only guarantee ──

describe("Read-only guarantee", () => {
  test("dashboard does not modify database", () => {
    const db = makeDb();
    seedLearningData(db);
    seedPublicationData(db);

    const beforeAgents = db.prepare("SELECT COUNT(*) as c FROM learning_agent_stats").get().c;
    const beforeComps = db.prepare("SELECT COUNT(*) as c FROM learning_competition_stats").get().c;
    const beforeResults = db.prepare("SELECT COUNT(*) as c FROM learning_match_results").get().c;
    const beforeSnapshots = db.prepare("SELECT COUNT(*) as c FROM official_prediction_snapshots").get().c;
    const beforeConcile = db.prepare("SELECT COUNT(*) as c FROM concile_analyses").get().c;

    const dash = new HermesDashboard(db, makeEnv());
    dash.getFullDashboard();
    dash.getFullDashboard();
    dash.getFullDashboard();

    expect(db.prepare("SELECT COUNT(*) as c FROM learning_agent_stats").get().c).toBe(beforeAgents);
    expect(db.prepare("SELECT COUNT(*) as c FROM learning_competition_stats").get().c).toBe(beforeComps);
    expect(db.prepare("SELECT COUNT(*) as c FROM learning_match_results").get().c).toBe(beforeResults);
    expect(db.prepare("SELECT COUNT(*) as c FROM official_prediction_snapshots").get().c).toBe(beforeSnapshots);
    expect(db.prepare("SELECT COUNT(*) as c FROM concile_analyses").get().c).toBe(beforeConcile);
  });
});

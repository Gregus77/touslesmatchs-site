const Database = require("better-sqlite3");
const { LearningEngine, LEARNING_EVENTS } = require("../learning_engine");
const { LearningBridge } = require("../learning_bridge");
const { SnapshotStore } = require("../snapshot_store");
const { bus } = require("../event_bus");

function makeDb() {
  const db = new Database(":memory:");
  return db;
}

function makeFullDb() {
  const db = makeDb();
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

function createSnapshot(db, overrides = {}) {
  const ss = new SnapshotStore(db);
  const analysis = {
    match_key: overrides.match_key || "Arsenal_Chelsea",
    best_bet: overrides.bet || "Under 2.5 buts",
    confidence: overrides.confidence || 82,
    consensus_votes: 4,
    total_agents: 5,
    raison: "Test",
    agents: overrides.agents || [
      { name: "Perplexity-Web", bet: "Under 2.5 buts", confidence: 80 },
      { name: "DeepSeek-V3", bet: "Under 2.5 buts", confidence: 85 },
      { name: "Mistral-Large", bet: "Over 2.5 buts", confidence: 60 },
      { name: "Cohere-Command", bet: "Under 2.5 buts", confidence: 78 },
      { name: "Claude Chief", bet: "Under 2.5 buts", confidence: 82, isChief: true },
    ],
  };
  const match = {
    id: overrides.id || "12345",
    home: overrides.home || "Arsenal",
    away: overrides.away || "Chelsea",
    competition: overrides.competition || "Premier League",
    sport: overrides.sport || "Football",
  };
  return ss.createSnapshot(analysis, match, 50);
}

function simulateAutoLearn(db, home, away, scoreHome, scoreAway) {
  const bridge = new LearningBridge(db);
  const engine = bridge.getEngine();

  const hw = String(home || "").split(" ")[0];
  const aw = String(away || "").split(" ")[0];
  if (!hw || !aw) return { learned: 0, weightChanges: [] };

  const snapshots = db.prepare(
    "SELECT * FROM official_prediction_snapshots WHERE home LIKE ? AND away LIKE ? AND status = 'published'"
  ).all(`%${hw}%`, `%${aw}%`);

  let learned = 0;
  for (const snap of snapshots) {
    const result = engine.evaluateMatch(snap, scoreHome, scoreAway);
    if (result) learned++;
  }

  let weightChanges = [];
  if (learned > 0) {
    engine.recalculateROI();
    weightChanges = engine.recalculateWeights();
  }

  return { learned, weightChanges };
}

// ── Auto-learning trigger ──

describe("Auto-learning on match finish", () => {
  test("evaluates snapshot when match finishes with Under 2.5 win", () => {
    const db = makeFullDb();
    createSnapshot(db);

    const { learned } = simulateAutoLearn(db, "Arsenal", "Chelsea", 1, 0);
    expect(learned).toBe(1);

    const engine = new LearningEngine(db);
    const results = engine.getMatchResults();
    expect(results.length).toBe(1);
    expect(results[0].outcome).toBe("win");
    expect(results[0].final_score_home).toBe(1);
    expect(results[0].final_score_away).toBe(0);
  });

  test("evaluates snapshot when match finishes with Under 2.5 loss", () => {
    const db = makeFullDb();
    createSnapshot(db);

    const { learned } = simulateAutoLearn(db, "Arsenal", "Chelsea", 2, 1);
    expect(learned).toBe(1);

    const engine = new LearningEngine(db);
    const results = engine.getMatchResults();
    expect(results[0].outcome).toBe("loss");
  });

  test("updates all agent stats automatically", () => {
    const db = makeFullDb();
    createSnapshot(db);

    simulateAutoLearn(db, "Arsenal", "Chelsea", 1, 0);

    const engine = new LearningEngine(db);
    const stats = engine.getAgentStats();

    expect(stats.length).toBe(5);
    const perplexity = stats.find(s => s.agent_name === "Perplexity-Web");
    expect(perplexity.wins).toBe(1);
    expect(perplexity.matches).toBe(1);

    const mistral = stats.find(s => s.agent_name === "Mistral-Large");
    expect(mistral.losses).toBe(1);
  });

  test("updates competition stats automatically", () => {
    const db = makeFullDb();
    createSnapshot(db);

    simulateAutoLearn(db, "Arsenal", "Chelsea", 1, 0);

    const engine = new LearningEngine(db);
    const comps = engine.getCompetitionStats();
    const pl = comps.find(c => c.competition === "Premier League");
    expect(pl).toBeTruthy();
    expect(pl.wins).toBe(1);
  });

  test("calculates ROI after learning", () => {
    const db = makeFullDb();
    createSnapshot(db);

    simulateAutoLearn(db, "Arsenal", "Chelsea", 1, 0);

    const engine = new LearningEngine(db);
    const stats = engine.getAgentStats();
    const perplexity = stats.find(s => s.agent_name === "Perplexity-Web");
    expect(perplexity.roi).toBeDefined();
  });
});

// ── Duplicate prevention ──

describe("Duplicate prevention", () => {
  test("does not re-evaluate same snapshot twice", () => {
    const db = makeFullDb();
    createSnapshot(db);

    const first = simulateAutoLearn(db, "Arsenal", "Chelsea", 1, 0);
    const second = simulateAutoLearn(db, "Arsenal", "Chelsea", 1, 0);

    expect(first.learned).toBe(1);
    expect(second.learned).toBe(0);

    const engine = new LearningEngine(db);
    expect(engine.getMatchResults().length).toBe(1);
  });

  test("handles multiple snapshots for different matches", () => {
    const db = makeFullDb();
    createSnapshot(db, { match_key: "Arsenal_Chelsea", home: "Arsenal", away: "Chelsea" });
    createSnapshot(db, { match_key: "Liverpool_ManCity", home: "Liverpool", away: "Man City", id: "99999" });

    simulateAutoLearn(db, "Arsenal", "Chelsea", 1, 0);
    simulateAutoLearn(db, "Liverpool", "Man City", 2, 2);

    const engine = new LearningEngine(db);
    const results = engine.getMatchResults();
    expect(results.length).toBe(2);

    const arsenal = results.find(r => r.home === "Arsenal");
    expect(arsenal.outcome).toBe("win");

    const liverpool = results.find(r => r.home === "Liverpool");
    expect(liverpool.outcome).toBe("loss");
  });
});

// ── Error handling ──

describe("Error handling", () => {
  test("handles missing snapshot gracefully", () => {
    const db = makeFullDb();

    const { learned } = simulateAutoLearn(db, "Nobody", "NoTeam", 1, 0);
    expect(learned).toBe(0);
  });

  test("handles null scores gracefully", () => {
    const db = makeFullDb();
    createSnapshot(db);

    const bridge = new LearningBridge(db);
    const engine = bridge.getEngine();
    const snap = db.prepare("SELECT * FROM official_prediction_snapshots LIMIT 1").get();

    expect(engine.evaluateMatch(snap, null, 0)).toBeNull();
    expect(engine.evaluateMatch(snap, 1, null)).toBeNull();
    expect(engine.evaluateMatch(snap, undefined, 0)).toBeNull();
  });

  test("handles unresolvable bet types", () => {
    const db = makeFullDb();
    createSnapshot(db, {
      match_key: "weird_bet_match",
      bet: "Something Weird Unsupported",
      agents: [{ name: "TestBot", bet: "Something Weird Unsupported", confidence: 70 }],
    });

    const { learned } = simulateAutoLearn(db, "Arsenal", "Chelsea", 1, 0);
    expect(learned).toBe(0);
  });
});

// ── Weight evolution ──

describe("Weight evolution over multiple matches", () => {
  test("weights change after enough matches", () => {
    const db = makeFullDb();

    for (let i = 0; i < 12; i++) {
      const agents = [
        { name: "StrongBot", bet: "Under 2.5 buts", confidence: 80 },
        { name: "WeakBot", bet: "Over 2.5 buts", confidence: 60 },
      ];
      createSnapshot(db, {
        match_key: `match_${i}`,
        home: "Team A",
        away: "Team B",
        id: `${1000 + i}`,
        agents,
        bet: "Under 2.5 buts",
      });
      simulateAutoLearn(db, "Team A", "Team B", 1, 0);
    }

    const engine = new LearningEngine(db);
    const stats = engine.getAgentStats();
    const strong = stats.find(s => s.agent_name === "StrongBot");
    const weak = stats.find(s => s.agent_name === "WeakBot");

    expect(strong.wins).toBe(12);
    expect(strong.losses).toBe(0);
    expect(strong.winrate).toBe(100);

    expect(weak.wins).toBe(0);
    expect(weak.losses).toBe(12);
    expect(weak.winrate).toBe(0);

    expect(strong.weight).toBeGreaterThan(weak.weight);
  });

  test("competition stats accumulate correctly", () => {
    const db = makeFullDb();

    for (let i = 0; i < 5; i++) {
      createSnapshot(db, {
        match_key: `pl_${i}`, home: "Team A", away: "Team B", id: `${2000 + i}`,
        competition: "Premier League",
        agents: [{ name: "Bot", bet: "Under 2.5 buts", confidence: 75 }],
      });
      simulateAutoLearn(db, "Team A", "Team B", 1, 0);
    }

    for (let i = 0; i < 5; i++) {
      createSnapshot(db, {
        match_key: `bad_${i}`, home: "Team C", away: "Team D", id: `${3000 + i}`,
        competition: "Bad League",
        agents: [{ name: "Bot", bet: "Under 2.5 buts", confidence: 75 }],
      });
      simulateAutoLearn(db, "Team C", "Team D", 2, 1);
    }

    const engine = new LearningEngine(db);
    const comps = engine.getCompetitionStats();

    const pl = comps.find(c => c.competition === "Premier League");
    expect(pl.winrate).toBe(100);

    const bad = comps.find(c => c.competition === "Bad League");
    expect(bad.winrate).toBe(0);
  });
});

// ── Event emission ──

describe("Event emission during auto-learning", () => {
  test("emits MATCH_EVALUATED for each learned match", () => {
    const db = makeFullDb();
    createSnapshot(db);
    const events = [];
    const handler = (p) => events.push(p);
    bus.on(LEARNING_EVENTS.MATCH_EVALUATED, handler);

    simulateAutoLearn(db, "Arsenal", "Chelsea", 1, 0);

    expect(events.length).toBe(1);
    expect(events[0].outcome).toBe("win");
    bus.removeListener(LEARNING_EVENTS.MATCH_EVALUATED, handler);
  });

  test("emits WEIGHTS_UPDATED when weights change", () => {
    const db = makeFullDb();
    const engine = new LearningEngine(db);
    db.prepare(`
      INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("HighBot", 20, 18, 2, 90, 1.0);
    db.prepare(`
      INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("LowBot", 20, 4, 16, 20, 1.0);

    const events = [];
    const handler = (p) => events.push(p);
    bus.on(LEARNING_EVENTS.WEIGHTS_UPDATED, handler);

    engine.recalculateWeights();

    expect(events.length).toBe(1);
    expect(events[0].changes.length).toBe(2);
    bus.removeListener(LEARNING_EVENTS.WEIGHTS_UPDATED, handler);
  });
});

// ── Integration with SnapshotStore ──

describe("Integration with SnapshotStore", () => {
  test("processUnresolvedSnapshots catches up on missed matches", () => {
    const db = makeFullDb();
    const ss = new SnapshotStore(db);
    const engine = new LearningEngine(db);

    createSnapshot(db, { match_key: "catch1", home: "A", away: "B", id: "5001" });
    createSnapshot(db, { match_key: "catch2", home: "C", away: "D", id: "5002" });

    db.prepare(`
      INSERT INTO concile_analyses (match_key, home, away, best_bet, confidence, outcome, final_score_home, final_score_away)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run("catch1", "A", "B", "Under 2.5 buts", 82, "win", 1, 0);
    db.prepare(`
      INSERT INTO concile_analyses (match_key, home, away, best_bet, confidence, outcome, final_score_home, final_score_away)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run("catch2", "C", "D", "Under 2.5 buts", 75, "loss", 2, 1);

    const evaluated = engine.processUnresolvedSnapshots(ss);
    expect(evaluated).toBe(2);

    const results = engine.getMatchResults();
    expect(results.length).toBe(2);
  });
});

// ── Bridge weight context after auto-learning ──

describe("Bridge reflects updated weights after learning", () => {
  test("getWeightedAgentContext returns updated data after learning", () => {
    const db = makeFullDb();
    const bridge = new LearningBridge(db);

    expect(bridge.getWeightedAgentContext("Perplexity-Web").source).toBe("neutral");

    for (let i = 0; i < 6; i++) {
      createSnapshot(db, {
        match_key: `w_${i}`, home: "Arsenal", away: "Chelsea", id: `${7000 + i}`,
        agents: [{ name: "Perplexity-Web", bet: "Under 2.5 buts", confidence: 80 }],
      });
      simulateAutoLearn(db, "Arsenal", "Chelsea", 1, 0);
    }

    const ctx = bridge.getWeightedAgentContext("Perplexity-Web");
    expect(ctx.source).toBe("learning_engine");
    expect(ctx.winrate).toBe(100);
    expect(ctx.matches).toBe(6);
  });
});

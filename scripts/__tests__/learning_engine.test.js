const Database = require("better-sqlite3");
const { LearningEngine, LEARNING_EVENTS } = require("../learning_engine");
const { SnapshotStore } = require("../snapshot_store");
const { bus } = require("../event_bus");

function makeDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS concile_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_key TEXT NOT NULL,
      home TEXT NOT NULL,
      away TEXT NOT NULL,
      competition TEXT DEFAULT '',
      analysed_at TEXT DEFAULT (datetime('now')),
      minute_at_analysis INTEGER DEFAULT NULL,
      score_home_at_analysis INTEGER DEFAULT NULL,
      score_away_at_analysis INTEGER DEFAULT NULL,
      stats_status TEXT DEFAULT 'unavailable',
      best_bet TEXT NOT NULL,
      confidence INTEGER DEFAULT 0,
      raison TEXT DEFAULT '',
      consensus_votes INTEGER DEFAULT 0,
      agents_json TEXT DEFAULT '[]',
      pick_bet TEXT DEFAULT NULL,
      outcome TEXT DEFAULT NULL,
      final_score_home INTEGER DEFAULT NULL,
      final_score_away INTEGER DEFAULT NULL,
      resolved_at TEXT DEFAULT NULL,
      result_source TEXT DEFAULT NULL,
      sport TEXT DEFAULT 'Football',
      learning_tier TEXT DEFAULT 'learning',
      learning_note TEXT DEFAULT ''
    );
  `);
  return db;
}

function makeLearning(db) {
  return new LearningEngine(db || makeDb());
}

function makeSnapshot(overrides = {}) {
  return {
    id: 1,
    match_key: "12345_2026-07-05",
    match_id: "12345",
    competition: "Premier League",
    sport: "Football",
    home: "Arsenal",
    away: "Chelsea",
    minute_at_publication: 45,
    score_home: 0,
    score_away: 0,
    market: "goals",
    selection: "Under 2.5 buts",
    confidence: 82,
    consensus_votes: 4,
    total_agents: 5,
    raison: "Match defensif",
    agents_json: JSON.stringify([
      { name: "Groq", bet: "Under 2.5 buts", confidence: 80 },
      { name: "DeepSeek", bet: "Under 2.5 buts", confidence: 85 },
      { name: "Mistral", bet: "Over 2.5 buts", confidence: 60 },
      { name: "Gemini", bet: "Under 2.5 buts", confidence: 78 },
      { name: "Claude Chief", bet: "Under 2.5 buts", confidence: 82 },
    ]),
    odds: 1.72,
    version: 1,
    status: "published",
    ...overrides,
  };
}

// ── evaluateMatch ──

describe("LearningEngine.evaluateMatch", () => {
  test("records a winning match correctly", () => {
    const db = makeDb();
    const le = makeLearning(db);
    const snap = makeSnapshot();

    const result = le.evaluateMatch(snap, 1, 0);

    expect(result).not.toBeNull();
    expect(result.outcome).toBe("win");
    expect(result.agentOutcomes["Groq"]).toBe("win");
    expect(result.agentOutcomes["DeepSeek"]).toBe("win");
    expect(result.agentOutcomes["Mistral"]).toBe("loss");
    expect(result.agentOutcomes["Gemini"]).toBe("win");
    expect(result.agentOutcomes["Claude Chief"]).toBe("win");
  });

  test("records a losing match correctly", () => {
    const db = makeDb();
    const le = makeLearning(db);
    const snap = makeSnapshot();

    const result = le.evaluateMatch(snap, 2, 1);

    expect(result.outcome).toBe("loss");
    expect(result.agentOutcomes["Mistral"]).toBe("win");
  });

  test("prevents duplicate evaluation", () => {
    const db = makeDb();
    const le = makeLearning(db);
    const snap = makeSnapshot();

    le.evaluateMatch(snap, 1, 0);
    const second = le.evaluateMatch(snap, 1, 0);

    expect(second).toBeNull();
  });

  test("returns null for invalid inputs", () => {
    const le = makeLearning();
    expect(le.evaluateMatch(null, 1, 0)).toBeNull();
    expect(le.evaluateMatch(makeSnapshot(), null, 0)).toBeNull();
    expect(le.evaluateMatch(makeSnapshot(), 1, null)).toBeNull();
  });

  test("updates agent stats after evaluation", () => {
    const db = makeDb();
    const le = makeLearning(db);

    le.evaluateMatch(makeSnapshot(), 1, 0);
    const stats = le.getAgentStats();

    expect(stats.length).toBe(5);
    const groq = stats.find(s => s.agent_name === "Groq");
    expect(groq.wins).toBe(1);
    expect(groq.losses).toBe(0);
    expect(groq.matches).toBe(1);

    const mistral = stats.find(s => s.agent_name === "Mistral");
    expect(mistral.wins).toBe(0);
    expect(mistral.losses).toBe(1);
  });

  test("updates competition stats after evaluation", () => {
    const db = makeDb();
    const le = makeLearning(db);

    le.evaluateMatch(makeSnapshot(), 1, 0);
    const comps = le.getCompetitionStats();

    expect(comps.length).toBe(1);
    expect(comps[0].competition).toBe("Premier League");
    expect(comps[0].wins).toBe(1);
    expect(comps[0].matches).toBe(1);
  });

  test("emits MATCH_EVALUATED event", () => {
    const db = makeDb();
    const le = makeLearning(db);
    const events = [];
    bus.on(LEARNING_EVENTS.MATCH_EVALUATED, (p) => events.push(p));

    le.evaluateMatch(makeSnapshot(), 1, 0);

    expect(events.length).toBe(1);
    expect(events[0].outcome).toBe("win");
    bus.removeAllListeners(LEARNING_EVENTS.MATCH_EVALUATED);
  });
});

// ── Bet resolution ──

describe("LearningEngine bet resolution", () => {
  const le = makeLearning();

  test.each([
    ["Under 2.5 buts", 1, 0, "win"],
    ["Under 2.5 buts", 2, 1, "loss"],
    ["Over 2.5 buts", 2, 2, "win"],
    ["Over 2.5 buts", 1, 0, "loss"],
    ["BTTS Oui", 1, 1, "win"],
    ["BTTS Oui", 1, 0, "loss"],
    ["BTTS Non", 0, 0, "win"],
    ["BTTS Non", 1, 1, "loss"],
    ["Match nul", 1, 1, "win"],
    ["Match nul", 2, 1, "loss"],
    ["Victoire domicile", 2, 0, "win"],
    ["Victoire domicile", 0, 1, "loss"],
    ["Victoire extérieur", 0, 1, "win"],
    ["Victoire extérieur", 2, 0, "loss"],
  ])("%s with score %d-%d = %s", (bet, h, a, expected) => {
    expect(le._resolveBet(bet, h, a)).toBe(expected);
  });
});

// ── Agent stats accumulation ──

describe("Agent stats accumulation", () => {
  test("accumulates across multiple matches", () => {
    const db = makeDb();
    const le = makeLearning(db);

    le.evaluateMatch(makeSnapshot({ match_key: "m1" }), 1, 0);
    le.evaluateMatch(makeSnapshot({ match_key: "m2" }), 0, 0);
    le.evaluateMatch(makeSnapshot({ match_key: "m3" }), 3, 2);

    const stats = le.getAgentStats();
    const groq = stats.find(s => s.agent_name === "Groq");
    expect(groq.matches).toBe(3);
    expect(groq.wins).toBe(2);
    expect(groq.losses).toBe(1);
  });
});

// ── Competition stats ──

describe("Competition stats", () => {
  test("tracks multiple competitions separately", () => {
    const db = makeDb();
    const le = makeLearning(db);

    le.evaluateMatch(makeSnapshot({ match_key: "m1", competition: "Premier League" }), 1, 0);
    le.evaluateMatch(makeSnapshot({ match_key: "m2", competition: "La Liga" }), 2, 1);
    le.evaluateMatch(makeSnapshot({ match_key: "m3", competition: "La Liga" }), 0, 0);

    const comps = le.getCompetitionStats();
    expect(comps.length).toBe(2);

    const liga = comps.find(c => c.competition === "La Liga");
    expect(liga.matches).toBe(2);
    expect(liga.losses).toBe(1);
    expect(liga.wins).toBe(1);
  });
});

// ── Weight recalculation ──

describe("Weight recalculation", () => {
  test("adjusts weights based on winrate vs average", () => {
    const db = makeDb();
    const le = makeLearning(db);

    db.prepare(`
      INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("StrongBot", 20, 16, 4, 80, 1.0);

    db.prepare(`
      INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("WeakBot", 20, 8, 12, 40, 1.0);

    const changes = le.recalculateWeights();

    expect(changes.length).toBe(2);
    const strong = changes.find(c => c.agent === "StrongBot");
    expect(strong.newWeight).toBeGreaterThan(1.0);
    const weak = changes.find(c => c.agent === "WeakBot");
    expect(weak.newWeight).toBeLessThan(1.0);
  });

  test("records weight history", () => {
    const db = makeDb();
    const le = makeLearning(db);

    db.prepare(`
      INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("TestBot", 15, 12, 3, 80, 1.0);

    db.prepare(`
      INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("OtherBot", 15, 5, 10, 33.3, 1.0);

    le.recalculateWeights();

    const history = le.getWeightHistory("TestBot");
    expect(history.length).toBe(1);
    expect(history[0].new_weight).toBeGreaterThan(history[0].old_weight);
  });

  test("does not change weights when insufficient data", () => {
    const db = makeDb();
    const le = makeLearning(db);

    db.prepare(`
      INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("NewBot", 3, 2, 1, 66.7, 1.0);

    const changes = le.recalculateWeights();
    expect(changes.length).toBe(0);
  });

  test("respects weight bounds", () => {
    const db = makeDb();
    const le = makeLearning(db);

    db.prepare(`
      INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("MaxBot", 20, 18, 2, 90, 1.48);

    db.prepare(`
      INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("MinBot", 20, 2, 18, 10, 0.12);

    le.recalculateWeights();

    const maxBot = le.getAgentStats().find(a => a.agent_name === "MaxBot");
    const minBot = le.getAgentStats().find(a => a.agent_name === "MinBot");
    expect(maxBot.weight).toBeLessThanOrEqual(1.50);
    expect(minBot.weight).toBeGreaterThanOrEqual(0.10);
  });
});

// ── Recommendations ──

describe("Recommendations", () => {
  test("recommends excluding weak competitions", () => {
    const db = makeDb();
    const le = makeLearning(db);

    db.prepare(`
      INSERT INTO learning_competition_stats (competition, sport, matches, wins, losses, winrate, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run("Australia A-League", "Football", 15, 5, 10, 33.3, "active");

    const recs = le.generateRecommendations();
    const excl = recs.find(r => r.type === "competition" && r.action === "exclude");
    expect(excl).toBeTruthy();
    expect(excl.target).toBe("Australia A-League");
  });

  test("recommends reintegrating recovered competitions", () => {
    const db = makeDb();
    const le = makeLearning(db);

    db.prepare(`
      INSERT INTO learning_competition_stats (competition, sport, matches, wins, losses, winrate, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run("K League", "Football", 12, 8, 4, 66.7, "excluded");

    const recs = le.generateRecommendations();
    const reint = recs.find(r => r.type === "competition" && r.action === "reintegrate");
    expect(reint).toBeTruthy();
    expect(reint.target).toBe("K League");
  });

  test("recommends increasing weight for strong agents", () => {
    const db = makeDb();
    const le = makeLearning(db);

    db.prepare(`
      INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("StrongAgent", 20, 15, 5, 75, 1.0);

    const recs = le.generateRecommendations();
    const inc = recs.find(r => r.type === "agent" && r.action === "increase_weight");
    expect(inc).toBeTruthy();
    expect(inc.target).toBe("StrongAgent");
  });

  test("recommends decreasing weight for weak agents", () => {
    const db = makeDb();
    const le = makeLearning(db);

    db.prepare(`
      INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("WeakAgent", 15, 4, 11, 26.7, 0.90);

    const recs = le.generateRecommendations();
    const dec = recs.find(r => r.type === "agent" && r.action === "decrease_weight");
    expect(dec).toBeTruthy();
    expect(dec.target).toBe("WeakAgent");
  });
});

// ── Apply recommendation ──

describe("Apply recommendation", () => {
  test("applies agent weight change", () => {
    const db = makeDb();
    const le = makeLearning(db);

    db.prepare(`
      INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("TestAgent", 20, 15, 5, 75, 1.0);

    db.prepare(`
      INSERT INTO learning_recommendations (type, target, action, reason, data_json)
      VALUES (?, ?, ?, ?, ?)
    `).run("agent", "TestAgent", "increase_weight", "test", "{}");

    const recId = db.prepare("SELECT id FROM learning_recommendations ORDER BY id DESC LIMIT 1").get().id;
    le.applyRecommendation(recId);

    const agent = le.getAgentStats().find(a => a.agent_name === "TestAgent");
    expect(agent.weight).toBeGreaterThan(1.0);

    const rec = db.prepare("SELECT * FROM learning_recommendations WHERE id = ?").get(recId);
    expect(rec.applied).toBe(1);
  });

  test("applies competition exclusion", () => {
    const db = makeDb();
    const le = makeLearning(db);

    db.prepare(`
      INSERT INTO learning_competition_stats (competition, sport, matches, wins, losses, winrate, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run("Bad League", "Football", 10, 3, 7, 30, "active");

    db.prepare(`
      INSERT INTO learning_recommendations (type, target, action, reason, data_json)
      VALUES (?, ?, ?, ?, ?)
    `).run("competition", "Bad League", "exclude", "test", "{}");

    const recId = db.prepare("SELECT id FROM learning_recommendations ORDER BY id DESC LIMIT 1").get().id;
    le.applyRecommendation(recId);

    const comp = le.getCompetitionStats().find(c => c.competition === "Bad League");
    expect(comp.status).toBe("excluded");
  });

  test("returns null for already-applied recommendations", () => {
    const db = makeDb();
    const le = makeLearning(db);

    db.prepare(`
      INSERT INTO learning_recommendations (type, target, action, reason, data_json, applied)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run("agent", "X", "increase_weight", "done", "{}");

    const recId = db.prepare("SELECT id FROM learning_recommendations ORDER BY id DESC LIMIT 1").get().id;
    expect(le.applyRecommendation(recId)).toBeNull();
  });
});

// ── ROI calculation ──

describe("ROI calculation", () => {
  test("computes ROI per agent", () => {
    const db = makeDb();
    const le = makeLearning(db);

    le.evaluateMatch(makeSnapshot({ match_key: "m1", odds: 1.80 }), 1, 0);
    le.evaluateMatch(makeSnapshot({ match_key: "m2", odds: 1.80 }), 0, 0);
    le.evaluateMatch(makeSnapshot({ match_key: "m3", odds: 1.80 }), 3, 1);

    le.recalculateROI();

    const stats = le.getAgentStats();
    const groq = stats.find(s => s.agent_name === "Groq");
    expect(groq.roi).toBeDefined();
    expect(typeof groq.roi).toBe("number");
  });
});

// ── Summary ──

describe("getSummary", () => {
  test("returns complete summary object", () => {
    const db = makeDb();
    const le = makeLearning(db);

    le.evaluateMatch(makeSnapshot({ match_key: "m1" }), 1, 0);
    le.evaluateMatch(makeSnapshot({ match_key: "m2" }), 0, 0);

    const summary = le.getSummary();

    expect(summary.totalMatches).toBe(2);
    expect(summary.totalWins).toBe(2);
    expect(summary.totalLosses).toBe(0);
    expect(summary.globalWinrate).toBe(100);
    expect(summary.agents.length).toBe(5);
    expect(summary.pendingRecommendations).toBe(0);
  });
});

// ── processUnresolvedSnapshots ──

describe("processUnresolvedSnapshots", () => {
  test("processes snapshots with resolved concile analyses", () => {
    const db = makeDb();
    const ss = new SnapshotStore(db);
    const le = makeLearning(db);

    const analysis = {
      match_key: "99999_2026-07-05",
      best_bet: "Under 2.5 buts",
      confidence: 82,
      consensus_votes: 4,
      total_agents: 5,
      raison: "Test",
      agents: [
        { name: "Groq", bet: "Under 2.5 buts", confidence: 80 },
        { name: "Claude Chief", bet: "Under 2.5 buts", confidence: 82, isChief: true },
      ],
    };
    const match = { id: "99999", home: "TeamA", away: "TeamB", competition: "Test League", sport: "Football" };
    ss.createSnapshot(analysis, match, 50);

    db.prepare(`
      INSERT INTO concile_analyses (match_key, home, away, competition, best_bet, confidence, outcome, final_score_home, final_score_away)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run("99999_2026-07-05", "TeamA", "TeamB", "Test League", "Under 2.5 buts", 82, "win", 1, 0);

    const evaluated = le.processUnresolvedSnapshots(ss);
    expect(evaluated).toBe(1);

    const results = le.getMatchResults();
    expect(results.length).toBe(1);
    expect(results[0].outcome).toBe("win");
  });

  test("skips already-evaluated snapshots", () => {
    const db = makeDb();
    const ss = new SnapshotStore(db);
    const le = makeLearning(db);

    const analysis = {
      match_key: "88888_2026-07-05",
      best_bet: "Under 2.5 buts",
      confidence: 82,
      consensus_votes: 4,
      total_agents: 5,
      raison: "Test",
      agents: [{ name: "Groq", bet: "Under 2.5 buts", confidence: 80 }],
    };
    const match = { id: "88888", home: "A", away: "B", competition: "X", sport: "Football" };
    ss.createSnapshot(analysis, match, 50);

    db.prepare(`
      INSERT INTO concile_analyses (match_key, home, away, best_bet, confidence, outcome, final_score_home, final_score_away)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run("88888_2026-07-05", "A", "B", "Under 2.5 buts", 82, "win", 0, 0);

    le.processUnresolvedSnapshots(ss);
    const second = le.processUnresolvedSnapshots(ss);
    expect(second).toBe(0);
  });
});

// ── getAgentWeights ──

describe("getAgentWeights", () => {
  test("returns weights sorted by weight desc", () => {
    const db = makeDb();
    const le = makeLearning(db);

    db.prepare("INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight) VALUES (?,?,?,?,?,?)")
      .run("A", 10, 8, 2, 80, 1.20);
    db.prepare("INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight) VALUES (?,?,?,?,?,?)")
      .run("B", 10, 5, 5, 50, 0.90);

    const weights = le.getAgentWeights();
    expect(weights[0].agent_name).toBe("A");
    expect(weights[0].weight).toBe(1.20);
    expect(weights[1].agent_name).toBe("B");
    expect(weights[1].weight).toBe(0.90);
  });
});

// ── getCompetitionRanking ──

describe("getCompetitionRanking", () => {
  test("only includes competitions with enough matches", () => {
    const db = makeDb();
    const le = makeLearning(db);

    db.prepare("INSERT INTO learning_competition_stats (competition, sport, matches, wins, losses, winrate) VALUES (?,?,?,?,?,?)")
      .run("Big League", "Football", 20, 14, 6, 70);
    db.prepare("INSERT INTO learning_competition_stats (competition, sport, matches, wins, losses, winrate) VALUES (?,?,?,?,?,?)")
      .run("Tiny League", "Football", 3, 2, 1, 66.7);

    const ranking = le.getCompetitionRanking();
    expect(ranking.length).toBe(1);
    expect(ranking[0].competition).toBe("Big League");
  });
});

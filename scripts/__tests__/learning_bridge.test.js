const Database = require("better-sqlite3");
const { LearningBridge } = require("../learning_bridge");
const { LearningEngine } = require("../learning_engine");

function makeDb() {
  const db = new Database(":memory:");
  new LearningEngine(db);
  return db;
}

function seedAgentStats(db, agents) {
  const stmt = db.prepare(`
    INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight, roi, precision_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const a of agents) {
    stmt.run(a.name, a.matches, a.wins, a.losses, a.winrate, a.weight, a.roi || 0, a.precision || 0);
  }
}

function seedCompetitionStats(db, comps) {
  const stmt = db.prepare(`
    INSERT INTO learning_competition_stats (competition, sport, matches, wins, losses, winrate, roi, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of comps) {
    stmt.run(c.competition, c.sport || "Football", c.matches, c.wins, c.losses, c.winrate, c.roi || 0, c.status || "active");
  }
}

function seedMatchResults(db, results) {
  const stmt = db.prepare(`
    INSERT INTO learning_match_results
      (match_key, home, away, competition, sport, predicted_bet, predicted_confidence, predicted_odds,
       final_score_home, final_score_away, outcome, agents_json, agent_outcomes_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of results) {
    stmt.run(r.match_key, r.home, r.away, r.competition || "", r.sport || "Football",
      r.bet, r.confidence || 75, r.odds || 1.80,
      r.scoreH, r.scoreA, r.outcome, "[]", "{}");
  }
}

// ── getWeightedAgentContext ──

describe("getWeightedAgentContext", () => {
  test("returns neutral for unknown agent", () => {
    const db = makeDb();
    const bridge = new LearningBridge(db);
    const ctx = bridge.getWeightedAgentContext("Unknown");
    expect(ctx.weight).toBe(50);
    expect(ctx.source).toBe("neutral");
  });

  test("returns neutral for agent with few matches", () => {
    const db = makeDb();
    seedAgentStats(db, [{ name: "NewBot", matches: 3, wins: 2, losses: 1, winrate: 66.7, weight: 1.0 }]);
    const bridge = new LearningBridge(db);
    const ctx = bridge.getWeightedAgentContext("NewBot");
    expect(ctx.weight).toBe(50);
    expect(ctx.source).toBe("neutral");
  });

  test("returns learning_engine data for experienced agent", () => {
    const db = makeDb();
    seedAgentStats(db, [{ name: "Groq", matches: 20, wins: 14, losses: 6, winrate: 70, weight: 1.10, roi: 12.5, precision: 80 }]);
    const bridge = new LearningBridge(db);
    const ctx = bridge.getWeightedAgentContext("Groq");
    expect(ctx.source).toBe("learning_engine");
    expect(ctx.rawWeight).toBe(1.10);
    expect(ctx.winrate).toBe(70);
    expect(ctx.roi).toBe(12.5);
    expect(ctx.weight).toBe(77);
  });

  test("clamps weight between 10 and 95", () => {
    const db = makeDb();
    seedAgentStats(db, [
      { name: "High", matches: 20, wins: 19, losses: 1, winrate: 95, weight: 1.50 },
      { name: "Low", matches: 20, wins: 2, losses: 18, winrate: 10, weight: 0.10 },
    ]);
    const bridge = new LearningBridge(db);
    expect(bridge.getWeightedAgentContext("High").weight).toBeLessThanOrEqual(95);
    expect(bridge.getWeightedAgentContext("Low").weight).toBeGreaterThanOrEqual(10);
  });
});

// ── formatAgentVoteLine ──

describe("formatAgentVoteLine", () => {
  test("uses Learning Engine data when available", () => {
    const db = makeDb();
    seedAgentStats(db, [{ name: "Groq", matches: 15, wins: 10, losses: 5, winrate: 66.7, weight: 1.05, roi: 8.2 }]);
    const bridge = new LearningBridge(db);
    const line = bridge.formatAgentVoteLine(
      { name: "Groq", bet: "Under 2.5 buts", confidence: 78 },
      {}
    );
    expect(line).toContain("Learning Engine");
    expect(line).toContain("poids 1.05");
    expect(line).toContain("66.7%");
    expect(line).toContain("ROI");
  });

  test("falls back to agentPerf when no learning data", () => {
    const db = makeDb();
    const bridge = new LearningBridge(db);
    const line = bridge.formatAgentVoteLine(
      { name: "NewAgent", bet: "BTTS Oui", confidence: 65 },
      { NewAgent: { wins: 8, losses: 4, resolved: 12, winrate: 67 } }
    );
    expect(line).toContain("fallback");
    expect(line).toContain("67%");
  });

  test("shows neutral for completely unknown agent", () => {
    const db = makeDb();
    const bridge = new LearningBridge(db);
    const line = bridge.formatAgentVoteLine(
      { name: "Ghost", bet: "Match nul", confidence: 60 },
      {}
    );
    expect(line).toContain("neutre");
  });
});

// ── getCompetitionContext ──

describe("getCompetitionContext", () => {
  test("returns null for unknown competition", () => {
    const db = makeDb();
    const bridge = new LearningBridge(db);
    expect(bridge.getCompetitionContext("Fantasy League")).toBeNull();
  });

  test("returns null for competition with few matches", () => {
    const db = makeDb();
    seedCompetitionStats(db, [{ competition: "Tiny Cup", matches: 2, wins: 1, losses: 1, winrate: 50 }]);
    const bridge = new LearningBridge(db);
    expect(bridge.getCompetitionContext("Tiny Cup")).toBeNull();
  });

  test("returns full context for known competition", () => {
    const db = makeDb();
    seedCompetitionStats(db, [{ competition: "Premier League", matches: 25, wins: 18, losses: 7, winrate: 72, roi: 15.3 }]);
    const bridge = new LearningBridge(db);
    const ctx = bridge.getCompetitionContext("Premier League");
    expect(ctx).not.toBeNull();
    expect(ctx.winrate).toBe(72);
    expect(ctx.roi).toBe(15.3);
    expect(ctx.matches).toBe(25);
  });
});

// ── formatCompetitionNote ──

describe("formatCompetitionNote", () => {
  test("returns empty for unknown competition", () => {
    const db = makeDb();
    const bridge = new LearningBridge(db);
    expect(bridge.formatCompetitionNote("Nothing")).toBe("");
  });

  test("shows green emoji for strong competition", () => {
    const db = makeDb();
    seedCompetitionStats(db, [{ competition: "La Liga", matches: 20, wins: 14, losses: 6, winrate: 70 }]);
    const bridge = new LearningBridge(db);
    const note = bridge.formatCompetitionNote("La Liga");
    expect(note).toContain("🟢");
    expect(note).toContain("70.0%");
  });

  test("shows red emoji for weak competition", () => {
    const db = makeDb();
    seedCompetitionStats(db, [{ competition: "Chile Liga", matches: 10, wins: 3, losses: 7, winrate: 30 }]);
    const bridge = new LearningBridge(db);
    const note = bridge.formatCompetitionNote("Chile Liga");
    expect(note).toContain("🔴");
  });

  test("shows excluded status", () => {
    const db = makeDb();
    seedCompetitionStats(db, [{ competition: "Australia", matches: 12, wins: 4, losses: 8, winrate: 33.3, status: "excluded" }]);
    const bridge = new LearningBridge(db);
    const note = bridge.formatCompetitionNote("Australia");
    expect(note).toContain("EXCLUE");
  });
});

// ── getBetTypePerformance ──

describe("getBetTypePerformance", () => {
  test("returns null for unknown bet type", () => {
    const db = makeDb();
    const bridge = new LearningBridge(db);
    expect(bridge.getBetTypePerformance("Fantasy Bet")).toBeNull();
  });

  test("returns null for bet with few matches", () => {
    const db = makeDb();
    seedMatchResults(db, [
      { match_key: "m1", home: "A", away: "B", bet: "BTTS Oui", scoreH: 1, scoreA: 1, outcome: "win" },
    ]);
    const bridge = new LearningBridge(db);
    expect(bridge.getBetTypePerformance("BTTS Oui")).toBeNull();
  });

  test("returns correct stats for bet with enough data", () => {
    const db = makeDb();
    seedMatchResults(db, [
      { match_key: "m1", home: "A", away: "B", bet: "Under 2.5 buts", scoreH: 1, scoreA: 0, outcome: "win" },
      { match_key: "m2", home: "C", away: "D", bet: "Under 2.5 buts", scoreH: 0, scoreA: 0, outcome: "win" },
      { match_key: "m3", home: "E", away: "F", bet: "Under 2.5 buts", scoreH: 2, scoreA: 1, outcome: "loss" },
      { match_key: "m4", home: "G", away: "H", bet: "Under 2.5 buts", scoreH: 1, scoreA: 1, outcome: "win" },
      { match_key: "m5", home: "I", away: "J", bet: "Under 2.5 buts", scoreH: 0, scoreA: 1, outcome: "win" },
    ]);
    const bridge = new LearningBridge(db);
    const perf = bridge.getBetTypePerformance("Under 2.5 buts");
    expect(perf).not.toBeNull();
    expect(perf.matches).toBe(5);
    expect(perf.wins).toBe(4);
    expect(perf.winrate).toBe(80);
  });
});

// ── formatBetTypeNote ──

describe("formatBetTypeNote", () => {
  test("returns empty when no data", () => {
    const db = makeDb();
    const bridge = new LearningBridge(db);
    expect(bridge.formatBetTypeNote(["Under 2.5 buts"])).toBe("");
  });

  test("formats bet performance with checkmark for strong bets", () => {
    const db = makeDb();
    for (let i = 0; i < 8; i++) {
      seedMatchResults(db, [
        { match_key: `u${i}`, home: `A${i}`, away: `B${i}`, bet: "Under 2.5 buts", scoreH: 1, scoreA: 0, outcome: i < 6 ? "win" : "loss" },
      ]);
    }
    const bridge = new LearningBridge(db);
    const note = bridge.formatBetTypeNote(["Under 2.5 buts"]);
    expect(note).toContain("✅");
    expect(note).toContain("Under 2.5 buts");
  });
});

// ── isCompetitionExcluded ──

describe("isCompetitionExcluded", () => {
  test("returns false for unknown competition", () => {
    const db = makeDb();
    const bridge = new LearningBridge(db);
    expect(bridge.isCompetitionExcluded("Nothing")).toBe(false);
  });

  test("returns false for active competition", () => {
    const db = makeDb();
    seedCompetitionStats(db, [{ competition: "Ligue 1", matches: 20, wins: 12, losses: 8, winrate: 60, status: "active" }]);
    const bridge = new LearningBridge(db);
    expect(bridge.isCompetitionExcluded("Ligue 1")).toBe(false);
  });

  test("returns true for excluded competition", () => {
    const db = makeDb();
    seedCompetitionStats(db, [{ competition: "Bad League", matches: 15, wins: 4, losses: 11, winrate: 26.7, status: "excluded" }]);
    const bridge = new LearningBridge(db);
    expect(bridge.isCompetitionExcluded("Bad League")).toBe(true);
  });
});

// ── isAvailable ──

describe("isAvailable", () => {
  test("returns true when learning tables exist", () => {
    const db = makeDb();
    const bridge = new LearningBridge(db);
    expect(bridge.isAvailable()).toBe(true);
  });

  test("returns false when tables are dropped", () => {
    const db = new Database(":memory:");
    const bridge = new LearningBridge(db);
    db.exec("DROP TABLE learning_agent_stats");
    expect(bridge.isAvailable()).toBe(false);
  });
});

// ── getEngine ──

describe("getEngine", () => {
  test("returns the LearningEngine instance", () => {
    const db = makeDb();
    const bridge = new LearningBridge(db);
    expect(bridge.getEngine()).toBeInstanceOf(LearningEngine);
  });
});

// ── Integration: full vote line with multiple agents ──

describe("Integration: full concile context", () => {
  test("builds complete weighted vote lines for Chief", () => {
    const db = makeDb();
    seedAgentStats(db, [
      { name: "Perplexity-Web", matches: 18, wins: 12, losses: 6, winrate: 66.7, weight: 1.08, roi: 10.2 },
      { name: "DeepSeek-V3", matches: 22, wins: 17, losses: 5, winrate: 77.3, weight: 1.20, roi: 22.1 },
      { name: "Mistral-Large", matches: 15, wins: 8, losses: 7, winrate: 53.3, weight: 0.85, roi: -5.4 },
      { name: "Cohere-Command", matches: 12, wins: 7, losses: 5, winrate: 58.3, weight: 0.95, roi: 3.1 },
    ]);
    seedCompetitionStats(db, [
      { competition: "Premier League", matches: 30, wins: 22, losses: 8, winrate: 73.3, roi: 18.5 },
    ]);

    const bridge = new LearningBridge(db);
    const agents = [
      { name: "Perplexity-Web", bet: "Under 2.5 buts", confidence: 75 },
      { name: "DeepSeek-V3", bet: "Under 2.5 buts", confidence: 82 },
      { name: "Mistral-Large", bet: "Over 2.5 buts", confidence: 60 },
      { name: "Cohere-Command", bet: "Under 2.5 buts", confidence: 70 },
    ];

    const voteLines = agents.map(a => bridge.formatAgentVoteLine(a, {}));
    expect(voteLines.every(l => l.includes("Learning Engine"))).toBe(true);

    const compNote = bridge.formatCompetitionNote("Premier League");
    expect(compNote).toContain("🟢");
    expect(compNote).toContain("73.3%");

    const deepseek = bridge.getWeightedAgentContext("DeepSeek-V3");
    const mistral = bridge.getWeightedAgentContext("Mistral-Large");
    expect(deepseek.weight).toBeGreaterThan(mistral.weight);
  });
});

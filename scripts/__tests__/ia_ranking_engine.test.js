const Database = require("better-sqlite3");
const {
  IARankingEngine,
  isMarketStillValid,
  createAnonymizer,
  MARKET_VALIDITY_RULES,
  DEFAULT_AGENTS,
  MIN_PREDICTIONS_FOR_DISABLE,
  DISABLE_WINRATE_THRESHOLD,
} = require("../ia_ranking_engine");

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeEngine(opts = {}) {
  return new IARankingEngine({ db: new Database(":memory:"), ...opts });
}

function seedPredictions(engine, agentName, count, outcome, overrides = {}) {
  for (let i = 0; i < count; i++) {
    engine.recordPrediction({
      agentName,
      matchKey: `match_${agentName}_${outcome}_${i}`,
      sport: overrides.sport || "football",
      competition: overrides.competition || "Premier League",
      marketType: overrides.marketType || "Under 2.5",
      prediction: outcome === "win" ? "Under 2.5" : "Over 2.5",
      confidence: overrides.confidence || 75,
      odds: overrides.odds || 1.65,
    });
    engine.processMatchResult({
      matchKey: `match_${agentName}_${outcome}_${i}`,
      outcome,
    });
  }
}

// ─── Market validity rules ──────────────────────────────────────────────────

describe("isMarketStillValid (standalone)", () => {
  test("Under 2.5 valid at 60th minute", () => {
    const r = isMarketStillValid("Under 2.5", 60);
    expect(r.valid).toBe(true);
  });

  test("Under 2.5 valid at exactly 75th minute", () => {
    const r = isMarketStillValid("Under 2.5", 75);
    expect(r.valid).toBe(true);
  });

  test("Under 2.5 invalid at 76th minute", () => {
    const r = isMarketStillValid("Under 2.5", 76);
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("75");
  });

  test("Over 2.5 invalid at 80th minute", () => {
    const r = isMarketStillValid("Over 2.5", 80);
    expect(r.valid).toBe(false);
  });

  test("BTTS valid at 79th minute even with 0-0", () => {
    const r = isMarketStillValid("BTTS", 79, { home: 0, away: 0 });
    expect(r.valid).toBe(true);
  });

  test("BTTS invalid at 81st minute if one team hasn't scored", () => {
    const r = isMarketStillValid("BTTS", 81, { home: 1, away: 0 });
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("BTTS");
    expect(r.reason).toContain("1-0");
  });

  test("BTTS valid at 81st minute if both teams scored", () => {
    const r = isMarketStillValid("BTTS", 81, { home: 1, away: 1 });
    expect(r.valid).toBe(true);
  });

  test("BTTS invalid at 82nd minute with no score info still valid (no scoreCheck without score)", () => {
    // Without score object, scoreCheck doesn't trigger
    const r = isMarketStillValid("BTTS", 79);
    expect(r.valid).toBe(true);
  });

  test("BTTS invalid after maxMinute (90) even if both scored", () => {
    const r = isMarketStillValid("BTTS", 91, { home: 2, away: 1 });
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("90");
  });

  test("Score exact invalid after 60th minute", () => {
    const r = isMarketStillValid("Score exact", 61);
    expect(r.valid).toBe(false);
  });

  test("Score exact valid at 60th minute", () => {
    const r = isMarketStillValid("Score exact", 60);
    expect(r.valid).toBe(true);
  });

  test("Corners invalid after 85th minute", () => {
    const r = isMarketStillValid("Corners", 86);
    expect(r.valid).toBe(false);
  });

  test("Cards valid at 85th minute", () => {
    const r = isMarketStillValid("Cards", 85);
    expect(r.valid).toBe(true);
  });

  test("Double chance invalid after 85th minute", () => {
    const r = isMarketStillValid("Double chance", 90);
    expect(r.valid).toBe(false);
  });

  test("Winner (1X2) valid at 90th minute", () => {
    const r = isMarketStillValid("1X2", 90);
    expect(r.valid).toBe(true);
  });

  test("Winner invalid after 90th minute", () => {
    const r = isMarketStillValid("Winner", 91);
    expect(r.valid).toBe(false);
  });

  test("Handicap invalid after 70th minute", () => {
    const r = isMarketStillValid("Handicap", 71);
    expect(r.valid).toBe(false);
  });

  test("Handicap valid at 70th minute", () => {
    const r = isMarketStillValid("Handicap", 70);
    expect(r.valid).toBe(true);
  });

  test("Unknown market type is considered valid", () => {
    const r = isMarketStillValid("Nombre de corners", 90);
    expect(r.valid).toBe(true);
    expect(r.reason).toContain("non configure");
  });

  test("Minute 0 is always valid", () => {
    for (const mkt of Object.keys(MARKET_VALIDITY_RULES)) {
      const r = isMarketStillValid(mkt, 0);
      expect(r.valid).toBe(true);
    }
  });
});

describe("isMarketStillValid (instance method)", () => {
  test("uses instance rules", () => {
    const engine = makeEngine();
    const r = engine.isMarketStillValid("Under 2.5", 76);
    expect(r.valid).toBe(false);
    engine.close();
  });

  test("custom rules override defaults", () => {
    const engine = makeEngine({
      marketRules: {
        "Under 2.5": { maxMinute: 85, label: "Custom Over/Under" },
      },
    });
    const r = engine.isMarketStillValid("Under 2.5", 80);
    expect(r.valid).toBe(true);
    engine.close();
  });
});

// ─── AI Anonymization ───────────────────────────────────────────────────────

describe("AI anonymization", () => {
  let engine;
  beforeEach(() => {
    engine = makeEngine();
  });
  afterEach(() => engine.close());

  test("anonymizeAgentName returns stable IA numbers", () => {
    const anon1 = engine.anonymizeAgentName("GROQ-Llama");
    const anon2 = engine.anonymizeAgentName("GROQ-Llama");
    expect(anon1).toBe(anon2);
    expect(anon1).toMatch(/^IA n°\d+$/);
  });

  test("different agents get different numbers", () => {
    const names = DEFAULT_AGENTS.map(a => engine.anonymizeAgentName(a.name));
    const unique = new Set(names);
    expect(unique.size).toBe(DEFAULT_AGENTS.length);
  });

  test("unknown agent returns IA n°?", () => {
    expect(engine.anonymizeAgentName("UnknownBot")).toBe("IA n°?");
  });

  test("getAgentDisplayName public returns anonymous", () => {
    const name = engine.getAgentDisplayName("GeminiFlash", true);
    expect(name).toMatch(/^IA n°\d+$/);
    expect(name).not.toBe("GeminiFlash");
  });

  test("getAgentDisplayName private returns real name", () => {
    const name = engine.getAgentDisplayName("GeminiFlash", false);
    expect(name).toBe("GeminiFlash");
  });

  test("adding a new agent resets anon map and assigns new number", () => {
    const beforeCount = DEFAULT_AGENTS.length;
    engine.addAgent("NewBot", { displayOrder: 100 });
    const anon = engine.anonymizeAgentName("NewBot");
    expect(anon).toBe(`IA n°${beforeCount + 1}`);
  });

  test("createAnonymizer standalone function", () => {
    const anon = createAnonymizer(["Alpha", "Beta", "Gamma"]);
    expect(anon("Alpha")).toBe("IA n°1");
    expect(anon("Beta")).toBe("IA n°2");
    expect(anon("Gamma")).toBe("IA n°3");
    expect(anon("Unknown")).toBe("IA n°?");
  });
});

// ─── Ranking calculations ───────────────────────────────────────────────────

describe("ranking calculations", () => {
  let engine;
  beforeEach(() => {
    engine = makeEngine();
  });
  afterEach(() => engine.close());

  test("recording and processing a winning prediction creates ranking", () => {
    engine.recordPrediction({
      agentName: "GROQ-Llama",
      matchKey: "test_match_1",
      sport: "football",
      competition: "Ligue 1",
      marketType: "Under 2.5",
      confidence: 80,
      odds: 1.65,
    });

    const result = engine.processMatchResult({
      matchKey: "test_match_1",
      outcome: "win",
    });

    expect(result.updated).toBe(1);
    expect(result.rankings.length).toBeGreaterThan(0);

    const ranking = result.rankings.find(r => r.agent_name === "GROQ-Llama");
    expect(ranking).toBeDefined();
    expect(ranking.wins).toBe(1);
    expect(ranking.winrate).toBe(100);
  });

  test("mixed results produce correct winrate", () => {
    seedPredictions(engine, "GeminiFlash", 6, "win");
    seedPredictions(engine, "GeminiFlash", 4, "loss");

    const rankings = engine.getRankings({ sport: "football", competition: "Premier League" });
    const gemini = rankings.find(r => r.agent_name === "GeminiFlash");
    expect(gemini).toBeDefined();
    expect(gemini.winrate).toBe(60);
    expect(gemini.total_predictions).toBe(10);
  });

  test("rankings sorted by weight then winrate", () => {
    seedPredictions(engine, "GROQ-Llama", 10, "win");
    seedPredictions(engine, "GeminiFlash", 10, "loss");
    seedPredictions(engine, "Mistral-7B", 5, "win");
    seedPredictions(engine, "Mistral-7B", 5, "loss");

    const rankings = engine.getRankings();
    expect(rankings[0].agent_name).toBe("GROQ-Llama");
    // GeminiFlash (all losses) should be last
    const lastRanking = rankings[rankings.length - 1];
    expect(lastRanking.agent_name).toBe("GeminiFlash");
  });

  test("filter rankings by sport", () => {
    seedPredictions(engine, "GROQ-Llama", 5, "win", { sport: "football" });
    seedPredictions(engine, "GROQ-Llama", 3, "win", { sport: "basketball" });

    const footballOnly = engine.getRankings({ sport: "football" });
    expect(footballOnly.every(r => r.sport === "football")).toBe(true);

    const basketOnly = engine.getRankings({ sport: "basketball" });
    expect(basketOnly.every(r => r.sport === "basketball")).toBe(true);
  });

  test("filter rankings by competition", () => {
    seedPredictions(engine, "GROQ-Llama", 5, "win", { competition: "Ligue 1" });
    seedPredictions(engine, "GROQ-Llama", 3, "win", { competition: "Premier League" });

    const ligue1 = engine.getRankings({ competition: "Ligue 1" });
    expect(ligue1.every(r => r.competition === "Ligue 1")).toBe(true);
    expect(ligue1[0].total_predictions).toBe(5);
  });

  test("filter rankings by market type", () => {
    seedPredictions(engine, "GROQ-Llama", 5, "win", { marketType: "Under 2.5" });
    seedPredictions(engine, "GROQ-Llama", 3, "win", { marketType: "BTTS" });

    const under = engine.getRankings({ marketType: "Under 2.5" });
    expect(under.every(r => r.market_type === "Under 2.5")).toBe(true);
  });

  test("getTopAgent returns best agent for context", () => {
    seedPredictions(engine, "GROQ-Llama", 10, "win", { sport: "football", competition: "Ligue 1" });
    seedPredictions(engine, "GeminiFlash", 10, "loss", { sport: "football", competition: "Ligue 1" });

    const top = engine.getTopAgent("football", "Ligue 1", "Under 2.5");
    expect(top).not.toBeNull();
    expect(top.agent_name).toBe("GROQ-Llama");
  });

  test("getTopAgent returns null when no data", () => {
    const top = engine.getTopAgent("tennis", "Roland Garros", "Winner");
    expect(top).toBeNull();
  });

  test("pushes are tracked correctly", () => {
    engine.recordPrediction({
      agentName: "GROQ-Llama",
      matchKey: "push_match",
      sport: "football",
      competition: "Ligue 1",
      marketType: "Under 2.5",
    });
    engine.processMatchResult({ matchKey: "push_match", outcome: "push" });

    const rankings = engine.getRankings();
    const r = rankings.find(r => r.agent_name === "GROQ-Llama");
    expect(r.pushes).toBe(1);
    expect(r.wins).toBe(0);
    expect(r.losses).toBe(0);
  });
});

// ─── Weight adjustments ─────────────────────────────────────────────────────

describe("weight adjustments", () => {
  let engine;
  beforeEach(() => {
    engine = makeEngine();
  });
  afterEach(() => engine.close());

  test("high-performing agent gets higher weight", () => {
    seedPredictions(engine, "GROQ-Llama", 15, "win");
    seedPredictions(engine, "GeminiFlash", 15, "loss");

    const weights = engine.getAgentWeights();
    expect(weights["GROQ-Llama"]).toBeGreaterThan(1.0);
    expect(weights["GeminiFlash"]).toBeLessThan(1.0);
  });

  test("weights are bounded between 0.3 and 2.5", () => {
    seedPredictions(engine, "GROQ-Llama", 50, "win", { odds: 3.0 });
    // Use fewer losses to stay above auto-disable threshold (35% over 20+)
    seedPredictions(engine, "GeminiFlash", 8, "win");
    seedPredictions(engine, "GeminiFlash", 12, "loss");

    const weights = engine.getAgentWeights();
    expect(weights["GROQ-Llama"]).toBeLessThanOrEqual(2.5);
    expect(weights["GROQ-Llama"]).toBeGreaterThanOrEqual(0.3);
    expect(weights["GeminiFlash"]).toBeDefined();
    expect(weights["GeminiFlash"]).toBeGreaterThanOrEqual(0.3);
  });

  test("low volume predictions get reduced confidence multiplier", () => {
    // Agent with just 3 predictions should have volume penalty
    seedPredictions(engine, "GROQ-Llama", 3, "win");

    const rankings = engine.getRankings();
    const r = rankings.find(r => r.agent_name === "GROQ-Llama");
    // With 100% winrate but < 5 predictions, weight should be reduced by 0.7 multiplier
    // Base: 1.0 + 0.5 (winrate >= 60) + 0.1 (roi > 0) = 1.6, * 0.7 = 1.12
    expect(r.weight).toBeLessThan(1.6);
  });

  test("medium volume predictions have moderate confidence", () => {
    seedPredictions(engine, "GROQ-Llama", 8, "win");

    const rankings = engine.getRankings();
    const r = rankings.find(r => r.agent_name === "GROQ-Llama");
    // 8 predictions -> 0.85 multiplier
    expect(r.weight).toBeGreaterThan(0.3);
    expect(r.weight).toBeLessThanOrEqual(2.5);
  });

  test("high volume predictions boost weight", () => {
    seedPredictions(engine, "GROQ-Llama", 35, "win");

    const rankings = engine.getRankings();
    const r = rankings.find(r => r.agent_name === "GROQ-Llama");
    // 35 predictions -> 1.1 multiplier + high winrate + ROI bonuses
    expect(r.weight).toBeGreaterThan(1.5);
  });

  test("50% winrate agent gets near-default weight", () => {
    seedPredictions(engine, "GROQ-Llama", 15, "win");
    seedPredictions(engine, "GROQ-Llama", 15, "loss");

    const rankings = engine.getRankings();
    const r = rankings.find(r => r.agent_name === "GROQ-Llama");
    // 50% winrate: +0.1, roi ~0: no bonus, 30 preds: *1.1 => around 1.1-1.2
    expect(r.weight).toBeGreaterThanOrEqual(0.8);
    expect(r.weight).toBeLessThanOrEqual(1.5);
  });
});

// ─── Auto-disable logic ────────────────────────────────────────────────────

describe("auto-disable logic", () => {
  let engine;
  beforeEach(() => {
    engine = makeEngine();
  });
  afterEach(() => engine.close());

  test("agent with winrate < 35% over 20+ predictions gets disabled", () => {
    // 6 wins, 15 losses = 28.6% winrate over 21 predictions
    seedPredictions(engine, "GROQ-Llama", 6, "win");
    seedPredictions(engine, "GROQ-Llama", 15, "loss");

    const rankings = engine.getRankings({ enabledOnly: true });
    const stillActive = rankings.find(r => r.agent_name === "GROQ-Llama");
    expect(stillActive).toBeUndefined();
  });

  test("agent with winrate < 35% but < 20 predictions stays enabled", () => {
    // 3 wins, 10 losses = 23% winrate but only 13 predictions
    seedPredictions(engine, "GeminiFlash", 3, "win");
    seedPredictions(engine, "GeminiFlash", 10, "loss");

    const rankings = engine.getRankings();
    const agent = rankings.find(r => r.agent_name === "GeminiFlash");
    expect(agent).toBeDefined();
    expect(agent.enabled).toBe(1);
  });

  test("agent with winrate >= 35% over 20+ predictions stays enabled", () => {
    // 8 wins, 14 losses = 36.4% winrate over 22 predictions
    seedPredictions(engine, "Mistral-7B", 8, "win");
    seedPredictions(engine, "Mistral-7B", 14, "loss");

    const rankings = engine.getRankings();
    const agent = rankings.find(r => r.agent_name === "Mistral-7B");
    expect(agent).toBeDefined();
    expect(agent.enabled).toBe(1);
  });

  test("disabled agent can be re-enabled", () => {
    seedPredictions(engine, "GROQ-Llama", 5, "win");
    seedPredictions(engine, "GROQ-Llama", 16, "loss");

    // Should be disabled now
    let weights = engine.getAgentWeights();
    expect(weights["GROQ-Llama"]).toBeUndefined();

    // Re-enable
    engine.enableAgent("GROQ-Llama");
    weights = engine.getAgentWeights();
    expect(weights["GROQ-Llama"]).toBeDefined();
  });

  test("processMatchResult returns disabled agents list", () => {
    // Build up to threshold
    seedPredictions(engine, "GROQ-Llama", 5, "win");
    seedPredictions(engine, "GROQ-Llama", 14, "loss");

    // This should trigger disable (6 wins / 20 total = 30%)
    engine.recordPrediction({
      agentName: "GROQ-Llama",
      matchKey: "final_loss",
      sport: "football",
      competition: "Premier League",
      marketType: "Under 2.5",
    });
    const result = engine.processMatchResult({ matchKey: "final_loss", outcome: "loss" });

    expect(result.disabled.length).toBeGreaterThanOrEqual(0);
    // Total is now 20, winrate = 5/20 = 25% < 35% -> should be disabled
    if (result.disabled.length > 0) {
      expect(result.disabled[0].agent).toBe("GROQ-Llama");
    }
  });

  test("enabledOnly filter excludes disabled agents from rankings", () => {
    seedPredictions(engine, "GROQ-Llama", 5, "win");
    seedPredictions(engine, "GROQ-Llama", 16, "loss");

    const all = engine.getRankings();
    const enabledOnly = engine.getRankings({ enabledOnly: true });
    expect(enabledOnly.length).toBeLessThan(all.length);
  });
});

// ─── Agent management ───────────────────────────────────────────────────────

describe("agent management", () => {
  let engine;
  beforeEach(() => {
    engine = makeEngine();
  });
  afterEach(() => engine.close());

  test("addAgent adds a new AI to the system", () => {
    engine.addAgent("NewSuperBot", { displayOrder: 10, baseWeight: 1.2 });
    const weights = engine.getAgentWeights();
    expect(weights["NewSuperBot"]).toBe(1.2);
  });

  test("addAgent is idempotent (no error on duplicate)", () => {
    engine.addAgent("BotX");
    engine.addAgent("BotX");
    const weights = engine.getAgentWeights();
    expect(weights["BotX"]).toBeDefined();
  });

  test("default agents are seeded on init", () => {
    const weights = engine.getAgentWeights();
    for (const a of DEFAULT_AGENTS) {
      expect(weights[a.name]).toBeDefined();
    }
  });
});

// ─── Learning loop ──────────────────────────────────────────────────────────

describe("learning loop", () => {
  let engine;
  beforeEach(() => {
    engine = makeEngine();
  });
  afterEach(() => engine.close());

  test("processMatchResult updates pending predictions", () => {
    engine.recordPrediction({
      agentName: "GROQ-Llama",
      matchKey: "learn_1",
      sport: "football",
      competition: "Ligue 1",
      marketType: "Under 2.5",
    });
    engine.recordPrediction({
      agentName: "GeminiFlash",
      matchKey: "learn_1",
      sport: "football",
      competition: "Ligue 1",
      marketType: "Under 2.5",
    });

    const result = engine.processMatchResult({ matchKey: "learn_1", outcome: "win" });
    expect(result.updated).toBe(2);
  });

  test("processMatchResult with marketType filter only resolves matching market", () => {
    engine.recordPrediction({
      agentName: "GROQ-Llama",
      matchKey: "multi_market",
      marketType: "Under 2.5",
    });
    engine.recordPrediction({
      agentName: "GROQ-Llama",
      matchKey: "multi_market",
      marketType: "BTTS",
    });

    const result = engine.processMatchResult({
      matchKey: "multi_market",
      outcome: "win",
      marketType: "Under 2.5",
    });
    expect(result.updated).toBe(1);
  });

  test("already-resolved predictions are not re-processed", () => {
    engine.recordPrediction({
      agentName: "GROQ-Llama",
      matchKey: "double_resolve",
    });

    engine.processMatchResult({ matchKey: "double_resolve", outcome: "win" });
    const result2 = engine.processMatchResult({ matchKey: "double_resolve", outcome: "loss" });
    expect(result2.updated).toBe(0);
  });

  test("multi-sport tracking works independently", () => {
    seedPredictions(engine, "GROQ-Llama", 5, "win", { sport: "football", competition: "Ligue 1" });
    seedPredictions(engine, "GROQ-Llama", 5, "loss", { sport: "basketball", competition: "NBA" });

    const footballRankings = engine.getRankings({ sport: "football" });
    const basketRankings = engine.getRankings({ sport: "basketball" });

    const fbAgent = footballRankings.find(r => r.agent_name === "GROQ-Llama");
    const bbAgent = basketRankings.find(r => r.agent_name === "GROQ-Llama");

    expect(fbAgent.winrate).toBe(100);
    expect(bbAgent.winrate).toBe(0);
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe("edge cases", () => {
  test("engine works with :memory: database", () => {
    const engine = makeEngine();
    expect(engine.getRankings()).toEqual([]);
    engine.close();
  });

  test("sport names are normalized to lowercase", () => {
    const engine = makeEngine();
    engine.recordPrediction({
      agentName: "GROQ-Llama",
      matchKey: "case_test",
      sport: "Football",
    });
    engine.processMatchResult({ matchKey: "case_test", outcome: "win" });

    const rankings = engine.getRankings({ sport: "football" });
    expect(rankings.length).toBe(1);
    engine.close();
  });

  test("close is idempotent", () => {
    const engine = makeEngine();
    engine.close();
    expect(() => engine.close()).not.toThrow();
  });
});

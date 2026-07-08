const Database = require("better-sqlite3");
const { HermesBrain, DEFAULT_CONFIG } = require("../hermes_brain");

function createBrain(configOverrides = {}) {
  const db = new Database(":memory:");
  return new HermesBrain({ db, config: configOverrides });
}

function makeVotes(bets, confidences = [], weights = []) {
  return bets.map((bet, i) => ({
    agentName: `Agent-${i + 1}`,
    vote: bet,
    confidence: confidences[i] || 70,
    weight: weights[i] || 1.0,
    arguments: `Argument for ${bet}`,
    prediction: bet,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

describe("HermesBrain — Agent Management", () => {
  test("addAgent creates an active agent", () => {
    const brain = createBrain();
    const result = brain.addAgent("TestAgent");
    expect(result.name).toBe("TestAgent");
    expect(result.status).toBe("active");
    expect(result.weight).toBe(1.0);
  });

  test("addAgent in trial mode", () => {
    const brain = createBrain();
    const result = brain.addAgent("TrialAgent", { trial: true });
    expect(result.status).toBe("trial");
    expect(result.weight).toBe(0.25);
    expect(result.trialRemaining).toBe(15);
  });

  test("addAgent with custom trial predictions", () => {
    const brain = createBrain();
    const result = brain.addAgent("TrialAgent", { trial: true, trialPredictions: 10 });
    expect(result.trialRemaining).toBe(10);
  });

  test("getAgent returns null for missing agent", () => {
    const brain = createBrain();
    expect(brain.getAgent("NonExistent")).toBeNull();
  });

  test("listAgents returns all agents", () => {
    const brain = createBrain();
    brain.addAgent("A1", { displayOrder: 1 });
    brain.addAgent("A2", { displayOrder: 2 });
    brain.addAgent("A3", { displayOrder: 3 });
    const list = brain.listAgents();
    expect(list).toHaveLength(3);
    expect(list[0].agent_name).toBe("A1");
  });

  test("listAgents filters by status", () => {
    const brain = createBrain();
    brain.addAgent("Active1");
    brain.addAgent("Trial1", { trial: true });
    expect(brain.listAgents({ status: "trial" })).toHaveLength(1);
    expect(brain.listAgents({ status: "active" })).toHaveLength(1);
  });

  test("disableAgent sets status and weight to 0", () => {
    const brain = createBrain();
    brain.addAgent("A1");
    const result = brain.disableAgent("A1", "bad performance");
    expect(result.status).toBe("disabled");
    expect(result.previousWeight).toBe(1.0);
    expect(brain.getAgent("A1").weight).toBe(0);
  });

  test("enableAgent restores agent", () => {
    const brain = createBrain();
    brain.addAgent("A1");
    brain.disableAgent("A1");
    brain.enableAgent("A1");
    const agent = brain.getAgent("A1");
    expect(agent.status).toBe("active");
    expect(agent.weight).toBe(1.0);
  });

  test("setAgentWeight snaps to nearest step", () => {
    const brain = createBrain();
    brain.addAgent("A1");
    const w = brain.setAgentWeight("A1", 1.3, "manual");
    expect(w).toBe(1.5);
    expect(brain.getAgent("A1").weight).toBe(1.5);
  });

  test("weight 0.1 snaps to 0", () => {
    const brain = createBrain();
    expect(brain._snapToWeightStep(0.1)).toBe(0);
  });

  test("weight 0.4 snaps to 0.5", () => {
    const brain = createBrain();
    expect(brain._snapToWeightStep(0.4)).toBe(0.5);
  });

  test("weight 2.3 snaps to 2.5", () => {
    const brain = createBrain();
    expect(brain._snapToWeightStep(2.3)).toBe(2.5);
  });

  test("total_analyses starts at 0", () => {
    const brain = createBrain();
    brain.addAgent("A1");
    expect(brain.getAgent("A1").total_analyses).toBe(0);
  });

  test("total_analyses increments after evaluate", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");
    brain.evaluate({
      matchKey: "M1",
      votes: [{ agentName: "A1", vote: "X", confidence: 70 }],
      market: "X",
    });
    expect(brain.getAgent("A1").total_analyses).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MARKET VALIDITY
// ═══════════════════════════════════════════════════════════════════════════

describe("HermesBrain — Market Validity", () => {
  test("Over 2.5 valid at 70'", () => {
    const brain = createBrain();
    const result = brain.isMarketValid("Over 2.5", 70, null);
    expect(result.valid).toBe(true);
  });

  test("Over 2.5 invalid at 80'", () => {
    const brain = createBrain();
    const result = brain.isMarketValid("Over 2.5", 80, null);
    expect(result.valid).toBe(false);
  });

  test("BTTS invalid at 85' with 0-0", () => {
    const brain = createBrain();
    const result = brain.isMarketValid("BTTS", 85, { home: 0, away: 0 });
    expect(result.valid).toBe(false);
  });

  test("BTTS valid at 85' with 1-1", () => {
    const brain = createBrain();
    const result = brain.isMarketValid("BTTS", 85, { home: 1, away: 1 });
    expect(result.valid).toBe(true);
  });

  test("Unknown market is valid by default", () => {
    const brain = createBrain();
    const result = brain.isMarketValid("Exotic Market", 90, null);
    expect(result.valid).toBe(true);
  });

  test("Score exact invalid at 65'", () => {
    const brain = createBrain();
    const result = brain.isMarketValid("Score exact", 65, null);
    expect(result.valid).toBe(false);
  });

  test("Blowout check: Under 2.5 at 82' with 3-1", () => {
    const brain = createBrain();
    const result = brain.isMarketValid("Under 2.5", 82, { home: 3, away: 1 });
    expect(result.valid).toBe(false);
  });

  test("1X2 invalid at 87' with 4-0", () => {
    const brain = createBrain();
    const result = brain.isMarketValid("1X2", 87, { home: 4, away: 0 });
    expect(result.valid).toBe(false);
  });

  test("1X2 valid at 87' with 1-0", () => {
    const brain = createBrain();
    const result = brain.isMarketValid("1X2", 87, { home: 1, away: 0 });
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// INDICE HERMÈS™ — 16 sub-scores
// ═══════════════════════════════════════════════════════════════════════════

describe("HermesBrain — Indice Hermès™", () => {
  test("returns score between 0 and 100", () => {
    const brain = createBrain();
    brain.addAgent("Agent-1");
    brain.addAgent("Agent-2");
    const votes = makeVotes(["Under 2.5", "Under 2.5"], [80, 75]);
    const result = brain.calculateIndiceHermes({ votes, market: "Under 2.5" });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test("includes all 16 breakdown components", () => {
    const brain = createBrain();
    const votes = makeVotes(["Under 2.5"], [70]);
    const result = brain.calculateIndiceHermes({ votes, market: "Under 2.5" });
    const expectedKeys = [
      "statistique", "ia", "historique", "championnat", "forme",
      "domicile_exterieur", "motivation", "calendrier", "blessures",
      "fatigue", "meteo", "bookmakers", "marche", "donnees",
      "stabilite", "risque",
    ];
    for (const key of expectedKeys) {
      expect(result.breakdown).toHaveProperty(key);
      expect(typeof result.breakdown[key]).toBe("number");
    }
  });

  test("higher consensus = higher score", () => {
    const brain = createBrain();
    const low = brain.calculateIndiceHermes({
      votes: makeVotes(["Under 2.5", "Over 2.5", "BTTS", "1X2"], [60, 60, 60, 60]),
      market: "Under 2.5",
    });
    const high = brain.calculateIndiceHermes({
      votes: makeVotes(["Under 2.5", "Under 2.5", "Under 2.5", "Under 2.5"], [80, 80, 80, 80]),
      market: "Under 2.5",
    });
    expect(high.score).toBeGreaterThan(low.score);
  });

  test("invalid market sets marche to 0", () => {
    const brain = createBrain();
    const result = brain.calculateIndiceHermes({
      votes: makeVotes(["Under 2.5"], [90]),
      market: "Under 2.5",
      minute: 80,
    });
    expect(result.breakdown.marche).toBe(0);
  });

  test("championship reliability: Premier League > unknown", () => {
    const brain = createBrain();
    expect(brain._getChampionshipReliability("Premier League")).toBe(98);
    expect(brain._getChampionshipReliability("Unknown League")).toBe(50);
  });

  test("fatigue score decreases with minute", () => {
    const brain = createBrain();
    expect(brain._getFatigueScore(0)).toBe(100);
    expect(brain._getFatigueScore(15)).toBe(95);
    expect(brain._getFatigueScore(45)).toBe(85);
    expect(brain._getFatigueScore(75)).toBe(50);
    expect(brain._getFatigueScore(90)).toBe(10);
  });

  test("stats unavailable reduces score", () => {
    const brain = createBrain();
    const withStats = brain.calculateIndiceHermes({
      votes: makeVotes(["Under 2.5"], [80]),
      market: "Under 2.5",
      statsAvailable: true,
    });
    const withoutStats = brain.calculateIndiceHermes({
      votes: makeVotes(["Under 2.5"], [80]),
      market: "Under 2.5",
      statsAvailable: false,
    });
    expect(withStats.score).toBeGreaterThan(withoutStats.score);
  });

  test("empty votes returns low score", () => {
    const brain = createBrain();
    const result = brain.calculateIndiceHermes({ votes: [] });
    expect(result.score).toBeLessThan(60);
  });

  test("data quality impacts score", () => {
    const brain = createBrain();
    const high = brain.calculateIndiceHermes({
      votes: makeVotes(["Under 2.5"], [80]),
      market: "Under 2.5",
      dataQuality: 1.0,
    });
    const low = brain.calculateIndiceHermes({
      votes: makeVotes(["Under 2.5"], [80]),
      market: "Under 2.5",
      dataQuality: 0.3,
    });
    expect(high.score).toBeGreaterThan(low.score);
  });

  test("home advantage boosts domicile_exterieur", () => {
    const brain = createBrain();
    expect(brain._getHomeAwayScore("home")).toBe(65);
    expect(brain._getHomeAwayScore("away")).toBe(40);
    expect(brain._getHomeAwayScore("neutral")).toBe(50);
    expect(brain._getHomeAwayScore(null)).toBe(50);
  });

  test("motivation score from matchImportance", () => {
    const brain = createBrain();
    expect(brain._getMotivationScore(90)).toBe(90);
    expect(brain._getMotivationScore(null)).toBe(50);
    expect(brain._getMotivationScore(150)).toBe(100);
  });

  test("schedule score from scheduleDensity", () => {
    const brain = createBrain();
    expect(brain._getScheduleScore(80)).toBe(80);
    expect(brain._getScheduleScore(null)).toBe(50);
  });

  test("injury score handles different formats", () => {
    const brain = createBrain();
    expect(brain._getInjuryScore(null)).toBe(50);
    expect(brain._getInjuryScore(75)).toBe(75);
    expect(brain._getInjuryScore({ available: false })).toBe(30);
    expect(brain._getInjuryScore({ score: 90 })).toBe(90);
  });

  test("weather score handles different formats", () => {
    const brain = createBrain();
    expect(brain._getWeatherScore(null)).toBe(50);
    expect(brain._getWeatherScore(80)).toBe(80);
    expect(brain._getWeatherScore({ score: 60 })).toBe(60);
  });

  test("bookmaker score handles different formats", () => {
    const brain = createBrain();
    expect(brain._getBookmakerScore(null, [])).toBe(50);
    expect(brain._getBookmakerScore(85, [])).toBe(85);
    expect(brain._getBookmakerScore({ alignment: 70 }, [])).toBe(70);
  });

  test("data completeness score accumulates", () => {
    const brain = createBrain();
    const minimal = brain._getDataCompletenessScore({ votes: [] });
    const full = brain._getDataCompletenessScore({
      votes: [],
      statsAvailable: true,
      dataQuality: 0.9,
      competition: "Ligue 1",
      homeAway: "home",
      injuryData: {},
      oddsData: {},
      weatherData: {},
      matchImportance: 80,
    });
    expect(full).toBeGreaterThan(minimal);
    expect(full).toBe(100);
  });

  test("risk score varies with conditions", () => {
    const brain = createBrain();
    const lowRisk = brain._getRiskScore(
      makeVotes(["Under 2.5", "Under 2.5", "Under 2.5"], [85, 90, 88]),
      10, null, "Under 2.5"
    );
    const highRisk = brain._getRiskScore(
      makeVotes(["Under 2.5", "Over 2.5", "BTTS", "1X2"], [40, 35, 45, 30]),
      88, { home: 0, away: 0 }, "Under 2.5"
    );
    expect(lowRisk).toBeGreaterThan(highRisk);
  });

  test("totalWeight reflects sum of indiceWeights", () => {
    const brain = createBrain();
    const result = brain.calculateIndiceHermes({ votes: makeVotes(["X"], [70]), market: "X" });
    const expectedTotal = Object.values(DEFAULT_CONFIG.indiceWeights).reduce((s, v) => s + v, 0);
    expect(result.totalWeight).toBe(expectedTotal);
  });

  test("custom indiceWeights are applied", () => {
    const brain = createBrain({
      indiceWeights: {
        statistique: 0, ia: 0, historique: 0, championnat: 0, forme: 50,
        domicile_exterieur: 0, motivation: 0, calendrier: 0, blessures: 0,
        fatigue: 0, meteo: 0, bookmakers: 0, marche: 50, donnees: 0,
        stabilite: 0, risque: 0,
      },
    });
    const result = brain.calculateIndiceHermes({
      votes: makeVotes(["Under 2.5", "Under 2.5"], [80, 80]),
      market: "Under 2.5",
    });
    expect(result.breakdown.marche).toBe(100);
    expect(result.score).toBeGreaterThanOrEqual(50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONSENSUS LEVELS
// ═══════════════════════════════════════════════════════════════════════════

describe("HermesBrain — Consensus Levels", () => {
  test("0% = FAIBLE", () => {
    const brain = createBrain();
    expect(brain.getConsensusLevel(0).level).toBe("FAIBLE");
  });

  test("50% = MOYEN", () => {
    const brain = createBrain();
    expect(brain.getConsensusLevel(50).level).toBe("MOYEN");
  });

  test("75% = FORT", () => {
    const brain = createBrain();
    expect(brain.getConsensusLevel(75).level).toBe("FORT");
  });

  test("95% = EXCEPTIONNEL", () => {
    const brain = createBrain();
    expect(brain.getConsensusLevel(95).level).toBe("EXCEPTIONNEL");
  });

  test("includes label and pct", () => {
    const brain = createBrain();
    const result = brain.getConsensusLevel(85);
    expect(result.label).toBe("Consensus fort");
    expect(result.pct).toBe(85);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HERMÈS DECISION (evaluate)
// ═══════════════════════════════════════════════════════════════════════════

describe("HermesBrain — Decision (evaluate)", () => {
  test("refuses when indice is below threshold", () => {
    const brain = createBrain({ publicationThreshold: 90 });
    ["Agent-1", "Agent-2", "Agent-3", "Agent-4"].forEach(n => brain.addAgent(n));
    const result = brain.evaluate({
      matchKey: "PSG_OL",
      home: "PSG",
      away: "OL",
      votes: makeVotes(["Under 2.5", "Over 2.5", "BTTS", "1X2"], [40, 30, 35, 25]),
      market: "Under 2.5",
    });
    expect(result.decision).toBe("REFUS");
    expect(result.published).toBe(false);
  });

  test("refuses when market is invalid", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    ["Agent-1", "Agent-2"].forEach(n => brain.addAgent(n));
    const result = brain.evaluate({
      matchKey: "A_B",
      home: "A",
      away: "B",
      votes: makeVotes(["Under 2.5", "Under 2.5"], [90, 90]),
      market: "Under 2.5",
      minute: 80,
    });
    expect(result.decision).toBe("REFUS");
    expect(result.reason).toContain("invalide");
  });

  test("publishes when indice meets threshold", () => {
    const brain = createBrain({ publicationThreshold: 30 });
    ["Agent-1", "Agent-2", "Agent-3", "Agent-4"].forEach(n => brain.addAgent(n));
    const result = brain.evaluate({
      matchKey: "PSG_OL",
      home: "PSG",
      away: "OL",
      competition: "Ligue 1",
      votes: makeVotes(["Under 2.5", "Under 2.5", "Under 2.5", "Under 2.5"], [85, 80, 82, 78]),
      market: "Under 2.5",
      dataQuality: 1.0,
      statsAvailable: true,
    });
    expect(result.decision).toBe("PUBLICATION");
    expect(result.published).toBe(true);
    expect(result.indiceHermes).toBeGreaterThanOrEqual(30);
  });

  test("returns indiceHermes and indiceBreakdown", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    ["Agent-1"].forEach(n => brain.addAgent(n));
    const result = brain.evaluate({
      matchKey: "A_B",
      home: "A",
      away: "B",
      votes: makeVotes(["Under 2.5"], [80]),
      market: "Under 2.5",
    });
    expect(typeof result.indiceHermes).toBe("number");
    expect(result.indiceHermes).toBeGreaterThanOrEqual(0);
    expect(result.indiceHermes).toBeLessThanOrEqual(100);
    expect(result.indiceBreakdown).toBeDefined();
    expect(result.indiceBreakdown).toHaveProperty("statistique");
    expect(result.indiceBreakdown).toHaveProperty("risque");
  });

  test("returns consensus level", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    ["Agent-1", "Agent-2"].forEach(n => brain.addAgent(n));
    const result = brain.evaluate({
      matchKey: "A_B",
      home: "A",
      away: "B",
      votes: makeVotes(["Under 2.5", "Under 2.5"], [80, 80]),
      market: "Under 2.5",
    });
    expect(result.consensus).toBeDefined();
    expect(result.consensus.level).toBeDefined();
  });

  test("returns dominant bet", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    ["Agent-1", "Agent-2", "Agent-3"].forEach(n => brain.addAgent(n));
    const result = brain.evaluate({
      matchKey: "A_B",
      home: "A",
      away: "B",
      votes: makeVotes(["Under 2.5", "Under 2.5", "Over 2.5"], [80, 85, 60]),
      market: "Under 2.5",
    });
    expect(result.dominantBet).toBe("Under 2.5");
  });

  test("logs to journal", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    ["Agent-1"].forEach(n => brain.addAgent(n));
    brain.evaluate({
      matchKey: "X_Y",
      home: "X",
      away: "Y",
      votes: makeVotes(["BTTS"], [70]),
      market: "BTTS",
    });
    const journal = brain.getJournal();
    expect(journal).toHaveLength(1);
    expect(journal[0].match_key).toBe("X_Y");
  });

  test("trial agent has reduced weight in evaluation", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("Regular", { weight: 2.0 });
    brain.addAgent("Newbie", { trial: true });
    const result = brain.evaluate({
      matchKey: "A_B",
      home: "A",
      away: "B",
      votes: [
        { agentName: "Regular", vote: "Under 2.5", confidence: 80 },
        { agentName: "Newbie", vote: "Over 2.5", confidence: 80 },
      ],
      market: "Under 2.5",
    });
    expect(result.votes[1].weight).toBe(0.25);
  });

  test("disabled agent has zero weight", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");
    brain.disableAgent("A1");
    const result = brain.evaluate({
      matchKey: "X_Y",
      home: "X",
      away: "Y",
      votes: [{ agentName: "A1", vote: "Under 2.5", confidence: 90 }],
      market: "Under 2.5",
    });
    expect(result.votes[0].weight).toBe(0);
  });

  test("reason explains refusal clearly", () => {
    const brain = createBrain({ publicationThreshold: 95 });
    const result = brain.evaluate({
      matchKey: "A_B",
      votes: makeVotes(["Under 2.5"], [50]),
      market: "Under 2.5",
    });
    expect(result.reason).toContain("aucun signal suffisamment fiable");
  });

  test("marketValid flag is in result", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");
    const valid = brain.evaluate({
      matchKey: "M1",
      votes: [{ agentName: "A1", vote: "X", confidence: 80 }],
      market: "Under 2.5",
      minute: 10,
    });
    expect(valid.marketValid).toBe(true);

    const invalid = brain.evaluate({
      matchKey: "M2",
      votes: [{ agentName: "A1", vote: "X", confidence: 80 }],
      market: "Under 2.5",
      minute: 80,
    });
    expect(invalid.marketValid).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONFIDENCE RANGE
// ═══════════════════════════════════════════════════════════════════════════

describe("HermesBrain — Confidence Range", () => {
  test("confidence ranges bucketed correctly", () => {
    const brain = createBrain();
    expect(brain._confidenceRange(30)).toBe("very_low");
    expect(brain._confidenceRange(55)).toBe("low");
    expect(brain._confidenceRange(65)).toBe("medium");
    expect(brain._confidenceRange(75)).toBe("high");
    expect(brain._confidenceRange(85)).toBe("very_high");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TRIAL PHASE
// ═══════════════════════════════════════════════════════════════════════════

describe("HermesBrain — Trial Phase", () => {
  test("trial counter decrements after evaluation", () => {
    const brain = createBrain();
    brain.addAgent("TrialBot", { trial: true, trialPredictions: 3 });
    brain.evaluate({
      matchKey: "A_B",
      votes: [{ agentName: "TrialBot", vote: "Under 2.5", confidence: 70 }],
      market: "Under 2.5",
    });
    expect(brain.getAgent("TrialBot").trial_remaining).toBe(2);
  });

  test("trial agent promoted after completing trial with good results", () => {
    const brain = createBrain({ autoPromote: { minPredictions: 3, winrateThreshold: 55 } });
    brain.addAgent("TrialBot", { trial: true, trialPredictions: 2 });

    brain.evaluate({ matchKey: "M1", votes: [{ agentName: "TrialBot", vote: "X", confidence: 80 }], market: "X" });
    brain.db.prepare("UPDATE hermes_predictions SET outcome = 'win' WHERE match_key = 'M1'").run();

    brain.evaluate({ matchKey: "M2", votes: [{ agentName: "TrialBot", vote: "X", confidence: 80 }], market: "X" });
    brain.db.prepare("UPDATE hermes_predictions SET outcome = 'win' WHERE match_key = 'M2'").run();

    const agent = brain.getAgent("TrialBot");
    expect(agent.status).not.toBe("trial");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LEARNING LOOP
// ═══════════════════════════════════════════════════════════════════════════

describe("HermesBrain — Learning Loop", () => {
  test("processResult resolves pending predictions", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");
    brain.evaluate({
      matchKey: "PSG_OL",
      home: "PSG",
      away: "OL",
      votes: [{ agentName: "A1", vote: "Under 2.5", confidence: 80 }],
      market: "Under 2.5",
    });
    const result = brain.processResult("PSG_OL", "win");
    expect(result.predictionsResolved).toBe(1);
  });

  test("processResult creates specializations", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");
    brain.evaluate({
      matchKey: "PSG_OL",
      home: "PSG",
      away: "OL",
      sport: "football",
      votes: [{ agentName: "A1", vote: "Under 2.5", confidence: 80 }],
      market: "Under 2.5",
    });
    brain.processResult("PSG_OL", "win");
    const specs = brain.getSpecializations("A1");
    expect(specs.length).toBeGreaterThan(0);
    expect(specs[0].wins).toBe(1);
  });

  test("processResult updates journal", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");
    brain.evaluate({
      matchKey: "PSG_OL",
      votes: [{ agentName: "A1", vote: "X", confidence: 80 }],
      market: "X",
    });
    brain.processResult("PSG_OL", "win");
    const journal = brain.getJournal({ matchKey: "PSG_OL" });
    expect(journal[0].result).toBe("win");
  });

  test("multiple results build specialization winrate", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");

    for (let i = 0; i < 5; i++) {
      brain.evaluate({
        matchKey: `match_${i}`,
        sport: "football",
        votes: [{ agentName: "A1", vote: "Under 2.5", confidence: 80 }],
        market: "Under 2.5",
      });
      brain.processResult(`match_${i}`, i < 4 ? "win" : "loss");
    }

    const specs = brain.getSpecializations("A1", { marketType: "Under 2.5" });
    expect(specs[0].wins).toBe(4);
    expect(specs[0].losses).toBe(1);
    expect(specs[0].winrate).toBe(80);
  });

  test("processResult builds rankings", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");
    brain.addAgent("A2");

    for (let i = 0; i < 3; i++) {
      brain.evaluate({
        matchKey: `r_${i}`,
        sport: "football",
        competition: "Ligue 1",
        votes: [
          { agentName: "A1", vote: "Under 2.5", confidence: 80 },
          { agentName: "A2", vote: "Under 2.5", confidence: 70 },
        ],
        market: "Under 2.5",
      });
      brain.processResult(`r_${i}`, "win");
    }

    const rankings = brain.getRankings("football", "Ligue 1", "Under 2.5");
    expect(rankings.length).toBe(2);
    expect(rankings[0].rank).toBe(1);
    expect(rankings[1].rank).toBe(2);
  });

  test("processResult calculates precision", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");

    for (let i = 0; i < 5; i++) {
      brain.evaluate({
        matchKey: `p_${i}`,
        sport: "football",
        competition: "Ligue 1",
        votes: [{ agentName: "A1", vote: "X", confidence: 80 }],
        market: "X",
      });
      brain.processResult(`p_${i}`, i < 4 ? "win" : "loss");
    }

    const specs = brain.getSpecializations("A1", { sport: "football", marketType: "X" });
    expect(specs[0].precision_score).toBeGreaterThanOrEqual(0);
    expect(specs[0].precision_score).toBeLessThanOrEqual(100);
  });

  test("processResult calculates stability", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");

    for (let i = 0; i < 8; i++) {
      brain.evaluate({
        matchKey: `s_${i}`,
        sport: "football",
        votes: [{ agentName: "A1", vote: "X", confidence: 75 }],
        market: "X",
      });
      brain.processResult(`s_${i}`, i % 2 === 0 ? "win" : "loss");
    }

    const specs = brain.getSpecializations("A1", { marketType: "X" });
    expect(specs[0].stability).toBeGreaterThanOrEqual(0);
    expect(specs[0].stability).toBeLessThanOrEqual(100);
  });

  test("processResult calculates yield", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");

    for (let i = 0; i < 5; i++) {
      brain.evaluate({
        matchKey: `y_${i}`,
        sport: "football",
        votes: [{ agentName: "A1", vote: "X", confidence: 80 }],
        market: "X",
      });
      brain.processResult(`y_${i}`, i < 3 ? "win" : "loss");
    }

    const specs = brain.getSpecializations("A1", { marketType: "X" });
    expect(specs[0].yield).toBeDefined();
    expect(typeof specs[0].yield).toBe("number");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SPECIALIZATIONS
// ═══════════════════════════════════════════════════════════════════════════

describe("HermesBrain — Specializations", () => {
  test("getSpecializations returns empty for new agent", () => {
    const brain = createBrain();
    brain.addAgent("A1");
    expect(brain.getSpecializations("A1")).toHaveLength(0);
  });

  test("getTopAgentForContext returns null with no data", () => {
    const brain = createBrain();
    expect(brain.getTopAgentForContext("football", "Ligue 1", "Under 2.5")).toBeNull();
  });

  test("getTopAgentForContext returns best agent after learning", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("Good");
    brain.addAgent("Bad");

    for (let i = 0; i < 6; i++) {
      brain.evaluate({
        matchKey: `m_${i}`,
        sport: "football",
        competition: "Ligue 1",
        votes: [
          { agentName: "Good", vote: "Under 2.5", confidence: 80 },
          { agentName: "Bad", vote: "Under 2.5", confidence: 80 },
        ],
        market: "Under 2.5",
      });
      brain.processResult(`m_${i}`, "win");
    }

    const top = brain.getTopAgentForContext("football", "Ligue 1", "Under 2.5");
    expect(top).not.toBeNull();
    expect(top.total_predictions).toBeGreaterThanOrEqual(5);
  });

  test("specializations filter by sport", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");

    brain.evaluate({ matchKey: "fb1", sport: "football", votes: [{ agentName: "A1", vote: "X", confidence: 70 }], market: "X" });
    brain.processResult("fb1", "win");

    brain.evaluate({ matchKey: "bk1", sport: "basketball", votes: [{ agentName: "A1", vote: "Y", confidence: 70 }], market: "Y" });
    brain.processResult("bk1", "loss");

    const fbSpecs = brain.getSpecializations("A1", { sport: "football" });
    const bkSpecs = brain.getSpecializations("A1", { sport: "basketball" });
    expect(fbSpecs).toHaveLength(1);
    expect(bkSpecs).toHaveLength(1);
    expect(fbSpecs[0].wins).toBe(1);
    expect(bkSpecs[0].losses).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RANKINGS
// ═══════════════════════════════════════════════════════════════════════════

describe("HermesBrain — Rankings", () => {
  test("getRankings returns empty with no data", () => {
    const brain = createBrain();
    expect(brain.getRankings("football")).toHaveLength(0);
  });

  test("getAllRankings groups by sport/competition/market", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");
    brain.addAgent("A2");

    brain.evaluate({
      matchKey: "rank1",
      sport: "football",
      competition: "Ligue 1",
      votes: [
        { agentName: "A1", vote: "X", confidence: 80 },
        { agentName: "A2", vote: "X", confidence: 70 },
      ],
      market: "X",
    });
    brain.processResult("rank1", "win");

    const all = brain.getAllRankings();
    expect(all.length).toBeGreaterThan(0);
    expect(all[0]).toHaveProperty("sport");
    expect(all[0]).toHaveProperty("competition");
    expect(all[0]).toHaveProperty("market_type");
    expect(all[0]).toHaveProperty("agents");
    expect(all[0]).toHaveProperty("agent_count");
  });

  test("rankings update rank in specializations", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");

    brain.evaluate({
      matchKey: "sp_rank1",
      sport: "football",
      competition: "PL",
      votes: [{ agentName: "A1", vote: "X", confidence: 80 }],
      market: "X",
    });
    brain.processResult("sp_rank1", "win");

    const specs = brain.getSpecializations("A1");
    expect(specs[0].rank).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DYNAMIC WEIGHTS
// ═══════════════════════════════════════════════════════════════════════════

describe("HermesBrain — Dynamic Weights", () => {
  test("weight increases after consistent wins", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("GoodAgent");

    for (let i = 0; i < 10; i++) {
      brain.evaluate({
        matchKey: `w_${i}`,
        sport: "football",
        votes: [{ agentName: "GoodAgent", vote: "Under 2.5", confidence: 85 }],
        market: "Under 2.5",
      });
      brain.processResult(`w_${i}`, "win");
    }

    const agent = brain.getAgent("GoodAgent");
    expect(agent.weight).toBeGreaterThan(1.0);
  });

  test("weight decreases after consistent losses", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("BadAgent");

    for (let i = 0; i < 10; i++) {
      brain.evaluate({
        matchKey: `l_${i}`,
        sport: "football",
        votes: [{ agentName: "BadAgent", vote: "Under 2.5", confidence: 50 }],
        market: "Under 2.5",
      });
      brain.processResult(`l_${i}`, "loss");
    }

    const agent = brain.getAgent("BadAgent");
    expect(agent.weight).toBeLessThan(1.0);
  });

  test("weight history is logged", () => {
    const brain = createBrain();
    brain.addAgent("A1");
    brain.setAgentWeight("A1", 2.0, "manual boost");
    const history = brain.db.prepare("SELECT * FROM hermes_weight_history WHERE agent_name = 'A1'").all();
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].new_weight).toBe(2.0);
    expect(history[0].reason).toBe("manual boost");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

describe("HermesBrain — Auto-Management", () => {
  test("auto-disables agent with low winrate", () => {
    const brain = createBrain({
      publicationThreshold: 10,
      autoDisable: { minPredictions: 5, winrateThreshold: 35 },
    });
    brain.addAgent("Terrible");

    for (let i = 0; i < 6; i++) {
      brain.evaluate({
        matchKey: `m_${i}`,
        sport: "football",
        votes: [{ agentName: "Terrible", vote: "X", confidence: 50 }],
        market: "X",
      });
      brain.processResult(`m_${i}`, "loss");
    }

    const agent = brain.getAgent("Terrible");
    expect(agent.status).toBe("disabled");
  });

  test("getRecommendations identifies inactive agents", () => {
    const brain = createBrain();
    brain.db.prepare(`
      INSERT INTO hermes_agents (agent_name, status, weight, created_at)
      VALUES ('OldAgent', 'active', 1.0, datetime('now', '-14 days'))
    `).run();
    const recs = brain.getRecommendations();
    const inactive = recs.find(r => r.type === "alert_inactive" && r.agent === "OldAgent");
    expect(inactive).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AGENT FULL STATS
// ═══════════════════════════════════════════════════════════════════════════

describe("HermesBrain — Agent Full Stats", () => {
  test("getAgentFullStats returns null for unknown agent", () => {
    const brain = createBrain();
    expect(brain.getAgentFullStats("Unknown")).toBeNull();
  });

  test("getAgentFullStats returns complete profile", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");

    for (let i = 0; i < 5; i++) {
      brain.evaluate({
        matchKey: `fs_${i}`,
        sport: "football",
        competition: "Ligue 1",
        votes: [{ agentName: "A1", vote: "Under 2.5", confidence: 80 }],
        market: "Under 2.5",
      });
      brain.processResult(`fs_${i}`, i < 4 ? "win" : "loss");
    }

    const stats = brain.getAgentFullStats("A1");
    expect(stats).not.toBeNull();
    expect(stats.agent_name).toBe("A1");
    expect(stats.globalStats).toBeDefined();
    expect(stats.globalStats.total).toBe(5);
    expect(stats.globalStats.wins).toBe(4);
    expect(stats.globalStats.losses).toBe(1);
    expect(stats.globalStats.winrate).toBeGreaterThan(0);
    expect(stats.globalStats.roi).toBeDefined();
    expect(stats.globalStats.yield).toBeDefined();
    expect(stats.specializations.length).toBeGreaterThan(0);
    expect(stats.rankings).toBeDefined();
    expect(stats.recentPredictions.length).toBeGreaterThan(0);
    expect(stats.weightHistory).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// JOURNAL
// ═══════════════════════════════════════════════════════════════════════════

describe("HermesBrain — Journal", () => {
  test("journal records all required fields", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");
    brain.evaluate({
      matchKey: "PSG_OL",
      home: "PSG",
      away: "OL",
      competition: "Ligue 1",
      sport: "football",
      market: "Under 2.5",
      minute: 0,
      votes: [{ agentName: "A1", vote: "Under 2.5", confidence: 80, arguments: "Strong defense" }],
    });

    const entry = brain.getJournal()[0];
    expect(entry.match_key).toBe("PSG_OL");
    expect(entry.home).toBe("PSG");
    expect(entry.away).toBe("OL");
    expect(entry.competition).toBe("Ligue 1");
    expect(entry.sport).toBe("football");
    expect(entry.market_type).toBe("Under 2.5");
    expect(entry.indice_hermes).toBeGreaterThan(0);
    expect(entry.consensus_level).toBeDefined();
    expect(entry.decision).toBeDefined();
    expect(entry.decision_reason).toBeDefined();
  });

  test("journal filters by decision", () => {
    const brain = createBrain({ publicationThreshold: 50 });
    brain.addAgent("Agent-1");

    brain.evaluate({
      matchKey: "M1",
      votes: makeVotes(["Under 2.5"], [80]),
      market: "Under 2.5",
      competition: "Premier League",
    });
    brain.evaluate({
      matchKey: "M2",
      votes: makeVotes(["Under 2.5"], [10]),
      market: "Under 2.5",
      minute: 80,
    });

    const refused = brain.getJournal({ decision: "REFUS" });
    expect(refused.length).toBeGreaterThanOrEqual(1);
  });

  test("getJournalEntry parses JSON fields", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");
    brain.evaluate({
      matchKey: "X_Y",
      votes: [{ agentName: "A1", vote: "X", confidence: 70 }],
      market: "X",
    });
    const journal = brain.getJournal();
    const entry = brain.getJournalEntry(journal[0].id);
    expect(typeof entry.indice_breakdown).toBe("object");
    expect(entry.indice_breakdown).toHaveProperty("statistique");
    expect(Array.isArray(entry.votes_json)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

describe("HermesBrain — Dashboard", () => {
  test("getDashboard returns complete structure", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");
    brain.addAgent("A2", { trial: true });
    brain.evaluate({
      matchKey: "X_Y",
      votes: [
        { agentName: "A1", vote: "X", confidence: 80 },
        { agentName: "A2", vote: "X", confidence: 70 },
      ],
      market: "X",
    });
    brain.processResult("X_Y", "win");

    const dashboard = brain.getDashboard();
    expect(dashboard.generatedAt).toBeDefined();
    expect(dashboard.config.publicationThreshold).toBe(10);
    expect(dashboard.agents).toHaveLength(2);
    expect(dashboard.globalStats).toBeDefined();
    expect(dashboard.journal).toBeDefined();
    expect(dashboard.rankings).toBeDefined();
    expect(dashboard.recentDecisions).toBeDefined();
    expect(dashboard.recentWeightChanges).toBeDefined();
    expect(dashboard.recommendations).toBeDefined();
  });

  test("dashboard agent entry includes specializations and metrics", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");
    brain.evaluate({
      matchKey: "M1",
      sport: "football",
      votes: [{ agentName: "A1", vote: "Under 2.5", confidence: 80 }],
      market: "Under 2.5",
    });
    brain.processResult("M1", "win");

    const dashboard = brain.getDashboard();
    const a1 = dashboard.agents.find(a => a.name === "A1");
    expect(a1.specializations.length).toBeGreaterThan(0);
    expect(a1.totalPredictions).toBe(1);
    expect(a1.winrate).toBe(100);
    expect(a1.roi).toBeDefined();
    expect(a1.yield).toBeDefined();
    expect(a1.totalAnalyses).toBeDefined();
  });

  test("dashboard journal stats include avg_indice", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");
    brain.evaluate({
      matchKey: "D1",
      votes: [{ agentName: "A1", vote: "X", confidence: 80 }],
      market: "X",
    });

    const dashboard = brain.getDashboard();
    expect(dashboard.journal).toHaveProperty("avg_indice");
    expect(dashboard.journal).toHaveProperty("total_evaluations");
    expect(dashboard.journal).toHaveProperty("published");
    expect(dashboard.journal).toHaveProperty("refused");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

describe("HermesBrain — Configuration", () => {
  test("getThreshold returns default", () => {
    const brain = createBrain();
    expect(brain.getThreshold()).toBe(90);
  });

  test("setThreshold clamps to 0-100", () => {
    const brain = createBrain();
    brain.setThreshold(150);
    expect(brain.getThreshold()).toBe(100);
    brain.setThreshold(-10);
    expect(brain.getThreshold()).toBe(0);
  });

  test("updateConfig merges partial config", () => {
    const brain = createBrain();
    brain.updateConfig({ publicationThreshold: 85, trialPredictions: 20 });
    expect(brain.getThreshold()).toBe(85);
    expect(brain.config.trialPredictions).toBe(20);
  });

  test("getConfig returns full config copy", () => {
    const brain = createBrain();
    const config = brain.getConfig();
    expect(config.publicationThreshold).toBe(90);
    expect(config.indiceWeights).toBeDefined();
    expect(config.consensusLevels).toBeDefined();
    expect(config.marketValidityRules).toBeDefined();
  });

  test("updateConfig merges indiceWeights", () => {
    const brain = createBrain();
    brain.updateConfig({ indiceWeights: { statistique: 20 } });
    expect(brain.config.indiceWeights.statistique).toBe(20);
    expect(brain.config.indiceWeights.ia).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXTENSIBILITY
// ═══════════════════════════════════════════════════════════════════════════

describe("HermesBrain — Extensibility", () => {
  test("adding a new agent doesn't break existing flow", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("OldAgent");
    brain.evaluate({
      matchKey: "M1",
      votes: [{ agentName: "OldAgent", vote: "X", confidence: 80 }],
      market: "X",
    });
    brain.addAgent("NewAgent", { trial: true });
    const result = brain.evaluate({
      matchKey: "M2",
      votes: [
        { agentName: "OldAgent", vote: "X", confidence: 80 },
        { agentName: "NewAgent", vote: "Y", confidence: 70 },
      ],
      market: "X",
    });
    expect(result.decision).toBeDefined();
    expect(result.votes).toHaveLength(2);
  });

  test("adding a new sport works seamlessly", () => {
    const brain = createBrain({ publicationThreshold: 10 });
    brain.addAgent("A1");
    const result = brain.evaluate({
      matchKey: "Tennis_M1",
      sport: "tennis",
      votes: [{ agentName: "A1", vote: "Winner", confidence: 75 }],
      market: "Winner",
    });
    expect(result.decision).toBeDefined();
    brain.processResult("Tennis_M1", "win");
    const specs = brain.getSpecializations("A1", { sport: "tennis" });
    expect(specs.length).toBeGreaterThan(0);
  });

  test("custom market validity rule works", () => {
    const brain = createBrain({
      marketValidityRules: {
        "Custom Market": { maxMinute: 50 },
      },
    });
    expect(brain.isMarketValid("Custom Market", 45, null).valid).toBe(true);
    expect(brain.isMarketValid("Custom Market", 55, null).valid).toBe(false);
  });

  test("custom championship reliability works", () => {
    const brain = createBrain({
      championshipReliability: { "My League": 99 },
    });
    expect(brain._getChampionshipReliability("My League")).toBe(99);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FULL SCENARIO
// ═══════════════════════════════════════════════════════════════════════════

describe("HermesBrain — Full Scenario", () => {
  test("complete lifecycle: add agents → evaluate → result → learn → rankings", () => {
    const brain = createBrain({ publicationThreshold: 30 });

    brain.addAgent("DeepSeek", { displayOrder: 1 });
    brain.addAgent("Mistral", { displayOrder: 2 });
    brain.addAgent("Gemini", { displayOrder: 3 });
    brain.addAgent("Chief", { displayOrder: 4 });
    brain.addAgent("NewBot", { trial: true, trialPredictions: 5 });

    const eval1 = brain.evaluate({
      matchKey: "PSG_OM_2026-07-08",
      home: "PSG",
      away: "OM",
      competition: "Ligue 1",
      sport: "football",
      market: "Under 2.5",
      minute: 0,
      dataQuality: 1.0,
      statsAvailable: true,
      votes: [
        { agentName: "DeepSeek", vote: "Under 2.5", confidence: 85, arguments: "Defensive teams" },
        { agentName: "Mistral", vote: "Under 2.5", confidence: 80, arguments: "Low-scoring H2H" },
        { agentName: "Gemini", vote: "Under 2.5", confidence: 78, arguments: "Recent under trend" },
        { agentName: "Chief", vote: "Under 2.5", confidence: 82, arguments: "Consensus clear" },
        { agentName: "NewBot", vote: "Under 2.5", confidence: 70, arguments: "I agree" },
      ],
    });

    expect(eval1.indiceHermes).toBeGreaterThan(0);
    expect(eval1.indiceBreakdown).toBeDefined();
    expect(eval1.indiceBreakdown).toHaveProperty("statistique");
    expect(eval1.indiceBreakdown).toHaveProperty("risque");
    expect(eval1.dominantBet).toBe("Under 2.5");

    const result1 = brain.processResult("PSG_OM_2026-07-08", "win");
    expect(result1.predictionsResolved).toBe(5);

    const specs = brain.getSpecializations("DeepSeek", { sport: "football", marketType: "Under 2.5" });
    expect(specs.length).toBe(1);
    expect(specs[0].wins).toBe(1);

    const dashboard = brain.getDashboard();
    expect(dashboard.agents).toHaveLength(5);
    expect(dashboard.globalStats.wins).toBe(5);
    expect(dashboard.rankings.length).toBeGreaterThan(0);

    const newBot = brain.getAgent("NewBot");
    expect(newBot.trial_remaining).toBe(4);
    expect(newBot.total_analyses).toBe(1);

    const fullStats = brain.getAgentFullStats("DeepSeek");
    expect(fullStats).not.toBeNull();
    expect(fullStats.globalStats.wins).toBe(1);
    expect(fullStats.specializations.length).toBeGreaterThan(0);
  });
});

const Database = require("better-sqlite3");
const { PublicationEngine, evaluatePublication, loadConfig, DEFAULT_CONFIG } = require("../publication_engine");
const { SnapshotStore } = require("../snapshot_store");
const { bus, EVENT_NAMES } = require("../event_bus");

function makeDb() {
  return new Database(":memory:");
}

function makeStore(db) {
  return new SnapshotStore(db || makeDb());
}

function makeAnalysis(overrides = {}) {
  return {
    match_key: "12345_2026-07-05",
    best_bet: "Under 2.5 buts",
    confidence: 82,
    consensus_votes: 4,
    total_agents: 5,
    raison: "Match defensif, peu de tirs cadres",
    agents: [
      { name: "Groq", bet: "Under 2.5 buts", confidence: 80, icon: "🌐" },
      { name: "DeepSeek", bet: "Under 2.5 buts", confidence: 85, icon: "🔮" },
      { name: "Mistral", bet: "Over 2.5 buts", confidence: 60, icon: "🌊" },
      { name: "Cerebras", bet: "Under 2.5 buts", confidence: 78, icon: "🧬" },
      { name: "Claude Chief", bet: "Under 2.5 buts", confidence: 82, isChief: true, icon: "👑" },
    ],
    ...overrides,
  };
}

function makeMatch(overrides = {}) {
  return {
    id: "12345",
    home: "PSG",
    away: "Marseille",
    competition: "Ligue 1",
    sport: "Football",
    score_home: 0,
    score_away: 0,
    minute: "45",
    status: "IN_PLAY",
    ...overrides,
  };
}

describe("evaluatePublication", () => {
  const config = DEFAULT_CONFIG;

  test("rejects publication before 30th minute", () => {
    const store = makeStore();
    const analysis = makeAnalysis();
    const result = evaluatePublication(analysis, 10, config, store);
    expect(result.decision).toBe("WAIT");
    expect(result.reason).toMatch(/Too early/);
  });

  test("rejects publication before MIN_PUBLICATION_MINUTE=30 at minute 29", () => {
    const store = makeStore();
    const result = evaluatePublication(makeAnalysis(), 29, config, store);
    expect(result.decision).toBe("WAIT");
  });

  test("allows publication at exactly minute 30", () => {
    const store = makeStore();
    const result = evaluatePublication(makeAnalysis(), 30, config, store);
    expect(result.decision).toBe("PUBLISH");
  });

  test("rejects publication after 75th minute", () => {
    const store = makeStore();
    const result = evaluatePublication(makeAnalysis(), 80, config, store);
    expect(result.decision).toBe("BLOCKED");
    expect(result.reason).toMatch(/Too late/);
  });

  test("allows publication at exactly minute 75", () => {
    const store = makeStore();
    const result = evaluatePublication(makeAnalysis(), 75, config, store);
    expect(result.decision).toBe("PUBLISH");
  });

  test("rejects publication with low confidence", () => {
    const store = makeStore();
    const analysis = makeAnalysis({ confidence: 50 });
    const result = evaluatePublication(analysis, 45, config, store);
    expect(result.decision).toBe("WAIT");
    expect(result.reason).toMatch(/Low confidence/);
  });

  test("rejects publication with weak consensus", () => {
    const store = makeStore();
    const analysis = makeAnalysis({ consensus_votes: 2 });
    const result = evaluatePublication(analysis, 45, config, store);
    expect(result.decision).toBe("WAIT");
    expect(result.reason).toMatch(/Weak consensus/);
  });

  test("accepts publication with all criteria met", () => {
    const store = makeStore();
    const result = evaluatePublication(makeAnalysis(), 45, config, store);
    expect(result.decision).toBe("PUBLISH");
    expect(result.reason).toMatch(/OK/);
  });

  test("blocks if snapshot already exists (immutable)", () => {
    const db = makeDb();
    const store = makeStore(db);
    store.createSnapshot(makeAnalysis(), makeMatch(), 45);
    const result = evaluatePublication(makeAnalysis(), 50, config, store);
    expect(result.decision).toBe("BLOCKED");
    expect(result.reason).toMatch(/immutable/);
  });
});

describe("PublicationEngine", () => {
  test("creates snapshot on valid publication", () => {
    const db = makeDb();
    const store = makeStore(db);
    const engine = new PublicationEngine({ snapshotStore: store, config: DEFAULT_CONFIG });

    const result = engine.process(makeAnalysis(), makeMatch({ minute: "50" }));
    expect(result.decision).toBe("PUBLISH");
    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.selection).toBe("Under 2.5 buts");
    expect(result.snapshot.locked).toBe(1);
  });

  test("snapshot is immutable — second publication blocked", () => {
    const db = makeDb();
    const store = makeStore(db);
    const engine = new PublicationEngine({ snapshotStore: store, config: DEFAULT_CONFIG });

    const r1 = engine.process(makeAnalysis(), makeMatch({ minute: "45" }));
    expect(r1.decision).toBe("PUBLISH");

    const r2 = engine.process(
      makeAnalysis({ best_bet: "Over 2.5 buts", confidence: 90 }),
      makeMatch({ minute: "55", score_home: 1, score_away: 1 })
    );
    expect(r2.decision).toBe("BLOCKED");
    expect(r2.reason).toMatch(/immutable/);

    const snapshot = store.getSnapshot("12345_2026-07-05");
    expect(snapshot.selection).toBe("Under 2.5 buts");
  });

  test("saves post-publication analysis after snapshot exists", () => {
    const db = makeDb();
    const store = makeStore(db);
    const engine = new PublicationEngine({ snapshotStore: store, config: DEFAULT_CONFIG });

    engine.process(makeAnalysis(), makeMatch({ minute: "45" }));
    engine.process(
      makeAnalysis({ best_bet: "Over 2.5 buts", confidence: 88 }),
      makeMatch({ minute: "60", score_home: 1, score_away: 1 })
    );

    const postAnalyses = store.getPostPublicationAnalyses("12345_2026-07-05");
    expect(postAnalyses).toHaveLength(1);
    expect(postAnalyses[0].selection).toBe("Over 2.5 buts");
    expect(postAnalyses[0].confidence).toBe(88);
  });

  test("emits OFFICIAL_PREDICTION_PUBLISHED event", () => {
    const db = makeDb();
    const store = makeStore(db);
    const engine = new PublicationEngine({ snapshotStore: store, config: DEFAULT_CONFIG });
    const events = [];
    bus.on(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, (payload) => events.push(payload));

    engine.process(makeAnalysis(), makeMatch({ minute: "50" }));

    expect(events).toHaveLength(1);
    expect(events[0].selection).toBe("Under 2.5 buts");
    expect(events[0].home).toBe("PSG");

    bus.removeAllListeners(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED);
  });

  test("emits POST_PUBLICATION_ANALYSIS event for recalculations", () => {
    const db = makeDb();
    const store = makeStore(db);
    const engine = new PublicationEngine({ snapshotStore: store, config: DEFAULT_CONFIG });
    const events = [];
    bus.on(EVENT_NAMES.POST_PUBLICATION_ANALYSIS, (payload) => events.push(payload));

    engine.process(makeAnalysis(), makeMatch({ minute: "45" }));
    engine.process(makeAnalysis({ confidence: 90 }), makeMatch({ minute: "60" }));

    expect(events).toHaveLength(1);
    expect(events[0].match_key).toBe("12345_2026-07-05");

    bus.removeAllListeners(EVENT_NAMES.POST_PUBLICATION_ANALYSIS);
  });

  test("emits PREDICTION_REJECTED when too late", () => {
    const db = makeDb();
    const store = makeStore(db);
    const engine = new PublicationEngine({ snapshotStore: store, config: DEFAULT_CONFIG });
    const events = [];
    bus.on(EVENT_NAMES.PREDICTION_REJECTED, (payload) => events.push(payload));

    engine.process(makeAnalysis(), makeMatch({ minute: "80" }));

    expect(events).toHaveLength(1);
    expect(events[0].reason).toMatch(/Too late/);

    bus.removeAllListeners(EVENT_NAMES.PREDICTION_REJECTED);
  });

  test("recovery after restart — snapshot persists in DB", () => {
    const db = makeDb();
    const store1 = makeStore(db);
    const engine1 = new PublicationEngine({ snapshotStore: store1, config: DEFAULT_CONFIG });
    engine1.process(makeAnalysis(), makeMatch({ minute: "45" }));

    const store2 = new SnapshotStore(db);
    const engine2 = new PublicationEngine({ snapshotStore: store2, config: DEFAULT_CONFIG });
    const result = engine2.process(makeAnalysis(), makeMatch({ minute: "50" }));
    expect(result.decision).toBe("BLOCKED");
    expect(result.reason).toMatch(/immutable/);

    const snapshot = store2.getSnapshot("12345_2026-07-05");
    expect(snapshot).not.toBeNull();
    expect(snapshot.selection).toBe("Under 2.5 buts");
  });

  test("custom config via env variables", () => {
    const config = loadConfig({
      MIN_PUBLICATION_MINUTE: "40",
      MAX_PUBLICATION_MINUTE: "70",
      MIN_CONFIDENCE: "75",
      MIN_CONSENSUS: "4",
      PUBLICATION_INTERVAL_MINUTES: "3",
    });
    expect(config.MIN_PUBLICATION_MINUTE).toBe(40);
    expect(config.MAX_PUBLICATION_MINUTE).toBe(70);
    expect(config.MIN_CONFIDENCE).toBe(75);
    expect(config.MIN_CONSENSUS).toBe(4);
    expect(config.PUBLICATION_INTERVAL_MINUTES).toBe(3);
  });

  test("onPublish callback is called", () => {
    const db = makeDb();
    const store = makeStore(db);
    const published = [];
    const engine = new PublicationEngine({
      snapshotStore: store,
      config: DEFAULT_CONFIG,
      onPublish: (s) => published.push(s),
    });

    engine.process(makeAnalysis(), makeMatch({ minute: "50" }));
    expect(published).toHaveLength(1);
    expect(published[0].selection).toBe("Under 2.5 buts");
  });
});

describe("SnapshotStore", () => {
  test("createSnapshot stores correct data", () => {
    const store = makeStore();
    const snapshot = store.createSnapshot(makeAnalysis(), makeMatch(), 45);

    expect(snapshot.match_key).toBe("12345_2026-07-05");
    expect(snapshot.home).toBe("PSG");
    expect(snapshot.away).toBe("Marseille");
    expect(snapshot.selection).toBe("Under 2.5 buts");
    expect(snapshot.confidence).toBe(82);
    expect(snapshot.minute_at_publication).toBe(45);
    expect(snapshot.market).toBe("goals");
    expect(snapshot.locked).toBe(1);
    expect(snapshot.odds).toBeGreaterThan(0);
    expect(snapshot.odds).toBeLessThanOrEqual(1.95);
  });

  test("throws on duplicate snapshot (immutability)", () => {
    const store = makeStore();
    store.createSnapshot(makeAnalysis(), makeMatch(), 45);
    expect(() => store.createSnapshot(makeAnalysis(), makeMatch(), 50)).toThrow(/immutable/);
  });

  test("getSnapshot returns null for unknown match", () => {
    const store = makeStore();
    expect(store.getSnapshot("nonexistent")).toBeNull();
  });

  test("hasSnapshot returns true/false correctly", () => {
    const store = makeStore();
    expect(store.hasSnapshot("12345_2026-07-05")).toBe(false);
    store.createSnapshot(makeAnalysis(), makeMatch(), 45);
    expect(store.hasSnapshot("12345_2026-07-05")).toBe(true);
  });

  test("getAllSnapshots with pagination", () => {
    const store = makeStore();
    for (let i = 0; i < 5; i++) {
      store.createSnapshot(
        makeAnalysis({ match_key: `match_${i}_2026-07-05` }),
        makeMatch({ id: `match_${i}`, home: `Home${i}`, away: `Away${i}` }),
        45
      );
    }
    expect(store.getAllSnapshots({ limit: 3 })).toHaveLength(3);
    expect(store.getAllSnapshots({ limit: 10 })).toHaveLength(5);
    expect(store.countSnapshots()).toBe(5);
  });

  test("post-publication analyses accumulate", () => {
    const store = makeStore();
    store.createSnapshot(makeAnalysis(), makeMatch(), 45);

    for (let i = 0; i < 3; i++) {
      store.savePostPublicationAnalysis(
        makeAnalysis({ confidence: 70 + i * 5, best_bet: "Over 2.5 buts" }),
        makeMatch({ minute: `${55 + i * 5}`, score_home: 1, score_away: i }),
        55 + i * 5
      );
    }

    const posts = store.getPostPublicationAnalyses("12345_2026-07-05");
    expect(posts).toHaveLength(3);
    expect(posts[0].confidence).toBe(70);
    expect(posts[2].confidence).toBe(80);
  });

  test("100 concurrent matches — each gets unique snapshot", () => {
    const store = makeStore();
    const results = [];

    for (let i = 0; i < 100; i++) {
      const snapshot = store.createSnapshot(
        makeAnalysis({ match_key: `m${i}_2026-07-05`, confidence: 65 + (i % 30) }),
        makeMatch({ id: `m${i}`, home: `Team${i}A`, away: `Team${i}B`, competition: `League${i % 10}` }),
        30 + (i % 45)
      );
      results.push(snapshot);
    }

    expect(results).toHaveLength(100);
    expect(store.countSnapshots()).toBe(100);

    const keys = new Set(results.map((r) => r.match_key));
    expect(keys.size).toBe(100);

    for (let i = 0; i < 100; i++) {
      expect(store.hasSnapshot(`m${i}_2026-07-05`)).toBe(true);
      expect(() =>
        store.createSnapshot(
          makeAnalysis({ match_key: `m${i}_2026-07-05` }),
          makeMatch({ id: `m${i}` }),
          60
        )
      ).toThrow(/immutable/);
    }
  });
});

describe("Event Bus integration", () => {
  test("all consumers read from same snapshot via event", () => {
    const db = makeDb();
    const store = makeStore(db);
    const engine = new PublicationEngine({ snapshotStore: store, config: DEFAULT_CONFIG });

    const telegramReceived = [];
    const brevoReceived = [];
    const siteReceived = [];
    const dashboardReceived = [];

    bus.on(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, (s) => telegramReceived.push(s));
    bus.on(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, (s) => brevoReceived.push(s));
    bus.on(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, (s) => siteReceived.push(s));
    bus.on(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, (s) => dashboardReceived.push(s));

    engine.process(makeAnalysis(), makeMatch({ minute: "50" }));

    expect(telegramReceived).toHaveLength(1);
    expect(brevoReceived).toHaveLength(1);
    expect(siteReceived).toHaveLength(1);
    expect(dashboardReceived).toHaveLength(1);

    expect(telegramReceived[0].selection).toBe(brevoReceived[0].selection);
    expect(siteReceived[0].selection).toBe(dashboardReceived[0].selection);
    expect(telegramReceived[0].selection).toBe(siteReceived[0].selection);

    bus.removeAllListeners(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED);
  });
});

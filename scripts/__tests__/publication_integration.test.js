const Database = require("better-sqlite3");
const { PublicationEngine, loadConfig, DEFAULT_CONFIG } = require("../publication_engine");
const { SnapshotStore } = require("../snapshot_store");
const { bus, EVENT_NAMES } = require("../event_bus");

function makeDb() {
  return new Database(":memory:");
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
      { name: "Perplexity-Web", bet: "Under 2.5 buts", confidence: 80, icon: "🌐" },
      { name: "DeepSeek-V3", bet: "Under 2.5 buts", confidence: 85, icon: "🔮" },
      { name: "Mistral-Large", bet: "Over 2.5 buts", confidence: 60, icon: "🌊" },
      { name: "Cohere-Command", bet: "Under 2.5 buts", confidence: 78, icon: "🧬" },
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

describe("Integration: Telegram receives ONLY via OFFICIAL_PREDICTION_PUBLISHED", () => {
  let db, store, engine;

  beforeEach(() => {
    db = makeDb();
    store = new SnapshotStore(db);
    engine = new PublicationEngine({ snapshotStore: store, config: DEFAULT_CONFIG });
  });

  afterEach(() => {
    bus.removeAllListeners();
  });

  test("Telegram listener fires on PUBLISH, receives snapshot data", () => {
    const telegramMessages = [];
    bus.on(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, (snapshot) => {
      telegramMessages.push({
        chatId: "premium",
        text: `Signal Fort ${snapshot.confidence}% — ${snapshot.home} vs ${snapshot.away}: ${snapshot.selection}`,
      });
    });

    engine.process(makeAnalysis(), makeMatch({ minute: "50" }));

    expect(telegramMessages).toHaveLength(1);
    expect(telegramMessages[0].text).toContain("Under 2.5 buts");
    expect(telegramMessages[0].text).toContain("PSG");
    expect(telegramMessages[0].text).toContain("82%");
  });

  test("Telegram does NOT fire on WAIT (too early)", () => {
    const telegramMessages = [];
    bus.on(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, (snapshot) => {
      telegramMessages.push(snapshot);
    });

    engine.process(makeAnalysis(), makeMatch({ minute: "10" }));

    expect(telegramMessages).toHaveLength(0);
  });

  test("Telegram does NOT fire on BLOCKED (duplicate)", () => {
    const telegramMessages = [];
    bus.on(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, (snapshot) => {
      telegramMessages.push(snapshot);
    });

    engine.process(makeAnalysis(), makeMatch({ minute: "45" }));
    expect(telegramMessages).toHaveLength(1);

    engine.process(makeAnalysis({ confidence: 90 }), makeMatch({ minute: "55" }));
    expect(telegramMessages).toHaveLength(1);
  });
});

describe("Integration: Brevo receives ONLY via OFFICIAL_PREDICTION_PUBLISHED", () => {
  let db, store, engine;

  beforeEach(() => {
    db = makeDb();
    store = new SnapshotStore(db);
    engine = new PublicationEngine({ snapshotStore: store, config: DEFAULT_CONFIG });
  });

  afterEach(() => {
    bus.removeAllListeners();
  });

  test("Brevo listener fires with same data as Telegram", () => {
    const brevoEmails = [];
    bus.on(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, (snapshot) => {
      brevoEmails.push({
        subject: `Signal Fort ${snapshot.confidence}%`,
        match: `${snapshot.home} vs ${snapshot.away}`,
        bet: snapshot.selection,
      });
    });

    engine.process(makeAnalysis(), makeMatch({ minute: "50" }));

    expect(brevoEmails).toHaveLength(1);
    expect(brevoEmails[0].bet).toBe("Under 2.5 buts");
  });

  test("Brevo does NOT fire without official snapshot", () => {
    const brevoEmails = [];
    bus.on(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, (snapshot) => {
      brevoEmails.push(snapshot);
    });

    engine.process(makeAnalysis({ confidence: 50 }), makeMatch({ minute: "45" }));

    expect(brevoEmails).toHaveLength(0);
  });
});

describe("Integration: Site reads ONLY from official_prediction_snapshots", () => {
  let db, store, engine;

  beforeEach(() => {
    db = makeDb();
    store = new SnapshotStore(db);
    engine = new PublicationEngine({ snapshotStore: store, config: DEFAULT_CONFIG });
  });

  test("Site reads snapshot after publication", () => {
    engine.process(makeAnalysis(), makeMatch({ minute: "50" }));

    const snapshot = store.getSnapshot("12345_2026-07-05");
    expect(snapshot).not.toBeNull();
    expect(snapshot.selection).toBe("Under 2.5 buts");
    expect(snapshot.confidence).toBe(82);
    expect(snapshot.home).toBe("PSG");
    expect(snapshot.away).toBe("Marseille");
    expect(snapshot.locked).toBe(1);
  });

  test("Site reads same data as Telegram/Brevo (no divergence)", () => {
    const eventPayloads = [];
    bus.on(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, (s) => eventPayloads.push(s));

    engine.process(makeAnalysis(), makeMatch({ minute: "50" }));

    const snapshot = store.getSnapshot("12345_2026-07-05");
    expect(eventPayloads).toHaveLength(1);
    expect(snapshot.selection).toBe(eventPayloads[0].selection);
    expect(snapshot.confidence).toBe(eventPayloads[0].confidence);
    expect(snapshot.home).toBe(eventPayloads[0].home);

    bus.removeAllListeners();
  });

  test("Site snapshot is immutable — cannot change after 2nd analysis", () => {
    engine.process(makeAnalysis(), makeMatch({ minute: "45" }));
    engine.process(
      makeAnalysis({ best_bet: "Over 2.5 buts", confidence: 95 }),
      makeMatch({ minute: "60", score_home: 2, score_away: 1 })
    );

    const snapshot = store.getSnapshot("12345_2026-07-05");
    expect(snapshot.selection).toBe("Under 2.5 buts");
    expect(snapshot.confidence).toBe(82);
  });
});

describe("Integration: Dashboard reads ONLY from official_prediction_snapshots", () => {
  let db, store, engine;

  beforeEach(() => {
    db = makeDb();
    store = new SnapshotStore(db);
    engine = new PublicationEngine({ snapshotStore: store, config: DEFAULT_CONFIG });
  });

  test("Dashboard lists all snapshots via getAllSnapshots", () => {
    for (let i = 0; i < 5; i++) {
      engine.process(
        makeAnalysis({ match_key: `match_${i}_2026-07-05` }),
        makeMatch({ id: `match_${i}`, home: `Home${i}`, away: `Away${i}`, minute: "50" })
      );
    }

    const all = store.getAllSnapshots({ limit: 10 });
    expect(all).toHaveLength(5);
    expect(store.countSnapshots()).toBe(5);
  });

  test("Dashboard snapshot includes post-publication analyses", () => {
    engine.process(makeAnalysis(), makeMatch({ minute: "45" }));
    engine.process(
      makeAnalysis({ best_bet: "Over 2.5 buts", confidence: 88 }),
      makeMatch({ minute: "60", score_home: 1, score_away: 1 })
    );

    const postAnalyses = store.getPostPublicationAnalyses("12345_2026-07-05");
    expect(postAnalyses).toHaveLength(1);
    expect(postAnalyses[0].selection).toBe("Over 2.5 buts");
  });
});

describe("Integration: Live IA uses ONLY the Publication Engine", () => {
  let db, store, engine;

  beforeEach(() => {
    db = makeDb();
    store = new SnapshotStore(db);
    engine = new PublicationEngine({ snapshotStore: store, config: DEFAULT_CONFIG });
  });

  afterEach(() => {
    bus.removeAllListeners();
  });

  test("Live IA analysis routes through Publication Engine", () => {
    const result = engine.process(makeAnalysis(), makeMatch({ minute: "50" }));

    expect(result.decision).toBe("PUBLISH");
    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.selection).toBe("Under 2.5 buts");
  });

  test("Live IA recalculation goes to post_publication_analyses", () => {
    engine.process(makeAnalysis(), makeMatch({ minute: "45" }));

    const result2 = engine.process(
      makeAnalysis({ best_bet: "BTTS Oui", confidence: 75 }),
      makeMatch({ minute: "60", score_home: 1, score_away: 0 })
    );

    expect(result2.decision).toBe("BLOCKED");
    expect(result2.reason).toContain("immutable");

    const posts = store.getPostPublicationAnalyses("12345_2026-07-05");
    expect(posts).toHaveLength(1);
    expect(posts[0].selection).toBe("BTTS Oui");
  });
});

describe("Integration: No double flux — single publication path", () => {
  let db, store, engine;

  beforeEach(() => {
    db = makeDb();
    store = new SnapshotStore(db);
    engine = new PublicationEngine({ snapshotStore: store, config: DEFAULT_CONFIG });
  });

  afterEach(() => {
    bus.removeAllListeners();
  });

  test("5 concurrent analyses for same match = exactly 1 snapshot + 1 Telegram event", () => {
    const telegramEvents = [];
    const brevoEvents = [];
    bus.on(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, (s) => {
      telegramEvents.push(s);
      brevoEvents.push(s);
    });

    for (let i = 0; i < 5; i++) {
      engine.process(
        makeAnalysis({ confidence: 70 + i * 5 }),
        makeMatch({ minute: `${40 + i * 5}` })
      );
    }

    expect(telegramEvents).toHaveLength(1);
    expect(brevoEvents).toHaveLength(1);
    expect(store.countSnapshots()).toBe(1);
    expect(telegramEvents[0].selection).toBe("Under 2.5 buts");
    expect(telegramEvents[0].confidence).toBe(70);
  });

  test("10 different matches = 10 snapshots, 10 events", () => {
    const events = [];
    bus.on(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, (s) => events.push(s));

    for (let i = 0; i < 10; i++) {
      engine.process(
        makeAnalysis({ match_key: `m${i}_2026-07-05` }),
        makeMatch({ id: `m${i}`, home: `Team${i}A`, away: `Team${i}B`, minute: "50" })
      );
    }

    expect(events).toHaveLength(10);
    expect(store.countSnapshots()).toBe(10);

    bus.removeAllListeners();
  });

  test("WAIT decision triggers no Telegram, no Brevo, no snapshot", () => {
    const events = [];
    bus.on(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, (s) => events.push(s));

    engine.process(makeAnalysis({ confidence: 50 }), makeMatch({ minute: "45" }));

    expect(events).toHaveLength(0);
    expect(store.countSnapshots()).toBe(0);

    bus.removeAllListeners();
  });

  test("BLOCKED (too late) triggers PREDICTION_REJECTED, no snapshot", () => {
    const published = [];
    const rejected = [];
    bus.on(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, (s) => published.push(s));
    bus.on(EVENT_NAMES.PREDICTION_REJECTED, (s) => rejected.push(s));

    engine.process(makeAnalysis(), makeMatch({ minute: "80" }));

    expect(published).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toContain("Too late");
    expect(store.countSnapshots()).toBe(0);

    bus.removeAllListeners();
  });
});

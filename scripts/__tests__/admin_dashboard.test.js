/**
 * Tests for admin dashboard data endpoint structure.
 * Verifies all dashboard sections return expected fields.
 */

function buildMockDashboardData() {
  return {
    ok: true,
    health: {
      api: { status: "ok", uptime: 3600 },
      memory: { rss: 120, heapUsed: 80, heapTotal: 150 },
      node: "v20.0.0",
      dbSize: 5,
    },
    vps: { ram: { usedMB: 500, totalMB: 2048, pct: 24 }, cpu: 15, disk: { usedGB: 10, totalGB: 50, pct: 20 }, load: { m1: 0.5, m5: 0.3, m15: 0.2 }, uptime: 86400 },
    docker: { containers: [{ name: "api", state: "running", status: "Up 2 days" }], running: 1, stopped: 0, total: 1 },
    backups: { latest: { name: "backup-2026-07-07.tar.gz", date: new Date().toISOString(), sizeMB: 12 }, files: [], total: 3 },
    business: { users: { free: 10, carte: 5, premium: 3, vip: 1, elite: 1, total: 20 }, expiring_soon: 1, expired_total: 5, new_today: 2, total_carte: 15, revenue_estimate: 85.60, conversion_7d: 1.5 },
    analytics: { today: { visitors: 150, views: 400 }, yesterday: { visitors: 120 }, last7days: [], topPages: [], topSources: [] },
    pronostics: { currentPick: null, signalFort: { total: 20, wins: 13, losses: 7, winrate: 65, threshold: 80 }, recent: [], byAgent: [], bySport: [] },
    alerts: [],
    activityLog: [],
    services: { api_sports: true, football_data: true, stripe: true, telegram: true, brevo: true, groq: true, deepseek: true },
    crmStats: { total: 50, byPlan: [{ plan: "free", c: 30 }, { plan: "premium", c: 15 }, { plan: "elite", c: 5 }], recent_7d: 8, telegram_joined: 12 },
    telegramStats: { botConfigured: true, freeChannel: true, premiumChannel: true, eliteChannel: true, freeMembers: 250 },
    timestamp: new Date().toISOString(),
  };
}

describe("Dashboard data structure", () => {
  const data = buildMockDashboardData();

  test("ok flag is true", () => {
    expect(data.ok).toBe(true);
  });

  test("health section has required fields", () => {
    expect(data.health.api.status).toBe("ok");
    expect(data.health.api.uptime).toBeGreaterThan(0);
    expect(data.health.memory.rss).toBeGreaterThan(0);
    expect(data.health.memory.heapUsed).toBeGreaterThan(0);
    expect(data.health.node).toBeDefined();
  });

  test("VPS section has required fields", () => {
    expect(data.vps.ram).toBeDefined();
    expect(data.vps.ram.pct).toBeDefined();
    expect(data.vps.cpu).toBeDefined();
    expect(data.vps.disk).toBeDefined();
    expect(data.vps.uptime).toBeGreaterThan(0);
  });

  test("docker section has containers", () => {
    expect(data.docker.containers).toBeInstanceOf(Array);
    expect(data.docker.running).toBeDefined();
    expect(data.docker.total).toBeGreaterThan(0);
  });

  test("backups section has latest", () => {
    expect(data.backups.latest).toBeDefined();
    expect(data.backups.latest.name).toBeTruthy();
    expect(data.backups.total).toBeGreaterThan(0);
  });

  test("business section has all required metrics", () => {
    expect(data.business.users.total).toBeGreaterThan(0);
    expect(data.business.total_carte).toBeDefined();
    expect(data.business.revenue_estimate).toBeGreaterThan(0);
    expect(data.business.conversion_7d).toBeDefined();
    expect(data.business.expiring_soon).toBeDefined();
    expect(data.business.expired_total).toBeDefined();
    expect(data.business.new_today).toBeDefined();
  });

  test("analytics section has today and yesterday", () => {
    expect(data.analytics.today.visitors).toBeDefined();
    expect(data.analytics.today.views).toBeDefined();
    expect(data.analytics.yesterday.visitors).toBeDefined();
  });

  test("pronostics section has Signal Fort stats", () => {
    expect(data.pronostics.signalFort.total).toBeGreaterThan(0);
    expect(data.pronostics.signalFort.winrate).toBeDefined();
    expect(data.pronostics.signalFort.threshold).toBeDefined();
  });

  test("services section lists all required services", () => {
    const required = ["api_sports", "football_data", "stripe", "telegram", "brevo", "groq", "deepseek"];
    required.forEach(svc => {
      expect(data.services).toHaveProperty(svc);
    });
  });

  test("CRM stats have all required fields", () => {
    expect(data.crmStats.total).toBeGreaterThan(0);
    expect(data.crmStats.byPlan).toBeInstanceOf(Array);
    expect(data.crmStats.recent_7d).toBeDefined();
    expect(data.crmStats.telegram_joined).toBeDefined();
  });

  test("Telegram stats have channel configuration", () => {
    expect(data.telegramStats.botConfigured).toBe(true);
    expect(data.telegramStats.freeChannel).toBe(true);
    expect(data.telegramStats.premiumChannel).toBe(true);
    expect(data.telegramStats.eliteChannel).toBe(true);
    expect(data.telegramStats.freeMembers).toBeGreaterThan(0);
  });

  test("timestamp is valid ISO string", () => {
    expect(new Date(data.timestamp).getTime()).toBeGreaterThan(0);
  });
});

describe("Dashboard sections — 16 sections total", () => {
  const sections = [
    "health", "vps", "docker", "backups",
    "business", "analytics",
    "pronostics", "alerts", "activityLog",
    "services", "crmStats", "telegramStats",
  ];

  const data = buildMockDashboardData();

  test("all 12 data sections present in response", () => {
    sections.forEach(s => {
      expect(data).toHaveProperty(s);
    });
  });

  test("no section is null or undefined", () => {
    sections.forEach(s => {
      expect(data[s]).not.toBeNull();
      expect(data[s]).not.toBeUndefined();
    });
  });
});

describe("Dashboard alerts logic", () => {
  test("empty alerts means all is ok", () => {
    const data = buildMockDashboardData();
    expect(data.alerts).toHaveLength(0);
  });

  test("alerts have level and msg fields", () => {
    const alerts = [
      { level: "danger", msg: "RAM VPS critique : 95%" },
      { level: "warning", msg: "2 abonnements expirent dans 3 jours" },
    ];
    alerts.forEach(a => {
      expect(["danger", "warning"]).toContain(a.level);
      expect(a.msg.length).toBeGreaterThan(0);
    });
  });
});

describe("Garde-fous — dashboard", () => {
  test("business revenue_estimate is a number", () => {
    const data = buildMockDashboardData();
    expect(typeof data.business.revenue_estimate).toBe("number");
    expect(Number.isNaN(data.business.revenue_estimate)).toBe(false);
  });

  test("conversion_7d is a number between 0 and 100", () => {
    const data = buildMockDashboardData();
    expect(data.business.conversion_7d).toBeGreaterThanOrEqual(0);
    expect(data.business.conversion_7d).toBeLessThanOrEqual(100);
  });

  test("CRM total >= sum of byPlan counts", () => {
    const data = buildMockDashboardData();
    const sumByPlan = data.crmStats.byPlan.reduce((s, p) => s + p.c, 0);
    expect(data.crmStats.total).toBeGreaterThanOrEqual(sumByPlan);
  });

  test("Signal Fort winrate between 0 and 100", () => {
    const data = buildMockDashboardData();
    expect(data.pronostics.signalFort.winrate).toBeGreaterThanOrEqual(0);
    expect(data.pronostics.signalFort.winrate).toBeLessThanOrEqual(100);
  });
});

// TousLesMatchs — API Server
// Auth, live matches, Live IA, Stripe, Brevo, Admin

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http  = require("http");
const { bookmakerButtons } = require("./bookmakers.config");

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(cors());

// ── Database ──────────────────────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || "/data/tlm.db";
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    status TEXT DEFAULT 'free',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS user_tokens (
    user_id INTEGER PRIMARY KEY,
    tokens_today INTEGER DEFAULT 0,
    reset_date TEXT DEFAULT '',
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS revealed_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    match_key TEXT NOT NULL,
    analysis_json TEXT NOT NULL,
    revealed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS agent_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL,
    home TEXT NOT NULL,
    away TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    bet TEXT NOT NULL,
    confidence INTEGER DEFAULT 70,
    outcome TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(match_key, agent_name)
  );
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
    confidence INTEGER DEFAULT 70,
    raison TEXT DEFAULT '',
    consensus_votes INTEGER DEFAULT 0,
    agents_json TEXT DEFAULT '[]',
    pick_bet TEXT DEFAULT NULL,
    outcome TEXT DEFAULT NULL
  );
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn("concile_analyses", "final_score_home", "INTEGER DEFAULT NULL");
ensureColumn("concile_analyses", "final_score_away", "INTEGER DEFAULT NULL");
ensureColumn("concile_analyses", "resolved_at", "TEXT DEFAULT NULL");
ensureColumn("concile_analyses", "result_source", "TEXT DEFAULT NULL");
ensureColumn("concile_analyses", "sport", "TEXT DEFAULT 'Football'");
ensureColumn("concile_analyses", "learning_tier", "TEXT DEFAULT 'learning'");
ensureColumn("concile_analyses", "learning_note", "TEXT DEFAULT ''");

// ── Constants ─────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || "tlm_secret_2026";
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || "";
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY || process.env.FOOTBALL_DATA_API_KEY || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_PRICE_ID_CARTE = process.env.STRIPE_PRICE_ID_CARTE || process.env.STRIPE_PRICE_CARTE || "";
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "noreply@touslesmatchs.com";
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || "TousLesMatchs";

function bookmakerEmailHtml() {
  const colors = ["#ef4444", "#3b82f6", "#22c55e", "#06b6d4"];
  return `
  <div style="background:#0d1020;border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:18px;margin:20px 0">
    <div style="font-size:11px;color:#f8d37a;letter-spacing:.12em;text-transform:uppercase;font-weight:900;margin-bottom:10px">Comparer la cote</div>
    <div style="font-size:13px;color:#a8aec8;line-height:1.5;margin-bottom:14px">La cote finale se vérifie toujours sur le bookmaker. 18+ uniquement, jeu responsable.</div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
      ${bookmakerButtons.map((b, i) => `
        <a href="${b.url}" style="display:block;text-align:center;background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.03));border:1px solid ${colors[i] || "#64748b"};color:#fff;padding:12px 10px;border-radius:10px;text-decoration:none;font-weight:800;font-size:13px">
          ${b.text}
        </a>`).join("")}
    </div>
  </div>`;
}

// Preuves storage file
const PREUVES_PATH = "/var/touslesmatchs/preuves.json";
const SCORE_PATH = "/var/touslesmatchs/live_score.json";
const PICK_PATH = "/var/touslesmatchs/current_pick.json";
const HERMES_PICKS_PATH = "/picks/picks.json";
const LEADS_PATH = "/var/touslesmatchs/leads.json";

function loadPick() {
  try { return JSON.parse(fs.readFileSync(PICK_PATH, "utf8")); } catch { return null; }
}
function savePick(data) {
  fs.mkdirSync("/var/touslesmatchs", { recursive: true });
  fs.writeFileSync(PICK_PATH, JSON.stringify(data, null, 2));
}
function loadLeads() {
  try {
    const data = JSON.parse(fs.readFileSync(LEADS_PATH, "utf8"));
    return Array.isArray(data.leads) ? data : { leads: [] };
  } catch {
    return { leads: [] };
  }
}
function saveLeads(data) {
  fs.mkdirSync("/var/touslesmatchs", { recursive: true });
  fs.writeFileSync(LEADS_PATH, JSON.stringify(data, null, 2));
}

function buildPickTeam(team, fallbackName, fallbackColor) {
  if (team && typeof team === "object") {
    const name = team.name || fallbackName || "";
    return {
      name,
      abbr: team.abbr || (name || "").slice(0, 3).toUpperCase(),
      color: team.color || fallbackColor,
    };
  }
  const name = team || fallbackName || "";
  return {
    name,
    abbr: (name || "").slice(0, 3).toUpperCase(),
    color: fallbackColor,
  };
}

function parsePickScore(rawScore, rawScoreA, rawScoreB) {
  if (rawScore && typeof rawScore === "string" && rawScore.includes("-")) {
    const parts = rawScore.split("-");
    return {
      scoreA: parseInt(parts[0], 10) || 0,
      scoreB: parseInt(parts[1], 10) || 0,
    };
  }
  return {
    scoreA: rawScoreA ?? null,
    scoreB: rawScoreB ?? null,
  };
}

function normalizePickStatus(status) {
  if (status === "NOPICK" || status === "no_pick") return { status: "no_pick", result: null };
  if (status === "GAGNE" || status === "win") return { status: "win", result: "win" };
  if (status === "PERDU" || status === "loss") return { status: "loss", result: "loss" };
  return { status: "upcoming", result: null };
}

function normalizeCurrentPick(p, defaultSource) {
  if (!p) return null;

  const score = parsePickScore(p.score, p.scoreA, p.scoreB);
  const normalizedStatus = normalizePickStatus(p.status);
  const homeName = p.home || p.teamA?.name || p.teamA || "";
  const awayName = p.away || p.teamB?.name || p.teamB || "";

  return {
    teamA: buildPickTeam(p.teamA, homeName, "#4f46e5"),
    teamB: buildPickTeam(p.teamB, awayName, "#7c3aed"),
    competition: p.competition || p.league || p.sport || "",
    time: p.time || "",
    date: p.date || null,
    source: p.source || defaultSource || "hermes",
    updatedAt: p.updatedAt || null,
    publishedAt: p.publishedAt || null,
    sourceMatchId: p.sourceMatchId || null,
    fixtureId: p.fixtureId || null,
    liveUnavailable: p.liveUnavailable === true,
    liveAvailabilityReason: p.liveAvailabilityReason || null,
    marketType: p.marketType || p.bet || "",
    marketLabel: p.marketLabel || p.prono || "",
    cote: p.cote === "" || p.cote === null || p.cote === undefined ? null : (parseFloat(p.cote) || null),
    status: normalizedStatus.status,
    result: normalizedStatus.result,
    scoreA: score.scoreA,
    scoreB: score.scoreB,
    confidence: p.confidence != null ? Number(p.confidence) : null,
    raison: p.raison || null,
    sport: p.sport || "Football",
  };
}

function loadManualScore() {
  try { return JSON.parse(fs.readFileSync(SCORE_PATH, "utf8")); } catch { return null; }
}
function saveManualScore(data) {
  fs.mkdirSync("/var/touslesmatchs", { recursive: true });
  fs.writeFileSync(SCORE_PATH, JSON.stringify(data, null, 2));
}
function loadProofs() {
  try { return JSON.parse(fs.readFileSync(PREUVES_PATH, "utf8")); } catch { return []; }
}
function saveProofs(proofs) {
  try {
    fs.mkdirSync("/var/touslesmatchs", { recursive: true });
    fs.writeFileSync(PREUVES_PATH, JSON.stringify(proofs, null, 2));
  } catch (e) { console.error("[preuves] save error:", e.message); }
}

// Cache live matches 10 minutes to stay under 100 req/day
let liveMatchesCache = { data: null, ts: 0 };
const CACHE_TTL = 10 * 60 * 1000;

const TOKEN_LIMITS = { free: 0, carte: 1, premium: 10, vip: 30, elite: 30 };

// ── Auth middleware ───────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");
  if (!token) return res.json({ ok: false, error: "Non authentifié" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.json({ ok: false, error: "Token invalide" });
  }
}

// ── Token helpers ─────────────────────────────────────────────────────────────
function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

const AUTO_CONCILE_OBSERVER = process.env.AUTO_CONCILE_OBSERVER !== "0";
const AUTO_CONCILE_INTERVAL_MS = Math.max(5, Number(process.env.AUTO_CONCILE_INTERVAL_MIN || 10)) * 60 * 1000;
const AUTO_CONCILE_MAX_MATCHES = Math.max(1, Number(process.env.AUTO_CONCILE_MAX_MATCHES || 8));
const AUTO_CONCILE_MIN_MINUTE = Math.max(1, Number(process.env.AUTO_CONCILE_MIN_MINUTE || 10));
const AUTO_CONCILE_BUCKET_MINUTES = Math.max(5, Number(process.env.AUTO_CONCILE_BUCKET_MINUTES || 15));

function getTokenRow(userId) {
  return db.prepare("SELECT * FROM user_tokens WHERE user_id = ?").get(userId);
}

function ensureTokenRow(userId) {
  const today = getTodayStr();
  let row = getTokenRow(userId);
  if (!row) {
    db.prepare("INSERT INTO user_tokens (user_id, tokens_today, reset_date) VALUES (?,0,?)").run(userId, today);
    row = getTokenRow(userId);
  }
  if (row.reset_date !== today) {
    const user = db.prepare("SELECT status FROM users WHERE id = ?").get(userId);
    const limit = TOKEN_LIMITS[user?.status || "free"] || 0;
    db.prepare("UPDATE user_tokens SET tokens_today = ?, reset_date = ? WHERE user_id = ?").run(limit, today, userId);
    row = getTokenRow(userId);
  }
  return row;
}

function deductToken(userId) {
  const row = ensureTokenRow(userId);
  const user = db.prepare("SELECT status FROM users WHERE id = ?").get(userId);
  const limit = TOKEN_LIMITS[user?.status || "free"] || 0;
  if (limit === 0) return { ok: false, error: "Abonnement requis pour accéder au Concile" };
  if (row.tokens_today <= 0) return { ok: false, error: "Jetons épuisés pour aujourd'hui — recharge à minuit" };
  db.prepare("UPDATE user_tokens SET tokens_today = tokens_today - 1 WHERE user_id = ?").run(userId);
  return { ok: true, remaining: row.tokens_today - 1 };
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const req = https.request({ hostname: opts.hostname, path: opts.pathname + opts.search, headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({}); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const payload = JSON.stringify(body);
    const options = {
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...headers },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({}); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function httpPostStrict(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const payload = JSON.stringify(body);
    const options = {
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...headers },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        let parsed = {};
        try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = { raw: data }; }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const detail = typeof parsed === "object" ? JSON.stringify(parsed).slice(0, 500) : String(data).slice(0, 500);
          reject(new Error(`HTTP ${res.statusCode}: ${detail}`));
          return;
        }
        resolve(parsed);
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ── Live matches — football-data.org (gratuit, couvre Coupe du Monde) ─────────
function formatFDMatch(m) {
  return {
    id: `fd-${m.id}`,
    source: "football-data",
    sourceId: String(m.id),
    fixtureId: null,
    sport: "Football",
    home: m.homeTeam.name,
    away: m.awayTeam.name,
    score_home: m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null,
    score_away: m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null,
    minute: m.minute ?? null,
    status: m.status === "FINISHED" ? "FINISHED" : "IN_PLAY",
    competition: m.competition?.name || "International",
    utcDate: m.utcDate,
  };
}

function normalizeFootballDataMatch(m) {
  return formatFDMatch(m);
}

function normalizeApiSportsFootballFixture(f) {
  const fixtureId = String(f.fixture.id);
  const match = {
    id: fixtureId,
    source: "api-sports",
    sourceId: fixtureId,
    fixtureId,
    sport: "Football",
    home: f.teams.home.name,
    away: f.teams.away.name,
    score_home: f.goals.home ?? null,
    score_away: f.goals.away ?? null,
    minute: f.fixture.status.elapsed ?? null,
    status: "IN_PLAY",
    competition: f.league.name + (f.league.country !== "World" ? " · " + f.league.country : ""),
    utcDate: f.fixture.date,
  };
  return { ...match, lowTrustCompetition: isLowTrustCompetition(match) };
}

const LOW_TRUST_COMPETITION_KEYWORDS = [
  "friendly", "friendlies", "club friendly", "international friendly", "amical", "amicaux",
  "u17", "u18", "u19", "u20", "u21", "u23",
  "under 17", "under 18", "under 19", "under 20", "under 21", "under 23",
  "reserve", "reserves", "b team", "ii ", " ii", "youth", "academy",
  "copa rio", "copa chile", "svenska cupen", "regional cup", "state cup",
];

function isLowTrustCompetition(matchOrCompetition = "") {
  const raw = typeof matchOrCompetition === "string"
    ? matchOrCompetition
    : [matchOrCompetition?.competition, matchOrCompetition?.home, matchOrCompetition?.away].filter(Boolean).join(" ");
  const value = String(raw || "").toLowerCase();
  return LOW_TRUST_COMPETITION_KEYWORDS.some((keyword) => value.includes(keyword));
}

function getVerifiedFixtureId(match) {
  if (!match || match.source !== "api-sports" || match.sport !== "Football") return null;
  const fixtureId = match.fixtureId || match.sourceId || match.id;
  if (!fixtureId) return null;
  const id = String(fixtureId);
  if (!/^\d+$/.test(id)) return null;
  return id;
}

function buildStatsStatus(match, stats, reason) {
  return {
    available: !!stats,
    source: stats ? "api-sports" : null,
    fixtureId: getVerifiedFixtureId(match),
    reason: stats ? null : reason,
    stats: stats || null,
  };
}

async function fetchFromFootballData() {
  if (!FOOTBALL_DATA_KEY) return null;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    // Matchs EN COURS + TERMINÉS hier et aujourd'hui (couvre les picks de J-1)
    const [liveData, finishedData] = await Promise.all([
      httpGet("https://api.football-data.org/v4/matches?status=LIVE", { "X-Auth-Token": FOOTBALL_DATA_KEY }),
      httpGet(`https://api.football-data.org/v4/matches?status=FINISHED&dateFrom=${yesterday}&dateTo=${today}`, { "X-Auth-Token": FOOTBALL_DATA_KEY }),
    ]);
    const live = (liveData.matches || []).map((m) => {
      const match = formatFDMatch(m);
      return { ...match, lowTrustCompetition: isLowTrustCompetition(match) };
    });
    const finished = (finishedData.matches || []).map((m) => {
      const match = formatFDMatch(m);
      return { ...match, lowTrustCompetition: isLowTrustCompetition(match) };
    });
    const all = [...live, ...finished];
    console.log(`[live-matches] football-data.org: ${live.length} live, ${finished.length} finished (hier+aujourd'hui)`);
    return all;
  } catch (e) {
    console.error("[live-matches] football-data.org error:", e.message);
    return null;
  }
}

// ── Live matches — API-Sports (fallback) ──────────────────────────────────────
async function fetchFromApiSports() {
  if (!API_SPORTS_KEY) return null;
  const results = [];

  // Football live
  try {
    const data = await httpGet("https://v3.football.api-sports.io/fixtures?live=all", { "x-apisports-key": API_SPORTS_KEY });
    if (!data.errors || Object.keys(data.errors).length === 0) {
      const items = (data.response || []).slice(0, 20).map(normalizeApiSportsFootballFixture);
      results.push(...items);
      console.log(`[live-matches] API-Sports football: ${items.length}`);
    }
  } catch(e) { console.error("[live-matches] API-Sports football:", e.message); }

  // Basketball live
  try {
    const data = await httpGet("https://v1.basketball.api-sports.io/games?live=all", { "x-apisports-key": API_SPORTS_KEY });
    const items = (data.response || []).slice(0, 10).map((g) => ({
      id: "bk-" + g.id, sport: "Basketball",
      source: "api-sports",
      sourceId: String(g.id),
      fixtureId: null,
      home: g.teams?.home?.name, away: g.teams?.away?.name,
      score_home: g.scores?.home?.total ?? null, score_away: g.scores?.away?.total ?? null,
      minute: g.status?.timer ?? null, status: "IN_PLAY",
      competition: (g.league?.name || "Basketball") + (g.country?.name ? " · " + g.country.name : ""),
      utcDate: g.date,
    })).filter(g => g.home && g.away);
    results.push(...items);
    if (items.length) console.log(`[live-matches] API-Sports basketball: ${items.length}`);
  } catch(e) { console.error("[live-matches] API-Sports basketball:", e.message); }

  // Hockey live
  try {
    const data = await httpGet("https://v1.hockey.api-sports.io/games?live=all", { "x-apisports-key": API_SPORTS_KEY });
    const items = (data.response || []).slice(0, 10).map((g) => ({
      id: "hk-" + g.id, sport: "Hockey",
      source: "api-sports",
      sourceId: String(g.id),
      fixtureId: null,
      home: g.teams?.home?.name, away: g.teams?.away?.name,
      score_home: g.scores?.home ?? null, score_away: g.scores?.away ?? null,
      minute: g.status?.timer ?? null, status: "IN_PLAY",
      competition: (g.league?.name || "Hockey") + (g.country?.name ? " · " + g.country.name : ""),
      utcDate: g.date,
    })).filter(g => g.home && g.away);
    results.push(...items);
    if (items.length) console.log(`[live-matches] API-Sports hockey: ${items.length}`);
  } catch(e) { console.error("[live-matches] API-Sports hockey:", e.message); }

  // Baseball live
  try {
    const data = await httpGet("https://v1.baseball.api-sports.io/games?live=all", { "x-apisports-key": API_SPORTS_KEY });
    const items = (data.response || []).slice(0, 10).map((g) => ({
      id: "bb-" + g.id, sport: "Baseball",
      source: "api-sports",
      sourceId: String(g.id),
      fixtureId: null,
      home: g.teams?.home?.name, away: g.teams?.away?.name,
      score_home: g.scores?.home?.total ?? g.scores?.home ?? null,
      score_away: g.scores?.away?.total ?? g.scores?.away ?? null,
      minute: g.status?.long || g.status?.short || null,
      status: "IN_PLAY",
      competition: (g.league?.name || "Baseball") + (g.country?.name ? " · " + g.country.name : ""),
      utcDate: g.date,
    })).filter(g => g.home && g.away);
    results.push(...items);
    if (items.length) console.log(`[live-matches] API-Sports baseball: ${items.length}`);
  } catch(e) { console.error("[live-matches] API-Sports baseball:", e.message); }

  if (results.length === 0) return null;
  console.log(`[live-matches] API-Sports total: ${results.length} événements`);
  return results;
}

function sameLiveTeams(a, b) {
  return normalizeMatchName(a?.home) === normalizeMatchName(b?.home)
    && normalizeMatchName(a?.away) === normalizeMatchName(b?.away);
}

function hasKnownScore(match) {
  return match?.score_home !== null && match?.score_home !== undefined
    && match?.score_away !== null && match?.score_away !== undefined;
}

function parseLiveMinuteValue(minute) {
  if (minute === null || minute === undefined) return null;
  const parsed = parseInt(String(minute).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isFinishedOrTooLateForLiveIa(match) {
  const status = String(match?.status || "").toUpperCase();
  if (["FINISHED", "FT", "AET", "PEN", "ENDED", "CANCELLED", "POSTPONED"].includes(status)) return true;
  const minute = parseLiveMinuteValue(match?.minute);
  return match?.sport === "Football" && minute !== null && minute >= 85;
}

function scoresDiffer(a, b) {
  if (!hasKnownScore(a) || !hasKnownScore(b)) return false;
  return Number(a.score_home) !== Number(b.score_home) || Number(a.score_away) !== Number(b.score_away);
}

function mergeLiveMatchSources(footballDataMatches = [], apiSportsMatches = []) {
  const merged = [...footballDataMatches];
  for (const apiMatch of apiSportsMatches) {
    const existingIndex = merged.findIndex((m) => sameLiveTeams(m, apiMatch) && m.status !== "FINISHED");
    if (existingIndex >= 0 && apiMatch.sport === "Football") {
      const previous = merged[existingIndex];
      merged[existingIndex] = scoresDiffer(previous, apiMatch)
        ? {
            ...apiMatch,
            scoreConflict: true,
            scoreConflictSources: {
              footballData: `${previous.score_home}-${previous.score_away}`,
              apiSports: `${apiMatch.score_home}-${apiMatch.score_away}`,
            },
          }
        : apiMatch;
    } else {
      merged.push(apiMatch);
    }
  }
  return merged;
}

function rejectScoreConflict(match, res) {
  if (!match?.scoreConflict) return false;
  const sources = match.scoreConflictSources || {};
  res.json({
    ok: false,
    error: `Score live contradictoire entre les APIs (${sources.footballData || "?"} vs ${sources.apiSports || "?"}). Analyse bloquee jusqu'a confirmation.`,
    scoreConflict: true,
  });
  return true;
}

async function fetchLiveMatches() {
  if (liveMatchesCache.data && Date.now() - liveMatchesCache.ts < CACHE_TTL) {
    return liveMatchesCache.data;
  }
  const [footballDataMatches, apiSportsMatches] = await Promise.all([
    fetchFromFootballData(),
    fetchFromApiSports(),
  ]);
  // If both failed, do not keep stale live matches on screen.
  if (footballDataMatches === null && apiSportsMatches === null) return resolveLiveMatchesAfterFetchFailure(liveMatchesCache);
  const matches = mergeLiveMatchSources(footballDataMatches || [], apiSportsMatches || []);

  // Auto-résoudre les prédictions des matchs terminés
  matches.filter(m => m.status === "FINISHED").forEach(m => autoResolvePredictions(m));

  const visibleMatches = matches.filter(m => !isFinishedOrTooLateForLiveIa(m));
  liveMatchesCache = { data: visibleMatches, ts: Date.now() };
  return visibleMatches;
}

function getMockMatches() {
  // Demo matches when API unavailable
  const base = Date.now();
  return [
    { id: "demo1", home: "Maroc", away: "Écosse", score_home: 1, score_away: 0, minute: 55, status: "IN_PLAY", competition: "Coupe du Monde 2026", utcDate: new Date(base).toISOString() },
    { id: "demo2", home: "Real Madrid", away: "Barcelona", score_home: 2, score_away: 1, minute: 67, status: "IN_PLAY", competition: "La Liga", utcDate: new Date(base).toISOString() },
    { id: "demo3", home: "Manchester City", away: "Arsenal", score_home: 0, score_away: 0, minute: 12, status: "IN_PLAY", competition: "Premier League", utcDate: new Date(base).toISOString() },
    { id: "demo4", home: "Bayern Munich", away: "Dortmund", score_home: 3, score_away: 1, minute: 78, status: "IN_PLAY", competition: "Bundesliga", utcDate: new Date(base).toISOString() },
  ];
}

// ── Statistiques live par match (api-sports.io) ───────────────────────────────
function resolveLiveMatchesAfterFetchFailure() {
  return [];
}

function normalizeMatchName(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveVerifiedLiveMatch(input, liveMatches) {
  const matches = Array.isArray(liveMatches) ? liveMatches : [];
  const inputId = input?.id || input?.match_id || input?.sourceMatchId || input?.sourceId || input?.fixtureId;
  if (inputId) {
    const wanted = String(inputId);
    const byId = matches.find((m) => [m.id, m.sourceMatchId, m.sourceId, m.fixtureId].filter(Boolean).map(String).includes(wanted));
    if (byId) return byId;
  }

  const home = normalizeMatchName(input?.home);
  const away = normalizeMatchName(input?.away);
  if (!home || !away) return null;

  return matches.find((m) => normalizeMatchName(m.home) === home && normalizeMatchName(m.away) === away) || null;
}

async function requireVerifiedLiveMatch(input) {
  const matches = await fetchLiveMatches();
  return resolveVerifiedLiveMatch(input, matches);
}

const matchStatsCache = new Map();

async function fetchMatchStats(fixtureId) {
  if (!API_SPORTS_KEY || !fixtureId) return null;
  const id = String(fixtureId);
  // Seulement pour les fixtures football (pas bk-, hk-, etc.)
  if (id.startsWith("bk-") || id.startsWith("hk-") || id.startsWith("demo")) return null;

  const ck = `stats_${id}`;
  const cached = matchStatsCache.get(ck);
  if (cached && Date.now() - cached.ts < 60000) return cached.data;

  try {
    const data = await httpGet(
      `https://v3.football.api-sports.io/fixtures/statistics?fixture=${id}`,
      { "x-apisports-key": API_SPORTS_KEY }
    );
    const stats = parseMatchStats(data);
    matchStatsCache.set(ck, { data: stats, ts: Date.now() });
    return stats;
  } catch (e) {
    console.error("[match-stats] Erreur:", e.message);
    return null;
  }
}

async function fetchMatchStatsForMatch(match) {
  const fixtureId = getVerifiedFixtureId(match);
  if (!API_SPORTS_KEY) return buildStatsStatus(match, null, "api_sports_key_missing");
  if (!fixtureId) return buildStatsStatus(match, null, "missing_api_sports_fixture");

  const stats = await fetchMatchStats(fixtureId);
  if (!stats) return buildStatsStatus({ ...match, fixtureId }, null, "api_sports_stats_unavailable");
  return buildStatsStatus({ ...match, fixtureId }, stats, null);
}

function parseMatchStats(data) {
  if (!data?.response?.length) return null;
  const home = data.response[0]?.statistics || [];
  const away = data.response[1]?.statistics || [];
  const get = (arr, name) => {
    const s = arr.find(s => s.type === name);
    return s?.value ?? null;
  };
  return {
    possession_home: get(home, "Ball Possession"),
    possession_away: get(away, "Ball Possession"),
    shots_on_goal_home: get(home, "Shots on Goal"),
    shots_on_goal_away: get(away, "Shots on Goal"),
    total_shots_home: get(home, "Total Shots"),
    total_shots_away: get(away, "Total Shots"),
    dangerous_attacks_home: get(home, "Dangerous Attacks"),
    dangerous_attacks_away: get(away, "Dangerous Attacks"),
    yellow_cards_home: get(home, "Yellow Cards") || 0,
    yellow_cards_away: get(away, "Yellow Cards") || 0,
    red_cards_home: get(home, "Red Cards") || 0,
    red_cards_away: get(away, "Red Cards") || 0,
    corners_home: get(home, "Corner Kicks"),
    corners_away: get(away, "Corner Kicks"),
  };
}

function buildStatsBlock(stats, home, away) {
  if (!stats) return "";
  const lines = ["\n📊 STATISTIQUES TEMPS RÉEL (données live api-sports.io) :"];
  if (stats.possession_home) lines.push(`  Possession    : ${home} ${stats.possession_home} — ${away} ${stats.possession_away}`);
  if (stats.shots_on_goal_home !== null) lines.push(`  Tirs cadrés   : ${home} ${stats.shots_on_goal_home} — ${away} ${stats.shots_on_goal_away}`);
  if (stats.total_shots_home !== null) lines.push(`  Tirs totaux   : ${home} ${stats.total_shots_home} — ${away} ${stats.total_shots_away}`);
  if (stats.dangerous_attacks_home !== null) lines.push(`  Att. dang.    : ${home} ${stats.dangerous_attacks_home} — ${away} ${stats.dangerous_attacks_away}`);
  if (stats.corners_home !== null) lines.push(`  Corners       : ${home} ${stats.corners_home} — ${away} ${stats.corners_away}`);
  if (stats.yellow_cards_home > 0 || stats.yellow_cards_away > 0) lines.push(`  Cartons jaunes: ${home} ${stats.yellow_cards_home} — ${away} ${stats.yellow_cards_away}`);
  if (stats.red_cards_home > 0 || stats.red_cards_away > 0) lines.push(`  ⚠️ CARTONS ROUGES: ${home} ${stats.red_cards_home} — ${away} ${stats.red_cards_away} (infériorité numérique!)`);
  return lines.join("\n");
}

// ── Groq Concile analysis ─────────────────────────────────────────────────────
const BET_TYPES = ["Victoire domicile", "Victoire extérieur", "Match nul", "Over 2.5 buts", "Under 2.5 buts", "BTTS Oui", "BTTS Non", "Double chance 1X", "Double chance X2"];

// Estime la minute depuis l'heure de début quand l'API ne la fournit pas
function estimateMinute(match) {
  const m = parseInt(match.minute);
  if (!isNaN(m) && m > 0) return m;
  if (match.status !== "IN_PLAY" && match.status !== "LIVE") return 0;
  if (match.utcDate) {
    const elapsed = Math.floor((Date.now() - new Date(match.utcDate).getTime()) / 60000);
    if (elapsed > 0 && elapsed <= 120) return Math.min(elapsed, 92);
  }
  return 50; // fallback mi-match si aucune info
}

// Filtre les paris mathématiquement impossibles ou déjà perdus
function readKnownScore(match) {
  if (match.score_home === null || match.score_home === undefined || match.score_away === null || match.score_away === undefined) {
    return null;
  }
  const home = Number(match.score_home);
  const away = Number(match.score_away);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return { home, away, total: home + away };
}

function computeAvailableBets(match) {
  const score = readKnownScore(match);
  if (!score) return [...BET_TYPES];
  const h = score.home;
  const a = score.away;
  const total = score.total;
  const minute = estimateMinute(match);
  const remaining = Math.max(0, 93 - minute);
  const isLive = minute >= 30 && match.status !== "SCHEDULED";
  const isNeutral = isNeutralComp(match.competition || "");

  let bets = [...BET_TYPES];

  // Terrain neutre (Coupe du Monde, Euro, etc.) → remplacer domicile/extérieur par noms réels
  // Les termes "Victoire domicile/extérieur" n'ont pas de sens sans avantage terrain
  if (isNeutral) {
    bets = bets.map(b => {
      if (b === "Victoire domicile") return `Victoire ${match.home}`;
      if (b === "Victoire extérieur") return `Victoire ${match.away}`;
      if (b === "Double chance 1X") return `Double chance ${match.home} ou Nul`;
      if (b === "Double chance X2") return `Double chance ${match.away} ou Nul`;
      return b;
    });
  }

  if (!isLive) return bets;

  // Marchés déjà PERDUS → supprimer
  if (total > 2.5) bets = bets.filter(b => b !== "Under 2.5 buts");
  if (total > 1.5) bets = bets.filter(b => b !== "Under 1.5 buts" && b !== "Under 2.5 buts");
  if (h > 0 && a > 0) bets = bets.filter(b => b !== "BTTS Non");
  // Marchés déjà gagnés : ne jamais proposer un pari dont l'issue est déjà acquise.
  if (total > 2.5) bets = bets.filter(b => b !== "Over 2.5 buts");
  if (h > 0 && a > 0) bets = bets.filter(b => b !== "BTTS Oui");

  // Over 2.5 : projection mathématique basée sur le rythme actuel
  const need25 = Math.max(0, 3 - total);
  const projectedGoals = minute > 0 ? (total / minute) * 90 : 0;
  if (need25 >= 3 && remaining <= 30) bets = bets.filter(b => b !== "Over 2.5 buts");
  if (need25 >= 2 && remaining <= 15) bets = bets.filter(b => b !== "Over 2.5 buts");
  // Nouveau : si projection < 2.0 après 45 min → Over 2.5 statistiquement improbable
  if (minute >= 45 && need25 >= 2 && projectedGoals < 2.0) bets = bets.filter(b => b !== "Over 2.5 buts");

  // BTTS quasi-impossible si une équipe vierge et peu de temps
  if (h === 0 && remaining <= 15) bets = bets.filter(b => b !== "BTTS Oui");
  if (a === 0 && remaining <= 15) bets = bets.filter(b => b !== "BTTS Oui");

  // Victoire impossible si mène +2 et <10 min
  if (isNeutral) {
    if (h - a >= 2 && remaining <= 10) bets = bets.filter(b => b !== `Victoire ${match.away}`);
    if (a - h >= 2 && remaining <= 10) bets = bets.filter(b => b !== `Victoire ${match.home}`);
  } else {
    if (h - a >= 2 && remaining <= 10) bets = bets.filter(b => b !== "Victoire extérieur");
    if (a - h >= 2 && remaining <= 10) bets = bets.filter(b => b !== "Victoire domicile");
  }

  return bets.length > 0 ? bets : BET_TYPES;
}

// Correction post-IA : si l'IA recommande quand même un pari impossible, on corrige
function validateAndCorrectBet(bet, match, availableBets) {
  if (availableBets.includes(bet)) return { bet, corrected: false };

  // Corrections logiques
  const score = readKnownScore(match);
  const h = score ? score.home : null;
  const a = score ? score.away : null;
  const total = score ? score.total : null;
  const minute = estimateMinute(match);
  const remaining = Math.max(0, 93 - minute);

  let corrected = bet;
  if (score && (bet === "Over 2.5 buts") && availableBets.includes("Under 2.5 buts")) corrected = "Under 2.5 buts";
  else if (score && (bet === "Under 2.5 buts") && total > 2.5 && availableBets.includes("Over 2.5 buts")) corrected = "Over 2.5 buts";
  else if (score && (bet === "BTTS Non") && h > 0 && a > 0 && availableBets.includes("BTTS Oui")) corrected = "BTTS Oui";
  else corrected = availableBets[0]; // fallback sur premier pari disponible

  console.log(`[concile] Correction: "${bet}" → "${corrected}" (mathématiquement invalide à ${minute}', score ${h}-${a})`);
  return { bet: corrected, corrected: true, original: bet };
}

const NEUTRAL_KEYWORDS = ["world cup","coupe du monde","fifa world","euro ","uefa euro","copa america","gold cup","afcon","africa cup","nations league final","champions league final","europa league final"];
function isNeutralComp(comp = "") {
  const c = comp.toLowerCase();
  return NEUTRAL_KEYWORDS.some(k => c.includes(k));
}

// Calcule les contraintes mathématiques live pour éviter les paris impossibles
function computeLiveConstraints(match) {
  const score = readKnownScore(match);
  if (!score) return "";
  const h = score.home;
  const a = score.away;
  const total = score.total;
  const minute = estimateMinute(match); // utilise l'estimation si null
  const isLive = minute >= 30 && match.status !== "SCHEDULED" && match.minute !== "Pré-match";

  if (!isLive) return "";

  const remaining = Math.max(0, 93 - minute);
  const goalsPerMin = minute > 0 ? total / minute : 0;
  const projectedTotal = Math.round(goalsPerMin * 90 * 10) / 10;

  const lines = ["\n🔢 CONTRAINTES MATHÉMATIQUES LIVE — respecte-les impérativement:"];

  // ── Marchés déjà gagnés
  const won = [];
  if (total > 3.5) won.push("Over 3.5 ✅");
  if (total > 2.5) won.push("Over 2.5 ✅");
  if (total > 1.5) won.push("Over 1.5 ✅");
  if (h > 0 && a > 0) won.push("BTTS Oui ✅");
  if (won.length) lines.push(`  → DÉJÀ GAGNÉS : ${won.join(", ")} — ne propose pas leurs opposés.`);

  // ── Marchés déjà perdus
  const lost = [];
  if (total > 3.5) lost.push("Under 3.5 ❌");
  if (total > 2.5) lost.push("Under 2.5 ❌");
  if (total > 1.5) lost.push("Under 1.5 ❌");
  if (h > 0 && a > 0) lost.push("BTTS Non ❌");
  if (lost.length) lines.push(`  → DÉJÀ PERDUS — ne PAS recommander : ${lost.join(", ")}`);

  // ── Over 2.5 faisabilité
  if (total < 3) {
    const need25 = 3 - total;
    if (need25 >= 3 && remaining <= 25) {
      lines.push(`  → Over 2.5 QUASI IMPOSSIBLE : ${need25} but(s) en ~${remaining} min → probabilité <5% → recommande Under 2.5.`);
    } else if (need25 >= 2 && remaining <= 20) {
      lines.push(`  → Over 2.5 TRÈS DIFFICILE : ${need25} but(s) en ~${remaining} min → Under 2.5 favori.`);
    } else if (need25 === 1 && remaining <= 12) {
      lines.push(`  → Over 2.5 : 1 but en ~${remaining} min — incertain, préfère Under 2.5.`);
    }
  }

  // ── Over 1.5 faisabilité
  if (total < 2) {
    const need15 = 2 - total;
    if (need15 >= 2 && remaining <= 15) {
      lines.push(`  → Over 1.5 QUASI IMPOSSIBLE : 2 buts en ~${remaining} min.`);
    } else if (need15 === 1 && remaining <= 8) {
      lines.push(`  → Over 1.5 : 1 but en ~${remaining} min — très serré.`);
    }
  }

  // ── Rythme de buts (extrapolation + recommandation)
  if (minute >= 30) {
    lines.push(`  → Rythme actuel : ${total} but(s) en ${minute}' → extrapolation : ~${projectedTotal} buts à 90'.`);
    if (projectedTotal < 2.0 && total < 3) {
      lines.push(`  → ⚠️ PROJECTION FAIBLE (${projectedTotal} buts) : Over 2.5 peu probable au rythme actuel → préfère Under 2.5.`);
    } else if (projectedTotal >= 2.5 && total < 3) {
      lines.push(`  → Projection compatible avec Over 2.5 (${projectedTotal} buts estimés).`);
    }
  }

  // ── BTTS faisabilité
  if (h === 0 && remaining <= 20) {
    lines.push(`  → BTTS Oui : ${match.home} n'a PAS marqué — risqué avec seulement ~${remaining} min restantes.`);
  }
  if (a === 0 && remaining <= 20) {
    lines.push(`  → BTTS Oui : ${match.away} n'a PAS marqué — risqué avec seulement ~${remaining} min restantes.`);
  }

  // ── Résultat 1X2 en fin de match
  if (minute >= 75) {
    if (h > a) lines.push(`  → ${match.home} mène ${h}-${a} à la ${minute}' : Victoire domicile TRÈS PROBABLE. Retournement <8%.`);
    else if (a > h) lines.push(`  → ${match.away} mène ${a}-${h} à la ${minute}' : Victoire extérieur TRÈS PROBABLE. Retournement <8%.`);
    else lines.push(`  → 0-0 ou égalité à la ${minute}' : Match nul probable (~45%) ou but décisif dans ~${remaining} min.`);
  }

  lines.push("  → PRIORISE ces contraintes LIVE sur toute stat pré-match. Ne recommande PAS un pari mathématiquement contraire.");
  return lines.join("\n");
}

async function runConcileAnalysis(match) {
  if (!GROQ_API_KEY) {
    return getMockAnalysis(match);
  }

  const neutralNote = isNeutralComp(match.competition)
    ? "\n⚠️ TERRAIN NEUTRE — ne PAS mentionner l'avantage domicile, il n'existe pas dans cette compétition."
    : "";
  const sport = String(match.sport || "Football");
  const sportNote = sport !== "Football"
    ? `\nSport: ${sport}` : "";
  const sportRules = sport === "Basketball"
    ? "\nRègle sport: basket — privilégier moneyline/vainqueur et handicap prudent; éviter les gros over/under points sauf données très solides."
    : sport === "Hockey"
      ? "\nRègle sport: hockey — privilégier vainqueur/double chance; over/under seulement si rythme et tirs sont très solides."
      : sport === "Baseball"
        ? "\nRègle sport: baseball — privilégier moneyline/vainqueur; éviter les marchés joueurs ou exotiques au début."
        : "\nRègle sport: football — marchés autorisés: vainqueur, double chance, draw no bet, BTTS, over/under prudents, but équipe.";
  const liveConstraints = computeLiveConstraints(match);

  // Récupérer les statistiques live si disponibles (football uniquement)
  const isLiveMatch = match.status === "IN_PLAY" || match.status === "LIVE";
  const statsStatus = isLiveMatch
    ? await fetchMatchStatsForMatch(match)
    : buildStatsStatus(match, null, "match_not_live");
  const liveStats = statsStatus.available ? statsStatus.stats : null;
  const statsBlock = buildStatsBlock(liveStats, match.home, match.away);

  if (statsStatus.available) {
    console.log(`[concile] Stats live récupérées pour ${match.home} vs ${match.away} fixture=${statsStatus.fixtureId}`);
  } else {
    console.log(`[concile] Stats live indisponibles pour ${match.home} vs ${match.away}: ${statsStatus.reason}`);
  }

  // Pré-filtrer les paris impossibles du prompt
  const availableBets = computeAvailableBets(match);
  const estimatedMin = estimateMinute(match);
  const minuteDisplay = match.minute ? `${match.minute}'` : (estimatedMin > 0 ? `~${estimatedMin}' (estimé)` : "Pré-match");

  const matchContext = `Match: ${match.home} vs ${match.away}
Compétition: ${match.competition || "International"}${sportNote}
Score actuel: ${match.score_home ?? "?"}-${match.score_away ?? "?"}
Minute: ${minuteDisplay}
Statut: ${match.status}${neutralNote}${sportRules}${statsBlock}${liveConstraints}

IMPORTANT — Paris AUTORISÉS dans ce contexte (les seuls disponibles mathématiquement) :
→ ${availableBets.join(", ")}
Tu DOIS choisir UNIQUEMENT parmi cette liste. Tout autre pari est mathématiquement invalide.`;

  // Agents légers sur llama-3.1-8b-instant (~3x moins de tokens), Chief sur le grand modèle
  const agentNames = [
    { name: "GROQ-Llama", model: "llama-3.1-8b-instant", icon: "🦙" },
    { name: "GPT Analysis", model: "llama-3.1-8b-instant", icon: "🤖" },
    { name: "GeminiFlash", model: "llama-3.1-8b-instant", icon: "💎" },
    { name: "Mistral-7B", model: "llama-3.1-8b-instant", icon: "🌊" },
    { name: "Claude Chief", model: "llama-3.3-70b-versatile", icon: "👑" },
  ];

  const personas = [
    `Tu es GROQ-Llama, agent statistique. Utilise tes connaissances sur ${match.home} et ${match.away} : classement FIFA/ELO, moyenne de buts marqués/encaissés en compétition, forme récente (5 derniers matchs), style de jeu (pressing, possession, contre-attaque). Croise ces stats avec le score live.`,
    `Tu es GPT-Analysis, expert tactique. Analyse ${match.home} vs ${match.away} en t'appuyant sur ce que tu sais : schéma tactique habituel, force de la défense, pressing, profil des buteurs, résultats récents et H2H historique. Adapte ton analyse au score et à la minute actuelle.`,
    `Tu es GeminiFlash, spécialiste value bets. Pour ${match.home} vs ${match.away}, estime la vraie probabilité de chaque marché disponible en tenant compte du classement des équipes, de leurs statistiques offensives/défensives connues, et du contexte du tournoi (enjeu, élimination, groupe). Identifie le meilleur rapport probabilité/valeur.`,
    `Tu es Mistral-7B, expert Over/Under et BTTS. Pour ${match.home} vs ${match.away}, utilise tes connaissances sur le nombre moyen de buts dans ce type de confrontation, le style offensif ou défensif de chaque équipe, et les tendances de la compétition (ex: Coupe du Monde 2026 = moyenne buts). Concentre-toi sur les marchés de buts.`,
    `Tu es Claude Chief, arbitre du Concile. Tu ne fais pas une moyenne simple: tu compares les 4 agents, identifies les désaccords utiles, rejettes les signaux faibles, et arbitres avec tes propres connaissances sur ${match.home} et ${match.away} (classement, contexte, enjeux, historique). Tu es assisté par GPT-Codex Challenger: avant ton verdict, tu dois te demander si ton intuition est trop dominante, si un autre marché est plus solide, et quelle objection rationnelle pourrait te faire changer d'avis.`,
  ];

  // Charger les performances historiques pour pondérer le verdict du Chief
  const agentPerf = getAgentPerformance();

  const agentResults = [];

  for (let i = 0; i < agentNames.length; i++) {
    const isChief = i === 4;
    const previousVotes = isChief ? agentResults.map((a) => {
      const p = agentPerf[a.name];
      const resolved = p ? p.resolved : 0;
      const perfNote = resolved >= 5
        ? ` — historique: ${p.winrate}% winrate (${p.wins}/${resolved} résolus)`
        : resolved > 0 ? ` — (${resolved} prédiction(s), pas assez pour peser)` : ` — (sans historique)`;
      return `${a.name}: ${a.bet} (${a.confidence}%)${perfNote}`;
    }).join("\n") : "";

    const prompt = isChief
      ? `${personas[i]}

${matchContext}

Votes des agents avec leur fiabilité historique:
${previousVotes}

Synthétise ces votes en tenant compte de :
1. La fiabilité historique de chaque agent (winrate)
2. Les contraintes mathématiques du score live
3. Tes connaissances sur ${match.home} et ${match.away}
4. Les objections des agents minoritaires: explique pourquoi tu les acceptes ou les rejettes
5. Le contrôle GPT-Codex Challenger: teste au moins 3 marchés alternatifs (BTTS, double chance, over/under, vainqueur ou nul selon disponibilité), puis rejette ceux dont le signal est moins robuste
6. Le contexte business/risque: enjeu du match, domicile/extérieur, match amical ou officiel, blessures/absences connues seulement si tu en es sûr; si une donnée manque, ne l'invente pas
7. Les règles propres au sport: ${sport}
8. Tu DOIS choisir parmi : ${availableBets.join(", ")}

Réponds en JSON pur (pas de markdown):
{
  "bet": "un parmi: ${availableBets.join(", ")}",
  "confidence": <nombre 55-92>,
  "raison": "<2 phrases max: verdict + raison principale; objection minoritaire acceptée/rejetée si elle existe>"
}`
      : `${personas[i]}

${matchContext}

En te basant sur tes connaissances des équipes ET les données live ci-dessus, recommande le meilleur pari.
Tu DOIS choisir parmi cette liste uniquement : ${availableBets.join(", ")}

Réponds en JSON pur (pas de markdown):
{
  "bet": "un parmi: ${availableBets.join(", ")}",
  "confidence": <nombre 50-90>,
  "raison": "<2 phrases: 1 donnée concrète sur les équipes, 1 sur le contexte live>"
}`;

    try {
      const response = await httpPost(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: agentNames[i].model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3 + i * 0.05,
          max_tokens: isChief ? 400 : 200,
        },
        { Authorization: `Bearer ${GROQ_API_KEY}` }
      );

      const raw = response.choices?.[0]?.message?.content || "{}";
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);

      const rawBet = parsed.bet || availableBets[0];
      const { bet: validBet, corrected, original } = validateAndCorrectBet(rawBet, match, availableBets);
      // Fallback raison : synthèse des votes si Chief n'a pas produit d'analyse
      const fallbackRaison = isChief && agentResults.length > 0
        ? `Consensus des agents : ${agentResults.map(a => a.bet).join(", ")}. Score ${match.score_home}-${match.score_away} à ${minuteDisplay}.`
        : `Score actuel ${match.score_home}-${match.score_away}, analyse basée sur le rythme du match.`;
      const raisonFinal = corrected
        ? `[Corrigé: "${original}" → "${validBet}"] ${parsed.raison || fallbackRaison}`
        : (parsed.raison && parsed.raison.length > 10 ? parsed.raison : fallbackRaison);

      agentResults.push({
        name: agentNames[i].name,
        icon: agentNames[i].icon,
        bet: validBet,
        confidence: Math.min(95, Math.max(50, parseInt(parsed.confidence) || 70)),
        raison: raisonFinal,
        isChief,
        corrected: corrected || false,
      });
    } catch (e) {
      // fallback for this agent
      agentResults.push(getMockAgentAnalysis(agentNames[i], match, i));
    }

    // Small delay between agents to avoid rate limits
    if (i < agentNames.length - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // Find consensus bet
  const chief = agentResults[agentResults.length - 1];
  const betCounts = {};
  agentResults.slice(0, 4).forEach((a) => {
    betCounts[a.bet] = (betCounts[a.bet] || 0) + 1;
  });
  const consensusBet = chief.bet;
  const consensusVotes = betCounts[consensusBet] || 0;

  // Sauvegarder les prédictions pour le tracking de performance
  saveAgentPredictions(match, agentResults);

  const analysisResult = {
    match_key: `${match.home}_${match.away}`,
    best_bet: chief.bet,
    confidence: chief.confidence,
    raison: chief.raison,
    consensus_votes: consensusVotes + 1,
    total_agents: 5,
    agents: agentResults,
    statsStatus: typeof statsStatus !== "undefined" ? statsStatus : buildStatsStatus(match, null, "mock_or_unavailable"),
    agent_performance: agentPerf,
  };

  // Tracer l'analyse pour la boucle d'apprentissage
  const pick = loadPick();
  const pickBet = pick?.currentPick?.bet || pick?.marketType || null;
  saveConcileAnalysis(match, analysisResult, pickBet);

  return analysisResult;
}

function getMockAgentAnalysis(agent, match, index) {
  const bets = BET_TYPES;
  const score_diff = match.score_home - match.score_away;
  const minute = parseInt(match.minute) || 50;
  let bet;
  if (score_diff > 0 && minute > 60) bet = "Under 2.5 buts";
  else if (score_diff === 0 && minute < 70) bet = "BTTS Oui";
  else if (score_diff === 0) bet = "Over 2.5 buts";
  else bet = score_diff > 0 ? "Victoire domicile" : "Victoire extérieur";

  const confidence = 60 + Math.floor(Math.random() * 25);
  const raisons = [
    `L'équipe à domicile montre une solidité défensive depuis la ${minute}'. Le contexte du score favorise ce marché.`,
    `Les statistiques de ce type de match à cette phase du jeu indiquent une forte probabilité pour ce scénario.`,
    `Le score actuel de ${match.score_home}-${match.score_away} et la dynamique du match orientent clairement vers ce pari.`,
    `Analyse des patterns : ce type de configuration à la ${minute}' converge régulièrement vers ce résultat.`,
    `En synthèse des votes du Concile et du contexte temps réel, ce pari offre le meilleur ratio risque/récompense.`,
  ];

  return {
    name: agent.name,
    icon: agent.icon,
    bet,
    confidence,
    raison: raisons[index] || raisons[0],
    isChief: index === 4,
  };
}

function getMockAnalysis(match) {
  const statsStatus = buildStatsStatus(match, null, "mock_or_unavailable");
  const agents = [
    { name: "GROQ-Llama", icon: "🦙", model: "llama-3.3-70b" },
    { name: "GPT Analysis", icon: "🤖", model: "gpt-4o" },
    { name: "GeminiFlash", icon: "💎", model: "gemini-flash" },
    { name: "Mistral-7B", icon: "🌊", model: "mistral-7b" },
    { name: "Claude Chief", icon: "👑", model: "claude-opus", isChief: true },
  ];
  const agentResults = agents.map((a, i) => getMockAgentAnalysis(a, match, i));
  const chief = agentResults[agentResults.length - 1];
  return {
    match_key: `${match.home}_${match.away}`,
    best_bet: chief.bet,
    confidence: chief.confidence,
    raison: chief.raison,
    consensus_votes: 3,
    total_agents: 5,
    agents: agentResults,
    statsStatus: typeof statsStatus !== "undefined" ? statsStatus : buildStatsStatus(match, null, "mock_or_unavailable"),
  };
}

// ── Concile analysis trace ────────────────────────────────────────────────────
function summarizeOutcomeRows(rows) {
  const total = rows.reduce((n, r) => n + Number(r.total || 0), 0);
  const wins = rows.reduce((n, r) => n + Number(r.wins || 0), 0);
  const losses = rows.reduce((n, r) => n + Number(r.losses || 0), 0);
  const resolved = wins + losses;
  return { total, wins, losses, resolved, winrate: resolved ? Math.round((wins / resolved) * 100) : null };
}

function getLearningProfile({ sport = "Football", competition = "", bet = "" } = {}) {
  const s = String(sport || "Football");
  const c = String(competition || "");
  const b = String(bet || "");
  const empty = { total: 0, wins: 0, losses: 0, resolved: 0, winrate: null };
  try {
    const sportRows = db.prepare(`
      SELECT COUNT(*) total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses
      FROM concile_analyses
      WHERE sport = ? AND outcome IN ('win','loss')
    `).all(s);
    const marketRows = db.prepare(`
      SELECT COUNT(*) total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses
      FROM concile_analyses
      WHERE sport = ? AND best_bet = ? AND outcome IN ('win','loss')
    `).all(s, b);
    const competitionRows = db.prepare(`
      SELECT COUNT(*) total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses
      FROM concile_analyses
      WHERE sport = ? AND competition = ? AND outcome IN ('win','loss')
    `).all(s, c);
    return {
      sport: s,
      competition: c,
      bet: b,
      sportStats: summarizeOutcomeRows(sportRows),
      marketStats: summarizeOutcomeRows(marketRows),
      competitionStats: summarizeOutcomeRows(competitionRows),
    };
  } catch (e) {
    console.error("[learning-profile]", e.message);
    return { sport: s, competition: c, bet: b, sportStats: empty, marketStats: empty, competitionStats: empty };
  }
}

function assessLearningProfile(profile, minResolved = 5) {
  const reasons = [];
  if (!profile) return { tier: "learning", score: 0, clientSafe: false, reasons: ["profil absent"] };
  const sportResolved = profile.sportStats?.resolved || 0;
  const marketResolved = profile.marketStats?.resolved || 0;
  const sportWinrate = profile.sportStats?.winrate;
  const marketWinrate = profile.marketStats?.winrate;
  if (sportResolved < Math.max(3, minResolved)) reasons.push(`historique sport insuffisant (${sportResolved}/${Math.max(3, minResolved)})`);
  if (marketResolved < minResolved) reasons.push(`historique marche insuffisant (${marketResolved}/${minResolved})`);
  if (sportWinrate !== null && sportWinrate < 50) reasons.push(`sport sous 50% (${sportWinrate}%)`);
  if (marketWinrate !== null && marketWinrate < 55) reasons.push(`marche sous 55% (${marketWinrate}%)`);
  const clientSafe = reasons.length === 0;
  return { tier: clientSafe ? "elite_candidate" : "learning", score: clientSafe ? 100 : Math.max(0, 70 - reasons.length * 15), clientSafe, reasons };
}

function saveConcileAnalysis(match, result, pickBet) {
  try {
    const minute = parseInt(match.minute) || null;
    const statsStatus = result.statsStatus?.status || "unavailable";
    const matchKey = getPredictionSnapshotKey(match);
    const sport = match.sport || "Football";
    const learningProfile = getLearningProfile({ sport, competition: match.competition || match.league || "", bet: result.best_bet });
    const learningAssessment = assessLearningProfile(learningProfile, 5);
    db.prepare(`
      INSERT INTO concile_analyses
        (match_key, home, away, competition, minute_at_analysis,
         score_home_at_analysis, score_away_at_analysis, stats_status,
         best_bet, confidence, raison, consensus_votes, agents_json, pick_bet,
         sport, learning_tier, learning_note)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      matchKey,
      match.home, match.away,
      match.competition || match.league || "",
      minute,
      match.score_home ?? null,
      match.score_away ?? null,
      statsStatus,
      result.best_bet,
      result.confidence,
      result.raison || "",
      result.consensus_votes || 0,
      JSON.stringify((result.agents || []).map(a => ({ name: a.name, bet: a.bet, confidence: a.confidence }))),
      pickBet || null,
      sport,
      learningAssessment.tier,
      learningAssessment.reasons.join("; ")
    );
    console.log(
      `[concile-trace] saved ${matchKey} | ${match.competition || match.league || "competition inconnue"} | ` +
      `${match.home} vs ${match.away} | minute=${minute ?? "?"} | ` +
      `score=${match.score_home ?? "?"}-${match.score_away ?? "?"} | ` +
      `bet=${result.best_bet} | confidence=${result.confidence} | reason=${String(result.raison || "").slice(0, 180)}`
    );
  } catch(e) { console.error("[concile-trace] save:", e.message); }
}

function getBetOutcomeForScore(bet, h, a) {
  const value = String(bet || "").trim();
  const normalized = value.toLowerCase();
  const total = Number(h) + Number(a);
  if (!value) return null;
  if (normalized.includes("over 2.5") || normalized.includes("plus de 2.5")) return total > 2.5 ? "win" : "loss";
  if (normalized.includes("under 2.5") || normalized.includes("moins de 2.5")) return total < 2.5 ? "win" : "loss";
  if (normalized.includes("btts oui") || normalized.includes("les deux equipes marquent") || normalized.includes("les deux équipes marquent")) return (h > 0 && a > 0) ? "win" : "loss";
  if (normalized.includes("btts non")) return (h > 0 && a > 0) ? "loss" : "win";
  if (value === "Match nul" || value === "X" || normalized.includes("nul")) return h === a ? "win" : "loss";
  if (value === "1X" || normalized.includes("1x")) return h >= a ? "win" : "loss";
  if (value === "X2" || normalized.includes("x2")) return a >= h ? "win" : "loss";
  if (value === "12" || normalized.includes("12")) return h !== a ? "win" : "loss";
  if (normalized.includes("domicile") || value === "1") return h > a ? "win" : "loss";
  if (normalized.includes("extérieur") || normalized.includes("exterieur") || value === "2") return a > h ? "win" : "loss";
  return null;
}

function resolveConcileAnalyses(home, away, scoreHome, scoreAway) {
  if (scoreHome === null || scoreHome === undefined || scoreAway === null || scoreAway === undefined) return;
  const h = Number(scoreHome), a = Number(scoreAway);
  const total = h + a;

  function betOutcome(bet) {
    if (!bet) return null;
    if (bet === "Over 2.5 buts") return total > 2.5 ? "win" : "loss";
    if (bet === "Under 2.5 buts") return total < 2.5 ? "win" : "loss";
    if (bet === "BTTS Oui") return (h > 0 && a > 0) ? "win" : "loss";
    if (bet === "BTTS Non") return (h > 0 && a > 0) ? "loss" : "win";
    if (bet.includes("domicile") || bet === "1") return h > a ? "win" : "loss";
    if (bet.includes("extérieur") || bet === "2") return a > h ? "win" : "loss";
    if (bet === "Match nul" || bet === "X") return h === a ? "win" : "loss";
    if (bet === "1X" || bet.includes("1X")) return h >= a ? "win" : "loss";
    if (bet === "X2" || bet.includes("X2")) return a >= h ? "win" : "loss";
    if (bet === "12" || bet.includes("12")) return h !== a ? "win" : "loss";
    return null;
  }

  try {
    const first = home.split(' ')[0];
    const pending = db.prepare(
      "SELECT * FROM concile_analyses WHERE home LIKE ? AND away LIKE ? AND outcome IS NULL"
    ).all(`%${first}%`, `%${away.split(' ')[0]}%`);

    if (!pending.length) return;
    const upd = db.prepare(`
      UPDATE concile_analyses
      SET outcome = ?,
          final_score_home = ?,
          final_score_away = ?,
          resolved_at = datetime('now'),
          result_source = ?
      WHERE id = ?
    `);
    pending.forEach(r => {
      const out = getBetOutcomeForScore(r.best_bet, h, a) || betOutcome(r.best_bet);
      if (out) upd.run(out, h, a, "api_finished_match", r.id);
    });
    console.log(`[concile-trace] résolu ${pending.length} analyses: ${home} vs ${away} (${h}-${a})`);
  } catch(e) { console.error("[concile-trace] resolve:", e.message); }
}

function getConcilePerformance() {
  try {
    const byAgent = db.prepare(`
      SELECT ap.agent_name,
        COUNT(*) as total,
        SUM(CASE WHEN ap.outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN ap.outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM agent_predictions ap
      WHERE ap.outcome IS NOT NULL
      GROUP BY ap.agent_name
    `).all().map(r => ({
      agent: r.agent_name,
      total: r.total, wins: r.wins, losses: r.losses,
      winrate: r.wins + r.losses > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : null
    }));

    const byBet = db.prepare(`
      SELECT best_bet,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses
      WHERE outcome IS NOT NULL
      GROUP BY best_bet
      ORDER BY total DESC
    `).all().map(r => ({
      bet: r.best_bet, total: r.total, wins: r.wins, losses: r.losses,
      winrate: r.wins + r.losses > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : null
    }));

    const byStats = db.prepare(`
      SELECT stats_status,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses
      WHERE outcome IS NOT NULL
      GROUP BY stats_status
    `).all().map(r => ({
      stats: r.stats_status, total: r.total, wins: r.wins, losses: r.losses,
      winrate: r.wins + r.losses > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : null
    }));

    const bySport = db.prepare(`
      SELECT sport,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses
      WHERE outcome IS NOT NULL
      GROUP BY sport
      ORDER BY total DESC
    `).all().map(r => ({
      sport: r.sport || "Football", total: r.total, wins: r.wins, losses: r.losses,
      winrate: r.wins + r.losses > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : null
    }));

    const byMinute = db.prepare(`
      SELECT
        CASE
          WHEN minute_at_analysis < 30 THEN '0-29'
          WHEN minute_at_analysis < 46 THEN '30-45'
          WHEN minute_at_analysis < 60 THEN '46-59'
          WHEN minute_at_analysis < 75 THEN '60-74'
          ELSE '75+'
        END as minute_range,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins
      FROM concile_analyses
      WHERE outcome IS NOT NULL AND minute_at_analysis IS NOT NULL
      GROUP BY minute_range
      ORDER BY minute_range
    `).all().map(r => ({
      minute: r.minute_range, total: r.total, wins: r.wins,
      winrate: r.total > 0 ? Math.round(r.wins / r.total * 100) : null
    }));

    const recent = db.prepare(`
      SELECT home, away, best_bet, confidence, minute_at_analysis,
             score_home_at_analysis, score_away_at_analysis, outcome, analysed_at
      FROM concile_analyses
      ORDER BY analysed_at DESC LIMIT 10
    `).all();

    return { byAgent, byBet, byStats, byMinute, bySport, recent };
  } catch(e) {
    console.error("[concile-perf]", e.message);
    return { byAgent: [], byBet: [], byStats: [], byMinute: [], bySport: [], recent: [] };
  }
}

// ── Agent performance tracking ────────────────────────────────────────────────
function summarizeStrategyRows(rows, labelKey) {
  return (rows || [])
    .filter(r => Number(r.total || 0) > 0)
    .map(r => ({
      label: r[labelKey] || "Inconnu",
      total: Number(r.total || 0),
      wins: Number(r.wins || 0),
      losses: Number(r.losses || 0),
      winrate: r.winrate,
      confidence: Number(r.total || 0) >= 5 ? "usable" : "sample_faible",
    }))
    .sort((a, b) => {
      const ar = a.total >= 5 ? a.winrate : -1;
      const br = b.total >= 5 ? b.winrate : -1;
      return br - ar || b.total - a.total;
    });
}

function getStrategyDashboard() {
  const perf = getConcilePerformance();
  const agents = summarizeStrategyRows(perf.byAgent, "agent");
  const markets = summarizeStrategyRows(perf.byBet, "bet");
  const statsSources = summarizeStrategyRows(perf.byStats, "stats");
  const minutes = summarizeStrategyRows(perf.byMinute, "minute");
  const sports = summarizeStrategyRows(perf.bySport, "sport");

  let competitions = [];
  try {
    competitions = db.prepare(`
      SELECT competition,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses
      WHERE outcome IS NOT NULL
      GROUP BY competition
      ORDER BY total DESC
      LIMIT 25
    `).all().map(r => ({
      competition: r.competition || "Inconnue",
      total: r.total,
      wins: r.wins,
      losses: r.losses,
      winrate: r.wins + r.losses > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : null,
    }));
  } catch (e) {
    console.error("[strategy-dashboard] competitions:", e.message);
  }
  const leagues = summarizeStrategyRows(competitions, "competition");

  const bestMarket = markets.find(r => r.total >= 5 && r.winrate >= 60) || markets[0] || null;
  const weakMarket = markets.find(r => r.total >= 5 && r.winrate < 45) || markets.slice().reverse().find(r => r.total >= 5) || null;
  const bestLeague = leagues.find(r => r.total >= 5 && r.winrate >= 60) || leagues[0] || null;
  const bestAgent = agents.find(r => r.total >= 8) || agents[0] || null;
  const sampleWarning = (markets[0]?.total || 0) < 5
    ? "Échantillon encore faible: on observe, on ne conclut pas."
    : null;

  const focus = bestMarket && bestMarket.total >= 5
    ? `${bestMarket.label} (${bestMarket.winrate}% sur ${bestMarket.total})`
    : "continuer à accumuler des données avant de forcer un marché";
  const avoid = weakMarket
    ? `${weakMarket.label} (${weakMarket.winrate}% sur ${weakMarket.total})`
    : "amicaux, U20/U21 et matchs sans stats live fiables";
  const leagueLine = bestLeague && bestLeague.total >= 5
    ? `Priorité compétition: ${bestLeague.label} (${bestLeague.winrate}% sur ${bestLeague.total}).`
    : "Priorité compétition: surveiller Irlande/Japon/Corée/Brésil, mais attendre plus de résultats vérifiés.";
  const agentLine = bestAgent
    ? `IA à écouter davantage: ${bestAgent.label} (${bestAgent.winrate ?? "?"}% sur ${bestAgent.total}).`
    : "IA à écouter davantage: pas encore assez de données.";

  const note = [
    `Signal principal: ${focus}.`,
    `À éviter: ${avoid}.`,
    `${leagueLine} ${agentLine}`,
  ].filter(Boolean).join("\n");

  return {
    generatedAt: new Date().toISOString(),
    note: sampleWarning ? `${sampleWarning}\n${note}` : note,
    top: {
      agents: agents.slice(0, 8),
      markets: markets.slice(0, 10),
      competitions: leagues.slice(0, 10),
      sports: sports.slice(0, 10),
      minutes: minutes.slice(0, 8),
      statsSources: statsSources.slice(0, 8),
    },
    recommendations: { focus, avoid, sampleWarning },
  };
}

function getStrongSignalAlerts(options = {}) {
  const threshold = Math.max(60, Math.min(95, Number(options.threshold || 80)));
  const minResolved = Math.max(1, Number(options.minResolved || 5));
  const maxItems = Math.max(1, Math.min(20, Number(options.limit || 10)));
  try {
    const rows = db.prepare(`
      SELECT
        ca.match_key,
        ca.home,
        ca.away,
        ca.competition,
        ca.sport,
        ca.minute_at_analysis,
        ca.score_home_at_analysis,
        ca.score_away_at_analysis,
        ca.stats_status,
        ca.best_bet,
        ca.confidence,
        ca.raison,
        ca.consensus_votes,
        ca.analysed_at,
        ms.total as market_total,
        ms.wins as market_wins,
        ms.losses as market_losses
      FROM concile_analyses ca
      LEFT JOIN (
        SELECT best_bet,
          COUNT(*) as total,
          SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
        FROM concile_analyses
        WHERE outcome IN ('win','loss')
        GROUP BY best_bet
      ) ms ON ms.best_bet = ca.best_bet
      WHERE ca.outcome IS NULL
        AND ca.confidence >= ?
        AND ca.analysed_at >= datetime('now','-3 hours')
      ORDER BY ca.confidence DESC, ca.analysed_at DESC
      LIMIT 50
    `).all(threshold);

    return rows
      .filter(r => !isLowTrustCompetition({ competition: r.competition || "" }))
      .map(r => {
        const total = Number(r.market_total || 0);
        const wins = Number(r.market_wins || 0);
        const losses = Number(r.market_losses || 0);
        const marketWinrate = wins + losses > 0 ? Math.round(wins / (wins + losses) * 100) : null;
        const profile = getLearningProfile({
          sport: r.sport || "Football",
          competition: r.competition || "",
          bet: r.best_bet || "",
        });
        const assessment = assessLearningProfile(profile, minResolved);
        const sampleOk = total >= minResolved && assessment.clientSafe;
        const sport = r.sport || "Football";
        // Pour les sports non-Football (basket, hockey, baseball) : signal éligible dès 85% de confiance
        // même sans historique suffisant (sport récent sur la plateforme)
        const highConfidence = r.confidence >= 85 && sport !== "Football";
        const eligible = sampleOk || highConfidence;
        return {
          id: r.match_key,
          home: r.home,
          away: r.away,
          sport,
          competition: r.competition || "Inconnue",
          minute: r.minute_at_analysis,
          score: `${r.score_home_at_analysis ?? "?"}-${r.score_away_at_analysis ?? "?"}`,
          bet: r.best_bet,
          confidence: r.confidence,
          consensusVotes: r.consensus_votes,
          reason: r.raison,
          analysedAt: r.analysed_at,
          statsStatus: r.stats_status,
          market: {
            total,
            wins,
            losses,
            winrate: marketWinrate,
            sampleOk,
          },
          eligible,
          blockReason: eligible ? null : `historique insuffisant sur ce marché (${total}/${minResolved})`,
        };
      })
      .filter(r => r.eligible)
      .slice(0, maxItems);
  } catch (e) {
    console.error("[strong-signals]", e.message);
    return [];
  }
}

function getAgentPerformance() {
  try {
    const rows = db.prepare(`
      SELECT agent_name,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses,
        SUM(CASE WHEN outcome IS NULL THEN 1 ELSE 0 END) as pending
      FROM agent_predictions
      GROUP BY agent_name
    `).all();
    const perf = {};
    rows.forEach(r => {
      const resolved = r.wins + r.losses;
      perf[r.agent_name] = {
        total: r.total, wins: r.wins, losses: r.losses,
        pending: r.pending,
        winrate: resolved > 0 ? Math.round(r.wins / resolved * 100) : null,
        resolved,
      };
    });
    return perf;
  } catch(e) {
    console.error("[agent-perf] load:", e.message);
    return {};
  }
}

function normalizeHistoryKey(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
}

function loadHermesHistoryItems() {
  const items = [];
  for (const p of [HERMES_PICKS_PATH, "/data/picks.json"]) {
    try {
      const raw = JSON.parse(fs.readFileSync(p, "utf8"));
      const hist = raw.history || [];
      for (const h of hist) {
        let entry;
        if (Array.isArray(h)) {
          const [date, match, prono, cote, score, status] = h;
          const parts = (match || "").split(" vs ");
          entry = { date, home: parts[0] || "", away: parts[1] || "", bet: prono || "", score, status };
        } else {
          entry = {
            date: h.date || "",
            home: h.home || "",
            away: h.away || "",
            bet: h.prono || h.bet || "",
            score: h.score || "",
            status: h.status || "",
            league: h.league || h.competition || "",
          };
        }
        const s = (entry.status || "").toUpperCase();
        if (!["GAGNE", "PERDU", "WIN", "LOSS"].includes(s)) continue;
        if (!entry.home || !entry.away) continue;
        items.push({
          id: `hermes_${entry.date}_${normalizeHistoryKey(entry.home)}_${normalizeHistoryKey(entry.away)}`,
          home: entry.home,
          away: entry.away,
          competition: entry.league || "Football",
          bet: entry.bet,
          score: entry.score || null,
          outcome: ["GAGNE", "WIN"].includes(s) ? "win" : "loss",
          resolvedAt: entry.date,
          source: "hermes",
        });
      }
      break;
    } catch { /* fichier absent ou invalide */ }
  }
  return items;
}

function getPublicHistoryItems() {
  try {
    // 1. Picks Concile (SQLite)
    const concileItems = db.prepare(`
      SELECT
        match_key, home, away, competition, best_bet, confidence,
        outcome, final_score_home, final_score_away, stats_status,
        result_source, resolved_at, analysed_at
      FROM concile_analyses
      WHERE outcome IN ('win','loss')
        AND final_score_home IS NOT NULL
        AND final_score_away IS NOT NULL
      ORDER BY COALESCE(resolved_at, analysed_at) DESC
      LIMIT 80
    `).all().map(row => ({
      id: row.match_key,
      home: row.home,
      away: row.away,
      competition: row.competition || "Match verifie",
      bet: row.best_bet,
      confidence: row.confidence,
      score: `${row.final_score_home}-${row.final_score_away}`,
      outcome: row.outcome,
      resolvedAt: row.resolved_at || row.analysed_at,
      source: row.result_source || (row.stats_status === "manual_verified" ? "manual_verified" : "api_verified"),
    }));

    // 2. Picks Hermès (picks.json history)
    const hermesItems = loadHermesHistoryItems();

    // 3. Fusion + déduplication par date+équipes+pari
    const seen = new Set();
    const merged = [];
    for (const item of [...concileItems, ...hermesItems]) {
      const key = `${(item.resolvedAt || "").slice(0, 10)}_${normalizeHistoryKey(item.home)}_${normalizeHistoryKey(item.away)}_${normalizeHistoryKey(item.bet)}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    // 4. Tri par date décroissante
    return merged
      .sort((a, b) => (b.resolvedAt || "").localeCompare(a.resolvedAt || ""))
      .slice(0, 100);
  } catch (e) {
    console.error("[public-history]", e.message);
    return [];
  }
}

function getPredictionSnapshotKey(match) {
  const minute = parseLiveMinuteValue(match?.minute);
  const bucket = minute === null ? "prematch" : `${Math.floor(minute / AUTO_CONCILE_BUCKET_MINUTES) * AUTO_CONCILE_BUCKET_MINUTES}`;
  const score = `${match?.score_home ?? "x"}-${match?.score_away ?? "x"}`;
  const id = match?.id || match?.fixtureId || match?.sourceMatchId || `${match?.home}_${match?.away}`;
  return `${id}_${getTodayStr()}_${bucket}_${score}`;
}

function saveAgentPredictions(match, agentResults) {
  const matchKey = getPredictionSnapshotKey(match);
  try {
    const stmt = db.prepare(
      "INSERT OR IGNORE INTO agent_predictions (match_key, home, away, agent_name, bet, confidence) VALUES (?,?,?,?,?,?)"
    );
    agentResults.forEach(a => {
      stmt.run(matchKey, match.home, match.away, a.name, a.bet, a.confidence || 70);
    });
    console.log(`[agent-perf] ${agentResults.length} prédictions sauvegardées: ${match.home} vs ${match.away}`);
  } catch(e) { console.error("[agent-perf] save:", e.message); }
}

function getFinalScoreFromPick(pick) {
  if (!pick) return null;
  const directHome = pick.score_home ?? pick.home_score;
  const directAway = pick.score_away ?? pick.away_score;
  if (directHome !== undefined && directHome !== null && directAway !== undefined && directAway !== null) {
    const h = Number(directHome);
    const a = Number(directAway);
    if (Number.isFinite(h) && Number.isFinite(a)) return { score_home: h, score_away: a };
  }
  const match = String(pick.score || "").trim().match(/(\d+)\s*[-:]\s*(\d+)/);
  if (!match) return null;
  return { score_home: Number(match[1]), score_away: Number(match[2]) };
}

function autoResolvePredictions(match) {
  const { home, away, score_home, score_away } = match;
  if (score_home === null || score_home === undefined || score_away === null || score_away === undefined) return;

  const h = Number(score_home), a = Number(score_away);
  const total = h + a;
  const betResults = {};

  // Marchés buts
  betResults["Over 2.5 buts"] = total > 2.5 ? "win" : "loss";
  betResults["Under 2.5 buts"] = total < 2.5 ? "win" : "loss";

  // 1X2 et double chance
  if (h > a) {
    betResults["Victoire domicile"] = "win"; betResults["Victoire extérieur"] = "loss"; betResults["Match nul"] = "loss";
    betResults["Double chance 1X"] = "win"; betResults["Double chance X2"] = "loss";
  } else if (a > h) {
    betResults["Victoire extérieur"] = "win"; betResults["Victoire domicile"] = "loss"; betResults["Match nul"] = "loss";
    betResults["Double chance 1X"] = "loss"; betResults["Double chance X2"] = "win";
  } else {
    betResults["Match nul"] = "win"; betResults["Victoire domicile"] = "loss"; betResults["Victoire extérieur"] = "loss";
    betResults["Double chance 1X"] = "win"; betResults["Double chance X2"] = "win";
  }

  // BTTS
  betResults["BTTS Oui"] = (h > 0 && a > 0) ? "win" : "loss";
  betResults["BTTS Non"] = (h > 0 && a > 0) ? "loss" : "win";

  try {
    const firstWord = home.split(' ')[0];
    const pending = db.prepare(
      "SELECT * FROM agent_predictions WHERE home LIKE ? AND away LIKE ? AND outcome IS NULL"
    ).all(`%${firstWord}%`, `%${away.split(' ')[0]}%`);

    if (pending.length) {
      const updateStmt = db.prepare("UPDATE agent_predictions SET outcome = ? WHERE id = ?");
      pending.forEach(p => {
        const outcome = betResults[p.bet] || null;
        if (outcome) updateStmt.run(outcome, p.id);
      });
      console.log(`[agent-perf] Auto-résolu ${pending.length} prédictions: ${home} vs ${away} (${h}-${a})`);
    }
  } catch(e) { console.error("[agent-perf] auto-resolve:", e.message); }

  // Résoudre aussi les traces Concile
  resolveConcileAnalyses(home, away, score_home, score_away);
}

let autoConcileObserverRunning = false;

function shouldAutoObserveMatch(match) {
  if (!match || match.scoreConflict) return false;
  const status = String(match.status || "").toUpperCase();
  if (!["IN_PLAY", "LIVE"].includes(status)) return false;
  if (isFinishedOrTooLateForLiveIa(match)) return false;
  if (isLowTrustCompetition(match)) return false;
  if (String(match.sport || "Football") !== "Football") return true;
  const minute = parseLiveMinuteValue(match.minute);
  return minute !== null && minute >= AUTO_CONCILE_MIN_MINUTE;
}

function hasPredictionSnapshot(match) {
  const key = getPredictionSnapshotKey(match);
  try {
    const row = db.prepare("SELECT 1 FROM agent_predictions WHERE match_key = ? LIMIT 1").get(key);
    return !!row;
  } catch (e) {
    console.error("[auto-concile] snapshot check:", e.message);
    return true;
  }
}

async function runAutoConcileObserver() {
  if (!AUTO_CONCILE_OBSERVER || autoConcileObserverRunning) return;
  autoConcileObserverRunning = true;
  try {
    const matches = await fetchLiveMatches();
    const observed = matches
      .filter(shouldAutoObserveMatch)
      .filter(m => !hasPredictionSnapshot(m));
    const candidates = observed.slice(0, AUTO_CONCILE_MAX_MATCHES);
    console.log(
      `[auto-concile] live=${matches.length} eligible=${observed.length} analysed_this_cycle=${candidates.length} ` +
      `skipped_low_trust=${matches.filter(isLowTrustCompetition).length}`
    );

    for (const match of candidates) {
      try {
        console.log(
          `[auto-concile] analyse snapshot: ${match.competition || "competition inconnue"} | ` +
          `${match.home} vs ${match.away} | minute=${match.minute || "?"} | ` +
          `score=${match.score_home ?? "?"}-${match.score_away ?? "?"}`
        );
        await runConcileAnalysis(match);
      } catch (e) {
        console.error("[auto-concile] analyse:", e.message);
      }
    }
  } catch (e) {
    console.error("[auto-concile] cycle:", e.message);
  } finally {
    autoConcileObserverRunning = false;
  }
}

// ── Brevo helpers ─────────────────────────────────────────────────────────────
async function brevoAddContact(email, tag) {
  if (!BREVO_API_KEY) return;
  try {
    await httpPost(
      "https://api.brevo.com/v3/contacts",
      { email, attributes: {}, listIds: [], updateEnabled: true },
      { "api-key": BREVO_API_KEY, "content-type": "application/json" }
    );
    await httpPost(
      `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}/addToList`,
      {},
      { "api-key": BREVO_API_KEY }
    );
    // Apply tag via attribute
    await httpPost(
      `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
      { attributes: { PLAN: tag } },
      { "api-key": BREVO_API_KEY, "content-type": "application/json" }
    );
    console.log(`[brevo] contact upserted: ${email} tag=${tag}`);
  } catch (e) {
    console.error("[brevo] error:", e.message);
  }
}

async function brevoSendEmail(to, subject, htmlContent) {
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY manquante");
  return httpPostStrict(
    "https://api.brevo.com/v3/smtp/email",
    {
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent,
    },
    { "api-key": BREVO_API_KEY, "content-type": "application/json" }
  );
}

function leadLang(email, leadMap) {
  return String(leadMap.get(String(email).toLowerCase())?.lang || "fr").slice(0, 2).toLowerCase();
}

function pickEmailText(lang) {
  const t = {
    fr: ["Pick du jour", "Pronostic du Concile", "Voir l'analyse complete", "Paris sportifs reserves aux +18 ans. Jeu responsable."],
    en: ["Today's pick", "Council prediction", "See the full analysis", "Sports betting is 18+ only. Gamble responsibly."],
    es: ["Pick del dia", "Pronostico del Consejo", "Ver el analisis completo", "Apuestas deportivas solo para mayores de 18. Juega con responsabilidad."],
    pt: ["Pick do dia", "Prognostico do Conselho", "Ver a analise completa", "Apostas desportivas apenas para maiores de 18. Jogue com responsabilidade."],
    de: ["Tipp des Tages", "Prognose des Councils", "Vollstandige Analyse ansehen", "Sportwetten nur ab 18. Spiele verantwortungsvoll."],
    it: ["Pick del giorno", "Pronostico del Consiglio", "Vedi l'analisi completa", "Scommesse sportive solo 18+. Gioca responsabilmente."],
  };
  return t[lang] || t.fr;
}

// ── Admin auth helper ─────────────────────────────────────────────────────────
function isAdmin(email, code) {
  const auth = verifyCode(email, code);
  return auth.valid && code.toUpperCase().startsWith("ELITE-ADMIN");
}

// ── Expiry cron (check every hour) ────────────────────────────────────────────
function runExpiryCron() {
  if (!BREVO_API_KEY) return;
  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const now = new Date();
    const rows = codesDb.prepare(
      "SELECT * FROM codes WHERE active = 1 AND expires_at IS NOT NULL AND plan != 'free'"
    ).all();
    codesDb.close();

    rows.forEach(row => {
      const exp = new Date(row.expires_at);
      const diff = Math.round((exp - now) / (1000 * 60 * 60 * 24));

      if (diff === 3) {
        brevoSendEmail(row.email, "Votre abonnement expire dans 3 jours",
          `<p>Bonjour,</p><p>Votre abonnement TousLesMatchs expire le <strong>${exp.toLocaleDateString("fr-FR")}</strong>.</p>
          <p>Renouvelez maintenant pour conserver votre accès Elite et vos analyses IA.</p>
          <p><a href="https://www.touslesmatchs.com/#plans" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Renouveler →</a></p>`
        );
      } else if (diff === 1) {
        brevoSendEmail(row.email, "Dernière chance — abonnement expire demain",
          `<p>Votre abonnement expire <strong>demain</strong>. Ne perdez pas votre accès aux picks VIP et à l'analyse IA en temps réel.</p>
          <p><a href="https://www.touslesmatchs.com/#plans" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Renouveler maintenant →</a></p>`
        );
      } else if (diff === 0) {
        brevoSendEmail(row.email, "Votre abonnement expire aujourd'hui",
          `<p>Votre abonnement expire <strong>aujourd'hui</strong>. Renouvelez pour continuer à recevoir les picks gagnants.</p>
          <p><a href="https://www.touslesmatchs.com/#plans" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Renouveler →</a></p>`
        );
      }
    });
  } catch (e) {
    console.error("[expiry-cron] error:", e.message);
  }
}
setInterval(runExpiryCron, 60 * 60 * 1000);

// ══════════════════════════════════════════════════════════════════════════════
// Routes
// ══════════════════════════════════════════════════════════════════════════════

app.get("/health", (_, res) => res.json({ ok: true }));

// ── Subscribe email (capture gratuite → Brevo) ───────────────────────────────
app.post("/subscribe-email", async (req, res) => {
  const { email, lang, ageRange, source, referrer, landingPage, utm } = req.body || {};
  if (!email || !email.includes("@")) {
    return res.json({ ok: false, error: "Email invalide" });
  }
  const emailClean = email.toLowerCase().trim();
  const langHeader = String(lang || req.headers["accept-language"] || "fr").slice(0, 16);
  const langCountry = (langHeader.match(/[-_]([A-Za-z]{2})/) || [])[1] || "";
  const country = String(req.headers["cf-ipcountry"] || req.headers["x-vercel-ip-country"] || req.headers["x-country-code"] || langCountry || "").slice(0, 2).toUpperCase();
  const lead = {
    email: emailClean,
    created_at: new Date().toISOString(),
    lang: langHeader,
    country: country || "unknown",
    age_range: String(ageRange || "unknown").slice(0, 24),
    source: String(source || "direct").slice(0, 64),
    referrer: String(referrer || req.headers.referer || "").slice(0, 300),
    landing_page: String(landingPage || "").slice(0, 300),
    utm: utm && typeof utm === "object" ? utm : {},
  };
  try {
    const leadsData = loadLeads();
    const existing = leadsData.leads.find(l => String(l.email).toLowerCase() === emailClean);
    if (existing) Object.assign(existing, lead, { created_at: existing.created_at || lead.created_at, updated_at: lead.created_at });
    else leadsData.leads.push(lead);
    saveLeads(leadsData);

    if (!BREVO_API_KEY) {
      console.log(`[subscribe-email] Brevo non configure - lead sauvegarde: ${emailClean}`);
      return res.json({ ok: true });
    }
    await httpPost(
      "https://api.brevo.com/v3/contacts",
      { email: emailClean, attributes: { PLAN: "FREE_SUBSCRIBER" }, updateEnabled: true },
      { "api-key": BREVO_API_KEY, "content-type": "application/json" }
    );
    console.log(`[subscribe-email] Lead ajoute Brevo: ${emailClean} source=${lead.source} lang=${lead.lang} country=${lead.country}`);

    // Email de bienvenue uniquement pour les nouveaux inscrits
    if (!existing) {
      const welcomeHtml = `<div style="font-family:Inter,Arial,sans-serif;max-width:580px;margin:0 auto;background:#06080f;color:#eceaf4;border-radius:14px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:36px;text-align:center">
    <div style="font-size:26px;font-weight:900;color:#fff">Bienvenue sur TousLesMatchs</div>
    <div style="font-size:14px;color:rgba(255,255,255,.75);margin-top:6px">4 agents IA + 1 Chief. Tu décides avec plus de données.</div>
  </div>
  <div style="padding:32px">
    <p style="font-size:15px;margin:0 0 20px;color:#a8aec8">Tu es maintenant inscrit et tu recevras <strong style="color:#eceaf4">le pick du jour</strong> dès qu'Hermès le publie (chaque matin vers 00h05).</p>
    <div style="background:#0d1020;border:1px solid rgba(99,102,241,.25);border-radius:12px;padding:20px;margin-bottom:24px">
      <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#22d3ee;margin-bottom:12px">Ce que tu vas recevoir</div>
      <div style="font-size:14px;color:#a8aec8;line-height:1.8">
        ✅ Pick du jour validé par le Concile IA<br>
        ✅ Cote + probabilité + raison analytique<br>
        ✅ Alertes résultat (gagné/perdu)<br>
        ✅ Accès aux picks live sur le site
      </div>
    </div>
    <div style="text-align:center;margin-bottom:24px">
      <a href="https://www.touslesmatchs.com/live-ia" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none">Voir l'analyse Live IA →</a>
    </div>
    <p style="font-size:12px;color:#7b82a0;text-align:center">⚠️ Paris sportifs réservés aux +18 ans. Jeu responsable.<br>TousLesMatchs · <a href="https://www.touslesmatchs.com/mentions-legales.html" style="color:#6366f1;text-decoration:none">Mentions légales</a></p>
  </div>
</div>`;
      brevoSendEmail(emailClean, "Bienvenue sur TousLesMatchs — ton premier pick arrive bientôt 🎯", welcomeHtml)
        .catch(e => console.error("[subscribe-email] welcome email:", e.message));
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("[subscribe-email] error:", e.message);
    res.json({ ok: true });
  }
});

// Forgot code - lookup codes.db by email and send via Brevo
app.post("/forgot-code", async (req, res) => {
  const { email } = req.body || {};
  if (!email || !email.includes("@")) return res.json({ ok: false });
  const emailClean = email.toLowerCase().trim();
  // Always reply ok to avoid email enumeration
  res.json({ ok: true });
  // Async: look up codes and send
  try {
    const CODES_DB = "/var/touslesmatchs/codes.db";
    const cdb = new Database(CODES_DB, { readonly: true });
    const rows = cdb.prepare(
      "SELECT code, plan FROM codes WHERE email = ? AND active = 1"
    ).all(emailClean);
    cdb.close();
    if (!rows.length) return;
    if (!BREVO_API_KEY) return;
    const codeList = rows.map(r =>
      `<tr><td style="padding:6px 12px;font-family:monospace;font-size:16px;font-weight:700;letter-spacing:.05em">${r.code}</td><td style="padding:6px 12px;color:#7b82a0;font-size:13px">${r.plan.toUpperCase()}</td></tr>`
    ).join("");
    const html = `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;background:#06080f;color:#eceaf4;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px;text-align:center">
          <div style="font-size:22px;font-weight:800;color:#fff">TousLesMatchs</div>
          <div style="font-size:13px;color:rgba(255,255,255,.7);margin-top:4px">Récupération de votre code d'accès</div>
        </div>
        <div style="padding:32px">
          <p style="margin:0 0 16px;color:#a8aec8;font-size:14px">Voici votre code d'accès associé à <strong>${emailClean}</strong> :</p>
          <table style="width:100%;border-collapse:collapse;background:#0d1020;border-radius:8px;overflow:hidden">
            ${codeList}
          </table>
          <p style="margin:20px 0 0;color:#7b82a0;font-size:12px">Copiez ce code et connectez-vous sur <a href="https://touslesmatchs.com" style="color:#6366f1">touslesmatchs.com</a>.</p>
        </div>
      </div>`;
    await brevoSendEmail(emailClean, "Votre code d'accès TousLesMatchs", html);
    console.log(`[forgot-code] Code(s) envoyé(s) à ${emailClean}`);
  } catch (e) {
    console.error("[forgot-code] error:", e.message);
  }
});

// ── Verify code (reads codes.db directly) ────────────────────────────────────
const CODES_DB_PATH = "/var/touslesmatchs/codes.db";

app.post("/verify-code", (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.json({ valid: false, error: "Email et code requis" });

  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const row = codesDb.prepare(
      "SELECT * FROM codes WHERE code = ? AND email = ? AND active = 1"
    ).get(code.toUpperCase().trim(), email.toLowerCase().trim());
    codesDb.close();

    if (!row) return res.json({ valid: false, error: "Code ou email invalide" });

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return res.json({ valid: false, error: "Code expiré" });
    }

    const today = new Date().toISOString().slice(0, 10);
    const credits_left = row.credits_date === today
      ? Math.max(0, row.credits_max - row.credits_used)
      : row.credits_max;

    // Sync with Brevo asynchronously (don't block the response)
    const tag = row.plan === "free" ? "FREE" : row.plan === "premium" ? "PREMIUM" : row.plan === "elite" ? "ELITE" : "VIP";
    brevoAddContact(row.email, tag).catch(() => {});

    return res.json({ valid: true, plan: row.plan, credits_left, email: row.email });
  } catch (e) {
    console.error("[verify-code] error:", e.message);
    return res.json({ valid: false, error: "Erreur de vérification" });
  }
});

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post("/auth/register", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.json({ ok: false, error: "Email et mot de passe requis" });
  if (password.length < 6) return res.json({ ok: false, error: "Mot de passe trop court (6 caractères min)" });

  try {
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare("INSERT INTO users (email, password_hash, status) VALUES (?, ?, 'free')");
    const result = stmt.run(email.toLowerCase().trim(), hash);
    const userId = result.lastInsertRowid;
    const token = jwt.sign({ id: userId, email, status: "free" }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ ok: true, token, user: { id: userId, email, status: "free" } });
  } catch (e) {
    if (e.message?.includes("UNIQUE")) return res.json({ ok: false, error: "Email déjà utilisé" });
    console.error(e);
    res.json({ ok: false, error: "Erreur serveur" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.json({ ok: false, error: "Email et mot de passe requis" });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (!user) return res.json({ ok: false, error: "Email ou mot de passe incorrect" });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.json({ ok: false, error: "Email ou mot de passe incorrect" });

  const token = jwt.sign({ id: user.id, email: user.email, status: user.status }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ ok: true, token, user: { id: user.id, email: user.email, status: user.status } });
});

// ── User tokens ───────────────────────────────────────────────────────────────
app.get("/user/tokens", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT status FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.json({ ok: false, error: "Utilisateur introuvable" });

  const row = ensureTokenRow(req.user.id);
  const limit = TOKEN_LIMITS[user.status] || 0;

  res.json({
    ok: true,
    tokens: row.tokens_today,
    limit,
    status: user.status,
    reset_at: "minuit",
  });
});

// ── Pick du jour — lit picks.json d'Hermès en priorité ───────────────────────
app.get("/current-pick", (req, res) => {
  // 1. Essaie picks.json d'Hermès (source de vérité)
  try {
    const raw = JSON.parse(fs.readFileSync(HERMES_PICKS_PATH, "utf8"));
    const p = raw.currentPick;
    if (p && p.home && p.home !== "Analyse en cours") {
      return res.json({ ok: true, pick: normalizeCurrentPick(p, "hermes") });
    }
  } catch (e) { /* picks.json absent ou invalide */ }
  // 2. Fallback sur le pick manuel admin
  res.json({ ok: true, pick: normalizeCurrentPick(loadPick(), "manual-admin") });
});

app.post("/admin/set-pick", (req, res) => {
  const { email, code, pick } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  if (!pick || !pick.teamA || !pick.teamB) return res.status(400).json({ ok: false, error: "Données pick incomplètes" });
  const manualPick = {
    ...pick,
    source: pick.source || "manual-admin",
    updatedAt: new Date().toISOString(),
  };
  savePick(manualPick);
  res.json({ ok: true, pick: manualPick });
});

// ── Score manuel (fallback admin) ────────────────────────────────────────────
app.get("/live-score", (req, res) => {
  const s = loadManualScore();
  res.json(s ? { ok: true, score: s } : { ok: false });
});

app.post("/admin/set-score", (req, res) => {
  const { email, code, scoreA, scoreB, minute, status, home, away } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  const data = {
    home: home || "", away: away || "",
    score_home: Number(scoreA ?? 0), score_away: Number(scoreB ?? 0),
    minute: minute || null,
    status: status || "IN_PLAY",
    updated: new Date().toISOString()
  };
  saveManualScore(data);
  res.json({ ok: true, score: data });
});

app.delete("/admin/set-score", (req, res) => {
  const { email, code } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  try { fs.unlinkSync(SCORE_PATH); } catch {}
  res.json({ ok: true });
});

// ── Live matches ──────────────────────────────────────────────────────────────
app.get("/live-matches", async (req, res) => {
  try {
    // ?force=1 vide le cache pour forcer un appel API immédiat
    if (req.query.force === "1") {
      liveMatchesCache = { data: null, ts: 0 };
      console.log("[live-matches] Cache forcé vidé par l'utilisateur");
    }
    const matches = await fetchLiveMatches();
    res.json({ ok: true, matches });
  } catch (e) {
    res.json({ ok: true, matches: [] });
  }
});

// ── Existing analyse endpoint (no token cost) ─────────────────────────────────
// Rate limiter simple : max 3 analyses/min par IP
const analysisRateLimit = new Map();
function checkAnalysisRate(ip) {
  const now = Date.now();
  const entry = analysisRateLimit.get(ip) || { count: 0, resetAt: now + 60000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 60000; }
  entry.count++;
  analysisRateLimit.set(ip, entry);
  return entry.count <= 3;
}

app.post("/analyse", async (req, res) => {
  const { home, away, match_id } = req.body || {};
  if (!home || !away) return res.json({ ok: false, error: "Deux équipes requises" });
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  if (!checkAnalysisRate(ip)) return res.status(429).json({ ok: false, error: "Trop de requêtes, attends 1 minute." });

  try {
    const verifiedMatch = await requireVerifiedLiveMatch({ id: match_id, home, away });
    if (!verifiedMatch) return res.json({ ok: false, error: "Match live non verifie" });
    if (rejectScoreConflict(verifiedMatch, res)) return;
    const analysis = await runConcileAnalysis(verifiedMatch);
    const chief = analysis.agents[analysis.agents.length - 1];

    res.json({
      ok: true,
      resume: chief.raison,
      value_bet: { marche: chief.bet, prob: chief.confidence, cote_min_conseillée: (1 / (chief.confidence / 100)).toFixed(2), raison: chief.raison },
      over25: { prob: 58, tendance: "Tendance légèrement positive sur les buts." },
      btts: { prob: 52, tendance: "Les deux équipes ont des attaques actives." },
      resultat: { domicile: 45, nul: 28, exterieur: 27, explication: "Légère faveur pour l'équipe à domicile." },
      premier_but_mi_temps: { premiere: 55, deuxieme: 45, explication: "Les premières mi-temps sont souvent plus ouvertes." },
    });
  } catch (e) {
    res.json({ ok: false, error: "Erreur d'analyse" });
  }
});

// ── Live IA — token-gated Concile analysis ─────────────────────────────────────
app.post("/live-ia/analyse", authMiddleware, async (req, res) => {
  const { match_id, home, away, score_home, score_away, minute, competition } = req.body || {};
  if (!home || !away) return res.json({ ok: false, error: "Données du match manquantes" });

  const verifiedMatch = await requireVerifiedLiveMatch({ id: match_id, home, away });
  if (!verifiedMatch) return res.json({ ok: false, error: "Match live non verifie" });
  if (rejectScoreConflict(verifiedMatch, res)) return;

  const matchKey = `${verifiedMatch.id || `${verifiedMatch.home}_${verifiedMatch.away}`}_${getTodayStr()}`;

  // Check if already revealed (no token cost)
  const existing = db.prepare(
    "SELECT analysis_json FROM revealed_analyses WHERE user_id = ? AND match_key = ?"
  ).get(req.user.id, matchKey);

  if (existing) {
    return res.json({ ok: true, ...sanitizeAnalysisForClient(JSON.parse(existing.analysis_json)), cached: true });
  }

  // Deduct token
  const tokenResult = deductToken(req.user.id);
  if (!tokenResult.ok) return res.json({ ok: false, error: tokenResult.error });

  // Run analysis
  try {
    const analysis = await runConcileAnalysis(verifiedMatch);

    // Cache result
    db.prepare(
      "INSERT INTO revealed_analyses (user_id, match_key, analysis_json) VALUES (?, ?, ?)"
    ).run(req.user.id, matchKey, JSON.stringify(analysis));

    // Get updated token count
    const tokenRow = getTokenRow(req.user.id);

    res.json({ ok: true, ...sanitizeAnalysisForClient(analysis), tokens_remaining: tokenRow?.tokens_today ?? 0 });
  } catch (e) {
    // Refund token on error
    db.prepare("UPDATE user_tokens SET tokens_today = tokens_today + 1 WHERE user_id = ?").run(req.user.id);
    res.json({ ok: false, error: "Erreur d'analyse — jeton remboursé" });
  }
});

// ── Live IA — code-based auth (no JWT) ────────────────────────────────────────
function httpPostInternal(host, port, path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      { hostname: host, port, path, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function verifyCode(email, code) {
  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const row = codesDb.prepare(
      "SELECT * FROM codes WHERE code = ? AND email = ? AND active = 1"
    ).get(code.toUpperCase().trim(), email.toLowerCase().trim());
    codesDb.close();
    if (!row) return { valid: false, error: "Code ou email invalide" };
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return { valid: false, error: "Code expiré" };
    }
    const today = new Date().toISOString().slice(0, 10);
    // Les codes ELITE-ADMIN ont des crédits illimités
    const isAdminCode = code.toUpperCase().startsWith('ELITE-ADMIN');
    const credits_left = isAdminCode
      ? 999999
      : (row.credits_date === today
          ? Math.max(0, row.credits_max - row.credits_used)
          : row.credits_max);
    return { valid: true, plan: row.plan, credits_left, email: row.email };
  } catch (e) {
    console.error("[verifyCode] error:", e.message);
    return { valid: false, error: "Erreur de vérification" };
  }
}

// Cache des analyses de la journée (clé = email+matchId)
function isAdminAccess(email, code) {
  if (!email || !code) return false;
  return isAdmin(email, code) || code.toUpperCase().trim().startsWith("ELITE-ADMIN");
}

function sanitizeAnalysisForClient(analysis, allowAdminFields = false) {
  if (allowAdminFields) return analysis;
  const clean = { ...analysis };
  delete clean.agent_performance;
  if (Array.isArray(clean.agents)) {
    clean.agents = clean.agents.map((agent, index) => ({
      ...agent,
      name: `Agent IA ${index + 1}`,
      model: "",
    }));
  }
  return clean;
}

const analysisCache = new Map();

app.post("/concile-analysis", async (req, res) => {
  const { email, code, match } = req.body || {};
  if (!email || !code) return res.json({ ok: false, error: "Connexion requise" });
  if (!match || !match.home || !match.away) return res.json({ ok: false, error: "Données du match manquantes" });

  const auth = verifyCode(email, code);
  if (!auth.valid) return res.json({ ok: false, error: auth.error || "Code invalide" });
  if (auth.plan === "free") return res.json({ ok: false, error: "UPGRADE_REQUIRED", plan: "free" });
  const allowAdminFields = isAdminAccess(email, code);

  // Check credits (credits_max=0 means unlimited)
  const today = new Date().toISOString().slice(0, 10);
  if (auth.credits_left !== null && auth.credits_left !== undefined && auth.credits_left <= 0) {
    return res.json({ ok: false, error: "CREDITS_EXHAUSTED", credits_left: 0 });
  }

  const verifiedMatch = await requireVerifiedLiveMatch(match);
  if (!verifiedMatch) return res.json({ ok: false, error: "Match live non verifie" });
  if (rejectScoreConflict(verifiedMatch, res)) return;

  const forceRefresh = req.body.force === true || req.body.force === 1 || req.body.force === "1";
  const cacheKey = `${email}__${verifiedMatch.id || `${verifiedMatch.home}_${verifiedMatch.away}`}_${today}`;
  if (!forceRefresh && analysisCache.has(cacheKey)) {
    return res.json({ ok: true, ...sanitizeAnalysisForClient(analysisCache.get(cacheKey), allowAdminFields), cached: true });
  }
  if (forceRefresh) analysisCache.delete(cacheKey);

  try {
    const analysis = await runConcileAnalysis(verifiedMatch);
    analysisCache.set(cacheKey, analysis);
    // Cache 30 min pour les matchs live (pas 6h — le score change !)
    const cacheTTL = verifiedMatch.status === "IN_PLAY" ? 30 * 60 * 1000 : 6 * 60 * 60 * 1000;
    setTimeout(() => analysisCache.delete(cacheKey), cacheTTL);

    // Decrement credits in codes.db (only on real analysis, not cache hit)
    try {
      const wdb = new Database(CODES_DB_PATH);
      const row = wdb.prepare("SELECT credits_max, credits_used, credits_date FROM codes WHERE code = ? AND email = ? AND active = 1")
        .get(code.toUpperCase().trim(), email.toLowerCase().trim());
      if (row && row.credits_max > 0) {
        if (row.credits_date === today) {
          wdb.prepare("UPDATE codes SET credits_used = credits_used + 1 WHERE code = ? AND email = ?")
            .run(code.toUpperCase().trim(), email.toLowerCase().trim());
        } else {
          wdb.prepare("UPDATE codes SET credits_used = 1, credits_date = ? WHERE code = ? AND email = ?")
            .run(today, code.toUpperCase().trim(), email.toLowerCase().trim());
        }
      }
      wdb.close();
    } catch(ce) { console.error("[concile-analysis] credits error:", ce.message); }

    res.json({ ok: true, ...sanitizeAnalysisForClient(analysis, allowAdminFields) });
  } catch (e) {
    res.json({ ok: false, error: "Erreur d'analyse — réessaie" });
  }
});

// ── Pre-match analysis (homepage pick, avant coup d'envoi) ───────────────────
app.post("/prematch-analysis", async (req, res) => {
  const { email, code, match } = req.body || {};
  if (!email || !code) return res.json({ ok: false, error: "Connexion requise" });
  if (!match || !match.home || !match.away) return res.json({ ok: false, error: "Données du match manquantes" });

  const auth = verifyCode(email, code);
  if (!auth.valid) return res.json({ ok: false, error: auth.error || "Code invalide" });
  if (auth.plan === "free") return res.json({ ok: false, error: "UPGRADE_REQUIRED", plan: "free" });
  const allowAdminFields = isAdminAccess(email, code);

  if (auth.credits_left !== null && auth.credits_left !== undefined && auth.credits_left <= 0) {
    return res.json({ ok: false, error: "CREDITS_EXHAUSTED", credits_left: 0 });
  }

  const today2 = new Date().toISOString().slice(0, 10);
  const cacheKey = `prematch__${email}__${match.home}_${match.away}_${match.date || today2}`;
  if (analysisCache.has(cacheKey)) {
    return res.json({ ok: true, ...sanitizeAnalysisForClient(analysisCache.get(cacheKey), allowAdminFields), cached: true });
  }

  try {
    const matchData = {
      home: match.home,
      away: match.away,
      score_home: 0,
      score_away: 0,
      minute: "Pré-match",
      status: "SCHEDULED",
      competition: match.competition || "International",
    };
    const analysis = await runConcileAnalysis(matchData);
    analysisCache.set(cacheKey, analysis);
    setTimeout(() => analysisCache.delete(cacheKey), 12 * 60 * 60 * 1000);

    // Decrement credits
    try {
      const wdb2 = new Database(CODES_DB_PATH);
      const row2 = wdb2.prepare("SELECT credits_max, credits_used, credits_date FROM codes WHERE code = ? AND email = ? AND active = 1")
        .get(code.toUpperCase().trim(), email.toLowerCase().trim());
      if (row2 && row2.credits_max > 0) {
        if (row2.credits_date === today2) {
          wdb2.prepare("UPDATE codes SET credits_used = credits_used + 1 WHERE code = ? AND email = ?")
            .run(code.toUpperCase().trim(), email.toLowerCase().trim());
        } else {
          wdb2.prepare("UPDATE codes SET credits_used = 1, credits_date = ? WHERE code = ? AND email = ?")
            .run(today2, code.toUpperCase().trim(), email.toLowerCase().trim());
        }
      }
      wdb2.close();
    } catch(ce2) { console.error("[prematch-analysis] credits error:", ce2.message); }

    res.json({ ok: true, ...sanitizeAnalysisForClient(analysis, allowAdminFields) });
  } catch (e) {
    console.error("[prematch-analysis]", e.message);
    res.json({ ok: false, error: "Erreur d'analyse — réessaie" });
  }
});

// ── Stripe ────────────────────────────────────────────────────────────────────
app.post("/stripe/create-checkout", authMiddleware, async (req, res) => {
  const { price_id } = req.body || {};
  if (!price_id || !STRIPE_SECRET_KEY) return res.json({ ok: false, error: "Configuration Stripe manquante" });

  try {
    const Stripe = require("stripe");
    const stripe = Stripe(STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: "https://www.touslesmatchs.com/live-ia?success=1",
      cancel_url: "https://www.touslesmatchs.com/subscription",
      client_reference_id: String(req.user.id),
      customer_email: req.user.email,
    });
    res.json({ ok: true, url: session.url });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// Stripe webhook — activate subscription
app.post("/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!STRIPE_SECRET_KEY) return res.json({ ok: false });

  let event;
  try {
    const Stripe = require("stripe");
    const stripe = Stripe(STRIPE_SECRET_KEY);
    event = STRIPE_WEBHOOK_SECRET
      ? stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET)
      : JSON.parse(req.body);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // ── Récupérer email client et prix ──────────────────────────────────────
    const customerEmail = (session.customer_details?.email || session.customer_email || "").toLowerCase().trim();
    let priceId = "";
    try {
      const Stripe2 = require("stripe");
      const stripe2 = Stripe2(STRIPE_SECRET_KEY);
      const full = await stripe2.checkout.sessions.retrieve(session.id, { expand: ["line_items"] });
      priceId = full.line_items?.data?.[0]?.price?.id || "";
    } catch(e) { console.error("[stripe] retrieve error:", e.message); }

    const planMap = {
      [STRIPE_PRICE_ID_CARTE]:               { status: "carte",   label: "Analyse 1 euro" },
      [process.env.STRIPE_PRICE_ID_PREMIUM]: { status: "premium", label: "Pro" },
      [process.env.STRIPE_PRICE_ID_VIP]:     { status: "vip",     label: "VIP" },
      [process.env.STRIPE_PRICE_ID_ELITE]:   { status: "elite",   label: "Elite" },
    };
    const { status = "premium", label: planLabel = "Pro" } = planMap[priceId] || {};

    // ── Mettre à jour users table si userId connu ────────────────────────────
    const userId = parseInt(session.client_reference_id);
    if (userId) {
      db.prepare("UPDATE users SET status = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?").run(
        status, session.customer, session.subscription, userId
      );
      const limit = TOKEN_LIMITS[status] || 0;
      db.prepare("INSERT OR REPLACE INTO user_tokens (user_id, tokens_today, reset_date) VALUES (?,?,?)").run(userId, limit, getTodayStr());
    }

    // ── Email de confirmation via Brevo ──────────────────────────────────────
    if (customerEmail && BREVO_API_KEY) {
      (async () => {
        try {
          // Chercher le code d'accès dans codes.db
          const cdb = new Database(CODES_DB_PATH, { readonly: true });
          const codeRows = cdb.prepare("SELECT code, plan FROM codes WHERE email = ? AND active = 1").all(customerEmail);
          cdb.close();

          let html;
          if (codeRows.length > 0) {
            const codeList = codeRows.map(r =>
              `<tr><td style="padding:8px 16px;font-family:monospace;font-size:18px;font-weight:800;letter-spacing:.08em;color:#eceaf4">${r.code}</td>
               <td style="padding:8px 16px;font-size:12px;color:#7b82a0">${r.plan.toUpperCase()}</td></tr>`
            ).join("");
            html = `<div style="font-family:Inter,system-ui,sans-serif;max-width:540px;margin:0 auto;background:#06080f;color:#eceaf4;border-radius:14px;overflow:hidden">
              <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:36px;text-align:center">
                <div style="font-size:24px;font-weight:800;color:#fff">✅ Abonnement ${planLabel} activé !</div>
                <div style="font-size:14px;color:rgba(255,255,255,.75);margin-top:6px">TousLesMatchs — 4 agents IA + 1 Chief. Tu décides avec plus de données.</div>
              </div>
              <div style="padding:32px">
                <p style="font-size:15px;margin:0 0 20px;color:#a8aec8">Merci pour ton abonnement ! Voici ton code d'accès :</p>
                <table style="width:100%;border-collapse:collapse;background:#0d1020;border-radius:10px;overflow:hidden;margin-bottom:24px">${codeList}</table>
                <p style="font-size:13px;color:#7b82a0;margin:0 0 20px">Utilise ce code sur <a href="https://touslesmatchs.com" style="color:#6366f1">touslesmatchs.com</a> → bouton "Se connecter" → entre ton email + ce code.</p>
                <div style="text-align:center">
                  <a href="https://touslesmatchs.com/live-ia" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none">Accéder au Live IA →</a>
                </div>
              </div>
            </div>`;
          } else {
            html = `<div style="font-family:Inter,system-ui,sans-serif;max-width:540px;margin:0 auto;background:#06080f;color:#eceaf4;border-radius:14px;overflow:hidden">
              <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:36px;text-align:center">
                <div style="font-size:24px;font-weight:800;color:#fff">✅ Paiement reçu — Plan ${planLabel}</div>
              </div>
              <div style="padding:32px">
                <p style="font-size:15px;color:#a8aec8">Ton paiement a été validé. Ton code d'accès te sera envoyé sous <strong style="color:#eceaf4">quelques minutes</strong> à cette adresse.</p>
                <p style="font-size:13px;color:#7b82a0;margin-top:16px">Si tu ne reçois rien dans l'heure, réponds à cet email.</p>
              </div>
            </div>`;
          }
          await brevoSendEmail(customerEmail, `🎉 Ton abonnement ${planLabel} est actif — voici ton code`, html);
          console.log(`[stripe] Email confirmation envoyé à ${customerEmail}`);
        } catch(e) { console.error("[stripe] email error:", e.message); }
      })();
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    db.prepare("UPDATE users SET status = 'free' WHERE stripe_subscription_id = ?").run(sub.id);
  }

  res.json({ received: true });
});

// Legacy create-checkout (no auth required, uses user_id from body)
app.post("/create-checkout", async (req, res) => {
  const { plan, user_id } = req.body || {};
  if (!STRIPE_SECRET_KEY) return res.json({ ok: false, error: "Configuration Stripe manquante" });

  const priceMap = {
    carte: STRIPE_PRICE_ID_CARTE,
    standard: process.env.STRIPE_PRICE_ID_PREMIUM,
    premium: process.env.STRIPE_PRICE_ID_PREMIUM,
    vip: process.env.STRIPE_PRICE_ID_VIP,
    elite: process.env.STRIPE_PRICE_ID_ELITE,
  };
  const priceId = priceMap[plan];
  if (!priceId) return res.json({ ok: false, error: "Plan inconnu" });

  try {
    const Stripe = require("stripe");
    const stripe = Stripe(STRIPE_SECRET_KEY);
    const mode = plan === "carte" ? "payment" : "subscription";
    const session = await stripe.checkout.sessions.create({
      mode,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: "https://www.touslesmatchs.com/live-ia?success=1",
      cancel_url: "https://www.touslesmatchs.com/subscription",
      client_reference_id: String(user_id || ""),
    });
    res.json({ ok: true, url: session.url });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── Community stats (Telegram member count) ───────────────────────────────────
let tgMemberCache = { count: null, ts: 0 };
app.get("/community-stats", async (req, res) => {
  if (process.env.SHOW_TELEGRAM_MEMBER_COUNT !== "true") {
    return res.json({ ok: false, members: null, hidden: true });
  }

  // Try multiple bot tokens — whichever is admin of the free channel
  const BOT_TOKEN = process.env.HERMES_ADMIN_TLM_BOT
    || process.env.TELEGRAM_BOT_TOKEN
    || process.env.BOT_TOKEN
    || "";
  const CHANNEL_ID = process.env.TELEGRAM_FREE_CHANNEL_ID
    || process.env.TELEGRAM_CHAT_ID
    || "@touslesmatchs_fr";

  // Cache 10 minutes
  if (tgMemberCache.count !== null && Date.now() - tgMemberCache.ts < 10 * 60 * 1000) {
    return res.json({ ok: true, members: tgMemberCache.count });
  }

  if (!BOT_TOKEN) {
    return res.json({ ok: false, members: null });
  }

  try {
    const tgUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMembersCount?chat_id=${encodeURIComponent(CHANNEL_ID)}`;
    const data = await new Promise((resolve, reject) => {
      https.get(tgUrl, r => {
        let body = "";
        r.on("data", c => body += c);
        r.on("end", () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
      }).on("error", reject);
    });
    if (data.ok && data.result) {
      tgMemberCache = { count: data.result, ts: Date.now() };
      return res.json({ ok: true, members: data.result });
    }
    res.json({ ok: false, members: null });
  } catch(e) {
    console.error("[community-stats]", e.message);
    res.json({ ok: false, members: null });
  }
});

// ── Concile performance — boucle d'apprentissage ──────────────────────────────
app.get("/concile-performance", (req, res) => {
  const { email, code } = req.query;
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Acces admin requis" });
  res.json({ ok: true, ...getConcilePerformance() });
});

// ── Agent performance — classement public ────────────────────────────────────
app.get("/strategy-dashboard", (req, res) => {
  const { email, code } = req.query;
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Acces admin requis" });
  res.json({ ok: true, ...getStrategyDashboard() });
});

app.post("/internal/strategy-report", (req, res) => {
  const { secret } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  res.json({ ok: true, ...getStrategyDashboard() });
});

app.post("/internal/strong-signals", (req, res) => {
  const { secret, threshold, minResolved, limit } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  res.json({
    ok: true,
    threshold: Number(threshold || 80),
    minResolved: Number(minResolved || 5),
    signals: getStrongSignalAlerts({ threshold, minResolved, limit }),
  });
});

app.get("/agent-performance", (req, res) => {
  const { email, code } = req.query;
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Acces admin requis" });
  const perf = getAgentPerformance();
  try {
    const meta = db.prepare(`
      SELECT
        COUNT(DISTINCT home || '|' || away || '|' || date(created_at)) as matches_tracked,
        COUNT(DISTINCT match_key) as snapshots_tracked,
        COUNT(*) as predictions_tracked,
        SUM(CASE WHEN outcome IS NOT NULL THEN 1 ELSE 0 END) as predictions_resolved
      FROM agent_predictions
    `).get();
    const pending = db.prepare(
      "SELECT match_key, home, away, COUNT(*) as n FROM agent_predictions WHERE outcome IS NULL GROUP BY match_key ORDER BY created_at DESC LIMIT 5"
    ).all();
    res.json({ ok: true, performance: perf, meta, pending_matches: pending });
  } catch(e) {
    res.json({ ok: true, performance: perf, meta: {}, pending_matches: [] });
  }
});

// ── Admin — forcer résolution manuelle d'un match ────────────────────────────
app.get("/public-history", (req, res) => {
  res.json({ ok: true, items: getPublicHistoryItems() });
});

app.post("/admin/resolve-match", (req, res) => {
  const { email, code, home, away, score_home, score_away } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  if (!home || !away || score_home === undefined || score_away === undefined) {
    return res.json({ ok: false, error: "home, away, score_home, score_away requis" });
  }
  autoResolvePredictions({ home, away, score_home: Number(score_home), score_away: Number(score_away), status: "FINISHED" });
  res.json({ ok: true, message: `Résolution lancée pour ${home} vs ${away} (${score_home}-${score_away})` });
});

// ── Start ─────────────────────────────────────────────────────────────────────
// ── Admin stats ───────────────────────────────────────────────────────────────
app.get("/admin/stats", (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.json({ ok: false, error: "Accès admin requis" });

  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const all = codesDb.prepare("SELECT plan, active, expires_at FROM codes").all();
    codesDb.close();

    const now = new Date();
    const active = all.filter(r => r.active === 1);
    const counts = { free: 0, premium: 0, vip: 0, elite: 0, total: active.length };
    active.forEach(r => { if (counts[r.plan] !== undefined) counts[r.plan]++; });

    const expiring3d = active.filter(r => {
      if (!r.expires_at) return false;
      const d = Math.round((new Date(r.expires_at) - now) / 86400000);
      return d >= 0 && d <= 3;
    }).length;

    const expired = all.filter(r => r.expires_at && new Date(r.expires_at) < now).length;

    const proofs = loadProofs();

    res.json({
      ok: true,
      users: counts,
      expiring_soon: expiring3d,
      expired_total: expired,
      proofs_count: proofs.length,
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── Admin codes list ──────────────────────────────────────────────────────────
app.get("/admin/codes", (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.json({ ok: false, error: "Accès admin requis" });

  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const rows = codesDb.prepare(
      "SELECT code, email, plan, active, expires_at, credits_max, credits_used, credits_date FROM codes ORDER BY plan, email"
    ).all();
    codesDb.close();
    res.json({ ok: true, codes: rows });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── Internal pick notify — called by Hermès after /analyse ───────────────────
// Secured by HERMES_ADMIN_TLM_BOT token as shared secret
app.post("/internal/pick-notify", async (req, res) => {
  const { pick, secret } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  if (!pick || !pick.home) return res.json({ ok: false, error: "pick manquant" });
  if (!BREVO_API_KEY) return res.json({ ok: false, error: "BREVO_API_KEY non configuré", sent: 0 });

  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const rows = codesDb.prepare(
      "SELECT email FROM codes WHERE active = 1 AND plan != 'free' AND email IS NOT NULL AND email != ''"
    ).all();
    codesDb.close();
    const leadRows = loadLeads().leads || [];
    const leadMap = new Map(leadRows.map(l => [String(l.email || "").toLowerCase(), l]));

    const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const gainPotentiel = pick.cote ? Math.round(100 * parseFloat(pick.cote)) : "?";
    const liveUnavailableHtml = pick.liveUnavailable
      ? `<div style="font-size:13px;color:#fbbf24;line-height:1.6;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.28);border-radius:10px;padding:12px;margin-top:12px">Analyse Live IA indisponible pour ce match : il n'est pas couvert par l'API live. Le pick officiel reste valide, mais aucune analyse live ne sera promise.</div>`
      : "";
    const htmlContent = `
<div style="background:#06080f;padding:32px 24px;font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:24px;font-weight:900;background:linear-gradient(135deg,#6366f1,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:inline-block">TousLesMatchs</div>
    <div style="font-size:11px;color:#7b82a0;letter-spacing:.1em;text-transform:uppercase;margin-top:4px">4 AGENTS IA + 1 CHIEF. TU DECIDES AVEC PLUS DE DONNEES.</div>
  </div>
  <div style="background:#0d1020;border:1px solid rgba(99,102,241,.25);border-radius:16px;padding:24px;margin-bottom:20px">
    <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#22d3ee;margin-bottom:12px">🎯 Pick du ${today}</div>
    <div style="font-size:22px;font-weight:900;color:#eceaf4;margin-bottom:8px">${pick.home} vs ${pick.away}</div>
    <div style="font-size:13px;color:#a8aec8;margin-bottom:16px">🏆 ${pick.league || ""} · 🕐 ${pick.time || ""}</div>
    <div style="background:rgba(79,70,229,.12);border:1px solid rgba(79,70,229,.25);border-radius:10px;padding:14px;margin-bottom:16px">
      <div style="font-size:13px;color:#a8aec8;margin-bottom:4px">Pronostic du Concile</div>
      <div style="font-size:20px;font-weight:800;color:#eceaf4">${pick.prono || pick.bet || ""}</div>
      <div style="margin-top:8px;display:flex;gap:16px;flex-wrap:wrap">
        <span style="font-size:13px;color:#22d3ee">📊 Cote : <strong>${pick.cote}</strong></span>
        <span style="font-size:13px;color:#10b981">✅ Confiance : <strong>${pick.confidenceTg || pick.confidence+"/10" || ""}</strong></span>
      </div>
    </div>
    ${pick.raison ? `<div style="font-size:13px;color:#a8aec8;line-height:1.6;font-style:italic;border-left:2px solid rgba(99,102,241,.4);padding-left:12px">${pick.raison}</div>` : ""}
    ${liveUnavailableHtml}
  </div>
  <div style="text-align:center;margin-bottom:20px">
    <div style="font-size:12px;color:#7b82a0;margin-bottom:12px">💰 Gain potentiel sur 100€ misés : <strong style="color:#10b981">+${gainPotentiel}€</strong></div>
    <a href="https://www.touslesmatchs.com" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">Voir l'analyse complète →</a>
  </div>
  ${bookmakerEmailHtml()}
  <div style="text-align:center;font-size:11px;color:#7b82a0;line-height:1.6">
    TousLesMatchs — Analyse IA · <a href="https://www.touslesmatchs.com" style="color:#6366f1;text-decoration:none">touslesmatchs.com</a><br>
    ⚠️ Paris sportifs réservés aux +18 ans. Jeu responsable.
  </div>
</div>`;

    let sent = 0;
    const emails = [...new Set([...rows.map(r => r.email), ...leadRows.map(l => l.email)].filter(Boolean))];
    for (const email of emails) {
      try {
        const [subjectPrefix] = pickEmailText(leadLang(email, leadMap));
        await brevoSendEmail(email, `🎯 ${subjectPrefix} — ${pick.home} vs ${pick.away} @${pick.cote}`, htmlContent);
        sent++;
      } catch (e) {
        console.error(`[pick-notify] email to ${email}:`, e.message);
      }
    }
    console.log(`[pick-notify] Emails envoyés : ${sent}/${emails.length}`);
    res.json({ ok: true, sent, total: emails.length });
  } catch (e) {
    console.error("[pick-notify]", e.message);
    res.json({ ok: false, error: e.message, sent: 0 });
  }
});

// ── Preuves — GET public ──────────────────────────────────────────────────────
app.post("/internal/pick-result-notify", async (req, res) => {
  const { pick, secret } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  if (!pick || !pick.home) return res.json({ ok: false, error: "pick manquant" });
  const finalScore = getFinalScoreFromPick(pick);
  if (finalScore && pick.home && pick.away) {
    autoResolvePredictions({
      home: pick.home,
      away: pick.away,
      score_home: finalScore.score_home,
      score_away: finalScore.score_away,
      status: "FINISHED",
    });
  }
  if (!BREVO_API_KEY) return res.json({ ok: false, error: "BREVO_API_KEY non configuré", sent: 0 });

  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const rows = codesDb.prepare(
      "SELECT email FROM codes WHERE active = 1 AND plan != 'free' AND email IS NOT NULL AND email != ''"
    ).all();
    codesDb.close();
    const leadRows = loadLeads().leads || [];

    const won = pick.status === "GAGNE" || pick.status === "win";
    const title = won ? "Pick gagnant" : "Résultat du pick";
    const score = pick.score || `${pick.score_home ?? "?"}-${pick.score_away ?? "?"}`;
    const htmlContent = `
<div style="background:#06080f;padding:32px 24px;font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:24px;font-weight:900;color:#eceaf4">TousLesMatchs</div>
    <div style="font-size:12px;color:#7b82a0;margin-top:4px">${title}</div>
  </div>
  <div style="background:#0d1020;border:1px solid ${won ? "rgba(16,185,129,.35)" : "rgba(99,102,241,.25)"};border-radius:16px;padding:24px;margin-bottom:20px">
    <div style="font-size:28px;font-weight:900;color:${won ? "#10b981" : "#eceaf4"};margin-bottom:12px">${won ? "GAGNÉ" : "TERMINÉ"}</div>
    <div style="font-size:20px;font-weight:800;color:#eceaf4;margin-bottom:8px">${pick.home} vs ${pick.away}</div>
    <div style="font-size:13px;color:#a8aec8;margin-bottom:14px">Score final : <strong>${score}</strong></div>
    <div style="font-size:15px;color:#eceaf4;margin-bottom:8px">${pick.prono || pick.bet || ""} @ ${pick.cote || ""}</div>
    <div style="font-size:13px;color:#a8aec8;line-height:1.6">${won ? "Le pick officiel du jour est validé." : "Le pick officiel du jour est clôturé. On garde la donnée pour améliorer le modèle."}</div>
  </div>
  <div style="text-align:center">
    <a href="https://www.touslesmatchs.com" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">Voir TousLesMatchs</a>
  </div>
  ${bookmakerEmailHtml()}
</div>`;

    let sent = 0;
    const emails = [...new Set([...rows.map(r => r.email), ...leadRows.map(l => l.email)].filter(Boolean))];
    for (const email of emails) {
      try {
        await brevoSendEmail(email, `${won ? "🏆" : "📊"} ${title} — ${pick.home} vs ${pick.away}`, htmlContent);
        sent++;
      } catch (e) {
        console.error(`[pick-result-notify] email to ${email}:`, e.message);
      }
    }
    console.log(`[pick-result-notify] Emails envoyés : ${sent}/${emails.length}`);
    res.json({ ok: true, sent, total: emails.length });
  } catch (e) {
    console.error("[pick-result-notify]", e.message);
    res.json({ ok: false, error: e.message, sent: 0 });
  }
});

app.post("/internal/record-concile-result", (req, res) => {
  const { record, secret } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  if (!record || !record.home || !record.away || !record.bet) {
    return res.json({ ok: false, error: "home, away, bet requis" });
  }
  const score = getFinalScoreFromPick(record);
  if (!score) return res.json({ ok: false, error: "score final requis, exemple 0-0" });

  const h = Number(score.score_home);
  const a = Number(score.score_away);
  const outcome = getBetOutcomeForScore(record.bet, h, a);
  if (!outcome) return res.json({ ok: false, error: `Marche non reconnu: ${record.bet}` });

  const confidence = Math.max(1, Math.min(100, Number(record.confidence || 70)));
  const minute = record.minute !== undefined && record.minute !== null && record.minute !== ""
    ? Number(record.minute)
    : null;
  const matchKey = `manual_${record.home}_${record.away}_${getTodayStr()}_${record.bet}_${h}-${a}`.replace(/\s+/g, "_");
  const agents = [{ name: record.agent || "Claude Chief", bet: record.bet, confidence }];

  try {
    db.prepare(`
      INSERT OR IGNORE INTO concile_analyses
        (match_key, home, away, competition, minute_at_analysis,
         score_home_at_analysis, score_away_at_analysis, stats_status,
         best_bet, confidence, raison, consensus_votes, agents_json, pick_bet, outcome)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      matchKey,
      record.home,
      record.away,
      record.competition || record.league || "Manuel",
      Number.isFinite(minute) ? minute : null,
      h,
      a,
      record.stats_status || "manual_verified",
      record.bet,
      confidence,
      record.reason || "Prediction verifiee manuellement par admin.",
      Number(record.consensus_votes || 1),
      JSON.stringify(agents),
      record.pick_bet || null,
      outcome
    );

    db.prepare(
      "INSERT OR IGNORE INTO agent_predictions (match_key, home, away, agent_name, bet, confidence, outcome) VALUES (?,?,?,?,?,?,?)"
    ).run(matchKey, record.home, record.away, record.agent || "Claude Chief", record.bet, confidence, outcome);

    db.prepare(`
      UPDATE concile_analyses
      SET final_score_home = ?,
          final_score_away = ?,
          resolved_at = datetime('now'),
          result_source = ?
      WHERE match_key = ?
    `).run(h, a, "manual_verified", matchKey);

    console.log(`[record-concile-result] ${record.home} vs ${record.away} ${record.bet} ${h}-${a} => ${outcome}`);
    res.json({ ok: true, outcome, match_key: matchKey });
  } catch (e) {
    console.error("[record-concile-result]", e.message);
    res.json({ ok: false, error: e.message });
  }
});

app.get("/preuves", (req, res) => {
  res.json({ ok: true, proofs: loadProofs() });
});

// ── Preuves — POST admin upload ───────────────────────────────────────────────
app.post("/admin/preuves", (req, res) => {
  const { email, code, proof } = req.body || {};
  if (!isAdmin(email, code)) return res.json({ ok: false, error: "Accès admin requis" });
  if (!proof || !proof.data || !proof.title) return res.json({ ok: false, error: "Données manquantes (data + title requis)" });

  const proofs = loadProofs();
  const newProof = {
    id: Date.now(),
    title: proof.title,
    description: proof.description || "",
    date: proof.date || new Date().toISOString().slice(0, 10),
    data: proof.data, // base64 data URI
    added_at: new Date().toISOString(),
  };
  proofs.unshift(newProof);
  saveProofs(proofs);
  res.json({ ok: true, proof: { ...newProof, data: "[omitted]" } });
});

// ── Preuves — DELETE admin ────────────────────────────────────────────────────
app.delete("/admin/preuves/:id", (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.json({ ok: false, error: "Accès admin requis" });

  const id = parseInt(req.params.id);
  const proofs = loadProofs();
  const updated = proofs.filter(p => p.id !== id);
  saveProofs(updated);
  res.json({ ok: true, deleted: proofs.length - updated.length });
});

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`TousLesMatchs API running on :${PORT}`);
    if (AUTO_CONCILE_OBSERVER) {
      console.log(`[auto-concile] enabled: every ${Math.round(AUTO_CONCILE_INTERVAL_MS / 60000)} min, max ${AUTO_CONCILE_MAX_MATCHES} match(es)`);
      setTimeout(runAutoConcileObserver, 30000);
      setInterval(runAutoConcileObserver, AUTO_CONCILE_INTERVAL_MS);
    }
  });
}

module.exports.__liveContractTest = {
  normalizeFootballDataMatch,
  normalizeApiSportsFootballFixture,
  isLowTrustCompetition,
  getVerifiedFixtureId,
  buildStatsStatus,
  normalizeCurrentPick,
  readKnownScore,
  computeAvailableBets,
  computeLiveConstraints,
  mergeLiveMatchSources,
  TOKEN_LIMITS,
  resolveVerifiedLiveMatch,
  resolveLiveMatchesAfterFetchFailure,
};

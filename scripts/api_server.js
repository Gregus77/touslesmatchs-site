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
`);

// ── Constants ─────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || "tlm_secret_2026";
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || "";
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY || process.env.FOOTBALL_DATA_API_KEY || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";

// Preuves storage file
const PREUVES_PATH = "/var/touslesmatchs/preuves.json";
const SCORE_PATH = "/var/touslesmatchs/live_score.json";
const PICK_PATH = "/var/touslesmatchs/current_pick.json";
const HERMES_PICKS_PATH = "/picks/picks.json";

const DEFAULT_PICK = {
  teamA: { name: "Turquie", abbr: "TUR", color: "#e30a17" },
  teamB: { name: "Paraguay", abbr: "PAR", color: "#d52b1e" },
  competition: "Coupe du Monde 2026 · Groupe H",
  time: "05:00",
  marketType: "1X",
  marketLabel: "Victoire Turquie ou Nul (double chance)",
  cote: 1.52,
  status: "upcoming",
  result: null,
  scoreA: null,
  scoreB: null,
};

function loadPick() {
  try { return JSON.parse(fs.readFileSync(PICK_PATH, "utf8")); } catch { return DEFAULT_PICK; }
}
function savePick(data) {
  fs.mkdirSync("/var/touslesmatchs", { recursive: true });
  fs.writeFileSync(PICK_PATH, JSON.stringify(data, null, 2));
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

const TOKEN_LIMITS = { free: 0, premium: 10, vip: 30, elite: 999 };

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

// ── Live matches — football-data.org (gratuit, couvre Coupe du Monde) ─────────
function formatFDMatch(m) {
  return {
    id: String(m.id),
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
    const live = (liveData.matches || []).map(formatFDMatch);
    const finished = (finishedData.matches || []).map(formatFDMatch);
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
      const items = (data.response || []).slice(0, 20).map((f) => ({
        id: String(f.fixture.id), sport: "Football",
        home: f.teams.home.name, away: f.teams.away.name,
        score_home: f.goals.home ?? 0, score_away: f.goals.away ?? 0,
        minute: f.fixture.status.elapsed ?? null, status: "IN_PLAY",
        competition: f.league.name + (f.league.country !== "World" ? " · " + f.league.country : ""),
        utcDate: f.fixture.date,
      }));
      results.push(...items);
      console.log(`[live-matches] API-Sports football: ${items.length}`);
    }
  } catch(e) { console.error("[live-matches] API-Sports football:", e.message); }

  // Basketball live
  try {
    const data = await httpGet("https://v1.basketball.api-sports.io/games?live=all", { "x-apisports-key": API_SPORTS_KEY });
    const items = (data.response || []).slice(0, 10).map((g) => ({
      id: "bk-" + g.id, sport: "Basketball",
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
      home: g.teams?.home?.name, away: g.teams?.away?.name,
      score_home: g.scores?.home ?? null, score_away: g.scores?.away ?? null,
      minute: g.status?.timer ?? null, status: "IN_PLAY",
      competition: (g.league?.name || "Hockey") + (g.country?.name ? " · " + g.country.name : ""),
      utcDate: g.date,
    })).filter(g => g.home && g.away);
    results.push(...items);
    if (items.length) console.log(`[live-matches] API-Sports hockey: ${items.length}`);
  } catch(e) { console.error("[live-matches] API-Sports hockey:", e.message); }

  if (results.length === 0) return null;
  console.log(`[live-matches] API-Sports total: ${results.length} événements`);
  return results;
}

async function fetchLiveMatches() {
  if (liveMatchesCache.data && Date.now() - liveMatchesCache.ts < CACHE_TTL) {
    return liveMatchesCache.data;
  }
  // Try football-data.org first (couvre Coupe du Monde gratuitement)
  let matches = await fetchFromFootballData();
  // Fallback to API-Sports
  if (matches === null) matches = await fetchFromApiSports();
  // If both failed, return cached or empty
  if (matches === null) return liveMatchesCache.data || [];

  liveMatchesCache = { data: matches, ts: Date.now() };
  return matches;
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

// ── Groq Concile analysis ─────────────────────────────────────────────────────
const BET_TYPES = ["Victoire domicile", "Victoire extérieur", "Match nul", "Over 2.5 buts", "Under 2.5 buts", "BTTS Oui", "BTTS Non", "Double chance 1X", "Double chance X2"];

const NEUTRAL_KEYWORDS = ["world cup","coupe du monde","fifa world","euro ","uefa euro","copa america","gold cup","afcon","africa cup","nations league final","champions league final","europa league final"];
function isNeutralComp(comp = "") {
  const c = comp.toLowerCase();
  return NEUTRAL_KEYWORDS.some(k => c.includes(k));
}

async function runConcileAnalysis(match) {
  if (!GROQ_API_KEY) {
    return getMockAnalysis(match);
  }

  const neutralNote = isNeutralComp(match.competition)
    ? "\n⚠️ TERRAIN NEUTRE — ne PAS mentionner l'avantage domicile, il n'existe pas dans cette compétition."
    : "";
  const sportNote = match.sport && match.sport !== "Football"
    ? `\nSport: ${match.sport}` : "";

  const matchContext = `Match: ${match.home} vs ${match.away}
Compétition: ${match.competition || "International"}${sportNote}
Score actuel: ${match.score_home ?? "?"}-${match.score_away ?? "?"}
Minute: ${match.minute ? match.minute + "'" : "?"}
Statut: ${match.status}${neutralNote}`;

  const agentNames = [
    { name: "GROQ-Llama", model: "llama-3.3-70b-versatile", icon: "🦙" },
    { name: "GPT Analysis", model: "llama-3.3-70b-versatile", icon: "🤖" },
    { name: "GeminiFlash", model: "llama-3.3-70b-versatile", icon: "💎" },
    { name: "Mistral-7B", model: "llama-3.3-70b-versatile", icon: "🌊" },
    { name: "Claude Chief", model: "llama-3.3-70b-versatile", icon: "👑" },
  ];

  const personas = [
    "Tu es GROQ-Llama, un agent statistique spécialisé dans les patterns de buts.",
    "Tu es GPT-Analysis, un agent expert en analyse tactique et forme des équipes.",
    "Tu es GeminiFlash, un agent spécialisé dans les probabilités et value bets.",
    "Tu es Mistral-7B, un agent focalisé sur les marchés alternatifs comme BTTS et Over/Under.",
    "Tu es Claude Chief, le chef du Concile. Tu synthétises les analyses et tranches.",
  ];

  const agentResults = [];

  for (let i = 0; i < agentNames.length; i++) {
    const isChief = i === 4;
    const previousVotes = isChief ? agentResults.map((a) => `${a.name}: ${a.bet} (${a.confidence}%)`).join("\n") : "";

    const prompt = isChief
      ? `${personas[i]}

${matchContext}

Votes des agents précédents:
${previousVotes}

En tant que chef du Concile, analyse ce match et donne ton verdict final. Réponds en JSON pur (pas de markdown):
{
  "bet": "un parmi: ${BET_TYPES.join(", ")}",
  "confidence": <nombre 55-92>,
  "raison": "<2 phrases max expliquant ton choix basé sur le score, la minute et le contexte>"
}`
      : `${personas[i]}

${matchContext}

Analyse ce match en direct et recommande le meilleur pari. Réponds en JSON pur (pas de markdown):
{
  "bet": "un parmi: ${BET_TYPES.join(", ")}",
  "confidence": <nombre 50-90>,
  "raison": "<2 phrases max expliquant ton choix>"
}`;

    try {
      const response = await httpPost(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: agentNames[i].model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3 + i * 0.05,
          max_tokens: 200,
        },
        { Authorization: `Bearer ${GROQ_API_KEY}` }
      );

      const raw = response.choices?.[0]?.message?.content || "{}";
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);

      agentResults.push({
        name: agentNames[i].name,
        icon: agentNames[i].icon,
        bet: parsed.bet || BET_TYPES[0],
        confidence: Math.min(95, Math.max(50, parseInt(parsed.confidence) || 70)),
        raison: parsed.raison || "Analyse en cours.",
        isChief,
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

  return {
    match_key: `${match.home}_${match.away}`,
    best_bet: chief.bet,
    confidence: chief.confidence,
    raison: chief.raison,
    consensus_votes: consensusVotes + 1, // +1 for chief
    total_agents: 5,
    agents: agentResults,
  };
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
  };
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
  if (!BREVO_API_KEY) return;
  try {
    await httpPost(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { name: "TousLesMatchs", email: "noreply@touslesmatchs.com" },
        to: [{ email: to }],
        subject,
        htmlContent,
      },
      { "api-key": BREVO_API_KEY, "content-type": "application/json" }
    );
  } catch (e) {
    console.error("[brevo] sendEmail error:", e.message);
  }
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
          <p>Renouvelez maintenant pour conserver votre accès Premium et vos analyses IA.</p>
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
  const { email } = req.body || {};
  if (!email || !email.includes("@")) {
    return res.json({ ok: false, error: "Email invalide" });
  }
  const emailClean = email.toLowerCase().trim();
  try {
    if (!BREVO_API_KEY) {
      console.log(`[subscribe-email] Brevo non configuré — email ignoré: ${emailClean}`);
      return res.json({ ok: true }); // ne pas bloquer l'UX si Brevo absent
    }
    await httpPost(
      "https://api.brevo.com/v3/contacts",
      { email: emailClean, attributes: { PLAN: "FREE_SUBSCRIBER" }, updateEnabled: true },
      { "api-key": BREVO_API_KEY, "content-type": "application/json" }
    );
    console.log(`[subscribe-email] Abonné ajouté Brevo: ${emailClean}`);
    res.json({ ok: true });
  } catch (e) {
    console.error("[subscribe-email] error:", e.message);
    res.json({ ok: true }); // ne pas montrer l'erreur à l'utilisateur
  }
});

// ── Forgot code — lookup codes.db by email and send via Brevo ─────────────────
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
      let scoreA = null, scoreB = null;
      if (p.score && p.score.includes("-")) {
        const parts = p.score.split("-");
        scoreA = parseInt(parts[0]) || 0;
        scoreB = parseInt(parts[1]) || 0;
      }
      return res.json({ ok: true, pick: {
        teamA: { name: p.home, abbr: (p.home||"").slice(0,3).toUpperCase(), color: "#4f46e5" },
        teamB: { name: p.away, abbr: (p.away||"").slice(0,3).toUpperCase(), color: "#7c3aed" },
        competition: p.league || p.sport || "",
        time: p.time || "",
        marketType: p.bet || "",
        marketLabel: p.prono || "",
        cote: parseFloat(p.cote) || null,
        status: p.status === "GAGNE" ? "win" : p.status === "PERDU" ? "loss" : "upcoming",
        result: p.status === "GAGNE" ? "win" : p.status === "PERDU" ? "loss" : null,
        scoreA, scoreB,
      }});
    }
  } catch (e) { /* picks.json absent ou invalide */ }
  // 2. Fallback sur le pick manuel admin
  res.json({ ok: true, pick: loadPick() });
});

app.post("/admin/set-pick", (req, res) => {
  const { email, code, pick } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  if (!pick || !pick.teamA || !pick.teamB) return res.status(400).json({ ok: false, error: "Données pick incomplètes" });
  savePick(pick);
  res.json({ ok: true, pick });
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
    home: home || "Turquie", away: away || "Paraguay",
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
app.post("/analyse", async (req, res) => {
  const { home, away } = req.body || {};
  if (!home || !away) return res.json({ ok: false, error: "Deux équipes requises" });

  try {
    const match = { home, away, score_home: 0, score_away: 0, minute: "?", status: "IN_PLAY", competition: "International" };
    const analysis = await runConcileAnalysis(match);
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

  const matchKey = `${home}_${away}_${getTodayStr()}`;

  // Check if already revealed (no token cost)
  const existing = db.prepare(
    "SELECT analysis_json FROM revealed_analyses WHERE user_id = ? AND match_key = ?"
  ).get(req.user.id, matchKey);

  if (existing) {
    return res.json({ ok: true, ...JSON.parse(existing.analysis_json), cached: true });
  }

  // Deduct token
  const tokenResult = deductToken(req.user.id);
  if (!tokenResult.ok) return res.json({ ok: false, error: tokenResult.error });

  // Run analysis
  try {
    const match = { home, away, score_home: score_home ?? 0, score_away: score_away ?? 0, minute: minute || "?", status: "IN_PLAY", competition: competition || "International" };
    const analysis = await runConcileAnalysis(match);

    // Cache result
    db.prepare(
      "INSERT INTO revealed_analyses (user_id, match_key, analysis_json) VALUES (?, ?, ?)"
    ).run(req.user.id, matchKey, JSON.stringify(analysis));

    // Get updated token count
    const tokenRow = getTokenRow(req.user.id);

    res.json({ ok: true, ...analysis, tokens_remaining: tokenRow?.tokens_today ?? 0 });
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
    const credits_left = row.credits_date === today
      ? Math.max(0, row.credits_max - row.credits_used)
      : row.credits_max;
    return { valid: true, plan: row.plan, credits_left, email: row.email };
  } catch (e) {
    console.error("[verifyCode] error:", e.message);
    return { valid: false, error: "Erreur de vérification" };
  }
}

// Cache des analyses de la journée (clé = email+matchId)
const analysisCache = new Map();

app.post("/concile-analysis", async (req, res) => {
  const { email, code, match } = req.body || {};
  if (!email || !code) return res.json({ ok: false, error: "Connexion requise" });
  if (!match || !match.home || !match.away) return res.json({ ok: false, error: "Données du match manquantes" });

  const auth = verifyCode(email, code);
  if (!auth.valid) return res.json({ ok: false, error: auth.error || "Code invalide" });
  if (auth.plan === "free") return res.json({ ok: false, error: "UPGRADE_REQUIRED", plan: "free" });

  // Check credits (credits_max=0 means unlimited)
  const today = new Date().toISOString().slice(0, 10);
  if (auth.credits_left !== null && auth.credits_left !== undefined && auth.credits_left <= 0) {
    return res.json({ ok: false, error: "CREDITS_EXHAUSTED", credits_left: 0 });
  }

  const cacheKey = `${email}__${match.home}_${match.away}_${today}`;
  if (analysisCache.has(cacheKey)) {
    return res.json({ ok: true, ...analysisCache.get(cacheKey), cached: true });
  }

  try {
    const analysis = await runConcileAnalysis(match);
    analysisCache.set(cacheKey, analysis);
    setTimeout(() => analysisCache.delete(cacheKey), 6 * 60 * 60 * 1000);

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

    res.json({ ok: true, ...analysis });
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

  if (auth.credits_left !== null && auth.credits_left !== undefined && auth.credits_left <= 0) {
    return res.json({ ok: false, error: "CREDITS_EXHAUSTED", credits_left: 0 });
  }

  const today2 = new Date().toISOString().slice(0, 10);
  const cacheKey = `prematch__${email}__${match.home}_${match.away}_${match.date || today2}`;
  if (analysisCache.has(cacheKey)) {
    return res.json({ ok: true, ...analysisCache.get(cacheKey), cached: true });
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

    res.json({ ok: true, ...analysis });
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
                <div style="font-size:14px;color:rgba(255,255,255,.75);margin-top:6px">TousLesMatchs — Le Concile analyse. Tu encaisses.</div>
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
    standard: process.env.STRIPE_PRICE_ID_PREMIUM,
    premium: process.env.STRIPE_PRICE_ID_VIP,
    vip: process.env.STRIPE_PRICE_ID_VIP,
    elite: process.env.STRIPE_PRICE_ID_ELITE,
  };
  const priceId = priceMap[plan];
  if (!priceId) return res.json({ ok: false, error: "Plan inconnu" });

  try {
    const Stripe = require("stripe");
    const stripe = Stripe(STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
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

// ── Preuves — GET public ──────────────────────────────────────────────────────
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
app.listen(PORT, () => console.log(`TousLesMatchs API running on :${PORT}`));

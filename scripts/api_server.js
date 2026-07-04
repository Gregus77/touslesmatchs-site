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
const crypto = require("crypto");
const { bookmakerButtons } = require("./bookmakers.config");

const app = express();
// IMPORTANT : le webhook Stripe a besoin du corps BRUT (Buffer) pour vérifier
// la signature. On exclut donc /stripe/webhook du parser JSON global, sinon
// constructEvent échoue → le client paie mais ne reçoit jamais son code/email.
const jsonParser = express.json({ limit: "20mb" });
app.use((req, res, next) => {
  if (req.originalUrl === "/stripe/webhook") return next();
  return jsonParser(req, res, next);
});
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
    confidence INTEGER DEFAULT 0,
    outcome TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(match_key, agent_name)
  );
  CREATE TABLE IF NOT EXISTS agent_market_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL,
    home TEXT NOT NULL,
    away TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    market_line TEXT NOT NULL,
    bet TEXT NOT NULL,
    confidence INTEGER DEFAULT 60,
    outcome TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(match_key, agent_name, market_line)
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
    confidence INTEGER DEFAULT 0,
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
ensureColumn("concile_analyses", "home_logo",       "TEXT DEFAULT NULL");
ensureColumn("concile_analyses", "away_logo",       "TEXT DEFAULT NULL");
ensureColumn("concile_analyses", "bet_category",    "TEXT DEFAULT NULL");
ensureColumn("concile_analyses", "country",         "TEXT DEFAULT NULL");
ensureColumn("concile_analyses", "is_neutral",      "INTEGER DEFAULT 0");
ensureColumn("concile_analyses", "home_form",       "TEXT DEFAULT NULL");
ensureColumn("concile_analyses", "away_form",       "TEXT DEFAULT NULL");
ensureColumn("concile_analyses", "home_goals_avg",  "REAL DEFAULT NULL");
ensureColumn("concile_analyses", "away_goals_avg",  "REAL DEFAULT NULL");
ensureColumn("concile_analyses", "home_shots",      "INTEGER DEFAULT NULL");
ensureColumn("concile_analyses", "away_shots",      "INTEGER DEFAULT NULL");
ensureColumn("concile_analyses", "home_possession", "INTEGER DEFAULT NULL");
ensureColumn("concile_analyses", "away_possession", "INTEGER DEFAULT NULL");

// ── Migration: deduplicate old concile_analyses (keep latest row per match per day)
try {
  const dupeCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM concile_analyses
    WHERE id NOT IN (
      SELECT MAX(id) FROM concile_analyses GROUP BY home, away, date(analysed_at)
    )
  `).get()?.cnt || 0;
  if (dupeCount > 0) {
    db.exec(`
      DELETE FROM concile_analyses
      WHERE id NOT IN (
        SELECT MAX(id) FROM concile_analyses GROUP BY home, away, date(analysed_at)
      )
    `);
    console.log(`[migration] Supprimé ${dupeCount} doublons concile_analyses`);
  }
} catch (e) { console.error("[migration] dedup:", e.message); }

// ── Learning Engine — agent weights history ──────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS agent_weights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    weight REAL NOT NULL,
    wilson_score REAL DEFAULT 0,
    ema_score REAL DEFAULT 0,
    roi_multiplier REAL DEFAULT 1.0,
    winrate REAL,
    total_resolved INTEGER DEFAULT 0,
    roi REAL DEFAULT 0,
    sport TEXT DEFAULT 'all',
    bet_category TEXT DEFAULT 'all',
    context_key TEXT DEFAULT 'global',
    old_weight REAL,
    reason TEXT DEFAULT '',
    computed_at TEXT DEFAULT (datetime('now'))
  );
`);
ensureColumn("agent_weights", "wilson_score", "REAL DEFAULT 0");
ensureColumn("agent_weights", "ema_score", "REAL DEFAULT 0");
ensureColumn("agent_weights", "roi_multiplier", "REAL DEFAULT 1.0");
ensureColumn("agent_weights", "bet_category", "TEXT DEFAULT 'all'");
ensureColumn("agent_weights", "context_key", "TEXT DEFAULT 'global'");
ensureColumn("agent_weights", "old_weight", "REAL");

// ── Learning Engine — persistent configuration ─────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS learning_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_json TEXT NOT NULL,
    variant TEXT DEFAULT 'production',
    status TEXT DEFAULT 'draft',
    updated_by TEXT DEFAULT 'system',
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS learning_config_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    param_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    variant TEXT DEFAULT 'production',
    changed_by TEXT DEFAULT 'admin',
    changed_at TEXT DEFAULT (datetime('now'))
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS learning_lab_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id INTEGER,
    run_type TEXT NOT NULL,
    roi REAL,
    winrate REAL,
    total_matches INTEGER,
    curve_json TEXT,
    comparison_json TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

ensureColumn("learning_config", "status", "TEXT DEFAULT 'draft'");
ensureColumn("concile_analyses", "cote", "REAL DEFAULT NULL");
ensureColumn("concile_analyses", "gain", "REAL DEFAULT NULL");

// ── Nurturing emails table (persistent across restarts) ──────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS scheduled_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    email_type TEXT NOT NULL,
    send_after TEXT NOT NULL,
    sent INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(email, email_type)
  );
`);

// ── Analytics — page views tracking ──────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page TEXT NOT NULL,
    referrer TEXT DEFAULT '',
    utm_source TEXT DEFAULT '',
    utm_medium TEXT DEFAULT '',
    utm_campaign TEXT DEFAULT '',
    ip_hash TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ── Shadow eval table ─────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS shadow_evals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL,
    home TEXT NOT NULL,
    away TEXT NOT NULL,
    competition TEXT DEFAULT '',
    sport TEXT DEFAULT 'Football',
    agent_name TEXT NOT NULL,
    bet TEXT NOT NULL,
    confidence INTEGER DEFAULT 0,
    raison TEXT DEFAULT '',
    outcome TEXT DEFAULT NULL,
    final_score_home INTEGER DEFAULT NULL,
    final_score_away INTEGER DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT DEFAULT NULL,
    UNIQUE(match_key, agent_name)
  );
`);

// ── Constants ─────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || "tlm_secret_2026";
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || "";
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY || process.env.FOOTBALL_DATA_API_KEY || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_PRICE_ID_CARTE    = process.env.STRIPE_PRICE_ID_CARTE    || process.env.STRIPE_PRICE_CARTE   || "";
const STRIPE_PRICE_ID_PREMIUM  = process.env.STRIPE_PRICE_ID_PREMIUM  || process.env.STRIPE_PRICE_PRO     || "";
const STRIPE_PRICE_ID_ELITE    = process.env.STRIPE_PRICE_ID_ELITE    || process.env.STRIPE_PRICE_ELITE   || "";
const STRIPE_PRICE_ID_VIP      = process.env.STRIPE_PRICE_ID_VIP      || process.env.STRIPE_PRICE_VIP     || "";
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "noreply@touslesmatchs.com";
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || "TousLesMatchs";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || "";
const TELEGRAM_PREMIUM_CHANNEL_ID = process.env.TELEGRAM_PREMIUM_CHANNEL_ID || "";
const _signalSentCache = new Set();
const _freeSignalDailyDate = { date: "", count: 0 };
const _freeResultDailyDate = { date: "", count: 0 };
let _adaptiveThresholdCache = { value: 80, computedAt: 0 };

function getAdaptiveSignalThreshold() {
  const now = Date.now();
  if (now - _adaptiveThresholdCache.computedAt < 30 * 60 * 1000) return _adaptiveThresholdCache.value;
  try {
    const rows = db.prepare(`
      SELECT confidence, outcome FROM concile_analyses
      WHERE confidence >= 80 AND outcome IN ('win','loss')
      ORDER BY analysed_at DESC LIMIT 100
    `).all();
    if (rows.length < 15) {
      _adaptiveThresholdCache = { value: 80, computedAt: now };
      return 80;
    }
    const brackets = [
      { min: 80, max: 82, wins: 0, total: 0 },
      { min: 82, max: 85, wins: 0, total: 0 },
      { min: 85, max: 88, wins: 0, total: 0 },
      { min: 88, max: 101, wins: 0, total: 0 },
    ];
    for (const r of rows) {
      for (const b of brackets) {
        if (r.confidence >= b.min && r.confidence < b.max) {
          b.total++;
          if (r.outcome === "win") b.wins++;
          break;
        }
      }
    }
    let threshold = 80;
    let cumTotal = 0, cumWins = 0;
    for (const b of brackets) {
      cumTotal += b.total;
      cumWins += b.wins;
    }
    let runTotal = 0, runWins = 0;
    for (const b of brackets) {
      const aboveTotal = cumTotal - runTotal;
      const aboveWins = cumWins - runWins;
      const aboveWinrate = aboveTotal > 0 ? Math.round(aboveWins / aboveTotal * 100) : 0;
      if (aboveWinrate >= 65 && aboveTotal >= 5) {
        threshold = b.min;
        break;
      }
      runTotal += b.total;
      runWins += b.wins;
    }
    console.log(`[adaptive-threshold] Seuil Signal Fort ajusté: ${threshold}% (basé sur ${rows.length} analyses récentes)`);
    _adaptiveThresholdCache = { value: threshold, computedAt: now };
    return threshold;
  } catch (e) {
    console.error("[adaptive-threshold]", e.message);
    return _adaptiveThresholdCache.value || 80;
  }
}

// ── Shadow agents (banc d'essai — free tiers) ─────────────────────────────────
const MISTRAL_API_KEY    = process.env.MISTRAL_API_KEY    || "";
const CEREBRAS_API_KEY   = process.env.CEREBRAS_API_KEY   || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const COHERE_API_KEY     = process.env.COHERE_API_KEY     || "";
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || "";
const TOGETHER_API_KEY   = process.env.TOGETHER_API_KEY   || "";

const SHADOW_AGENTS = [
  // ── IA gratuites immédiates (clé Groq déjà configurée, aucun ajout requis) ──
  {
    name: "Groq-Llama70B",
    icon: "🦙",
    enabled: () => !!GROQ_API_KEY,
    call: (prompt) => callOpenAICompat(prompt, {
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: GROQ_API_KEY,
      model: "llama-3.3-70b-versatile",
    }),
  },
  {
    name: "Groq-Llama8B",
    icon: "🐎",
    enabled: () => !!GROQ_API_KEY,
    call: (prompt) => callOpenAICompat(prompt, {
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: GROQ_API_KEY,
      model: "llama-3.1-8b-instant",
    }),
  },
  {
    name: "Mistral-Small",
    icon: "🌊",
    enabled: () => !!MISTRAL_API_KEY,
    call: (prompt) => callOpenAICompat(prompt, {
      url: "https://api.mistral.ai/v1/chat/completions",
      key: MISTRAL_API_KEY,
      model: "mistral-small-latest",
    }),
  },
  {
    name: "Cerebras-Llama",
    icon: "⚡",
    enabled: () => !!CEREBRAS_API_KEY,
    call: (prompt) => callOpenAICompat(prompt, {
      url: "https://api.cerebras.ai/v1/chat/completions",
      key: CEREBRAS_API_KEY,
      model: "llama3.1-8b",
    }),
  },
  {
    name: "OR-Mistral7B",
    icon: "🔓",
    enabled: () => !!OPENROUTER_API_KEY,
    call: (prompt) => callOpenAICompat(prompt, {
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: OPENROUTER_API_KEY,
      model: "mistralai/mistral-7b-instruct:free",
    }),
  },
  {
    name: "Cohere-Command",
    icon: "🧬",
    enabled: () => !!COHERE_API_KEY,
    call: (prompt) => callCohere(prompt),
  },
];

// ── Telegram helper ──────────────────────────────────────────────────────────
function sendTelegramMessage(chatId, text) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return Promise.resolve(false);
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      timeout: 15000,
    }, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try { resolve(JSON.parse(data).ok === true); } catch { resolve(false); }
      });
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.write(body);
    req.end();
  });
}

// ── Shadow API helpers ────────────────────────────────────────────────────────
function callOpenAICompat(prompt, { url, key, model }) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.3,
    });
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
        "HTTP-Referer": "https://touslesmatchs.com",
        "X-Title": "TousLesMatchs Shadow Eval",
      },
      timeout: 15000,
    };
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.request(options, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const text = json.choices?.[0]?.message?.content || "";
          resolve({ ok: true, text });
        } catch { resolve({ ok: false, text: "" }); }
      });
    });
    req.on("error", () => resolve({ ok: false, text: "" }));
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, text: "" }); });
    req.write(body);
    req.end();
  });
}

function callCohere(prompt) {
  return new Promise((resolve) => {
    if (!COHERE_API_KEY) return resolve({ ok: false, text: "" });
    const body = JSON.stringify({
      model: "command-r",
      message: prompt,
      max_tokens: 200,
      temperature: 0.3,
    });
    const options = {
      hostname: "api.cohere.ai",
      path: "/v1/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${COHERE_API_KEY}`,
      },
      timeout: 15000,
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const text = json.text || json.chat_history?.slice(-1)[0]?.message || "";
          resolve({ ok: true, text });
        } catch { resolve({ ok: false, text: "" }); }
      });
    });
    req.on("error", () => resolve({ ok: false, text: "" }));
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, text: "" }); });
    req.write(body);
    req.end();
  });
}

function parseShadowResponse(text) {
  const t = text.trim();
  const betMatch = t.match(/(?:PARI|BET|PRONOSTIC|ANALYSE)\s*:\s*([^\n|]+)/i);
  const confMatch = t.match(/(?:CONFIANCE|CONFIDENCE)\s*:\s*(\d+)/i);
  const raisonMatch = t.match(/(?:RAISON|REASON|POURQUOI)\s*:\s*([^\n]+)/i);
  const marchesMatch = t.match(/MARCHES\s*:\s*([^\n]+)/i);
  let bet = betMatch ? betMatch[1].trim() : null;
  if (!bet) {
    const known = ["Over 2.5", "Under 2.5", "BTTS Oui", "BTTS Non", "Match nul", "Victoire domicile", "Victoire extérieur", "1X", "X2", "12", "NO BET"];
    for (const k of known) {
      if (t.toLowerCase().includes(k.toLowerCase())) { bet = k; break; }
    }
  }
  // Parse "buts=o2.5:70,btts=oui:60,resultat=dom:65,mt1=oui:55" → objet marches
  let marches = null;
  if (marchesMatch) {
    marches = {};
    marchesMatch[1].split(",").forEach(part => {
      const m = part.trim().match(/^(buts|btts|resultat|mt1)\s*=\s*([a-z0-9.]+)\s*:\s*(\d+)/i);
      if (m) marches[m[1].toLowerCase()] = { p: m[2].toLowerCase(), c: parseInt(m[3]) };
    });
    if (Object.keys(marches).length === 0) marches = null;
  }
  return {
    bet: bet || "NO BET",
    confidence: confMatch ? Math.min(100, Math.max(0, parseInt(confMatch[1]))) : 55,
    raison: raisonMatch ? raisonMatch[1].trim().slice(0, 300) : t.slice(0, 200),
    marches,
  };
}

function buildShadowPrompt(match) {
  const scoreStr = (match.score_home != null && match.score_away != null)
    ? `\nScore actuel : ${match.score_home}-${match.score_away}${match.minute ? ` (${match.minute}')` : ""}`
    : "";
  return `Tu es un analyste sportif expert. Analyse ce match et donne ta recommandation.

Match : ${match.home} vs ${match.away}
Compétition : ${match.competition || match.league || "inconnue"}
Sport : ${match.sport || "Football"}${scoreStr}

DIRECTIVE : Under 2.5 UNIQUEMENT si match équilibré (écart 0-1 but) ET rythme faible. Si écart >= 2 buts OU 2+ buts avant 45' → préfère Over 2.5 ou Victoire.

Réponds UNIQUEMENT dans ce format :
ANALYSE : [ex: Under 2.5 / Over 2.5 / Victoire domicile / 1X / Match nul / NO BET]
CONFIANCE : [0-100]
RAISON : [1 phrase maximum]
MARCHES : buts=o2.5:70,btts=oui:60,resultat=dom:65,mt1=oui:55

Pour MARCHES (avis rapide sur chaque marché, codes courts + confiance 40-90) :
- buts : o2.5 (plus de 2.5) ou u2.5 (moins de 2.5)
- btts : oui ou non (les deux équipes marquent)
- resultat : dom, ext ou nul
- mt1 : oui ou non (but en 1ère mi-temps)

Ne mets rien d'autre. Si tu n'es pas sûr du pick principal, réponds NO BET (mais donne quand même MARCHES).`;
}

async function runShadowEvaluation(match) {
  const prompt = buildShadowPrompt(match);
  const matchKey = `${(match.home || "").replace(/\s+/g, "_")}_${(match.away || "").replace(/\s+/g, "_")}_${(match.date || match.utcDate || "").slice(0, 10)}`;
  const activeAgents = SHADOW_AGENTS.filter(a => a.enabled());
  if (activeAgents.length === 0) return;

  for (const agent of activeAgents) {
    try {
      const existing = db.prepare("SELECT 1 FROM shadow_evals WHERE match_key = ? AND agent_name = ?").get(matchKey, agent.name);
      if (existing) continue;

      const result = await agent.call(prompt);
      if (!result.ok || !result.text) continue;

      const parsed = parseShadowResponse(result.text);
      // Avis multi-marchés du banc d'essai — même mécanique que les 4 agents
      // du Concile, pour que TOUTES les IA (pas seulement Perplexity/DeepSeek/
      // Mistral-Large/Cohere) apparaissent dans la matrice IA × marché.
      if (parsed.marches) {
        saveAgentMarketPredictions(match, [{ name: agent.name, marches: parsed.marches }]);
      }
      db.prepare(`
        INSERT OR IGNORE INTO shadow_evals
          (match_key, home, away, competition, sport, agent_name, bet, confidence, raison)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).run(
        matchKey,
        match.home || "", match.away || "",
        match.competition || match.league || "",
        match.sport || "Football",
        agent.name,
        parsed.bet, parsed.confidence, parsed.raison
      );
      console.log(`[shadow] ${agent.icon} ${agent.name} → ${parsed.bet} (${parsed.confidence}%) pour ${match.home} vs ${match.away}`);
    } catch (e) {
      console.error(`[shadow] ${agent.name} erreur:`, e.message);
    }
  }
}

function resolveShadowOutcomes(home, away, scoreHome, scoreAway) {
  try {
    // Match par équipes (comme les autres résolveurs) — l'ancien code matchait
    // par match_key exact, mais le match_key de shadow_evals (home_away_date)
    // ne correspond JAMAIS à celui de concile_analyses (id_date_bucket_score),
    // donc les IA du banc d'essai n'étaient quasiment jamais résolues.
    const hw = String(home || "").split(" ")[0];
    const aw = String(away || "").split(" ")[0];
    if (!hw || !aw) return;
    const rows = db.prepare(
      "SELECT id, bet FROM shadow_evals WHERE home LIKE ? AND away LIKE ? AND outcome IS NULL"
    ).all(`%${hw}%`, `%${aw}%`);
    for (const row of rows) {
      const outcome = getBetOutcomeForScore(row.bet, scoreHome, scoreAway);
      if (outcome) {
        db.prepare(`UPDATE shadow_evals SET outcome = ?, final_score_home = ?, final_score_away = ?, resolved_at = datetime('now') WHERE id = ?`)
          .run(outcome, scoreHome, scoreAway, row.id);
      }
    }
  } catch (e) { console.error("[shadow] resolve:", e.message); }
}

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
const PINNED_SIGNALS_PATH = "/var/touslesmatchs/pinned_signals.json";

function loadPinnedSignals() {
  try { return JSON.parse(fs.readFileSync(PINNED_SIGNALS_PATH, "utf8")); } catch { return []; }
}
function savePinnedSignals(signals) {
  try { fs.writeFileSync(PINNED_SIGNALS_PATH, JSON.stringify(signals, null, 2)); } catch {}
}
function addPinnedSignal(signal) {
  const signals = loadPinnedSignals().filter(s => s.id !== signal.id);
  const expireAt = Date.now() + 90 * 60 * 1000; // 90 minutes
  signals.unshift({ ...signal, expireAt, pinnedAt: new Date().toISOString() });
  savePinnedSignals(signals.slice(0, 20));
}
function getActivePinnedSignals() {
  const now = Date.now();
  return loadPinnedSignals().filter(s => s.expireAt > now);
}
const LEADS_PATH = "/var/touslesmatchs/leads.json";
const REFERRALS_PATH = "/var/touslesmatchs/referrals.json";

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
    home_logo: p.home_logo || p.teamA?.logo || null,
    away_logo: p.away_logo || p.teamB?.logo || null,
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
    home_logo: m.homeTeam?.crest || null,
    away_logo: m.awayTeam?.crest || null,
    score_home: m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null,
    score_away: m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null,
    ht_home: m.score?.halfTime?.home ?? null,
    ht_away: m.score?.halfTime?.away ?? null,
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
    home_logo: f.teams.home.logo || null,
    away_logo: f.teams.away.logo || null,
    score_home: f.goals.home ?? null,
    score_away: f.goals.away ?? null,
    ht_home: f.score?.halftime?.home ?? null,
    ht_away: f.score?.halftime?.away ?? null,
    minute: f.fixture.status.elapsed ?? null,
    status: "IN_PLAY",
    competition: f.league.name + (f.league.country !== "World" ? " · " + f.league.country : ""),
    utcDate: f.fixture.date,
  };
  return { ...match, lowTrustCompetition: isLowTrustCompetition(match) };
}

const LOW_TRUST_COMPETITION_KEYWORDS = [
  // Catégories génériques non fiables
  "friendly", "friendlies", "club friendly", "international friendly", "amical", "amicaux",
  "u17", "u18", "u19", "u20", "u21", "u23",
  "under 17", "under 18", "under 19", "under 20", "under 21", "under 23",
  "reserve", "reserves", "b team", "ii ", " ii", "youth", "youth championship", "academy",
  "regional cup", "state cup", "state league",
  "world cup", "coupe du monde", "fifa world", "copa del mundo",
  // Afrique
  "ethiopia", "nigeria", "npfl", "tanzania", "kenya", "uganda",
  "ghana", "zambia", "zimbabwe", "mozambique", "cameroon", "cameroun",
  "rwanda", "burundi", "malawi", "botswana", "lesotho", "eswatini", "swaziland",
  "senegal", "ivory coast", "côte d'ivoire", "burkina",
  "congo", "angola", "namibia", "gabon", "togo", "benin", "niger · ",
  "madagascar", "mauritius", "cape verde", "guinea",
  "sierra leone", "liberia", "gambia", "eritrea", "djibouti", "comoros",
  "south africa", "algeria · ligue", "tunisia · ligue", "egypt · premier",
  // Asie
  "kazakhstan", "uzbekistan", "tajikistan", "kyrgyzstan", "turkmenistan",
  "myanmar", "cambodia", "laos", "vietnam", "v.league",
  "bangladesh", "nepal", "mongolia", "bhutan", "maldives", "brunei", "timor",
  "palestine", "jordan · ", "iraq", "syria", "yemen", "oman", "bahrain",
  "lebanon", "india", "sri lanka", "pakistan",
  "indonesia", "malaysia · ", "philippines", "thailand · ",
  // Amérique du Sud — ligues secondaires
  "chile", "bolivia", "peru", "venezuela", "ecuador",
  "paraguay", "uruguay · segunda", "colombia · b",
  // Amérique centrale et Caraïbes
  "honduras", "guatemala", "el salvador", "nicaragua",
  "costa rica", "panama · liga", "haiti", "jamaica", "trinidad",
  "dominican", "cuba", "belize", "suriname", "guyana",
  // Europe — divisions inférieures/ligues exotiques
  "estonia", "latvia", "lithuania", "faroe", "gibraltar",
  "andorra", "malta", "san marino", "kosovo", "north macedonia",
  "albania", "moldova", "belarus", "armenia",
  "georgia · erovnuli", "georgian erovnuli",
  "azerbaijan", "iceland", "northern ireland",
  "luxembourg", "liechtenstein", "montenegro", "bosnia",
  // Océanie
  "fiji", "samoa", "tonga", "vanuatu", "solomon", "papua",
  "new caledonia", "tahiti",
  "australia · npl", "australian npl",
  "queensland premier league", "queensland · ", "victoria premier league",
  // Moyen-Orient (manquant)
  "iran",
  // USA — ligues amateurs/semi-pro
  "usl league two", "usl2", "usl league one",
  "npsl", "nisa", "mls next", "mls next pro",
  "us open cup", "usl w league",
];

const TRUSTED_COMPETITIONS = [
  "ligue 1", "ligue 2", "coupe de france",
  "premier league", "championship", "fa cup", "efl cup", "carabao",
  "la liga", "laliga", "segunda division", "copa del rey",
  "bundesliga", "2. bundesliga", "dfb-pokal",
  "serie a", "serie b", "coppa italia",
  "eredivisie",
  "pro league", "first division a",
  "liga portugal", "primeira liga",
  "super lig", "süper lig",
  "champions league", "europa league", "conference league",
  "euro 20", "uefa euro", "nations league",
  "mls ", "liga mx", "copa libertadores", "copa sudamericana",
  "brasileirao", "serie a · brazil",
  "liga profesional", "copa argentina",
  "j1 league", "j-league", "meiji yasuda",
  "k league", "k-league",
  "chinese super league",
  "canadian premier",
  "nhl", "nba", "atp", "wta", "grand slam",
  "top 14", "pro d2", "premiership rugby", "urc",
  "euroleague", "euroligue",
  "a-league", "a league · australia",
  "swiss super league", "super league · switzerland",
  "scottish premiership", "scottish · premiership",
  "danish superliga", "superliga · denmark",
  "norwegian eliteserien", "eliteserien",
  "finnish veikkausliiga",
  "czech first league", "czech liga",
  "polish ekstraklasa", "ekstraklasa",
  "croatian hnl", "hnl · croatia",
  "serbian superliga", "super liga · serbia",
  "greek super league", "super league · greece",
  "romanian superliga", "liga i · romania",
  "ukrainian premier",
  "russian premier",
  "austrian bundesliga",
  "hungarian nb i", "nb i · hungary",
  "bulgarian first", "first league · bulgaria",
  "slovak super liga",
  "cypriot first", "first division · cyprus",
  "saudi pro league", "roshn",
  "uae pro league",
  "qsl", "qatar stars",
  "usl championship",
  "nwsl",
  "ahl",
  "nbl", "nbl · australia",
  "australia cup",
];

function isLowTrustCompetition(matchOrCompetition = "") {
  const raw = typeof matchOrCompetition === "string"
    ? matchOrCompetition
    : [matchOrCompetition?.competition, matchOrCompetition?.home, matchOrCompetition?.away].filter(Boolean).join(" ");
  const value = String(raw || "").toLowerCase();
  if (LOW_TRUST_COMPETITION_KEYWORDS.some((keyword) => value.includes(keyword))) return true;
  if (TRUSTED_COMPETITIONS.some(tc => value.includes(tc))) return false;
  return true;
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
      const items = (data.response || []).slice(0, 60).map(normalizeApiSportsFootballFixture);
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
      home_logo: g.teams?.home?.logo || null, away_logo: g.teams?.away?.logo || null,
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
    const items = (data.response || []).slice(0, 30).map((g) => ({
      id: "hk-" + g.id, sport: "Hockey",
      source: "api-sports",
      sourceId: String(g.id),
      fixtureId: null,
      home: g.teams?.home?.name, away: g.teams?.away?.name,
      home_logo: g.teams?.home?.logo || null, away_logo: g.teams?.away?.logo || null,
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
      home_logo: g.teams?.home?.logo || null, away_logo: g.teams?.away?.logo || null,
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

  // Tennis live — filtré sur ATP (exclut WTA/ITF/Challenger via le nom du tournoi)
  try {
    const data = await httpGet("https://v1.tennis.api-sports.io/games?live=all", { "x-apisports-key": API_SPORTS_KEY });
    const items = (data.response || [])
      .filter(g => {
        const t = String(g.league?.name || g.tournament?.name || "").toLowerCase();
        return t.includes("atp") && !t.includes("wta");
      })
      .slice(0, 10)
      .map((g) => ({
        id: "tn-" + g.id, sport: "Tennis",
        source: "api-sports",
        sourceId: String(g.id),
        fixtureId: null,
        home: g.teams?.home?.name, away: g.teams?.away?.name,
        home_logo: g.teams?.home?.logo || null, away_logo: g.teams?.away?.logo || null,
        score_home: g.scores?.home?.total ?? g.scores?.home ?? null,
        score_away: g.scores?.away?.total ?? g.scores?.away ?? null,
        minute: g.status?.long || g.status?.short || null,
        status: "IN_PLAY",
        competition: "ATP · " + (g.league?.name || g.tournament?.name || "Tennis"),
        utcDate: g.date,
      })).filter(g => g.home && g.away);
    results.push(...items);
    if (items.length) console.log(`[live-matches] API-Sports tennis ATP: ${items.length}`);
  } catch(e) { console.error("[live-matches] API-Sports tennis:", e.message); }

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
  return String(value || "").trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\bman(chester)?\b/g, "man")
    .replace(/\b(united|utd)\b/g, "utd")
    .replace(/\bcity\b/g, "city")
    .replace(/\bparis\s*(saint|st)[\s-]*germain\b/g, "psg")
    .replace(/\bp\.?\s*s\.?\s*g\.?\b/g, "psg")
    .replace(/\bbayern\s*munich\b/g, "bayern")
    .replace(/\binter\s*milan\b/g, "inter")
    .replace(/\bac\s*milan\b/g, "milan")
    .replace(/\breal\s*madrid\b/g, "real madrid")
    .replace(/\batletic[o]?\b/g, "atletico")
    .replace(/\s+/g, " ").trim();
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

  // ── Détection de massacre / domination totale
  const scoreDiff = Math.abs(h - a);
  if (scoreDiff >= 3 && total < 3) {
    lines.push(`  → ⚠️ DOMINATION TOTALE (${h}-${a}) : NE PAS recommander Under 2.5 — l'équipe dominante continue de marquer.`);
  } else if (scoreDiff >= 2 && minute <= 60) {
    lines.push(`  → ⚠️ ÉCART IMPORTANT (${h}-${a}) en ${minute}' : Under 2.5 est RISQUÉ — l'équipe en tête peut continuer à marquer. Préfère Over 2.5 ou Victoire.`);
  } else if (total >= 2 && minute <= 45) {
    lines.push(`  → ⚠️ MATCH OUVERT (${total} buts en ${minute}') : Under 2.5 RISQUÉ au rythme actuel. Préfère Over 2.5.`);
  }

  // ── Rythme de buts (extrapolation + recommandation)
  if (minute >= 30) {
    lines.push(`  → Rythme actuel : ${total} but(s) en ${minute}' → extrapolation : ~${projectedTotal} buts à 90'.`);
    if (projectedTotal >= 3.0 && total < 3) {
      lines.push(`  → ⚠️ PROJECTION HAUTE (${projectedTotal} buts) : Under 2.5 DANGEREUX → préfère Over 2.5 ou Victoire.`);
    } else if (projectedTotal < 2.0 && total < 3 && scoreDiff < 2) {
      lines.push(`  → PROJECTION FAIBLE (${projectedTotal} buts) : Over 2.5 peu probable → Under 2.5 favori.`);
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

  lines.push("  → PRIORISE ces contraintes LIVE sur toute stat pré-match. Ne recommande PAS un marché mathématiquement contraire.");
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
Tu DOIS choisir UNIQUEMENT parmi cette liste. Tout autre marché est mathématiquement invalide.`;

  // Concile v3 — 4 familles d'IA radicalement différentes + Chief
  // Agent 0 : Perplexity-Web  → accès web temps réel (forme, blessures, H2H)
  // Agent 1 : DeepSeek-V3     → contrarian (architecture chinoise, entraînement différent)
  // Agent 2 : Mistral-Large   → modèle européen (architecture MoE, ≠ Llama/GPT)
  // Agent 3 : Cohere-Command  → spécialiste RAG/données structurées (architecture ≠ tout le reste)
  // Agent 4 : Chief           → arbitre Llama-70b (Groq, rapide)
  const usePerplexity = !!PERPLEXITY_API_KEY;
  const useMistral    = !!MISTRAL_API_KEY;
  const useCohere     = !!COHERE_API_KEY;

  const agentNames = [
    {
      name: "Perplexity-Web",
      model: usePerplexity ? "sonar-pro" : "llama-3.3-70b-versatile",
      icon: "🌐",
      usePerplexity,
    },
    { name: "DeepSeek-V3", model: "deepseek-chat", icon: "🔮", useDeepseek: true },
    {
      name: "Mistral-Large",
      model: useMistral ? "mistral-large-latest" : "llama-3.3-70b-versatile",
      icon: "🌊",
      useMistral,
    },
    {
      name: "Cohere-Command",
      model: useCohere ? "command-r-plus" : "llama-3.3-70b-versatile",
      icon: "🧬",
      useCohere,
    },
    { name: "Claude Chief", model: "llama-3.3-70b-versatile", icon: "👑" },
  ];

  const webSearchNote = usePerplexity
    ? `\nATTENTION : tu as accès aux données web en temps réel. Cherche impérativement : forme récente de ${match.home} et ${match.away} (5 derniers matchs), blessures confirmées, confrontations directes récentes, et cotes actuelles chez les bookmakers. Cite tes sources. N'invente RIEN.`
    : "";

  const personas = [
    `Tu es Perplexity-Web, agent data temps réel.${webSearchNote} Mission : apporter des FAITS vérifiés sur ${match.home} vs ${match.away}. Recherche impérativement : classement actuel des deux équipes dans leur championnat (top 5 / milieu / bottom 5), forme sur les 5 derniers matchs, blessures majeures confirmées, H2H récent avec moyenne de buts. Si tu n'as pas de données fiables, dis-le. Tu es le seul agent avec accès web — c'est ton avantage unique.`,

    `Tu es DeepSeek-V3, agent contrarian. Ton rôle est de CONTREDIRE l'intuition dominante sur ${match.home} vs ${match.away}. Critères clés à vérifier : une équipe en haut du classement en mauvaise forme récente (5 derniers matchs), fatigue/calendrier chargé, H2H qui contredit le classement, équipe en bas de tableau surperformante à domicile. N'accepte un pick que si tu as un argument basé sur des données — pas une intuition.`,

    `Tu es Mistral-Large, expert tactique européen. Analyse ${match.home} vs ${match.away} avec : 1) Position au classement et écart entre les deux équipes, 2) Force défensive vs offensive (buts marqués/encaissés par match), 3) Bilan domicile vs extérieur spécifique, 4) Moyenne de buts des H2H pour Under/Over. Top 4 vs Bottom 5 à domicile = signal fort. Raisonne : données → conclusion.`,

    `Tu es Cohere-Command, expert en valeur et marchés. Pour ${match.home} vs ${match.away} : 1) Identifie le marché avec la meilleure value en croisant classement + forme + H2H, 2) Si les deux équipes ont une moyenne < 2.0 buts/match ET les H2H sont majoritairement Under = Under très probable, 3) Si écart > 10 places au classement + forme alignée = ML probable. Raisonne en probabilités, évite les marchés surpricés.`,

    `Tu es Claude Chief, arbitre du Concile v3. Tu reçois 4 votes d'IA. Critères de décision par ordre de poids : 1) Classement + écart de niveau (30%), 2) Forme récente 5 matchs (25%), 3) H2H + moyenne buts (15%), 4) Facteur dom/ext (15%), 5) Moyenne buts/match (10%), 6) Cotes/value (5%). Ne valide que si au moins 2 critères forts sont alignés. NOPICK si les signaux sont contradictoires. Mieux vaut 0 pick qu'un mauvais pick.`,
  ];

  // Charger les performances historiques pour pondérer le verdict du Chief
  const agentPerf = getAgentPerformance();

  const agentMarketList = []; // avis multi-marchés de chaque agent (hors Chief)

  // Helper: run a single agent and return its result
  async function runSingleAgent(i) {
    const isChief = i === 4;
    const agCfg = agentNames[i];
    const temp = 0.3 + i * 0.05;
    const maxTok = isChief ? 400 : 300;

    const prompt = `${personas[i]}

${matchContext}

En te basant sur tes connaissances des équipes ET les données live ci-dessus, recommande la meilleure analyse.
Tu DOIS choisir parmi cette liste uniquement : ${availableBets.join(", ")}

DIRECTIVE MARCHÉ :
- Under 2.5 buts UNIQUEMENT si le match est équilibré (écart de score 0-1) ET le rythme de buts est faible (projection < 2.5).
- INTERDIT de recommander Under 2.5 si : écart >= 2 buts OU 2+ buts marqués avant la 45' OU une équipe domine clairement.
- Si l'écart est large (2+), préfère Over 2.5 ou Victoire de l'équipe dominante.
- Respecte impérativement les CONTRAINTES MATHÉMATIQUES LIVE ci-dessous.

⚠️ CONFIANCE ARGUMENTÉE — INTERDICTION du 70% générique :
- Ta "confidence" DOIT refléter la force réelle des données, pas une valeur ronde par défaut.
- Base-la explicitement sur : la forme récente des 2 équipes, l'historique des confrontations directes (H2H), les blessés/absents connus (uniquement si tu en es sûr), l'enjeu (place à gagner/à défendre au classement), le contexte (domicile/extérieur, terrain neutre), et les stats live ci-dessus.
- Peu de signaux concordants → confiance basse (50-62). Signaux forts et convergents → confiance haute (78-90). N'utilise 70 QUE si c'est réellement le calcul, jamais par facilité.
- La "raison" DOIT citer au moins 2 données concrètes distinctes (ex: "3 des 5 derniers H2H sous 2.5 buts, + attaque extérieure à 0.9 but/match") — pas de phrase vague type "analyse basée sur le rythme".

Donne AUSSI ton avis rapide sur chaque marché (objet "marches", codes courts + confiance 40-90) :
- buts: "o2.5" (plus de 2.5) ou "u2.5" (moins de 2.5)
- btts: "oui" ou "non" (les deux équipes marquent)
- resultat: "dom", "ext" ou "nul"
- mt1: "oui" ou "non" (au moins un but en 1ère mi-temps)

Réponds en JSON pur (pas de markdown):
{
  "bet": "un parmi: ${availableBets.join(", ")}",
  "confidence": <nombre 50-90 argumenté, PAS 70 par défaut>,
  "raison": "<2 phrases avec au moins 2 données chiffrées concrètes (forme, H2H, blessés, enjeu, stats)>",
  "marches": {"buts":{"p":"o2.5","c":70},"btts":{"p":"oui","c":60},"resultat":{"p":"dom","c":65},"mt1":{"p":"oui","c":55}}
}`;

    try {
      const providers = [];
      if (agCfg.useDeepseek && DEEPSEEK_API_KEY) providers.push({ kind: "openai", url: "https://api.deepseek.com/v1/chat/completions", key: DEEPSEEK_API_KEY, model: agCfg.model });
      if (agCfg.usePerplexity && PERPLEXITY_API_KEY) providers.push({ kind: "openai", url: "https://api.perplexity.ai/chat/completions", key: PERPLEXITY_API_KEY, model: agCfg.model });
      if (agCfg.useMistral && MISTRAL_API_KEY) providers.push({ kind: "openai", url: "https://api.mistral.ai/v1/chat/completions", key: MISTRAL_API_KEY, model: agCfg.model });
      if (agCfg.useCohere && COHERE_API_KEY) providers.push({ kind: "cohere", key: COHERE_API_KEY, model: agCfg.model });
      if (!providers.length && DEEPSEEK_API_KEY) providers.push({ kind: "openai", url: "https://api.deepseek.com/v1/chat/completions", key: DEEPSEEK_API_KEY, model: "deepseek-chat" });
      if (!providers.length && MISTRAL_API_KEY) providers.push({ kind: "openai", url: "https://api.mistral.ai/v1/chat/completions", key: MISTRAL_API_KEY, model: "mistral-small-latest" });
      if (GROQ_API_KEY) providers.push({ kind: "openai", url: "https://api.groq.com/openai/v1/chat/completions", key: GROQ_API_KEY, model: "llama-3.3-70b-versatile" });
      if (OPENROUTER_API_KEY) providers.push({ kind: "openai", url: "https://openrouter.ai/api/v1/chat/completions", key: OPENROUTER_API_KEY, model: "meta-llama/llama-3.3-70b-instruct:free" });
      if (CEREBRAS_API_KEY) providers.push({ kind: "openai", url: "https://api.cerebras.ai/v1/chat/completions", key: CEREBRAS_API_KEY, model: "llama-3.3-70b" });

      let raw = "{}";
      for (const pv of providers) {
        try {
          if (pv.kind === "cohere") {
            const cr = await httpPost("https://api.cohere.ai/v1/chat", { model: pv.model, message: prompt, max_tokens: maxTok, temperature: temp }, { Authorization: `Bearer ${pv.key}` });
            raw = cr.text || cr.chat_history?.slice(-1)[0]?.message || "{}";
          } else {
            const rp = await httpPost(pv.url, { model: pv.model, messages: [{ role: "user", content: prompt }], temperature: temp, max_tokens: maxTok }, { Authorization: `Bearer ${pv.key}` });
            raw = rp.choices?.[0]?.message?.content || "{}";
          }
          const probe = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          if (probe && probe !== "{}" && probe.length > 8) break;
        } catch (e) {
          console.error(`[concile] ${agCfg.name} fournisseur échec: ${e.message}`);
        }
      }
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);

      const modelGaveBet = parsed && typeof parsed.bet === "string" && parsed.bet.trim().length > 0;
      if (!modelGaveBet) {
        console.error(`[concile] agent ${agCfg.name} : réponse vide (IA non joignable — quota/clé)`);
        return {
          name: agCfg.name, icon: agCfg.icon,
          bet: "—", confidence: null,
          raison: "⚠️ IA non joignable (quota épuisé ou clé manquante) — non comptée dans le verdict.",
          isChief: false, failed: true,
        };
      }

      const rawBet = parsed.bet || availableBets[0];
      if (parsed.marches && typeof parsed.marches === "object") {
        agentMarketList.push({ name: agCfg.name, marches: parsed.marches });
      }
      const { bet: validBet, corrected, original } = validateAndCorrectBet(rawBet, match, availableBets);
      const fallbackRaison = `Score actuel ${match.score_home}-${match.score_away}, analyse basée sur le rythme du match.`;
      const raisonFinal = corrected
        ? `[Corrigé: "${original}" → "${validBet}"] ${parsed.raison || fallbackRaison}`
        : (parsed.raison && parsed.raison.length > 10 ? parsed.raison : fallbackRaison);

      return {
        name: agCfg.name, icon: agCfg.icon,
        bet: validBet,
        confidence: Math.min(95, Math.max(50, isNaN(parseInt(parsed.confidence)) ? 55 : parseInt(parsed.confidence))),
        raison: raisonFinal,
        isChief: false, corrected: corrected || false,
      };
    } catch (e) {
      console.error(`[concile] agent ${agCfg.name} erreur:`, e.message);
      return getMockAgentAnalysis(agCfg, match, i);
    }
  }

  // Phase 1: Run 4 agents IN PARALLEL (not sequentially)
  const agentResults = await Promise.all([0, 1, 2, 3].map(i => runSingleAgent(i)));

  // Phase 2: Run Chief AFTER, with all agent votes available
  // Use Learning Engine weights if available, fallback to winrate-based calculation
  const learnedWeights = {};
  try {
    const latestW = getLatestAgentWeights();
    latestW.forEach(w => { learnedWeights[w.agent] = w; });
  } catch {}

  const previousVotes = agentResults.map((a) => {
    const p = agentPerf[a.name];
    const resolved = p ? p.resolved : 0;
    const lw = learnedWeights[a.name];
    const weight = lw ? Math.round(lw.weight) : (resolved >= 5 ? Math.max(10, Math.min(95, p.winrate)) : 50);
    const perfNote = lw
      ? ` — POIDS: ${weight}% (${lw.reason})`
      : resolved >= 5
        ? ` — historique: ${p.winrate}% winrate (${p.wins}/${resolved} résolus) → POIDS: ${weight}%`
        : resolved > 0 ? ` — (${resolved} prédiction(s), pas assez pour peser) → POIDS: ${weight}% (neutre)` : ` — (sans historique) → POIDS: ${weight}% (neutre)`;
    return `${a.name}: ${a.bet} (${a.confidence}%)${perfNote}`;
  }).join("\n");

  const chiefPrompt = `${personas[4]}

${matchContext}

Votes des agents avec leur fiabilité historique:
${previousVotes}

Synthétise ces votes en tenant compte de :
1. Le POIDS de chaque agent (indiqué ci-dessus, basé sur son winrate réel) : privilégie fortement les votes des agents à POIDS ≥60%, et ignore largement ceux à POIDS <35% sauf si aucun agent mieux noté ne couvre ce marché
2. Les contraintes mathématiques du score live
3. Tes connaissances sur ${match.home} et ${match.away}
4. Les objections des agents minoritaires: explique pourquoi tu les acceptes ou les rejettes
5. Le contrôle GPT-Codex Challenger: teste au moins 3 marchés alternatifs (BTTS, double chance, over/under, vainqueur ou nul selon disponibilité), puis rejette ceux dont le signal est moins robuste
6. Le contexte business/risque: enjeu du match, domicile/extérieur, match amical ou officiel, blessures/absences connues seulement si tu en es sûr; si une donnée manque, ne l'invente pas
7. Les règles propres au sport: ${sport}
8. Tu DOIS choisir parmi : ${availableBets.join(", ")}
9. DIRECTIVE MARCHÉ : Under 2.5 UNIQUEMENT si match équilibré (écart 0-1 but) ET rythme faible. Si écart >= 2 buts OU 2+ buts marqués avant 45' → Over 2.5 ou Victoire. JAMAIS Under 2.5 quand une équipe domine

Réponds en JSON pur (pas de markdown):
{
  "bet": "un parmi: ${availableBets.join(", ")}",
  "confidence": <nombre 55-92>,
  "raison": "<2 phrases max: verdict + raison principale; objection minoritaire acceptée/rejetée si elle existe>"
}`;

  try {
    const chiefProviders = [];
    if (GROQ_API_KEY) chiefProviders.push({ kind: "openai", url: "https://api.groq.com/openai/v1/chat/completions", key: GROQ_API_KEY, model: "llama-3.3-70b-versatile" });
    if (DEEPSEEK_API_KEY) chiefProviders.push({ kind: "openai", url: "https://api.deepseek.com/v1/chat/completions", key: DEEPSEEK_API_KEY, model: "deepseek-chat" });
    if (OPENROUTER_API_KEY) chiefProviders.push({ kind: "openai", url: "https://openrouter.ai/api/v1/chat/completions", key: OPENROUTER_API_KEY, model: "meta-llama/llama-3.3-70b-instruct:free" });
    if (CEREBRAS_API_KEY) chiefProviders.push({ kind: "openai", url: "https://api.cerebras.ai/v1/chat/completions", key: CEREBRAS_API_KEY, model: "llama-3.3-70b" });

    let raw = "{}";
    for (const pv of chiefProviders) {
      try {
        const rp = await httpPost(pv.url, { model: pv.model, messages: [{ role: "user", content: chiefPrompt }], temperature: 0.5, max_tokens: 400 }, { Authorization: `Bearer ${pv.key}` });
        raw = rp.choices?.[0]?.message?.content || "{}";
        const probe = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        if (probe && probe !== "{}" && probe.length > 8) break;
      } catch (e) {
        console.error(`[concile] Chief fournisseur échec: ${e.message}`);
      }
    }
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const rawBet = parsed.bet || availableBets[0];
    const { bet: validBet, corrected, original } = validateAndCorrectBet(rawBet, match, availableBets);
    const fallbackRaison = `Consensus des agents : ${agentResults.map(a => a.bet).join(", ")}. Score ${match.score_home}-${match.score_away} à ${minuteDisplay}.`;
    const raisonFinal = corrected
      ? `[Corrigé: "${original}" → "${validBet}"] ${parsed.raison || fallbackRaison}`
      : (parsed.raison && parsed.raison.length > 10 ? parsed.raison : fallbackRaison);

    agentResults.push({
      name: agentNames[4].name, icon: agentNames[4].icon,
      bet: validBet,
      confidence: Math.min(95, Math.max(50, isNaN(parseInt(parsed.confidence)) ? 55 : parseInt(parsed.confidence))),
      raison: raisonFinal,
      isChief: true, corrected: corrected || false,
    });
  } catch (e) {
    console.error(`[concile] agent Chief erreur:`, e.message);
    agentResults.push(getMockAgentAnalysis(agentNames[4], match, 4));
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
  saveAgentMarketPredictions(match, agentMarketList);

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

  // Signal fort Telegram automatique si confidence >= seuil adaptatif
  const signalThreshold = getAdaptiveSignalThreshold();
  if (analysisResult.confidence >= signalThreshold && TELEGRAM_BOT_TOKEN) {
    const signalKey = `${match.home}_${match.away}_${new Date().toISOString().slice(0, 13)}`;
    if (!_signalSentCache.has(signalKey)) {
      _signalSentCache.add(signalKey);
      const si = { Football:"⚽", Basketball:"🏀", Hockey:"🏒", Baseball:"⚾", Tennis:"🎾" };
      const ico = si[match.sport] || "🎯";
      const tgPremium = `🚨 <b>SIGNAL FORT — ${analysisResult.confidence}%</b>\n\n${ico} <b>${match.home} vs ${match.away}</b>\n🏆 ${match.competition || match.league || match.sport || ""}\n${match.minute ? `⏱ ${match.minute}' · Score : ${match.score_home ?? "?"}-${match.score_away ?? "?"}` : ""}\n\n💡 Analyse IA : <b>${analysisResult.best_bet}</b>\n📊 Confiance : <b>${analysisResult.confidence}%</b>\n${analysisResult.raison ? `\n<i>${String(analysisResult.raison).slice(0, 200)}</i>` : ""}\n\n━━━━━━━━━━━━━━━━━━\n⚠️ 18+ — Jeu responsable`;
      const tgFree = `🚨 <b>SIGNAL FORT DÉTECTÉ — ${analysisResult.confidence}%</b>\n\n${ico} <b>${match.home} vs ${match.away}</b>\n🏆 ${match.competition || match.league || match.sport || ""}\n${match.minute ? `⏱ ${match.minute}' · Score : ${match.score_home ?? "?"}-${match.score_away ?? "?"}` : ""}\n\n👉 <a href="https://www.touslesmatchs.com/#plan-carte">⚡ Voir l'analyse complète – 1 €</a>\n\n━━━━━━━━━━━━━━━━━━\n⚠️ 18+ — Jeu responsable`;
      if (TELEGRAM_PREMIUM_CHANNEL_ID) sendTelegramMessage(TELEGRAM_PREMIUM_CHANNEL_ID, tgPremium).then(ok => console.log(`[signal-fort] Telegram premium: ${ok ? "OK" : "FAIL"}`));
      const todayStr = new Date().toISOString().slice(0, 10);
      if (_freeSignalDailyDate.date !== todayStr) { _freeSignalDailyDate.date = todayStr; _freeSignalDailyDate.count = 0; }
      if (_freeSignalDailyDate.count < 1 && TELEGRAM_CHANNEL_ID) {
        _freeSignalDailyDate.count++;
        sendTelegramMessage(TELEGRAM_CHANNEL_ID, tgFree).then(ok => console.log(`[signal-fort] Telegram free: ${ok ? "OK" : "FAIL"}`));
      } else {
        console.log(`[signal-fort] Free channel: déjà 1 signal envoyé aujourd'hui, skip`);
      }
    }
  }

  // Évaluation shadow en parallèle (sans bloquer la réponse Concile)
  runShadowEvaluation(match).catch(e => console.error("[shadow] bg:", e.message));

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
    `Le score actuel de ${match.score_home}-${match.score_away} et la dynamique du match orientent clairement vers ce marché.`,
    `Analyse des patterns : ce type de configuration à la ${minute}' converge régulièrement vers ce résultat.`,
    `En synthèse des votes du Concile et du contexte temps réel, ce marché offre le meilleur ratio risque/récompense.`,
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
    { name: "Perplexity-Web", icon: "🌐", model: "sonar-pro" },
    { name: "DeepSeek-V3", icon: "🔮", model: "deepseek-chat" },
    { name: "Mistral-Large", icon: "🌊", model: "mistral-large-latest" },
    { name: "Cohere-Command", icon: "🧬", model: "command-r-plus" },
    { name: "Claude Chief", icon: "👑", model: "llama-3.3-70b-versatile", isChief: true },
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

// ── Learning Engine ──────────────────────────────────────────────────────────
// Learning Engine Configuration — all parameters configurable, nothing hardcoded
const LEARNING_CONFIG_DEFAULTS = {
  version: "2.0.0",
  wilson_z: 1.645,
  ema_alpha: 0.05,
  min_resolutions: 10,
  min_context_resolutions: 5,
  roi_cap: 0.3,
  default_weight: 50,
  weight_wilson_share: 0.6,
  weight_ema_share: 0.4,
  weight_min: 5,
  weight_max: 95,
  confidence_thresholds: {
    very_reliable: { minMatches: 50, minWilson: 0.55, label: "Tres fiable" },
    reliable: { minMatches: 30, minWilson: 0.45, label: "Fiable" },
    progressing: { minMatches: 15, minWilson: 0.35, label: "En progression" },
    low_data: { minMatches: 10, minWilson: 0, label: "Peu de donnees" },
    learning: { minMatches: 0, minWilson: 0, label: "En apprentissage" },
  },
};

function loadLearningConfig(variant = "production") {
  try {
    const row = db.prepare(`SELECT config_json FROM learning_config WHERE variant = ? ORDER BY updated_at DESC LIMIT 1`).get(variant);
    if (row) return { ...LEARNING_CONFIG_DEFAULTS, ...JSON.parse(row.config_json) };
  } catch (e) { console.error("[learning-config] load:", e.message); }
  return { ...LEARNING_CONFIG_DEFAULTS };
}

function saveLearningConfig(newConfig, changedBy = "admin", variant = "production") {
  const current = loadLearningConfig(variant);
  const changes = [];
  for (const [key, val] of Object.entries(newConfig)) {
    if (key === "version") continue;
    const oldVal = JSON.stringify(current[key]);
    const newVal = JSON.stringify(val);
    if (oldVal !== newVal) {
      changes.push({ param_name: key, old_value: oldVal, new_value: newVal });
    }
  }
  const oldVersion = current.version || "2.0.0";
  let newVersion = oldVersion;
  if (changes.length > 0) {
    const parts = oldVersion.split(".").map(Number);
    parts[2] = (parts[2] || 0) + 1;
    newVersion = parts.join(".");
  }
  const merged = { ...current, ...newConfig, version: newVersion };
  db.prepare(`INSERT INTO learning_config (config_json, variant, updated_by) VALUES (?, ?, ?)`).run(JSON.stringify(merged), variant, changedBy);
  const insertHistory = db.prepare(`INSERT INTO learning_config_history (param_name, old_value, new_value, variant, changed_by) VALUES (?, ?, ?, ?, ?)`);
  for (const c of changes) {
    insertHistory.run(c.param_name, c.old_value, c.new_value, variant, changedBy);
  }
  if (changes.length > 0) {
    insertHistory.run("version", JSON.stringify(oldVersion), JSON.stringify(newVersion), variant, changedBy);
  }
  return { config: merged, changes, version: newVersion };
}

function listConfigVersions(variant = "production") {
  return db.prepare(`SELECT id, config_json, variant, updated_by, updated_at FROM learning_config WHERE variant = ? ORDER BY updated_at DESC LIMIT 50`).all(variant).map(r => {
    const cfg = JSON.parse(r.config_json);
    return { id: r.id, version: cfg.version || "?", updatedBy: r.updated_by, updatedAt: r.updated_at };
  });
}

function restoreConfigVersion(configId, changedBy = "admin") {
  const row = db.prepare(`SELECT config_json, variant FROM learning_config WHERE id = ?`).get(configId);
  if (!row) return null;
  const restored = JSON.parse(row.config_json);
  return saveLearningConfig(restored, `${changedBy} (restore v${restored.version})`, row.variant);
}

function saveLearningLabRun(configId, runType, roi, winrate, totalMatches, curve, comparison, createdBy) {
  db.prepare(`
    INSERT INTO learning_lab_runs (config_id, run_type, roi, winrate, total_matches, curve_json, comparison_json, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(configId, runType, roi, winrate, totalMatches, JSON.stringify(curve || []), JSON.stringify(comparison || {}), createdBy);
}

function getLatestRunsForConfig(configId, limit = 10) {
  return db.prepare(`
    SELECT * FROM learning_lab_runs WHERE config_id = ? ORDER BY created_at DESC LIMIT ?
  `).all(configId, limit);
}

function validateConfigPromotion(configId) {
  const row = db.prepare(`SELECT * FROM learning_config WHERE id = ?`).get(configId);
  if (!row) return { valid: false, errors: ["Config introuvable"] };

  const cfg = JSON.parse(row.config_json);
  const runs = getLatestRunsForConfig(configId);
  const backtests = runs.filter(r => r.run_type === "backtest");
  const current = loadLearningConfig("production");
  const currentStats = getLearningEngineStats();

  const errors = [];
  const warnings = [];

  // Critère 1 : minimum 100 paris simulés/backtestés
  const totalMatches = backtests.reduce((sum, r) => sum + (r.total_matches || 0), 0);
  if (totalMatches < 100) errors.push(`Insuffisant d'historique: ${totalMatches} matchs (min 100)`);

  // Critère 2 : ROI supérieur à la version actuelle
  if (backtests.length > 0) {
    const avgRoi = backtests.reduce((sum, r) => sum + (r.roi || 0), 0) / backtests.length;
    if (avgRoi <= (currentStats.overall.roi || 0)) {
      warnings.push(`ROI simulé (${avgRoi.toFixed(1)}%) pas meilleur que production (${(currentStats.overall.roi || 0)}%)`);
    }
  }

  // Critère 3 : Winrate non dégradé
  if (backtests.length > 0) {
    const avgWinrate = backtests.reduce((sum, r) => sum + (r.winrate || 0), 0) / backtests.length;
    if (avgWinrate < (currentStats.overall.winrate || 50)) {
      errors.push(`Winrate degradé: ${avgWinrate}% vs ${currentStats.overall.winrate}%`);
    }
  }

  // Critère 4 : aucun test en erreur
  const errorRuns = runs.filter(r => r.roi === null || r.winrate === null);
  if (errorRuns.length > 0) errors.push(`${errorRuns.length} test(s) en erreur`);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: { totalMatches, avgRoi: backtests.length > 0 ? (backtests.reduce((s, r) => s + r.roi, 0) / backtests.length).toFixed(1) : 0, avgWinrate: backtests.length > 0 ? (backtests.reduce((s, r) => s + r.winrate, 0) / backtests.length).toFixed(0) : 0 }
  };
}

function promoteConfigToProduction(configId, promotedBy = "admin") {
  const validation = validateConfigPromotion(configId);
  if (!validation.valid) return { ok: false, errors: validation.errors };

  const row = db.prepare(`SELECT config_json FROM learning_config WHERE id = ?`).get(configId);
  const cfg = JSON.parse(row.config_json);

  db.prepare(`UPDATE learning_config SET status = 'production' WHERE variant = 'production' AND status = 'production'`).run();
  db.prepare(`UPDATE learning_config SET status = 'production' WHERE id = ?`).run(configId);

  return { ok: true, version: cfg.version, stats: validation.stats, message: `v${cfg.version} promue en production` };
}

function getLearningLabDashboard() {
  const current = loadLearningConfig("production");
  const allConfigs = db.prepare(`
    SELECT id, config_json, status, updated_by, updated_at FROM learning_config ORDER BY updated_at DESC LIMIT 20
  `).all().map(r => {
    const cfg = JSON.parse(r.config_json);
    const runs = getLatestRunsForConfig(r.id, 5);
    const backtests = runs.filter(r => r.run_type === "backtest");
    return {
      id: r.id, version: cfg.version, status: r.status, updatedBy: r.updated_by, updatedAt: r.updated_at,
      recentRuns: runs.length, avgRoi: backtests.length > 0 ? (backtests.reduce((s, r) => s + r.roi, 0) / backtests.length).toFixed(1) : null,
      avgWinrate: backtests.length > 0 ? (backtests.reduce((s, r) => s + r.winrate, 0) / backtests.length).toFixed(0) : null
    };
  });

  return {
    current: { version: current.version, roi: getLearningEngineStats().overall.roi, winrate: getLearningEngineStats().overall.winrate },
    configs: allConfigs,
    stats: getLearningEngineStats()
  };
}

function getLearningConfigHistory(limit = 50) {
  return db.prepare(`SELECT * FROM learning_config_history ORDER BY changed_at DESC LIMIT ?`).all(limit);
}

let LEARNING_CONFIG = loadLearningConfig();

// ── Learning Engine — Simulation & Backtest ─────────────────────────────────

function simulateWeights(customConfig) {
  const cfg = { ...LEARNING_CONFIG, ...customConfig };
  const { wilson_z, ema_alpha, min_resolutions, roi_cap, default_weight, weight_wilson_share, weight_ema_share, weight_min, weight_max } = cfg;

  const agents = db.prepare(`
    SELECT agent_name,
      COUNT(*) as total,
      SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
    FROM agent_predictions WHERE outcome IN ('win','loss') GROUP BY agent_name
  `).all();

  const results = [];
  for (const ag of agents) {
    const resolved = ag.wins + ag.losses;
    if (resolved < 3) continue;
    const wilson = wilsonScoreLowerBound(ag.wins, resolved, wilson_z);
    const outcomes = db.prepare(`SELECT outcome FROM agent_predictions WHERE agent_name = ? AND outcome IN ('win','loss') ORDER BY created_at ASC`).all(ag.agent_name).map(r => r.outcome);
    const ema = computeEMA(outcomes, ema_alpha);
    const roiData = computeAgentROI(ag.agent_name);
    const roiMultiplier = 1 + Math.max(-roi_cap, Math.min(roi_cap, roiData.roi / 100));
    let weight = resolved < min_resolutions ? default_weight : Math.round((wilson * weight_wilson_share + ema * weight_ema_share) * 100 * roiMultiplier);
    weight = Math.max(weight_min, Math.min(weight_max, weight));
    const currentRow = db.prepare(`SELECT weight FROM agent_weights WHERE agent_name = ? AND context_key = 'global' ORDER BY computed_at DESC LIMIT 1`).get(ag.agent_name);
    results.push({ agent: ag.agent_name, simulatedWeight: weight, currentWeight: currentRow ? currentRow.weight : null, wilson: (wilson * 100).toFixed(1), ema: (ema * 100).toFixed(1), roiMultiplier: roiMultiplier.toFixed(2), resolved, roi: roiData.roi, delta: currentRow ? weight - currentRow.weight : null });
  }
  return { config: cfg, agents: results.sort((a, b) => b.simulatedWeight - a.simulatedWeight) };
}

function runBacktest(customConfig) {
  const cfg = { ...LEARNING_CONFIG, ...customConfig };
  const { wilson_z, ema_alpha, min_resolutions, roi_cap, weight_wilson_share, weight_ema_share, default_weight, weight_min, weight_max } = cfg;

  const analyses = db.prepare(`
    SELECT match_key, outcome, confidence, cote, agents_json, created_at
    FROM concile_analyses WHERE outcome IN ('win','loss') ORDER BY created_at ASC
  `).all();

  if (analyses.length === 0) return { config: cfg, results: { roi: 0, winrate: 0, total: 0, curve: [] }, comparison: null };

  let stake = 0, returns = 0, wins = 0;
  const curve = [];
  const agentStats = {};

  for (const a of analyses) {
    let agents = [];
    try { agents = JSON.parse(a.agents_json || "[]"); } catch (e) {}

    for (const ag of agents) {
      const name = ag.agent || ag.name;
      if (!name) continue;
      if (!agentStats[name]) agentStats[name] = { wins: 0, total: 0, outcomes: [] };
    }

    const weightedVotes = {};
    for (const ag of agents) {
      const name = ag.agent || ag.name;
      if (!name) continue;
      const s = agentStats[name];
      const wilson = wilsonScoreLowerBound(s.wins, s.total, wilson_z);
      const ema = computeEMA(s.outcomes, ema_alpha);
      const roi = s.total > 0 ? (s.wins * 1.7 - s.total) / s.total * 100 : 0;
      const roiMult = 1 + Math.max(-roi_cap, Math.min(roi_cap, roi / 100));
      let w = s.total < min_resolutions ? default_weight : Math.round((wilson * weight_wilson_share + ema * weight_ema_share) * 100 * roiMult);
      w = Math.max(weight_min, Math.min(weight_max, w));
      weightedVotes[name] = w;
    }

    const cote = a.cote || Math.min(1.95, ((1 / (Math.max(55, a.confidence || 55) / 100)) * 1.45));
    stake += 1;
    if (a.outcome === "win") { returns += cote; wins++; }

    for (const ag of agents) {
      const name = ag.agent || ag.name;
      if (!name) continue;
      agentStats[name].total++;
      agentStats[name].outcomes.push(a.outcome);
      if (a.outcome === "win") agentStats[name].wins++;
    }

    if (stake % 5 === 0 || stake === analyses.length) {
      curve.push({ matchIndex: stake, roi: Math.round(((returns - stake) / stake) * 1000) / 10, winrate: Math.round(wins / stake * 100) });
    }
  }

  const backtestROI = stake > 0 ? Math.round(((returns - stake) / stake) * 1000) / 10 : 0;
  const backtestWinrate = stake > 0 ? Math.round(wins / stake * 100) : 0;

  const currentStats = getLearningEngineStats();
  const comparison = {
    current: { roi: currentStats.overall.roi, winrate: currentStats.overall.winrate, total: currentStats.overall.total },
    backtest: { roi: backtestROI, winrate: backtestWinrate, total: stake },
    delta: { roi: backtestROI - (currentStats.overall.roi || 0), winrate: backtestWinrate - (currentStats.overall.winrate || 0) }
  };

  return { config: cfg, results: { roi: backtestROI, winrate: backtestWinrate, total: stake, curve }, comparison };
}

function runSimulationAndSave(customConfig, configId, createdBy) {
  const result = simulateWeights(customConfig);
  if (configId) saveLearningLabRun(configId, "simulation", null, null, null, [], { simulation: true }, createdBy);
  return result;
}

function runBacktestAndSave(customConfig, configId, createdBy) {
  const result = runBacktest(customConfig);
  if (configId) saveLearningLabRun(configId, "backtest", result.results.roi, result.results.winrate, result.results.total, result.results.curve, result.comparison, createdBy);
  return result;
}

function wilsonScoreLowerBound(wins, total, z) {
  if (total === 0) return 0;
  const p = wins / total;
  const denominator = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return (centre - spread) / denominator;
}

function computeEMA(outcomes, alpha) {
  if (!outcomes || outcomes.length === 0) return 0.5;
  let ema = 0.5;
  for (const o of outcomes) {
    const val = o === "win" ? 1 : 0;
    ema = alpha * val + (1 - alpha) * ema;
  }
  return ema;
}

function computeConfidenceIndex(totalResolved, wilsonScore, emaScore) {
  const { confidence_thresholds, min_resolutions } = LEARNING_CONFIG;
  if (totalResolved < min_resolutions) return { level: "learning", label: confidence_thresholds.learning.label, color: "red" };
  const emaStability = Math.abs(emaScore - 0.5) < 0.15 ? 0 : 1;
  if (totalResolved >= confidence_thresholds.very_reliable.minMatches && wilsonScore >= confidence_thresholds.very_reliable.minWilson && emaStability)
    return { level: "very_reliable", label: confidence_thresholds.very_reliable.label, color: "green" };
  if (totalResolved >= confidence_thresholds.reliable.minMatches && wilsonScore >= confidence_thresholds.reliable.minWilson)
    return { level: "reliable", label: confidence_thresholds.reliable.label, color: "green" };
  if (totalResolved >= confidence_thresholds.progressing.minMatches && wilsonScore >= confidence_thresholds.progressing.minWilson)
    return { level: "progressing", label: confidence_thresholds.progressing.label, color: "orange" };
  if (totalResolved >= confidence_thresholds.low_data.minMatches)
    return { level: "low_data", label: confidence_thresholds.low_data.label, color: "orange" };
  return { level: "learning", label: confidence_thresholds.learning.label, color: "red" };
}

function buildExplicability(agentName, oldWeight, newWeight, wilson, ema, roiMultiplier, resolved, contextLabel) {
  const delta = newWeight - (oldWeight || 50);
  const parts = [];
  if (delta !== 0) parts.push(`${agentName} passe de ${oldWeight !== null ? Math.round(oldWeight) : '50 (defaut)'} a ${Math.round(newWeight)}`);
  else parts.push(`${agentName} reste a ${Math.round(newWeight)}`);
  parts.push(`Wilson: ${(wilson * 100).toFixed(1)}%`);
  parts.push(`EMA: ${(ema * 100).toFixed(1)}%`);
  parts.push(`ROI multiplicateur: x${roiMultiplier.toFixed(2)}`);
  if (contextLabel !== "global") parts.push(`Contexte: ${contextLabel}`);
  parts.push(`${resolved} matchs resolus`);
  const conf = computeConfidenceIndex(resolved, wilson, ema);
  parts.push(`Confiance: ${conf.label}`);
  return parts.join(" | ");
}

function computeContextWeight(wins, total, outcomes, roiMultiplier, contextLabel) {
  const { wilson_z, ema_alpha, min_resolutions, min_context_resolutions, default_weight, weight_wilson_share, weight_ema_share, weight_min, weight_max } = LEARNING_CONFIG;
  const wilson = wilsonScoreLowerBound(wins, total, wilson_z);
  const ema = computeEMA(outcomes, ema_alpha);
  let weight;
  if (total < min_context_resolutions) {
    weight = default_weight;
  } else if (total < min_resolutions) {
    weight = default_weight;
  } else {
    const baseScore = (wilson * weight_wilson_share + ema * weight_ema_share) * 100;
    weight = Math.round(baseScore * roiMultiplier);
    weight = Math.max(weight_min, Math.min(weight_max, weight));
  }
  return { weight, wilson, ema };
}

function computeAgentWeights() {
  try {
    LEARNING_CONFIG = loadLearningConfig();
    const { wilson_z, ema_alpha, min_resolutions, min_context_resolutions, roi_cap, default_weight, weight_wilson_share, weight_ema_share, weight_min, weight_max, version } = LEARNING_CONFIG;

    const agents = db.prepare(`
      SELECT agent_name,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM agent_predictions
      WHERE outcome IN ('win','loss')
      GROUP BY agent_name
    `).all();

    const results = [];
    const insert = db.prepare(`
      INSERT INTO agent_weights (agent_name, weight, wilson_score, ema_score, roi_multiplier, winrate, total_resolved, roi, sport, bet_category, context_key, old_weight, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const ag of agents) {
      const resolved = ag.wins + ag.losses;
      if (resolved < 3) continue;

      const globalWinrate = Math.round(ag.wins / resolved * 100);
      const wilson = wilsonScoreLowerBound(ag.wins, resolved, wilson_z);

      const outcomes = db.prepare(`
        SELECT outcome FROM agent_predictions
        WHERE agent_name = ? AND outcome IN ('win','loss')
        ORDER BY created_at ASC
      `).all(ag.agent_name).map(r => r.outcome);
      const ema = computeEMA(outcomes, ema_alpha);

      const roiData = computeAgentROI(ag.agent_name);
      const roi = roiData.roi;
      const roiMultiplier = 1 + Math.max(-roi_cap, Math.min(roi_cap, roi / 100));

      let weight;
      if (resolved < min_resolutions) {
        weight = default_weight;
      } else {
        const baseScore = (wilson * weight_wilson_share + ema * weight_ema_share) * 100;
        weight = Math.round(baseScore * roiMultiplier);
        weight = Math.max(weight_min, Math.min(weight_max, weight));
      }

      const oldWeightRow = db.prepare(`
        SELECT weight FROM agent_weights WHERE agent_name = ? AND context_key = 'global' ORDER BY computed_at DESC LIMIT 1
      `).get(ag.agent_name);
      const oldWeight = oldWeightRow ? oldWeightRow.weight : null;

      const confidence = computeConfidenceIndex(resolved, wilson, ema);
      const explicability = buildExplicability(ag.agent_name, oldWeight, weight, wilson, ema, roiMultiplier, resolved, "global");

      const reason = `[v${version}] ${explicability}`;
      insert.run(ag.agent_name, weight, wilson, ema, roiMultiplier, globalWinrate, resolved, roi, "all", "all", "global", oldWeight, reason);

      // Contextual weights by sport
      const sportRows = db.prepare(`
        SELECT ap.outcome, ca.sport
        FROM agent_predictions ap
        LEFT JOIN concile_analyses ca ON ap.match_key = ca.match_key
        WHERE ap.agent_name = ? AND ap.outcome IN ('win','loss') AND ca.sport IS NOT NULL
      `).all(ag.agent_name);

      const bySport = {};
      for (const r of sportRows) {
        if (!bySport[r.sport]) bySport[r.sport] = { wins: 0, total: 0, outcomes: [] };
        bySport[r.sport].total++;
        if (r.outcome === "win") bySport[r.sport].wins++;
        bySport[r.sport].outcomes.push(r.outcome);
      }

      for (const [sport, data] of Object.entries(bySport)) {
        if (data.total < min_context_resolutions) continue;
        const ctx = computeContextWeight(data.wins, data.total, data.outcomes, roiMultiplier, sport);
        insert.run(ag.agent_name, ctx.weight, ctx.wilson, ctx.ema, roiMultiplier, Math.round(data.wins / data.total * 100), data.total, roi, sport, "all", `sport:${sport}`, null, `[v${version}] ${sport}: Wilson ${(ctx.wilson * 100).toFixed(1)}% | EMA ${(ctx.ema * 100).toFixed(1)}% | ${data.total} matchs`);
      }

      // Contextual weights by competition (championship)
      const compRows = db.prepare(`
        SELECT ap.outcome, ca.competition, ca.sport
        FROM agent_predictions ap
        LEFT JOIN concile_analyses ca ON ap.match_key = ca.match_key
        WHERE ap.agent_name = ? AND ap.outcome IN ('win','loss') AND ca.competition IS NOT NULL AND ca.competition != ''
      `).all(ag.agent_name);

      const byComp = {};
      for (const r of compRows) {
        const key = r.competition;
        if (!byComp[key]) byComp[key] = { wins: 0, total: 0, outcomes: [], sport: r.sport };
        byComp[key].total++;
        if (r.outcome === "win") byComp[key].wins++;
        byComp[key].outcomes.push(r.outcome);
      }

      for (const [comp, data] of Object.entries(byComp)) {
        if (data.total < min_context_resolutions) continue;
        const ctx = computeContextWeight(data.wins, data.total, data.outcomes, roiMultiplier, comp);
        insert.run(ag.agent_name, ctx.weight, ctx.wilson, ctx.ema, roiMultiplier, Math.round(data.wins / data.total * 100), data.total, roi, data.sport || "all", "all", `comp:${comp}`, null, `[v${version}] ${comp}: Wilson ${(ctx.wilson * 100).toFixed(1)}% | EMA ${(ctx.ema * 100).toFixed(1)}% | ${data.total} matchs`);
      }

      // Contextual weights by bet_category
      const catRows = db.prepare(`
        SELECT ap.outcome, ca.bet_category
        FROM agent_predictions ap
        LEFT JOIN concile_analyses ca ON ap.match_key = ca.match_key
        WHERE ap.agent_name = ? AND ap.outcome IN ('win','loss') AND ca.bet_category IS NOT NULL
      `).all(ag.agent_name);

      const byCat = {};
      for (const r of catRows) {
        if (!byCat[r.bet_category]) byCat[r.bet_category] = { wins: 0, total: 0, outcomes: [] };
        byCat[r.bet_category].total++;
        if (r.outcome === "win") byCat[r.bet_category].wins++;
        byCat[r.bet_category].outcomes.push(r.outcome);
      }

      for (const [cat, data] of Object.entries(byCat)) {
        if (data.total < min_context_resolutions) continue;
        const ctx = computeContextWeight(data.wins, data.total, data.outcomes, roiMultiplier, cat);
        insert.run(ag.agent_name, ctx.weight, ctx.wilson, ctx.ema, roiMultiplier, Math.round(data.wins / data.total * 100), data.total, roi, "all", cat, `bet:${cat}`, null, `[v${version}] ${cat}: Wilson ${(ctx.wilson * 100).toFixed(1)}% | EMA ${(ctx.ema * 100).toFixed(1)}% | ${data.total} matchs`);
      }

      results.push({ agent: ag.agent_name, weight, wilson: (wilson * 100).toFixed(1), ema: (ema * 100).toFixed(1), roiMultiplier: roiMultiplier.toFixed(2), globalWinrate, resolved, roi, belowThreshold: resolved < min_resolutions, confidence, explicability });
    }

    return results;
  } catch (e) {
    console.error("[learning-engine] computeWeights:", e.message);
    return [];
  }
}

function computeAgentROI(agentName) {
  try {
    const rows = db.prepare(`
      SELECT ap.outcome, ca.confidence, ca.cote
      FROM agent_predictions ap
      LEFT JOIN concile_analyses ca ON ap.match_key = ca.match_key
      WHERE ap.agent_name = ? AND ap.outcome IN ('win','loss')
    `).all(agentName);

    let totalStake = 0, totalReturn = 0;
    for (const r of rows) {
      const cote = r.cote || Math.min(1.95, ((1 / (Math.max(55, r.confidence || 55) / 100)) * 1.45));
      totalStake += 1;
      if (r.outcome === "win") totalReturn += cote;
    }
    const roi = totalStake > 0 ? Math.round(((totalReturn - totalStake) / totalStake) * 1000) / 10 : 0;
    return { roi, totalStake, totalReturn: Math.round(totalReturn * 100) / 100 };
  } catch (e) {
    return { roi: 0, totalStake: 0, totalReturn: 0 };
  }
}

function getLatestAgentWeights() {
  try {
    const agents = db.prepare(`
      SELECT DISTINCT agent_name FROM agent_weights WHERE context_key = 'global' ORDER BY agent_name
    `).all().map(r => r.agent_name);

    return agents.map(name => {
      const latest = db.prepare(`
        SELECT * FROM agent_weights WHERE agent_name = ? AND context_key = 'global' ORDER BY computed_at DESC LIMIT 1
      `).get(name);
      if (!latest) return null;

      const previous = db.prepare(`
        SELECT weight FROM agent_weights WHERE agent_name = ? AND context_key = 'global' ORDER BY computed_at DESC LIMIT 1 OFFSET 1
      `).get(name);

      const history = db.prepare(`
        SELECT weight, wilson_score, ema_score, roi_multiplier, winrate, roi, total_resolved, reason, computed_at FROM agent_weights
        WHERE agent_name = ? AND context_key = 'global' ORDER BY computed_at DESC LIMIT 30
      `).all(name);

      const contextual = db.prepare(`
        SELECT context_key, weight, wilson_score, ema_score, total_resolved, winrate, computed_at FROM agent_weights
        WHERE agent_name = ? AND context_key != 'global' ORDER BY computed_at DESC LIMIT 20
      `).all(name);

      const belowThreshold = latest.total_resolved < LEARNING_CONFIG.min_resolutions;
      const confidence = computeConfidenceIndex(latest.total_resolved, latest.wilson_score, latest.ema_score);

      return {
        agent: name,
        weight: latest.weight,
        wilsonScore: latest.wilson_score,
        emaScore: latest.ema_score,
        roiMultiplier: latest.roi_multiplier,
        winrate: latest.winrate,
        resolved: latest.total_resolved,
        roi: latest.roi,
        reason: latest.reason,
        updatedAt: latest.computed_at,
        oldWeight: latest.old_weight,
        previousWeight: previous ? previous.weight : null,
        trend: previous ? (latest.weight > previous.weight ? "up" : latest.weight < previous.weight ? "down" : "stable") : "new",
        belowThreshold,
        confidence,
        minResolutions: LEARNING_CONFIG.min_resolutions,
        contextual,
        history,
      };
    }).filter(Boolean);
  } catch (e) {
    console.error("[learning-engine] getWeights:", e.message);
    return [];
  }
}

function getLearningEngineStats() {
  try {
    const overall = db.prepare(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses WHERE outcome IN ('win','loss')
    `).get();

    const overallROI = (() => {
      const rows = db.prepare(`
        SELECT outcome, confidence, cote FROM concile_analyses WHERE outcome IN ('win','loss')
      `).all();
      let stake = 0, ret = 0;
      for (const r of rows) {
        const cote = r.cote || Math.min(1.95, ((1 / (Math.max(55, r.confidence || 55) / 100)) * 1.45));
        stake += 1;
        if (r.outcome === "win") ret += cote;
      }
      return stake > 0 ? Math.round(((ret - stake) / stake) * 1000) / 10 : 0;
    })();

    const byCompetition = db.prepare(`
      SELECT competition, sport, country,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses WHERE outcome IN ('win','loss') AND competition != ''
      GROUP BY competition ORDER BY total DESC
    `).all().map(r => ({
      ...r, winrate: r.total > 0 ? Math.round(r.wins / r.total * 100) : 0
    }));

    const bySport = db.prepare(`
      SELECT sport,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses WHERE outcome IN ('win','loss')
      GROUP BY sport ORDER BY total DESC
    `).all().map(r => ({
      ...r, winrate: r.total > 0 ? Math.round(r.wins / r.total * 100) : 0
    }));

    const byBetCategory = db.prepare(`
      SELECT bet_category,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses WHERE outcome IN ('win','loss') AND bet_category IS NOT NULL
      GROUP BY bet_category ORDER BY total DESC
    `).all().map(r => ({
      ...r, winrate: r.total > 0 ? Math.round(r.wins / r.total * 100) : 0
    }));

    const byConfidenceBracket = db.prepare(`
      SELECT
        CASE
          WHEN confidence < 60 THEN '55-59'
          WHEN confidence < 70 THEN '60-69'
          WHEN confidence < 80 THEN '70-79'
          WHEN confidence < 90 THEN '80-89'
          ELSE '90+'
        END as bracket,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins
      FROM concile_analyses WHERE outcome IN ('win','loss')
      GROUP BY bracket ORDER BY bracket
    `).all().map(r => ({
      ...r, winrate: r.total > 0 ? Math.round(r.wins / r.total * 100) : 0
    }));

    return {
      config: LEARNING_CONFIG,
      overall: {
        total: overall.total, wins: overall.wins, losses: overall.losses,
        winrate: overall.total > 0 ? Math.round(overall.wins / overall.total * 100) : 0,
        roi: overallROI,
      },
      byCompetition, bySport, byBetCategory, byConfidenceBracket,
    };
  } catch (e) {
    console.error("[learning-engine] stats:", e.message);
    return { config: LEARNING_CONFIG, overall: {}, byCompetition: [], bySport: [], byBetCategory: [], byConfidenceBracket: [] };
  }
}

function extractCountry(competition) {
  if (!competition) return null;
  const map = {
    "France": ["Ligue 1","Ligue 2","Coupe de France","National"],
    "Espagne": ["La Liga","Liga","Segunda","Copa del Rey","LaLiga"],
    "Angleterre": ["Premier League","Championship","FA Cup","EFL","League One","League Two"],
    "Allemagne": ["Bundesliga","2. Bundesliga","DFB","3. Liga"],
    "Italie": ["Serie A","Serie B","Serie C","Coppa Italia"],
    "Portugal": ["Primeira Liga","Liga Portugal","Taça de Portugal"],
    "Pays-Bas": ["Eredivisie","Eerste Divisie","KNVB"],
    "Belgique": ["Pro League","First Division","Division 1"],
    "Turquie": ["Süper Lig","Super Lig","TFF"],
    "Brésil": ["Brasileirao","Serie A Brazil","Serie B Brazil","Serie C"],
    "USA": ["MLS","USL","NWSL","MLS Next"],
    "Chili": ["Primera Division","Copa Chile","Segunda Division"],
    "Argentine": ["Liga Profesional","Primera Nacional","Copa Argentina"],
    "International": ["World Cup","Copa América","Euro","Champions League","Europa League","Nations League","AFC","CAF","CONCACAF","FIFA"],
  };
  const comp = competition.toLowerCase();
  for (const [country, keywords] of Object.entries(map)) {
    if (keywords.some(k => comp.includes(k.toLowerCase()))) return country;
  }
  return null;
}

function saveConcileAnalysis(match, result, pickBet) {
  try {
    const minute = parseInt(match.minute) || null;
    const statsStatus = result.statsStatus?.status || "unavailable";
    const id = match?.id || match?.fixtureId || match?.sourceMatchId || `${match?.home}_${match?.away}`;
    const matchKey = `${id}_${getTodayStr()}`;
    const sport = match.sport || "Football";
    const competition = match.competition || match.league || "";
    const learningProfile = getLearningProfile({ sport, competition, bet: result.best_bet });
    const learningAssessment = assessLearningProfile(learningProfile, 5);
    const betCat = categorizeBet(result.best_bet);
    const country = extractCountry(competition);
    const neutral = isNeutralComp(competition) ? 1 : 0;

    const liveStats = result.statsStatus?.stats || null;
    const homePoss = liveStats?.possession?.home ?? null;
    const awayPoss = liveStats?.possession?.away ?? null;
    const homeShots = liveStats?.shots?.home ?? liveStats?.shots_on_goal?.home ?? null;
    const awayShots = liveStats?.shots?.away ?? liveStats?.shots_on_goal?.away ?? null;

    const cote = Math.min(1.95, ((1 / (Math.max(55, result.confidence) / 100)) * 1.45));

    const existing = db.prepare("SELECT id, best_bet FROM concile_analyses WHERE match_key = ?").get(matchKey);
    if (existing) {
      const betChanged = existing.best_bet !== result.best_bet;
      db.prepare(`
        UPDATE concile_analyses SET
          minute_at_analysis = ?, score_home_at_analysis = ?, score_away_at_analysis = ?,
          stats_status = ?, best_bet = ?, confidence = ?, raison = ?,
          consensus_votes = ?, agents_json = ?, pick_bet = ?,
          learning_tier = ?, learning_note = ?,
          bet_category = ?, home_possession = ?, away_possession = ?,
          home_shots = ?, away_shots = ?, cote = ?, analysed_at = datetime('now')
          ${betChanged ? ", outcome = NULL, final_score_home = NULL, final_score_away = NULL, resolved_at = NULL, gain = NULL" : ""}
        WHERE match_key = ?
      `).run(
        minute, match.score_home ?? null, match.score_away ?? null, statsStatus,
        result.best_bet, result.confidence, result.raison || "",
        result.consensus_votes || 0,
        JSON.stringify((result.agents || []).map(a => ({ name: a.name, bet: a.bet, confidence: a.confidence }))),
        pickBet || null,
        learningAssessment.tier, learningAssessment.reasons.join("; "),
        betCat, homePoss, awayPoss, homeShots, awayShots,
        Math.round(cote * 100) / 100,
        matchKey
      );
    } else {
      db.prepare(`
        INSERT INTO concile_analyses
          (match_key, home, away, competition, minute_at_analysis,
           score_home_at_analysis, score_away_at_analysis, stats_status,
           best_bet, confidence, raison, consensus_votes, agents_json, pick_bet,
           sport, learning_tier, learning_note, home_logo, away_logo,
           bet_category, country, is_neutral,
           home_possession, away_possession, home_shots, away_shots, cote)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        matchKey,
        match.home, match.away, competition, minute,
        match.score_home ?? null, match.score_away ?? null, statsStatus,
        result.best_bet, result.confidence, result.raison || "",
        result.consensus_votes || 0,
        JSON.stringify((result.agents || []).map(a => ({ name: a.name, bet: a.bet, confidence: a.confidence }))),
        pickBet || null, sport,
        learningAssessment.tier, learningAssessment.reasons.join("; "),
        match.home_logo || null, match.away_logo || null,
        betCat, country, neutral,
        homePoss, awayPoss, homeShots, awayShots,
        Math.round(cote * 100) / 100
      );
    }
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

    if (pending.length) {
      const upd = db.prepare(`
        UPDATE concile_analyses
        SET outcome = ?,
            final_score_home = ?,
            final_score_away = ?,
            resolved_at = datetime('now'),
            result_source = ?,
            gain = ?
        WHERE id = ?
      `);
      let resolved = 0;
      pending.forEach(r => {
        const out = getBetOutcomeForScore(r.best_bet, h, a) || betOutcome(r.best_bet);
        if (out) {
          const cote = r.cote || Math.min(1.95, ((1 / (Math.max(55, r.confidence) / 100)) * 1.45));
          const gain = out === "win" ? Math.round((cote - 1) * 100) / 100 : -1;
          upd.run(out, h, a, "api_finished_match", gain, r.id);
          resolved++;
          const resThreshold = getAdaptiveSignalThreshold();
          if (r.confidence >= resThreshold && TELEGRAM_BOT_TOKEN) {
            notifySignalFortResult(r, out, h, a).catch(() => {});
          }
        }
      });
      console.log(`[concile-trace] résolu ${resolved} analyses: ${home} vs ${away} (${h}-${a})`);

      if (resolved > 0) {
        try { computeAgentWeights(); } catch (e) { console.error("[learning-engine] auto-recompute:", e.message); }
      }
    }

    resolveShadowOutcomes(home, away, h, a);
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

function categorizeBet(bet) {
  const b = String(bet || "").toLowerCase().trim();
  if (!b || b === "no bet") return "NO BET";
  if (b.includes("over") || b.includes("under") || b.includes("plus de") || b.includes("moins de")) return "Over/Under";
  if (b.includes("btts") || b.includes("les deux")) return "BTTS";
  if (b === "1x" || b === "x2" || b === "12" || b.includes("double chance")) return "Double Chance";
  if (b.includes("nul") || b === "x" || b.includes("draw")) return "Match Nul";
  if (b.includes("domicile") || b === "1" || b.includes("home") || b.includes("victoire") && b.includes("dom")) return "Victoire Domicile";
  if (b.includes("extérieur") || b.includes("exterieur") || b === "2" || b.includes("away")) return "Victoire Extérieur";
  return "Autre";
}

function getPronoStats() {
  try {
    // Toutes les analyses résolues avec catégorie de pari
    const allResolved = db.prepare(`
      SELECT best_bet, confidence, outcome, agents_json, sport, competition,
             home, away, analysed_at, minute_at_analysis, score_home_at_analysis, score_away_at_analysis
      FROM concile_analyses
      WHERE outcome IS NOT NULL
      ORDER BY analysed_at DESC
    `).all();

    // Grouper par catégorie de pari
    const byCategory = {};
    for (const row of allResolved) {
      const cat = categorizeBet(row.best_bet);
      if (cat === "NO BET") continue;
      if (!byCategory[cat]) byCategory[cat] = { total: 0, wins: 0, losses: 0, bets: {} };
      byCategory[cat].total++;
      if (row.outcome === "win") byCategory[cat].wins++;
      else byCategory[cat].losses++;
      // Sous-catégorie par pari exact
      const b = row.best_bet;
      if (!byCategory[cat].bets[b]) byCategory[cat].bets[b] = { total: 0, wins: 0 };
      byCategory[cat].bets[b].total++;
      if (row.outcome === "win") byCategory[cat].bets[b].wins++;
    }

    const categoryStats = Object.entries(byCategory).map(([cat, d]) => ({
      category: cat,
      total: d.total,
      wins: d.wins,
      losses: d.losses,
      winrate: d.wins + d.losses > 0 ? Math.round(d.wins / (d.wins + d.losses) * 100) : null,
      bets: Object.entries(d.bets)
        .map(([bet, s]) => ({ bet, total: s.total, wins: s.wins, winrate: s.total > 0 ? Math.round(s.wins / s.total * 100) : null }))
        .sort((a, b) => b.total - a.total),
    })).sort((a, b) => (b.winrate || 0) - (a.winrate || 0));

    // Croisement agent × catégorie de pari
    const agentRows = db.prepare(`
      SELECT ap.agent_name, ap.bet, ap.outcome
      FROM agent_predictions ap
      WHERE ap.outcome IS NOT NULL
    `).all();

    const agentByCategory = {};
    for (const row of agentRows) {
      const cat = categorizeBet(row.bet);
      if (cat === "NO BET") continue;
      if (!agentByCategory[row.agent_name]) agentByCategory[row.agent_name] = {};
      if (!agentByCategory[row.agent_name][cat]) agentByCategory[row.agent_name][cat] = { total: 0, wins: 0 };
      agentByCategory[row.agent_name][cat].total++;
      if (row.outcome === "win") agentByCategory[row.agent_name][cat].wins++;
    }

    const agentMatrix = Object.entries(agentByCategory).map(([agent, cats]) => ({
      agent,
      categories: Object.entries(cats).map(([cat, d]) => ({
        category: cat,
        total: d.total,
        wins: d.wins,
        winrate: d.total > 0 ? Math.round(d.wins / d.total * 100) : null,
      })).sort((a, b) => b.total - a.total),
      best_category: Object.entries(cats)
        .filter(([, d]) => d.total >= 5)
        .map(([cat, d]) => ({ cat, winrate: Math.round(d.wins / d.total * 100) }))
        .sort((a, b) => b.winrate - a.winrate)[0] || null,
    }));

    // Meilleur agent par catégorie
    const bestAgentPerCategory = {};
    for (const { agent, categories } of agentMatrix) {
      for (const { category, total, wins, winrate } of categories) {
        if (total < 5 || winrate === null) continue;
        if (!bestAgentPerCategory[category] || winrate > bestAgentPerCategory[category].winrate) {
          bestAgentPerCategory[category] = { agent, winrate, total };
        }
      }
    }

    // Tendance : 7 jours vs 30 jours
    const last7 = allResolved.filter(r => new Date(r.analysed_at) > new Date(Date.now() - 7 * 86400000));
    const last30 = allResolved.filter(r => new Date(r.analysed_at) > new Date(Date.now() - 30 * 86400000));
    const trend = (rows) => {
      const w = rows.filter(r => r.outcome === "win").length;
      return { total: rows.length, wins: w, winrate: rows.length > 0 ? Math.round(w / rows.length * 100) : null };
    };

    // Stats par pays
    const byCountry = db.prepare(`
      SELECT country, COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses
      WHERE outcome IS NOT NULL AND country IS NOT NULL
      GROUP BY country ORDER BY total DESC
    `).all().map(r => ({
      country: r.country, total: r.total, wins: r.wins, losses: r.losses,
      winrate: r.wins + r.losses > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : null,
    }));

    // Stats par championnat (top 15)
    const byChampionship = db.prepare(`
      SELECT competition, sport, country, COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses
      WHERE outcome IS NOT NULL AND competition != ''
      GROUP BY competition ORDER BY total DESC LIMIT 15
    `).all().map(r => ({
      competition: r.competition, sport: r.sport, country: r.country,
      total: r.total, wins: r.wins, losses: r.losses,
      winrate: r.wins + r.losses > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : null,
    }));

    // Stats terrain neutre vs domicile/extérieur
    const byNeutral = db.prepare(`
      SELECT is_neutral, COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins
      FROM concile_analyses WHERE outcome IS NOT NULL GROUP BY is_neutral
    `).all().map(r => ({
      context: r.is_neutral ? "Terrain neutre" : "Domicile/Extérieur",
      total: r.total, wins: r.wins,
      winrate: r.total > 0 ? Math.round(r.wins / r.total * 100) : null,
    }));

    // Stats par niveau de confiance
    const byConfidence = db.prepare(`
      SELECT
        CASE WHEN confidence >= 85 THEN '85-100%'
             WHEN confidence >= 80 THEN '80-84%'
             WHEN confidence >= 70 THEN '70-79%'
             ELSE '<70%' END as conf_range,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins
      FROM concile_analyses WHERE outcome IS NOT NULL
      GROUP BY conf_range ORDER BY conf_range DESC
    `).all().map(r => ({
      confidence: r.conf_range, total: r.total, wins: r.wins,
      winrate: r.total > 0 ? Math.round(r.wins / r.total * 100) : null,
    }));

    // Les 20 derniers pronos avec résultat
    const allResolvedFull = db.prepare(`
      SELECT home, away, sport, competition, country, best_bet, bet_category,
             confidence, outcome, minute_at_analysis,
             score_home_at_analysis, score_away_at_analysis,
             home_possession, away_possession, home_shots, away_shots,
             is_neutral, analysed_at, agents_json
      FROM concile_analyses WHERE outcome IS NOT NULL
      ORDER BY analysed_at DESC LIMIT 20
    `).all();

    const recentPronos = allResolvedFull.map(r => {
      let agents = [];
      try { agents = JSON.parse(r.agents_json || "[]"); } catch {}
      return {
        home: r.home, away: r.away, sport: r.sport,
        competition: r.competition, country: r.country,
        bet: r.best_bet, category: r.bet_category || categorizeBet(r.best_bet),
        confidence: r.confidence, outcome: r.outcome,
        minute: r.minute_at_analysis,
        score: r.score_home_at_analysis != null ? `${r.score_home_at_analysis}-${r.score_away_at_analysis}` : null,
        stats: {
          possession_home: r.home_possession, possession_away: r.away_possession,
          shots_home: r.home_shots, shots_away: r.away_shots,
        },
        neutral: r.is_neutral === 1,
        date: r.analysed_at?.slice(0, 10),
        agents: agents.map(a => ({ name: a.name, bet: a.bet, category: categorizeBet(a.bet) })),
      };
    });

    return {
      summary: {
        total_resolved: allResolved.length,
        total_wins: allResolved.filter(r => r.outcome === "win").length,
        winrate_global: allResolved.length > 0
          ? Math.round(allResolved.filter(r => r.outcome === "win").length / allResolved.length * 100)
          : null,
        trend_7j: trend(last7),
        trend_30j: trend(last30),
      },
      by_category: categoryStats,
      by_country: byCountry,
      by_championship: byChampionship,
      by_neutral: byNeutral,
      by_confidence: byConfidence,
      best_agent_per_category: bestAgentPerCategory,
      agent_matrix: agentMatrix,
      recent: recentPronos,
    };
  } catch (e) {
    console.error("[prono-stats]", e.message);
    return { error: e.message };
  }
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
        ca.home_logo,
        ca.away_logo,
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
          home_logo: r.home_logo || null,
          away_logo: r.away_logo || null,
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
        match_key, home, away, competition, sport, best_bet, confidence,
        outcome, final_score_home, final_score_away, stats_status,
        result_source, resolved_at, analysed_at, home_logo, away_logo
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
      sport: row.sport || "Football",
      bet: row.best_bet,
      confidence: row.confidence,
      score: `${row.final_score_home}-${row.final_score_away}`,
      outcome: row.outcome,
      resolvedAt: row.resolved_at || row.analysed_at,
      source: row.result_source || (row.stats_status === "manual_verified" ? "manual_verified" : "api_verified"),
      home_logo: row.home_logo || null,
      away_logo: row.away_logo || null,
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

// ── Multi-marchés par agent ────────────────────────────────────────────────
// Chaque agent se prononce sur TOUS les marchés (pas seulement son meilleur pari
// envoyé au Concile). On stocke tout pour découvrir quelle IA est forte sur quel
// type de pari (matrice agent × marché).
function canonicalMarketBet(line, code) {
  const c = String(code || "").toLowerCase();
  if (line === "buts")     return /o|over|plus|\+/.test(c) ? "Over 2.5 buts" : "Under 2.5 buts";
  if (line === "btts")     return /^o|oui|yes/.test(c) ? "BTTS Oui" : "BTTS Non";
  if (line === "resultat") return /^d|dom/.test(c) ? "Victoire domicile" : /^e|ext/.test(c) ? "Victoire extérieur" : "Match nul";
  if (line === "mt1")      return /^o|oui|yes/.test(c) ? "But en 1ère mi-temps" : "Aucun but en 1ère mi-temps";
  return null;
}

function resolveMarketBet(bet, h, a, htTotal) {
  const total = h + a;
  switch (bet) {
    case "Over 2.5 buts":  return total > 2.5 ? "win" : "loss";
    case "Under 2.5 buts": return total < 2.5 ? "win" : "loss";
    case "BTTS Oui":       return (h > 0 && a > 0) ? "win" : "loss";
    case "BTTS Non":       return (h > 0 && a > 0) ? "loss" : "win";
    case "Victoire domicile":  return h > a ? "win" : "loss";
    case "Victoire extérieur": return a > h ? "win" : "loss";
    case "Match nul":      return h === a ? "win" : "loss";
    case "But en 1ère mi-temps":       return htTotal == null ? null : (htTotal > 0 ? "win" : "loss");
    case "Aucun but en 1ère mi-temps": return htTotal == null ? null : (htTotal === 0 ? "win" : "loss");
    default: return getBetOutcomeForScore(bet, h, a);
  }
}

function saveAgentMarketPredictions(match, agentMarketList) {
  if (!agentMarketList || !agentMarketList.length) return;
  const matchKey = getPredictionSnapshotKey(match);
  try {
    const stmt = db.prepare(
      "INSERT OR IGNORE INTO agent_market_predictions (match_key, home, away, agent_name, market_line, bet, confidence) VALUES (?,?,?,?,?,?,?)"
    );
    agentMarketList.forEach(am => {
      const m = am.marches || {};
      [["buts", m.buts], ["btts", m.btts], ["resultat", m.resultat], ["mt1", m.mt1]].forEach(([line, val]) => {
        if (!val) return;
        const code = typeof val === "object" ? val.p : val;
        const conf = typeof val === "object" ? (parseInt(val.c) || 60) : 60;
        const bet = canonicalMarketBet(line, code);
        if (bet) stmt.run(matchKey, match.home, match.away, am.name, line, bet, Math.min(95, Math.max(40, conf)));
      });
    });
  } catch (e) { console.error("[agent-market] save:", e.message); }
}

function resolveAgentMarketPredictions(home, away, h, a, htTotal) {
  try {
    const hw = String(home || "").split(" ")[0];
    const aw = String(away || "").split(" ")[0];
    if (!hw || !aw) return;
    const pending = db.prepare(
      "SELECT * FROM agent_market_predictions WHERE home LIKE ? AND away LIKE ? AND outcome IS NULL"
    ).all(`%${hw}%`, `%${aw}%`);
    if (!pending.length) return;
    const upd = db.prepare("UPDATE agent_market_predictions SET outcome = ? WHERE id = ?");
    let n = 0;
    pending.forEach(p => { const o = resolveMarketBet(p.bet, h, a, htTotal); if (o) { upd.run(o, p.id); n++; } });
    if (n) console.log(`[agent-market] résolu ${n}/${pending.length} avis marché: ${home} vs ${away}`);
  } catch (e) { console.error("[agent-market] resolve:", e.message); }
}

function saveAgentPredictions(match, agentResults) {
  const matchKey = getPredictionSnapshotKey(match);
  try {
    const stmt = db.prepare(
      "INSERT OR IGNORE INTO agent_predictions (match_key, home, away, agent_name, bet, confidence) VALUES (?,?,?,?,?,?)"
    );
    agentResults.forEach(a => {
      stmt.run(matchKey, match.home, match.away, a.name, a.bet, a.confidence ?? 55);
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
      let resolved = 0;
      pending.forEach(p => {
        // getBetOutcomeForScore gère bien plus de variantes de libellés
        // ("Plus de 2.5", "moins de 2.5", domicile/extérieur, 1X/X2/12...).
        // betResults reste un filet de secours pour les libellés exacts.
        const outcome = getBetOutcomeForScore(p.bet, h, a) || betResults[p.bet] || null;
        if (outcome) { updateStmt.run(outcome, p.id); resolved++; }
      });
      console.log(`[agent-perf] Auto-résolu ${resolved}/${pending.length} prédictions: ${home} vs ${away} (${h}-${a})`);
    }
  } catch(e) { console.error("[agent-perf] auto-resolve:", e.message); }

  // Résoudre aussi les avis multi-marchés de chaque agent
  const htTotal = (match.ht_home != null && match.ht_away != null)
    ? Number(match.ht_home) + Number(match.ht_away)
    : (match.ht_total != null ? Number(match.ht_total) : null);
  resolveAgentMarketPredictions(home, away, h, a, htTotal);

  // Résoudre aussi les traces Concile
  resolveConcileAnalyses(home, away, score_home, score_away);
}

// ── Rattrapage : résout les prédictions en attente dont le match est fini mais
// qui sont sorties de la fenêtre live (matchs de plus de quelques heures/jours).
// Sans ça, une prédiction reste "en attente" pour toujours → leaderboard faussé.
let staleResolveRunning = false;
async function resolveStalePredictions() {
  if (staleResolveRunning || (!FOOTBALL_DATA_KEY && !API_SPORTS_KEY)) return;
  staleResolveRunning = true;
  try {
    const stale = db.prepare(`
      SELECT DISTINCT home, away FROM (
        SELECT home, away, created_at FROM agent_predictions WHERE outcome IS NULL
        UNION ALL
        SELECT home, away, created_at FROM agent_market_predictions WHERE outcome IS NULL
        UNION ALL
        SELECT home, away, analysed_at AS created_at FROM concile_analyses WHERE outcome IS NULL
        UNION ALL
        SELECT home, away, created_at FROM shadow_evals WHERE outcome IS NULL
      ) WHERE created_at <= datetime('now','-3 hours')
      LIMIT 120
    `).all();
    if (!stale.length) return;

    const finished = [];

    // Source 1 : football-data — une requête couvre 7 jours de matchs finis
    if (FOOTBALL_DATA_KEY) {
      try {
        const to = new Date().toISOString().slice(0, 10);
        const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const d = await httpGet(
          `https://api.football-data.org/v4/matches?status=FINISHED&dateFrom=${from}&dateTo=${to}`,
          { "X-Auth-Token": FOOTBALL_DATA_KEY }
        );
        finished.push(...(d.matches || []).map(formatFDMatch).filter(m => m.score_home !== null && m.score_away !== null));
      } catch (e) { console.error("[catch-up] football-data:", e.message); }
    }

    // Source 2 : api-sports football — couvre aujourd'hui, hier, J-2
    if (API_SPORTS_KEY) {
      for (let d = 0; d < 3; d++) {
        const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
        try {
          const data = await httpGet(
            `https://v3.football.api-sports.io/fixtures?date=${date}&status=FT`,
            { "x-apisports-key": API_SPORTS_KEY }
          );
          const items = (data.response || []).map(normalizeApiSportsFootballFixture)
            .filter(m => m.score_home !== null && m.score_away !== null);
          finished.push(...items);
        } catch (e) { console.error("[catch-up] api-sports football:", e.message); }
      }
    }

    // Source 3 : api-sports basketball — résoudre les matchs basket aussi
    if (API_SPORTS_KEY) {
      for (let d = 0; d < 2; d++) {
        const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
        try {
          const data = await httpGet(
            `https://v1.basketball.api-sports.io/games?date=${date}&status=FT`,
            { "x-apisports-key": API_SPORTS_KEY }
          );
          (data.response || []).forEach(g => {
            if (g.teams?.home?.name && g.teams?.away?.name && g.scores?.home?.total != null) {
              finished.push({
                home: g.teams.home.name, away: g.teams.away.name,
                score_home: g.scores.home.total, score_away: g.scores.away.total,
              });
            }
          });
        } catch (e) { console.error("[catch-up] api-sports basketball:", e.message); }
      }
    }

    // Source 4 : api-sports hockey
    if (API_SPORTS_KEY) {
      for (let d = 0; d < 2; d++) {
        const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
        try {
          const data = await httpGet(
            `https://v1.hockey.api-sports.io/games?date=${date}&status=FT`,
            { "x-apisports-key": API_SPORTS_KEY }
          );
          (data.response || []).forEach(g => {
            if (g.teams?.home?.name && g.teams?.away?.name && g.scores?.home != null) {
              finished.push({
                home: g.teams.home.name, away: g.teams.away.name,
                score_home: g.scores.home, score_away: g.scores.away,
              });
            }
          });
        } catch (e) { console.error("[catch-up] api-sports hockey:", e.message); }
      }
    }

    if (!finished.length) return;

    let resolvedMatches = 0;
    for (const s of stale) {
      const hw = String(s.home || "").split(" ")[0].toLowerCase();
      const aw = String(s.away || "").split(" ")[0].toLowerCase();
      if (!hw || !aw) continue;
      const m = finished.find(f => {
        const fh = String(f.home || "").toLowerCase();
        const fa = String(f.away || "").toLowerCase();
        return (fh.includes(hw) && fa.includes(aw)) || (fh.includes(aw) && fa.includes(hw));
      });
      if (m) {
        // Réordonne le score si le match a été trouvé dans le sens inverse
        const reversed = String(m.home || "").toLowerCase().includes(aw);
        autoResolvePredictions({
          home: s.home, away: s.away,
          score_home: reversed ? m.score_away : m.score_home,
          score_away: reversed ? m.score_home : m.score_away,
          ht_home: reversed ? m.ht_away : m.ht_home,
          ht_away: reversed ? m.ht_home : m.ht_away,
        });
        resolvedMatches++;
      }
    }
    if (resolvedMatches) console.log(`[catch-up] ${resolvedMatches}/${stale.length} matchs en attente résolus (football-data + api-sports)`);
  } catch (e) {
    console.error("[catch-up] resolveStalePredictions:", e.message);
  } finally {
    staleResolveRunning = false;
  }
}
// Toutes les 30 min + un premier passage 30s après le démarrage
setInterval(resolveStalePredictions, 30 * 60 * 1000);
setTimeout(resolveStalePredictions, 30 * 1000);

// ── Résolution rapide Signal Fort (toutes les 10 min, délai 90 min) ──────────
let signalFortResolveRunning = false;
async function resolveSignalFortFast() {
  if (signalFortResolveRunning || !API_SPORTS_KEY) return;
  signalFortResolveRunning = true;
  try {
    const sfThreshold = getAdaptiveSignalThreshold();
    const pending = db.prepare(`
      SELECT DISTINCT home, away FROM concile_analyses
      WHERE outcome IS NULL AND confidence >= ?
        AND analysed_at <= datetime('now','-90 minutes')
        AND analysed_at >= datetime('now','-48 hours')
      LIMIT 30
    `).all(sfThreshold);
    if (!pending.length) return;

    const finished = [];
    for (let d = 0; d < 2; d++) {
      const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      try {
        const data = await httpGet(
          `https://v3.football.api-sports.io/fixtures?date=${date}&status=FT`,
          { "x-apisports-key": API_SPORTS_KEY }
        );
        (data.response || []).forEach(f => {
          if (f.teams?.home?.name && f.goals?.home != null) {
            finished.push({
              home: f.teams.home.name, away: f.teams.away.name,
              score_home: f.goals.home, score_away: f.goals.away,
              ht_home: f.score?.halftime?.home ?? null,
              ht_away: f.score?.halftime?.away ?? null,
            });
          }
        });
      } catch {}
    }
    if (!finished.length) return;

    let resolved = 0;
    for (const s of pending) {
      const hw = String(s.home).split(" ")[0].toLowerCase();
      const aw = String(s.away).split(" ")[0].toLowerCase();
      if (!hw || !aw) continue;
      const m = finished.find(f => {
        const fh = String(f.home).toLowerCase();
        const fa = String(f.away).toLowerCase();
        return (fh.includes(hw) && fa.includes(aw)) || (fh.includes(aw) && fa.includes(hw));
      });
      if (m) {
        const reversed = String(m.home).toLowerCase().includes(aw);
        autoResolvePredictions({
          home: s.home, away: s.away,
          score_home: reversed ? m.score_away : m.score_home,
          score_away: reversed ? m.score_home : m.score_away,
          ht_home: reversed ? m.ht_away : m.ht_home,
          ht_away: reversed ? m.ht_home : m.ht_away,
        });
        resolved++;
      }
    }
    if (resolved) console.log(`[signal-fort-fast] ${resolved}/${pending.length} signaux forts résolus`);
  } catch (e) {
    console.error("[signal-fort-fast]", e.message);
  } finally {
    signalFortResolveRunning = false;
  }
}
setInterval(resolveSignalFortFast, 10 * 60 * 1000);
setTimeout(resolveSignalFortFast, 2 * 60 * 1000);

let autoConcileObserverRunning = false;

function shouldAutoObserveMatch(match) {
  if (!match || match.scoreConflict) return false;
  const status = String(match.status || "").toUpperCase();
  if (!["IN_PLAY", "LIVE"].includes(status)) return false;
  if (isFinishedOrTooLateForLiveIa(match)) return false;
  if (String(match.sport || "Football") !== "Football") return true;
  if (isLowTrustCompetition(match)) return false;
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

const _emailDailyCap = new Map();
setInterval(() => _emailDailyCap.clear(), 24 * 60 * 60 * 1000);

async function brevoSendEmail(to, subject, htmlContent) {
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY manquante");
  const key = to.toLowerCase();
  const sent = _emailDailyCap.get(key) || 0;
  if (sent >= 1) {
    console.log(`[brevo] Cap 1 email/jour atteint pour ${key} — "${subject}" non envoyé`);
    return;
  }
  _emailDailyCap.set(key, sent + 1);
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
    fr: ["Analyse du jour", "Pronostic du Concile IA", "Voir l'analyse complete", "Analyses sportives reservees aux +18 ans. Jeu responsable."],
    en: ["Today's analysis", "AI Council prediction", "See the full analysis", "Sports analysis is 18+ only. Gamble responsibly."],
    es: ["Pick del dia", "Pronostico del Consejo", "Ver el analisis completo", "Apuestas deportivas solo para mayores de 18. Juega con responsabilidad."],
    pt: ["Pick do dia", "Prognostico do Conselho", "Ver a analise completa", "Apostas desportivas apenas para maiores de 18. Jogue com responsabilidade."],
    de: ["Tipp des Tages", "Prognose des Councils", "Vollstandige Analyse ansehen", "Sportwetten nur ab 18. Spiele verantwortungsvoll."],
    it: ["Pick del giorno", "Pronostico del Consiglio", "Vedi l'analisi completa", "Scommesse sportive solo 18+. Gioca responsabilmente."],
  };
  return t[lang] || t.fr;
}

// ── Referral system ───────────────────────────────────────────────────────────
function loadReferrals() {
  try { return JSON.parse(fs.readFileSync(REFERRALS_PATH, "utf8")); } catch { return { refs: {}, byEmail: {} }; }
}
function saveReferrals(data) {
  fs.mkdirSync("/var/touslesmatchs", { recursive: true });
  fs.writeFileSync(REFERRALS_PATH, JSON.stringify(data, null, 2));
}
function makeRefCode(email) {
  const slug = email.replace(/@.*/, "").replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `REF-${slug}-${rand}`;
}
function getOrCreateRefCode(email) {
  const data = loadReferrals();
  if (data.byEmail[email]) return data.byEmail[email];
  const code = makeRefCode(email);
  data.refs[code] = { ownerEmail: email, created_at: new Date().toISOString(), referrals: [], monthsEarned: 0 };
  data.byEmail[email] = code;
  saveReferrals(data);
  return code;
}
function creditReferrer(refCode, newSubscriberEmail) {
  const data = loadReferrals();
  const ref = data.refs[refCode];
  if (!ref) return false;
  if (ref.referrals.includes(newSubscriberEmail)) return false; // déjà crédité
  ref.referrals.push(newSubscriberEmail);
  ref.monthsEarned = (ref.monthsEarned || 0) + 1;
  saveReferrals(data);
  // Prolonger l'abonnement du parrain de 30 jours
  try {
    const codesDb = new Database(CODES_DB_PATH);
    const row = codesDb.prepare("SELECT expires_at FROM codes WHERE email = ? AND active = 1").get(ref.ownerEmail);
    if (row) {
      const base = row.expires_at ? new Date(row.expires_at) : new Date();
      if (base < new Date()) base.setTime(Date.now());
      base.setDate(base.getDate() + 30);
      codesDb.prepare("UPDATE codes SET expires_at = ? WHERE email = ? AND active = 1").run(base.toISOString(), ref.ownerEmail);
    }
    codesDb.close();
  } catch (e) { console.error("[referral] extend:", e.message); }
  // Email au parrain
  if (BREVO_API_KEY) {
    brevoSendEmail(ref.ownerEmail, "🎉 Tu viens de gagner 1 mois offert !",
      `<div style="background:#06080f;padding:32px;font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#eceaf4">
        <div style="font-size:24px;font-weight:900;background:linear-gradient(135deg,#6366f1,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:20px">TousLesMatchs</div>
        <div style="font-size:20px;font-weight:800;margin-bottom:10px">🎉 ${newSubscriberEmail.replace(/@.*/, "***@***")} a rejoint grâce à toi !</div>
        <div style="color:#a8aec8;line-height:1.6;margin-bottom:20px">Ton abonnement vient d'être prolongé de <strong style="color:#10b981">30 jours</strong> automatiquement. Merci de faire confiance à TousLesMatchs et de le partager autour de toi.</div>
        <a href="https://www.touslesmatchs.com" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700">Voir mes picks →</a>
      </div>`
    ).catch(() => {});
  }
  return true;
}

// ── Monthly stats for renewal email ───────────────────────────────────────────
function getMonthlyPickStats() {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  try {
    const rows = db.prepare(`
      SELECT home, away, competition, best_bet, confidence, outcome,
             final_score_home, final_score_away, resolved_at, home_logo, sport
      FROM concile_analyses
      WHERE outcome IN ('win','loss') AND resolved_at > ?
      ORDER BY resolved_at DESC LIMIT 20
    `).all(since);
    const wins = rows.filter(r => r.outcome === "win").length;
    const losses = rows.filter(r => r.outcome === "loss").length;
    const total = wins + losses;
    const winrate = total > 0 ? Math.round(wins / total * 100) : 0;
    // ROI simulé : mise 10u, cote moyenne 1.80
    const roi = total > 0 ? Math.round((wins * 8 - losses * 10) / (total * 10) * 100) : 0;
    return { wins, losses, total, winrate, roi, recent: rows.slice(0, 5) };
  } catch { return { wins: 0, losses: 0, total: 0, winrate: 0, roi: 0, recent: [] }; }
}

function renewalEmailHtml(row, daysLeft, stats) {
  const planLabel = row.plan === "elite" ? "Elite" : "Pro";
  const expDate = new Date(row.expires_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });
  const urgency = daysLeft <= 1 ? "🔴 DERNIER JOUR" : daysLeft <= 3 ? "🟡 Plus que " + daysLeft + " jours" : "📅 Dans " + daysLeft + " jours";
  const pickRows = stats.recent.map(p => {
    const icon = p.outcome === "win" ? "✅" : "❌";
    const gain = p.outcome === "win" ? `+8u` : `-10u`;
    const gainColor = p.outcome === "win" ? "#10b981" : "#f43f5e";
    return `<tr style="border-bottom:1px solid rgba(255,255,255,.06)">
      <td style="padding:8px 6px;font-size:13px;color:#eceaf4">${p.home} vs ${p.away}</td>
      <td style="padding:8px 6px;font-size:12px;color:#a8aec8">${p.best_bet}</td>
      <td style="padding:8px 6px;font-size:13px;font-weight:700;color:${gainColor};text-align:right">${icon} ${gain}</td>
    </tr>`;
  }).join("");

  return `
<div style="background:#06080f;padding:32px 24px;font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="text-align:center;margin-bottom:28px">
    <div style="font-size:24px;font-weight:900;background:linear-gradient(135deg,#6366f1,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:inline-block">TousLesMatchs</div>
    <div style="font-size:11px;color:#7b82a0;letter-spacing:.1em;text-transform:uppercase;margin-top:4px">CONCILE IA — RÉSULTATS DU MOIS</div>
  </div>

  <div style="background:rgba(244,63,94,.08);border:1px solid rgba(244,63,94,.25);border-radius:14px;padding:16px 20px;margin-bottom:24px;text-align:center">
    <div style="font-size:13px;font-weight:700;color:#fb7185">${urgency}</div>
    <div style="font-size:14px;color:#a8aec8;margin-top:4px">Ton abonnement <strong style="color:#eceaf4">${planLabel}</strong> expire le <strong>${expDate}</strong></div>
  </div>

  ${stats.total > 0 ? `
  <div style="background:#0d1020;border:1px solid rgba(99,102,241,.2);border-radius:16px;padding:24px;margin-bottom:20px">
    <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6366f1;margin-bottom:16px">📊 CE QUE TU AURAIS GAGNÉ CE MOIS</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
      <div style="text-align:center;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:10px;padding:14px">
        <div style="font-size:26px;font-weight:900;color:#10b981">${stats.wins}</div>
        <div style="font-size:11px;color:#7b82a0;text-transform:uppercase;letter-spacing:.05em">Gagnés</div>
      </div>
      <div style="text-align:center;background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:14px">
        <div style="font-size:26px;font-weight:900;color:#6366f1">${stats.winrate}%</div>
        <div style="font-size:11px;color:#7b82a0;text-transform:uppercase;letter-spacing:.05em">Réussite</div>
      </div>
      <div style="text-align:center;background:${stats.roi >= 0 ? "rgba(16,185,129,.08)" : "rgba(244,63,94,.08)"};border:1px solid ${stats.roi >= 0 ? "rgba(16,185,129,.2)" : "rgba(244,63,94,.2)"};border-radius:10px;padding:14px">
        <div style="font-size:26px;font-weight:900;color:${stats.roi >= 0 ? "#10b981" : "#f43f5e"}">${stats.roi >= 0 ? "+" : ""}${stats.roi}%</div>
        <div style="font-size:11px;color:#7b82a0;text-transform:uppercase;letter-spacing:.05em">ROI estimé</div>
      </div>
    </div>
    ${pickRows ? `<table style="width:100%;border-collapse:collapse">
      <tr style="border-bottom:1px solid rgba(255,255,255,.08)">
        <th style="text-align:left;padding:6px;font-size:11px;color:#7b82a0;font-weight:600">Match</th>
        <th style="text-align:left;padding:6px;font-size:11px;color:#7b82a0;font-weight:600">Paris</th>
        <th style="text-align:right;padding:6px;font-size:11px;color:#7b82a0;font-weight:600">Résultat</th>
      </tr>
      ${pickRows}
    </table>` : ""}
  </div>
  <div style="text-align:center;font-size:13px;color:#a8aec8;margin-bottom:20px">Sur 10€ misés par pick, tu aurais <strong style="color:${stats.roi >= 0 ? "#10b981" : "#f43f5e"}">${stats.roi >= 0 ? "gagné" : "perdu"} ${Math.abs(stats.roi * stats.total / 10).toFixed(0)}€</strong> sur ${stats.total} picks ce mois.</div>
  ` : `<div style="background:#0d1020;border:1px solid rgba(99,102,241,.2);border-radius:16px;padding:20px;text-align:center;margin-bottom:20px;color:#a8aec8">Le Concile continue d'affiner ses analyses — les résultats s'accumulent pick après pick.</div>`}

  <div style="text-align:center;margin-bottom:24px">
    <a href="https://www.touslesmatchs.com/#plans" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:14px 32px;border-radius:11px;text-decoration:none;font-weight:800;font-size:15px;box-shadow:0 4px 20px rgba(79,70,229,.4)">🔄 Renouveler mon abonnement ${planLabel}</a>
    <div style="font-size:11px;color:#7b82a0;margin-top:10px">Accès immédiat après paiement · Code envoyé par email</div>
  </div>

  ${bookmakerEmailHtml()}
  <div style="text-align:center;font-size:11px;color:#7b82a0;line-height:1.6;margin-top:16px">
    TousLesMatchs · <a href="https://www.touslesmatchs.com" style="color:#6366f1;text-decoration:none">touslesmatchs.com</a><br>
    ⚠️ Analyses sportives réservées aux +18 ans. Jeu responsable. Le ROI passé ne garantit pas les résultats futurs.
  </div>
</div>`;
}

// ── Admin auth helper ─────────────────────────────────────────────────────────
function isAdmin(email, code) {
  const auth = verifyCode(email, code);
  return auth.valid && code.toUpperCase().startsWith("ELITE-ADMIN");
}

// ── Expiry cron (check every hour) ────────────────────────────────────────────
// Tracks which emails got which reminder to avoid duplicate sends per day
const _expirySentToday = new Map(); // email → Set of diffs sent

function runExpiryCron() {
  if (!BREVO_API_KEY) return;
  try {
    const codesDb = new Database(CODES_DB_PATH);
    const now = new Date();
    const rows = codesDb.prepare(
      "SELECT * FROM codes WHERE plan != 'free' AND expires_at IS NOT NULL"
    ).all();

    rows.forEach(row => {
      const exp = new Date(row.expires_at);
      const diff = Math.round((exp - now) / (1000 * 60 * 60 * 24));

      // Auto-deactivation: code expired yesterday or before → désactiver
      if (diff < 0 && row.active === 1) {
        codesDb.prepare("UPDATE codes SET active = 0 WHERE code = ?").run(row.code);
        console.log(`[expiry-cron] Désactivé: ${row.email} (expiré il y a ${Math.abs(diff)}j)`);
        return;
      }

      if (!row.active || !row.email) return;

      const sentKey = row.email;
      const sentSet = _expirySentToday.get(sentKey) || new Set();

      const stats = getMonthlyPickStats();

      if ([7, 3, 1].includes(diff) && !sentSet.has(diff)) {
        const subjects = {
          7: `📊 Dans 7 jours — voici ce que tu aurais gagné ce mois sur TousLesMatchs`,
          3: `⏳ Plus que 3 jours — renouvelle ton abonnement ${row.plan === "elite" ? "Elite" : "Pro"}`,
          1: `🔴 Dernier jour — ton accès TousLesMatchs expire demain`,
        };
        brevoSendEmail(row.email, subjects[diff], renewalEmailHtml(row, diff, stats))
          .then(() => {
            sentSet.add(diff);
            _expirySentToday.set(sentKey, sentSet);
            console.log(`[expiry-cron] Email J-${diff} envoyé: ${row.email}`);
          })
          .catch(e => console.error(`[expiry-cron] email J-${diff} to ${row.email}:`, e.message));
      }

      if (diff === 0 && !sentSet.has(0)) {
        brevoSendEmail(row.email, `🔴 Ton abonnement expire aujourd'hui — dernière chance`, renewalEmailHtml(row, 0, stats))
          .then(() => { sentSet.add(0); _expirySentToday.set(sentKey, sentSet); })
          .catch(e => console.error(`[expiry-cron] email J-0 to ${row.email}:`, e.message));
      }
    });
    codesDb.close();
  } catch (e) {
    console.error("[expiry-cron] error:", e.message);
  }
}
setInterval(runExpiryCron, 60 * 60 * 1000);
// Reset the "sent today" tracker at midnight
setInterval(() => _expirySentToday.clear(), 24 * 60 * 60 * 1000);

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
    <div style="text-align:center;margin-bottom:20px">
      <a href="https://www.touslesmatchs.com/live-ia" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none">Voir l'analyse Live IA →</a>
    </div>
    <div style="background:#0d1020;border:1px solid rgba(99,102,241,.12);border-radius:10px;padding:14px;margin-bottom:20px;text-align:center">
      <div style="font-size:12px;color:#a8aec8;margin-bottom:6px">📱 Rejoins aussi le canal Telegram gratuit</div>
      <a href="https://t.me/+qFnIuKg2ZhdlMmY8" style="color:#22d3ee;font-size:13px;font-weight:700;text-decoration:none">Rejoindre le canal →</a>
    </div>
    <p style="font-size:12px;color:#7b82a0;text-align:center">⚠️ Analyses sportives réservées aux +18 ans. Jeu responsable.<br>TousLesMatchs · <a href="https://www.touslesmatchs.com/mentions-legales.html" style="color:#6366f1;text-decoration:none">Mentions légales</a></p>
  </div>
</div>`;
      brevoSendEmail(emailClean, "Bienvenue sur TousLesMatchs — ton premier pick arrive bientôt 🎯", welcomeHtml)
        .catch(e => console.error("[subscribe-email] welcome email:", e.message));

      // Séquence nurturing : J+1 (preuve) et J+3 (urgence)
      scheduleNurturingEmails(emailClean);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("[subscribe-email] error:", e.message);
    res.json({ ok: true });
  }
});

function scheduleNurturingEmails(email) {
  const now = new Date();
  const j1 = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const j3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const j5 = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const j7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  try {
    db.prepare("INSERT OR IGNORE INTO scheduled_emails (email, email_type, send_after) VALUES (?,?,?)").run(email, "nurture_j1", j1);
    db.prepare("INSERT OR IGNORE INTO scheduled_emails (email, email_type, send_after) VALUES (?,?,?)").run(email, "nurture_j3", j3);
    db.prepare("INSERT OR IGNORE INTO scheduled_emails (email, email_type, send_after) VALUES (?,?,?)").run(email, "nurture_j5", j5);
    db.prepare("INSERT OR IGNORE INTO scheduled_emails (email, email_type, send_after) VALUES (?,?,?)").run(email, "nurture_j7", j7);
  } catch (e) { console.error("[nurturing] schedule:", e.message); }
}

function buildPlanComparisonHtml() {
  const plans = [
    { name: "Gratuit", price: "0€", color: "#7b82a0", features: ["1 pick/jour (site)", "Stats publiques", "Canal Telegram gratuit"], locked: ["Live IA", "Alertes Signal Fort", "Telegram Pro/Elite"] },
    { name: "1€ Test", price: "1€", color: "#22d3ee", features: ["1 analyse Live IA", "Consensus IA complet", "Verdict + cote + raison"], locked: ["Accès illimité", "Alertes Signal Fort"] },
    { name: "Pro", price: "9.90€/mois", color: "#6366f1", badge: "POPULAIRE", features: ["10 analyses Live IA/jour", "Telegram Pro", "Consensus + verdict Chief", "Historique complet"], locked: ["Alertes Signal Fort"] },
    { name: "Elite", price: "19.90€/mois", color: "#a855f7", features: ["30 analyses Live IA/jour", "Telegram Elite", "Alertes Signal Fort (≥80%)", "Picks en avant-première", "Support direct"] },
  ];
  const rows = plans.map(p => {
    const feats = (p.features || []).map(f => `<div style="font-size:12px;color:#eceaf4;line-height:1.8">✅ ${f}</div>`).join("");
    const locks = (p.locked || []).map(f => `<div style="font-size:12px;color:#4a4e6a;line-height:1.8">🔒 ${f}</div>`).join("");
    const badge = p.badge ? `<div style="font-size:9px;font-weight:800;letter-spacing:.1em;background:${p.color};color:#fff;padding:2px 8px;border-radius:6px;display:inline-block;margin-bottom:6px">${p.badge}</div>` : "";
    return `<td style="width:25%;vertical-align:top;padding:12px 8px;border-right:1px solid rgba(255,255,255,.04)">
      ${badge}
      <div style="font-size:14px;font-weight:900;color:${p.color};margin-bottom:2px">${p.name}</div>
      <div style="font-size:18px;font-weight:900;color:#eceaf4;margin-bottom:10px">${p.price}</div>
      ${feats}${locks}
    </td>`;
  }).join("");
  return `<table style="width:100%;border-collapse:collapse;background:#0a0d1a;border:1px solid rgba(99,102,241,.15);border-radius:12px;overflow:hidden"><tr style="border-bottom:1px solid rgba(255,255,255,.06)">${rows}</tr></table>`;
}

function buildNurtureJ1Html(email) {
  let pickLine = "";
  try {
    const picks = JSON.parse(fs.readFileSync("/var/touslesmatchs/picks.json", "utf8"));
    const p = picks.currentPick;
    if (p?.status && ["GAGNE","WIN"].includes(String(p.status).toUpperCase())) {
      pickLine = `<div style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:10px;padding:16px;margin-bottom:20px">
        <div style="color:#10b981;font-weight:800;font-size:14px;margin-bottom:4px">✅ Dernier pick : GAGNÉ</div>
        <div style="color:#a8aec8;font-size:13px">${p.home} vs ${p.away} · ${p.prono || p.bet} @${p.cote}</div>
      </div>`;
    }
  } catch (_) {}
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#06080f;color:#eceaf4;border-radius:14px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:30px;text-align:center">
      <div style="font-size:22px;font-weight:900;color:#fff">TousLesMatchs</div>
      <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:4px">Le Concile IA a encore frappé</div>
    </div>
    <div style="padding:32px">
      <p style="font-size:15px;color:#a8aec8;margin:0 0 20px">Depuis ton inscription hier, le Concile a publié son pick du jour.</p>
      ${pickLine}
      <p style="font-size:14px;color:#a8aec8;line-height:1.7;margin-bottom:24px">Tu veux recevoir l'analyse <strong style="color:#eceaf4">complète</strong> — le pick exact, la cote, la mise suggérée et le raisonnement du Concile IA — directement dans ta boite mail et sur Telegram ?</p>
      <div style="text-align:center;margin-bottom:20px">
        <a href="https://www.touslesmatchs.com/#plans" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none">Déverrouiller l'analyse complète →</a>
      </div>
      <div style="text-align:center;margin-bottom:20px">
        <a href="https://www.touslesmatchs.com/#plan-carte" style="color:#6366f1;font-size:13px;text-decoration:none">Ou tester 1 analyse pour 1€ →</a>
      </div>
      <p style="font-size:12px;color:#7b82a0;text-align:center">18+ · Jeu responsable · <a href="https://www.touslesmatchs.com/mentions-legales.html" style="color:#6366f1;text-decoration:none">Se désabonner</a></p>
    </div>
  </div>`;
}

function buildNurtureJ3Html() {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#06080f;color:#eceaf4;border-radius:14px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:30px;text-align:center">
      <div style="font-size:22px;font-weight:900;color:#fff">TousLesMatchs</div>
      <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:4px">3 picks publiés depuis ton inscription</div>
    </div>
    <div style="padding:32px">
      <p style="font-size:15px;color:#a8aec8;margin:0 0 20px">Tu t'es inscrit il y a 3 jours. Le Concile a travaillé chaque matin.</p>
      <div style="background:#0d1020;border:1px solid rgba(99,102,241,.2);border-radius:12px;padding:20px;margin-bottom:24px">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#22d3ee;margin-bottom:12px">Ce que tu as vu</div>
        <div style="font-size:14px;color:#a8aec8;line-height:2">
          ✅ Match + compétition<br>
          ✅ Niveau de confiance du Concile<br>
          🔒 Le pick exact — <span style="color:#6366f1">réservé Pro/Elite</span><br>
          🔒 La cote recommandée — <span style="color:#6366f1">réservé Pro/Elite</span><br>
          🔒 La raison du Chief — <span style="color:#6366f1">réservé Pro/Elite</span>
        </div>
      </div>
      <p style="font-size:14px;color:#a8aec8;line-height:1.7;margin-bottom:24px">Pour <strong style="color:#eceaf4">9.90€/mois</strong>, tu accèdes à tout — pick complet, Live IA sur tous les matchs, canal Telegram Pro.</p>
      <div style="text-align:center;margin-bottom:12px">
        <a href="https://www.touslesmatchs.com/#plans" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;box-shadow:0 4px 20px rgba(79,70,229,.4)">S'abonner — 9.90€/mois →</a>
      </div>
      <div style="text-align:center;margin-bottom:24px">
        <a href="https://www.touslesmatchs.com/#plan-carte" style="color:#6366f1;font-size:13px;text-decoration:none">Pas prêt ? Tester 1 analyse pour 1€</a>
      </div>
      <p style="font-size:12px;color:#7b82a0;text-align:center">18+ · Jeu responsable · <a href="https://www.touslesmatchs.com/mentions-legales.html" style="color:#6366f1;text-decoration:none">Se désabonner</a></p>
    </div>
  </div>`;
}

function buildNurtureJ5Html() {
  const stats = getSignalFortStats();
  const recentWins = stats.recent.filter(r => r.outcome === "win").slice(0, 3);
  const winsBlock = recentWins.length > 0
    ? recentWins.map(r => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)">
        <span style="font-size:16px">✅</span>
        <div style="flex:1"><div style="font-size:13px;font-weight:700;color:#eceaf4">${r.home} vs ${r.away}</div><div style="font-size:11px;color:#7b82a0">${r.final_score_home}-${r.final_score_away} · ${r.confidence}% confiance</div></div>
        <div style="font-size:13px;font-weight:800;color:#10b981">GAGNÉ</div>
      </div>`).join("")
    : `<div style="font-size:13px;color:#a8aec8;text-align:center;padding:12px">Le Concile IA analyse des dizaines de matchs chaque semaine.</div>`;

  return `<div style="font-family:Inter,Arial,sans-serif;max-width:580px;margin:0 auto;background:#06080f;color:#eceaf4;border-radius:14px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#10b981,#059669);padding:30px;text-align:center">
      <div style="font-size:22px;font-weight:900;color:#fff">TousLesMatchs</div>
      <div style="font-size:13px;color:rgba(255,255,255,.8);margin-top:4px">${stats.winrate}% de winrate sur les signaux forts</div>
    </div>
    <div style="padding:32px">
      <p style="font-size:15px;color:#a8aec8;margin:0 0 16px">Voici ce que le Concile IA a détecté récemment :</p>
      <div style="background:#0d1020;border:1px solid rgba(16,185,129,.2);border-radius:12px;padding:16px;margin-bottom:20px">
        <div style="text-align:center;margin-bottom:12px">
          <span style="font-size:36px;font-weight:900;color:#10b981">${stats.winrate}%</span>
          <div style="font-size:12px;color:#7b82a0;margin-top:2px">${stats.wins} gagnés sur ${stats.total} signaux forts</div>
        </div>
        ${winsBlock}
      </div>
      <p style="font-size:14px;color:#a8aec8;line-height:1.7;margin-bottom:20px">Ces résultats sont <strong style="color:#eceaf4">réels et vérifiables</strong>. Mais tu n'as vu que les signaux — les abonnés ont eu l'analyse complète <em>avant</em> le match.</p>
      <div style="font-size:13px;font-weight:700;color:#22d3ee;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;text-align:center">Quel plan te correspond ?</div>
      ${buildPlanComparisonHtml()}
      <div style="text-align:center;margin:24px 0 12px">
        <a href="https://www.touslesmatchs.com/#plans" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;box-shadow:0 4px 20px rgba(79,70,229,.4)">Choisir mon plan →</a>
      </div>
      <div style="text-align:center;margin-bottom:20px">
        <a href="https://www.touslesmatchs.com/#plan-carte" style="color:#6366f1;font-size:13px;text-decoration:none">Juste tester 1 analyse pour 1€</a>
      </div>
      <p style="font-size:12px;color:#7b82a0;text-align:center">18+ · Jeu responsable · <a href="https://www.touslesmatchs.com/mentions-legales.html" style="color:#6366f1;text-decoration:none">Se désabonner</a></p>
    </div>
  </div>`;
}

function buildNurtureJ7Html() {
  const stats = getSignalFortStats();
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:580px;margin:0 auto;background:#06080f;color:#eceaf4;border-radius:14px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:30px;text-align:center">
      <div style="font-size:22px;font-weight:900;color:#fff">TousLesMatchs</div>
      <div style="font-size:13px;color:rgba(255,255,255,.85);margin-top:4px">Ta première semaine est passée</div>
    </div>
    <div style="padding:32px">
      <p style="font-size:15px;color:#a8aec8;margin:0 0 16px">En 7 jours, le Concile IA a analysé des dizaines de matchs. Voici ton bilan :</p>
      <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
        <div style="flex:1;min-width:120px;background:#0d1020;border:1px solid rgba(16,185,129,.2);border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:900;color:#10b981">${stats.wins}</div>
          <div style="font-size:11px;color:#7b82a0;margin-top:2px">Signaux gagnés</div>
        </div>
        <div style="flex:1;min-width:120px;background:#0d1020;border:1px solid rgba(99,102,241,.2);border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:900;color:#6366f1">${stats.winrate}%</div>
          <div style="font-size:11px;color:#7b82a0;margin-top:2px">Winrate global</div>
        </div>
        <div style="flex:1;min-width:120px;background:#0d1020;border:1px solid rgba(245,158,11,.2);border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:900;color:#f59e0b">${stats.total}</div>
          <div style="font-size:11px;color:#7b82a0;margin-top:2px">Signaux analysés</div>
        </div>
      </div>
      <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:12px;padding:16px;margin-bottom:20px;text-align:center">
        <div style="font-size:14px;color:#f59e0b;font-weight:700;margin-bottom:6px">Tu as reçu les signaux — mais pas les analyses complètes</div>
        <div style="font-size:13px;color:#a8aec8">Les abonnés Pro et Elite ont eu chaque pick détaillé avec cote, raison et mise suggérée.</div>
      </div>
      <div style="font-size:13px;font-weight:700;color:#22d3ee;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;text-align:center">Compare les plans en un coup d'oeil</div>
      ${buildPlanComparisonHtml()}
      <div style="text-align:center;margin:24px 0 12px">
        <a href="https://www.touslesmatchs.com/#plans" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;box-shadow:0 4px 20px rgba(245,158,11,.3)">Passer à l'action →</a>
      </div>
      <div style="text-align:center;margin-bottom:20px">
        <a href="https://www.touslesmatchs.com/#plan-carte" style="color:#6366f1;font-size:13px;text-decoration:none">Ou tester pour 1€ seulement</a>
      </div>
      <div style="background:#0d1020;border:1px solid rgba(99,102,241,.15);border-radius:10px;padding:14px;margin-bottom:20px;text-align:center">
        <div style="font-size:12px;color:#a8aec8">📱 Pas encore sur Telegram ?</div>
        <a href="https://t.me/+qFnIuKg2ZhdlMmY8" style="color:#22d3ee;font-size:13px;font-weight:700;text-decoration:none">Rejoindre le canal gratuit →</a>
      </div>
      <p style="font-size:12px;color:#7b82a0;text-align:center">18+ · Jeu responsable · <a href="https://www.touslesmatchs.com/mentions-legales.html" style="color:#6366f1;text-decoration:none">Se désabonner</a></p>
    </div>
  </div>`;
}

async function processScheduledEmails() {
  if (!BREVO_API_KEY) return;
  try {
    const due = db.prepare("SELECT * FROM scheduled_emails WHERE sent = 0 AND send_after <= datetime('now') LIMIT 10").all();
    for (const row of due) {
      try {
        if (row.email_type === "nurture_j1") {
          await brevoSendEmail(row.email, "✅ Le Concile vient de publier — voici ce que tu as manqué", buildNurtureJ1Html(row.email));
        } else if (row.email_type === "nurture_j3") {
          await brevoSendEmail(row.email, "🔒 Tu vois le signal, pas l'analyse complète — voici comment changer ça", buildNurtureJ3Html());
        } else if (row.email_type === "nurture_j5") {
          await brevoSendEmail(row.email, `📊 ${getSignalFortStats().winrate}% de réussite — les résultats parlent`, buildNurtureJ5Html());
        } else if (row.email_type === "nurture_j7") {
          await brevoSendEmail(row.email, "⚡ Ta première semaine est passée — voici le bilan", buildNurtureJ7Html());
        }
        db.prepare("UPDATE scheduled_emails SET sent = 1 WHERE id = ?").run(row.id);
        console.log(`[nurturing] ${row.email_type} envoyé: ${row.email}`);
      } catch (e) { console.error(`[nurturing] ${row.email_type}:`, e.message); }
    }
  } catch (e) { console.error("[nurturing] process:", e.message); }
}

setInterval(processScheduledEmails, 15 * 60 * 1000);
setTimeout(processScheduledEmails, 60 * 1000);

// ── Signal Fort Bilan — track record des signaux >= 80% ─────────────────────
function getSignalFortStats() {
  try {
    const threshold = getAdaptiveSignalThreshold();
    const raw = db.prepare(`
      SELECT home, away, competition, sport, best_bet, confidence, outcome,
             score_home_at_analysis, score_away_at_analysis,
             final_score_home, final_score_away, analysed_at
      FROM concile_analyses
      WHERE confidence >= ? AND outcome IN ('win','loss')
      ORDER BY analysed_at DESC
    `).all(threshold);
    const seen = new Set();
    const all = [];
    for (const r of raw) {
      const key = `${r.home}_${r.away}_${(r.analysed_at || "").slice(0, 10)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(r);
    }
    const wins = all.filter(r => r.outcome === "win").length;
    const losses = all.filter(r => r.outcome === "loss").length;
    const total = all.length;
    const winrate = total > 0 ? Math.round(wins / total * 100) : 0;
    return { total, wins, losses, winrate, recent: all.slice(0, 20) };
  } catch (e) {
    console.error("[signal-fort-bilan] stats:", e.message);
    return { total: 0, wins: 0, losses: 0, winrate: 0, recent: [] };
  }
}

async function sendSignalFortBilanTelegram() {
  const stats = getSignalFortStats();
  if (stats.total < 3) return;

  const recentLines = stats.recent.slice(0, 10).map(r => {
    const icon = r.outcome === "win" ? "✅" : "❌";
    const score = r.final_score_home != null ? `${r.final_score_home}-${r.final_score_away}` : "?";
    return `${icon} ${r.home} vs ${r.away} (${score}) — ${r.best_bet} @ ${r.confidence}%`;
  }).join("\n");

  const threshold = getAdaptiveSignalThreshold();
  const premiumMsg = `📈 <b>BILAN SIGNAL FORT</b>\n\n🎯 Signaux ≥ ${threshold}% de confiance :\n✅ Gagnés : <b>${stats.wins}</b>\n❌ Perdus : <b>${stats.losses}</b>\n📉 Winrate : <b>${stats.winrate}%</b>\n\n<b>Derniers résultats :</b>\n${recentLines}\n\n━━━━━━━━━━━━━━━━━━\n🤖 Concile IA — ${stats.total} signaux analysés`;

  const freeMsg = `📈 <b>BILAN SIGNAL FORT</b>\n\n🎯 Nos signaux ≥ ${threshold}% de confiance :\n✅ <b>${stats.wins} gagnés</b> sur ${stats.total} signaux\n📉 Winrate : <b>${stats.winrate}%</b>\n\n${recentLines.split("\n").slice(0, 5).map(l => l.replace(/ — .*/, "")).join("\n")}\n\n👉 <a href="https://www.touslesmatchs.com/#plan-carte">⚡ Voir l'analyse complète – 1 €</a>\n\n━━━━━━━━━━━━━━━━━━\n🤖 Concile IA — TousLesMatchs`;

  if (TELEGRAM_PREMIUM_CHANNEL_ID) {
    const ok = await sendTelegramMessage(TELEGRAM_PREMIUM_CHANNEL_ID, premiumMsg);
    console.log(`[signal-fort-bilan] Telegram premium: ${ok ? "OK" : "FAIL"}`);
  }
  if (TELEGRAM_CHANNEL_ID) {
    const ok = await sendTelegramMessage(TELEGRAM_CHANNEL_ID, freeMsg);
    console.log(`[signal-fort-bilan] Telegram free: ${ok ? "OK" : "FAIL"}`);
  }
}

// Bilan hebdomadaire chaque dimanche à 20h (vérifie toutes les heures)
setInterval(() => {
  const now = new Date();
  if (now.getDay() === 0 && now.getHours() === 20 && now.getMinutes() < 60) {
    sendSignalFortBilanTelegram().catch(e => console.error("[signal-fort-bilan]", e.message));
    sendWeeklyConversionEmail().catch(e => console.error("[weekly-conversion]", e.message));
  }
}, 60 * 60 * 1000);

// ── Auto-post résultat Signal Fort sur Telegram quand résolu ─────────────────
const _signalResultSentCache = new Set();
async function notifySignalFortResult(analysis, outcome, scoreH, scoreA) {
  const cacheKey = `${analysis.home}_${analysis.away}`;
  if (_signalResultSentCache.has(cacheKey)) return;
  _signalResultSentCache.add(cacheKey);

  const icon = outcome === "win" ? "✅" : "❌";
  const resultText = outcome === "win" ? "GAGNÉ" : "PERDU";
  const sportIcons = { Football:"⚽", Basketball:"🏀", Hockey:"🏒", Baseball:"⚾", Tennis:"🎾" };
  const si = sportIcons[analysis.sport] || "🎯";
  const stats = getSignalFortStats();
  const coteMoy = Math.min(1.95, ((1 / (analysis.confidence / 100)) * 1.45)).toFixed(2);
  const gain = (10 * parseFloat(coteMoy)).toFixed(2);

  const premiumMsg = [
    `${icon} <b>SIGNAL FORT ${resultText}</b>`,
    ``,
    `${si} <b>${analysis.home} vs ${analysis.away}</b>`,
    analysis.competition ? `🏆 ${analysis.competition}` : "",
    `⚽ Score final : <b>${scoreH}-${scoreA}</b>`,
    `💡 Analyse IA : <b>${analysis.best_bet}</b>`,
    `📊 Confiance : <b>${analysis.confidence}%</b> · Cote moy. : <b>${coteMoy}</b>`,
    ``,
    outcome === "win"
      ? `💰 Mise 10€ → <b>Gain ${gain}€</b>`
      : ``,
    ``,
    `📈 Bilan Signal Fort : <b>${stats.wins}W / ${stats.losses}L — ${stats.winrate}% winrate</b>`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `🤖 Concile IA — TousLesMatchs`,
  ].filter(Boolean).join("\n");

  const freeMsg = [
    `${icon} <b>SIGNAL FORT ${resultText}</b>`,
    ``,
    `${si} <b>${analysis.home} vs ${analysis.away}</b>`,
    analysis.competition ? `🏆 ${analysis.competition}` : "",
    `⚽ Score final : <b>${scoreH}-${scoreA}</b>`,
    `📊 Confiance : <b>${analysis.confidence}%</b> · Cote moy. : <b>${coteMoy}</b>`,
    ``,
    outcome === "win"
      ? `💰 Mise 10€ → <b>Gain ${gain}€</b>`
      : ``,
    ``,
    `📈 Bilan : <b>${stats.wins} gagnés sur ${stats.total} — ${stats.winrate}% winrate</b>`,
    ``,
    outcome === "win"
      ? `💎 Imagine si tu avais eu le pick...\n👉 <a href="https://www.touslesmatchs.com/#plan-carte">⚡ Voir l'analyse complète – 1 €</a>`
      : `💪 La discipline fait la différence sur le long terme.\n👉 <a href="https://www.touslesmatchs.com/#plan-carte">⚡ Voir l'analyse complète – 1 €</a>`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `🤖 Concile IA — TousLesMatchs`,
  ].filter(Boolean).join("\n");

  if (TELEGRAM_PREMIUM_CHANNEL_ID) sendTelegramMessage(TELEGRAM_PREMIUM_CHANNEL_ID, premiumMsg);
  const todayStr = new Date().toISOString().slice(0, 10);
  if (_freeResultDailyDate.date !== todayStr) { _freeResultDailyDate.date = todayStr; _freeResultDailyDate.count = 0; }
  if (_freeResultDailyDate.count < 1 && TELEGRAM_CHANNEL_ID) {
    _freeResultDailyDate.count++;
    sendTelegramMessage(TELEGRAM_CHANNEL_ID, freeMsg);
    console.log(`[signal-fort-result] ${icon} ${analysis.home} vs ${analysis.away} → ${outcome} (envoyé free + premium)`);
  } else {
    console.log(`[signal-fort-result] ${icon} ${analysis.home} vs ${analysis.away} → ${outcome} (premium only, free déjà envoyé aujourd'hui)`);
  }
}

// ── Email hebdomadaire de conversion aux leads gratuits ──────────────────────
async function sendWeeklyConversionEmail() {
  if (!BREVO_API_KEY) return;
  const stats = getSignalFortStats();
  if (stats.total < 3) return;

  const recentWins = stats.recent.filter(r => r.outcome === "win").slice(0, 5);
  const winsRows = recentWins.map(r =>
    `<tr style="border-bottom:1px solid rgba(255,255,255,.06)">
      <td style="padding:8px 6px;font-size:13px;color:#10b981">✅</td>
      <td style="padding:8px 6px;font-size:13px;color:#eceaf4">${r.home} vs ${r.away}</td>
      <td style="padding:8px 6px;font-size:13px;color:#22d3ee">${r.final_score_home}-${r.final_score_away}</td>
      <td style="padding:8px 6px;font-size:13px;color:#f8d37a">${r.confidence}%</td>
    </tr>`
  ).join("");

  const htmlContent = `
<div style="background:#06080f;padding:32px 24px;font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:24px;font-weight:900;background:linear-gradient(135deg,#6366f1,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:inline-block">TousLesMatchs</div>
    <div style="font-size:11px;color:#7b82a0;letter-spacing:.1em;text-transform:uppercase;margin-top:4px">RÉSULTATS SIGNAL FORT — CETTE SEMAINE</div>
  </div>
  <div style="background:#0d1020;border:1px solid rgba(16,185,129,.3);border-radius:16px;padding:24px;margin-bottom:20px">
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:48px;font-weight:900;color:#10b981">${stats.winrate}%</div>
      <div style="font-size:14px;color:#a8aec8">Winrate Signal Fort (≥80% confiance)</div>
      <div style="font-size:13px;color:#7b82a0;margin-top:4px">${stats.wins} gagnés · ${stats.losses} perdus · ${stats.total} signaux</div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <tr style="border-bottom:1px solid rgba(255,255,255,.12)">
        <th style="padding:6px;font-size:11px;color:#7b82a0;text-align:left"></th>
        <th style="padding:6px;font-size:11px;color:#7b82a0;text-align:left">Match</th>
        <th style="padding:6px;font-size:11px;color:#7b82a0;text-align:left">Score</th>
        <th style="padding:6px;font-size:11px;color:#7b82a0;text-align:left">Confiance</th>
      </tr>
      ${winsRows}
    </table>
    <div style="text-align:center;margin-top:20px;padding:14px;background:rgba(79,70,229,.12);border:1px solid rgba(79,70,229,.25);border-radius:10px">
      <div style="font-size:14px;color:#a8aec8;margin-bottom:6px">🔒 Les analyses complètes sont réservées aux abonnés</div>
      <div style="font-size:13px;color:#6366f1">Tu vois les matchs gagnants, mais pas l'analyse détaillée — rejoins le Premium pour tout débloquer.</div>
    </div>
  </div>
  <div style="margin:20px 0;padding:0 4px">
    <div style="font-size:12px;font-weight:700;color:#22d3ee;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;text-align:center">Quel plan pour toi ?</div>
    ${buildPlanComparisonHtml()}
  </div>
  <div style="text-align:center;margin-bottom:16px">
    <a href="https://www.touslesmatchs.com/#plans" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 20px rgba(79,70,229,.4)">Choisir mon plan →</a>
  </div>
  <div style="text-align:center;margin-bottom:16px">
    <a href="https://www.touslesmatchs.com/#plan-carte" style="color:#6366f1;font-size:13px;text-decoration:none">Ou tester 1 analyse pour 1€</a>
  </div>
  ${bookmakerEmailHtml()}
  <div style="text-align:center;font-size:11px;color:#7b82a0;line-height:1.6">
    TousLesMatchs — Bilan automatique hebdomadaire<br>
    ⚠️ 18+ · Jeu responsable · <a href="https://www.touslesmatchs.com/mentions-legales.html" style="color:#6366f1;text-decoration:none">Se désabonner</a>
  </div>
</div>`;

  try {
    const premiumEmails = new Set();
    try {
      const codesDb = new Database(CODES_DB_PATH, { readonly: true });
      codesDb.prepare("SELECT email FROM codes WHERE active = 1 AND email IS NOT NULL AND email != ''").all()
        .forEach(r => premiumEmails.add(r.email.toLowerCase()));
      codesDb.close();
    } catch {}

    const leadRows = loadLeads().leads || [];
    const freeEmails = [...new Set(leadRows.map(l => l.email).filter(e => e && !premiumEmails.has(e.toLowerCase())))];
    let sent = 0;
    for (const email of freeEmails.slice(0, 300)) {
      try {
        await brevoSendEmail(email, `📈 ${stats.winrate}% winrate cette semaine — Signal Fort IA`, htmlContent);
        sent++;
      } catch {}
    }
    console.log(`[weekly-conversion] Envoyé à ${sent}/${freeEmails.length} leads gratuits`);
  } catch (e) { console.error("[weekly-conversion]", e.message); }
}

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
const CODES_DB_PATH = process.env.CODES_DB_PATH || "/data/codes.db";

// Auto-create codes table if it doesn't exist
try {
  const _cdb = new Database(CODES_DB_PATH);
  _cdb.exec(`
    CREATE TABLE IF NOT EXISTS codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      email TEXT NOT NULL,
      plan TEXT DEFAULT 'free',
      active INTEGER DEFAULT 1,
      expires_at TEXT DEFAULT NULL,
      credits_max INTEGER DEFAULT 10,
      credits_used INTEGER DEFAULT 0,
      credits_date TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  _cdb.close();
} catch(e) { console.error("[codes-db] init error:", e.message); }

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
    if (req.query.force === "1") {
      liveMatchesCache = { data: null, ts: 0 };
      console.log("[live-matches] Cache forcé vidé par l'utilisateur");
    }
    const allMatches = await fetchLiveMatches();
    const matches = allMatches.filter(m => !isLowTrustCompetition(m));

    // Injecter les signaux épinglés si le match n'est plus dans l'API
    const pinned = getActivePinnedSignals();
    for (const ps of pinned) {
      const alreadyLive = matches.some(m =>
        m.home?.toLowerCase().includes(ps.home?.toLowerCase().split(" ")[0]) &&
        m.away?.toLowerCase().includes(ps.away?.toLowerCase().split(" ")[0])
      );
      if (!alreadyLive) {
        matches.unshift({
          id: ps.id,
          home: ps.home, away: ps.away,
          competition: ps.competition || ps.league || "",
          sport: ps.sport || "Football",
          status: "PINNED_SIGNAL",
          minute: ps.minute,
          score_home: ps.score_home ?? null,
          score_away: ps.score_away ?? null,
          home_logo: ps.home_logo || null,
          away_logo: ps.away_logo || null,
          pinnedSignal: true,
          pinnedBet: ps.bet,
          pinnedConfidence: ps.confidence,
          pinnedReason: ps.reason,
        });
      }
    }

    res.json({ ok: true, matches });
  } catch (e) {
    res.json({ ok: true, matches: [] });
  }
});

app.get("/pinned-signals", (req, res) => {
  res.json({ ok: true, signals: getActivePinnedSignals() });
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
  // Cache partagé par match+état (pas par user) pour économiser les tokens Groq
  const scoreState = verifiedMatch.score_home !== null ? `${verifiedMatch.score_home}-${verifiedMatch.score_away}_${Math.floor((verifiedMatch.minute || 0) / 15)}` : "prematch";
  const cacheKey = `${verifiedMatch.id || `${verifiedMatch.home}_${verifiedMatch.away}`}_${today}_${scoreState}`;
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
  // Cache partagé par match+jour (pas par user) pour économiser les tokens Groq
  const cacheKey = `prematch__${match.home}_${match.away}_${match.date || today2}`;
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

  const planLookup = { [STRIPE_PRICE_ID_CARTE]: "carte", [STRIPE_PRICE_ID_PREMIUM]: "premium", [STRIPE_PRICE_ID_VIP]: "vip", [STRIPE_PRICE_ID_ELITE]: "elite" };
  const planName = planLookup[price_id] || "premium";

  try {
    const Stripe = require("stripe");
    const stripe = Stripe(STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: `https://www.touslesmatchs.com/live-ia?success=1&plan=${planName}`,
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
      [STRIPE_PRICE_ID_CARTE]:   { status: "carte",   label: "Analyse 1 euro", durationDays: 1 },
      [STRIPE_PRICE_ID_PREMIUM]: { status: "premium", label: "Pro",            durationDays: 32 },
      [STRIPE_PRICE_ID_VIP]:     { status: "vip",     label: "VIP",            durationDays: 32 },
      [STRIPE_PRICE_ID_ELITE]:   { status: "elite",   label: "Elite",          durationDays: 32 },
    };
    const { status = "premium", label: planLabel = "Pro", durationDays = 32 } = planMap[priceId] || {};

    // ── Mettre à jour users table si userId connu ────────────────────────────
    const userId = parseInt(session.client_reference_id);
    if (userId) {
      db.prepare("UPDATE users SET status = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?").run(
        status, session.customer, session.subscription, userId
      );
      const limit = TOKEN_LIMITS[status] || 0;
      db.prepare("INSERT OR REPLACE INTO user_tokens (user_id, tokens_today, reset_date) VALUES (?,?,?)").run(userId, limit, getTodayStr());
    }

    // ── Créer code d'accès dans codes.db si pas encore existant ─────────────
    if (customerEmail) {
      try {
        const codeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const newCode = Array.from({ length: 8 }, () => codeChars[Math.floor(Math.random() * codeChars.length)]).join("");
        const expiresAt = new Date(Date.now() + durationDays * 86400000).toISOString().slice(0, 10);
        const creditsMax = status === "carte" ? 1 : status === "elite" ? 30 : 10;
        const cdbw = new Database(CODES_DB_PATH);
        const existing = cdbw.prepare("SELECT code FROM codes WHERE email = ? AND plan = ? AND active = 1").get(customerEmail, status);
        if (!existing) {
          cdbw.prepare(
            "INSERT INTO codes (code, email, plan, active, expires_at, credits_max, credits_used, credits_date) VALUES (?,?,?,1,?,?,0,?)"
          ).run(newCode, customerEmail, status, expiresAt, creditsMax, getTodayStr());
          console.log(`[stripe] Code créé: ${newCode} pour ${customerEmail} plan ${status}`);
        }
        cdbw.close();
      } catch(e) { console.error("[stripe] code creation error:", e.message); }
    }

    // ── Email de confirmation via Brevo ──────────────────────────────────────
    if (customerEmail && BREVO_API_KEY) {
      (async () => {
        try {
          const cdb = new Database(CODES_DB_PATH, { readonly: true });
          const codeRows = cdb.prepare("SELECT code, plan FROM codes WHERE email = ? AND active = 1").all(customerEmail);
          cdb.close();

          const codeList = codeRows.map(r =>
            `<tr><td style="padding:8px 16px;font-family:monospace;font-size:18px;font-weight:800;letter-spacing:.08em;color:#eceaf4">${r.code}</td>
             <td style="padding:8px 16px;font-size:12px;color:#7b82a0">${r.plan.toUpperCase()}</td></tr>`
          ).join("");

          const upsellBlock = status === "carte"
            ? `<div style="background:linear-gradient(135deg,rgba(79,70,229,.12),rgba(124,58,237,.08));border:1px solid rgba(99,102,241,.25);border-radius:10px;padding:20px;margin-top:24px;text-align:center">
                <div style="font-size:14px;font-weight:700;color:#a78bfa;margin-bottom:8px">Tu as aime ton analyse ?</div>
                <div style="font-size:12px;color:#7b82a0;margin-bottom:12px">Avec Pro, tu as <b style="color:#eceaf4">10 analyses par jour</b> — soit 0.33€ par analyse.<br><b style="color:#10b981">Sans engagement</b>, annulable a tout moment.</div>
                <a href="https://buy.stripe.com/4gM3cv4Je9ZG2RK3GS3VC00" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none">Passer Pro — 9.90€/mois</a>
              </div>`
            : status === "premium"
            ? `<div style="background:linear-gradient(135deg,rgba(212,175,55,.1),rgba(245,200,66,.06));border:1px solid rgba(212,175,55,.25);border-radius:10px;padding:20px;margin-top:24px;text-align:center">
                <div style="font-size:14px;font-weight:700;color:#d4af37;margin-bottom:8px">Passe au niveau superieur</div>
                <div style="font-size:12px;color:#7b82a0;margin-bottom:12px">Elite : <b style="color:#eceaf4">30 analyses/jour</b> + <b style="color:#d4af37">alertes Signal Fort automatiques</b>.<br>Les alertes seules valent le prix — <b style="color:#10b981">sans engagement</b>.</div>
                <a href="https://buy.stripe.com/28E8wPdfK7RybogfpA3VC04" style="display:inline-block;background:linear-gradient(135deg,#d4af37,#f5c842);color:#111;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none">Passer Elite — 19.90€/mois</a>
              </div>`
            : "";

          const html = `<div style="font-family:Inter,system-ui,sans-serif;max-width:540px;margin:0 auto;background:#06080f;color:#eceaf4;border-radius:14px;overflow:hidden">
            <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:36px;text-align:center">
              <div style="font-size:24px;font-weight:800;color:#fff">✅ Abonnement ${planLabel} active !</div>
              <div style="font-size:14px;color:rgba(255,255,255,.75);margin-top:6px">TousLesMatchs — 4 agents IA + 1 Chief. Tu decides avec plus de donnees.</div>
            </div>
            <div style="padding:32px">
              <p style="font-size:15px;margin:0 0 20px;color:#a8aec8">Merci pour ton abonnement ! Voici ton code d'acces :</p>
              <table style="width:100%;border-collapse:collapse;background:#0d1020;border-radius:10px;overflow:hidden;margin-bottom:24px">${codeList}</table>
              <p style="font-size:13px;color:#7b82a0;margin:0 0 20px">Utilise ce code sur <a href="https://touslesmatchs.com" style="color:#6366f1">touslesmatchs.com</a> → bouton "Se connecter" → entre ton email + ce code.</p>
              <div style="text-align:center">
                <a href="https://touslesmatchs.com/live-ia" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none">Acceder au Live IA →</a>
              </div>
              ${upsellBlock}
            </div>
          </div>`;

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

async function handleCreateCheckout(req, res) {
  const { plan, user_id } = req.body || {};
  if (!STRIPE_SECRET_KEY) return res.json({ ok: false, error: "Configuration Stripe manquante" });

  const priceMap = {
    carte:    STRIPE_PRICE_ID_CARTE,
    standard: STRIPE_PRICE_ID_PREMIUM,
    premium:  STRIPE_PRICE_ID_PREMIUM,
    vip:      STRIPE_PRICE_ID_VIP,
    elite:    STRIPE_PRICE_ID_ELITE,
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
      success_url: `https://www.touslesmatchs.com/live-ia?success=1&plan=${plan}`,
      cancel_url: "https://www.touslesmatchs.com/subscription",
      client_reference_id: String(user_id || ""),
    });
    res.json({ ok: true, url: session.url });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
}

// Legacy create-checkout accessible via /create-checkout et /api/create-checkout
app.post("/create-checkout", handleCreateCheckout);
app.post("/create-checkout", handleCreateCheckout);

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

// ── Shadow eval — classement des IAs candidates ───────────────────────────────
// ── Prono stats — classement par type de pari + agent ────────────────────────
app.get("/admin/prono-stats", (req, res) => {
  const { email, code } = req.query;
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Acces admin requis" });
  res.json({ ok: true, ...getPronoStats() });
});

app.post("/internal/prono-stats", (req, res) => {
  const { secret } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) return res.status(403).json({ ok: false, error: "Forbidden" });
  res.json({ ok: true, ...getPronoStats() });
});

app.get("/admin/shadow-perf", (req, res) => {
  const { email, code } = req.query;
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Acces admin requis" });
  try {
    const byAgent = db.prepare(`
      SELECT agent_name,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses,
        SUM(CASE WHEN outcome IS NULL THEN 1 ELSE 0 END) as pending,
        ROUND(AVG(confidence),1) as avg_confidence,
        MIN(created_at) as first_eval,
        MAX(created_at) as last_eval
      FROM shadow_evals
      GROUP BY agent_name
    `).all();

    const withStats = byAgent.map(r => ({
      ...r,
      winrate: r.total > 0 ? Math.round((r.wins / Math.max(1, r.wins + r.losses)) * 100) : null,
      resolved: r.wins + r.losses,
      days_active: r.first_eval ? Math.ceil((Date.now() - new Date(r.first_eval).getTime()) / 86400000) : 0,
    }))
      // Classement par taux de réussite (pas par nombre brut de victoires) :
      // une IA à 90% sur 10 paris doit passer avant une IA à 50% sur 30 paris.
      .sort((a, b) => {
        if (a.winrate !== null && b.winrate !== null) return b.winrate - a.winrate;
        if (a.winrate !== null) return -1;
        if (b.winrate !== null) return 1;
        return b.total - a.total;
      });

    const recentEvals = db.prepare(`
      SELECT agent_name, home, away, competition, bet, confidence, outcome, created_at
      FROM shadow_evals
      ORDER BY created_at DESC
      LIMIT 50
    `).all();

    const activeAgents = SHADOW_AGENTS.map(a => ({ name: a.name, icon: a.icon, active: a.enabled() }));

    res.json({ ok: true, agents: withStats, recent: recentEvals, configured: activeAgents });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
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
  const auth = verifyCode(email, code);
  if (!auth.valid || (auth.plan !== "elite" && !isAdminAccess(email, code))) return res.status(403).json({ ok: false, error: "Acces Elite requis" });
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

// ── Matrice IA × marché — quelle IA est forte sur quel type de pari ──────────
app.get("/agent-market-matrix", (req, res) => {
  const { email, code } = req.query;
  if (!isAdminAccess(email, code)) return res.status(403).json({ ok: false, error: "Acces admin requis" });
  try {
    const rows = db.prepare(`
      SELECT agent_name, market_line,
        COUNT(*) total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses,
        SUM(CASE WHEN outcome IS NULL THEN 1 ELSE 0 END) pending
      FROM agent_market_predictions
      GROUP BY agent_name, market_line
    `).all();
    const lineLabels = { buts: "Over/Under 2.5", btts: "BTTS", resultat: "Résultat 1X2", mt1: "But 1ère MT" };
    const matrix = {};
    const bestByLine = {};
    rows.forEach(r => {
      const resolved = r.wins + r.losses;
      const winrate = resolved > 0 ? Math.round(r.wins / resolved * 100) : null;
      if (!matrix[r.agent_name]) matrix[r.agent_name] = {};
      matrix[r.agent_name][r.market_line] = { label: lineLabels[r.market_line] || r.market_line, total: r.total, wins: r.wins, losses: r.losses, pending: r.pending, resolved, winrate };
      // Meilleure IA par marché (min 5 résolus)
      if (resolved >= 5 && winrate !== null) {
        if (!bestByLine[r.market_line] || winrate > bestByLine[r.market_line].winrate) {
          bestByLine[r.market_line] = { agent: r.agent_name, winrate, resolved, label: lineLabels[r.market_line] || r.market_line };
        }
      }
    });
    res.json({ ok: true, matrix, best_by_market: bestByLine });
  } catch (e) { res.json({ ok: false, error: e.message }); }
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

// Forcer le rattrapage de TOUTES les prédictions en attente (matchs finis)
app.post("/admin/resolve-stale", async (req, res) => {
  const { email, code } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  const countPending = () => db.prepare(`
    SELECT (SELECT COUNT(*) FROM agent_predictions WHERE outcome IS NULL)
         + (SELECT COUNT(*) FROM agent_market_predictions WHERE outcome IS NULL) AS n
  `).get().n;
  const before = countPending();
  await resolveStalePredictions();
  const after = countPending();
  res.json({ ok: true, resolved: before - after, pending_before: before, pending_after: after });
});

// ── Admin — envoyer rapport de statut sur Telegram Hermes Admin ──────────────
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || "";

app.post("/admin/send-report", (req, res) => {
  const { email, code } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  if (!TELEGRAM_ADMIN_CHAT_ID) return res.json({ ok: false, error: "TELEGRAM_ADMIN_CHAT_ID non configuré" });

  const perf = getAgentPerformance();
  const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const agents = Object.entries(perf).map(([name, p]) => {
    const total = (p.wins || 0) + (p.losses || 0);
    const wr = total > 0 ? Math.round(p.wins / total * 100) : 0;
    const pending = p.pending || 0;
    const status = total >= 10 ? (wr >= 80 ? "✅" : "⚠️") : "🔄";
    return { name, wins: p.wins || 0, losses: p.losses || 0, total, wr, pending, status };
  }).sort((a, b) => b.wr - a.wr);

  const agentLines = agents.map(a =>
    `  ${a.status} ${a.name}: ${a.total > 0 ? `${a.wr}% (${a.wins}/${a.total})` : `${a.pending} en attente`}`
  ).join("\n");

  let meta = {};
  try {
    meta = db.prepare(`
      SELECT
        COUNT(DISTINCT home || '|' || away || '|' || date(created_at)) as matches,
        COUNT(*) as predictions,
        SUM(CASE WHEN outcome IS NOT NULL THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN outcome IS NULL THEN 1 ELSE 0 END) as pending
      FROM agent_predictions
    `).get() || {};
  } catch(e) {}

  let pickInfo = "";
  try {
    const lastPick = db.prepare("SELECT * FROM picks ORDER BY rowid DESC LIMIT 1").get();
    if (lastPick) {
      pickInfo = `\n🎯 <b>Dernier pick :</b>\n  ${lastPick.home || ''} vs ${lastPick.away || ''}\n  ${lastPick.bet || ''} @ ${lastPick.odds || ''}\n  Confiance: ${lastPick.confidence || '?'}/10\n  Résultat: ${lastPick.result || 'en attente'}`;
    }
  } catch(e) {}

  const text = `📋 <b>RAPPORT HERMES — ${dateStr}</b>

🤖 <b>Performance des agents :</b>
${agentLines}

📊 <b>Données :</b>
  Matchs suivis : ${meta.matches || 0}
  Prédictions : ${meta.predictions || 0}
  Résolues : ${meta.resolved || 0}
  En attente : ${meta.pending || 0}
${pickInfo}

━━━━━━━━━━━━━━━━━━
🤖 Hermes Council — Rapport à la demande`;

  sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, text).then(ok => {
    res.json({ ok, message: ok ? "Rapport envoyé sur Telegram admin" : "Échec envoi Telegram" });
  });
});

// ── Admin — bilan complet analyses gagnées/perdues sur Telegram admin ────────
async function sendStatsBilanTelegram() {
  if (!TELEGRAM_ADMIN_CHAT_ID) return false;
  try {
    const threshold = getAdaptiveSignalThreshold();
    const raw = db.prepare(`
      SELECT home, away, competition, sport, best_bet, confidence, outcome,
             final_score_home, final_score_away, analysed_at
      FROM concile_analyses
      WHERE outcome IN ('win','loss')
      ORDER BY analysed_at DESC
    `).all();

    const seen = new Set();
    const all = [];
    for (const r of raw) {
      const key = `${r.home}_${r.away}_${(r.analysed_at || "").slice(0, 10)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(r);
    }

    const wins = all.filter(r => r.outcome === "win");
    const losses = all.filter(r => r.outcome === "loss");
    const total = all.length;
    const winrate = total > 0 ? Math.round(wins.length / total * 100) : 0;

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayAll = all.filter(r => r.analysed_at && r.analysed_at.startsWith(todayStr));
    const todayWins = todayAll.filter(r => r.outcome === "win").length;
    const todayLosses = todayAll.filter(r => r.outcome === "loss").length;

    const byComp = {};
    all.forEach(r => {
      const c = r.competition || "Inconnu";
      if (!byComp[c]) byComp[c] = { w: 0, l: 0 };
      if (r.outcome === "win") byComp[c].w++; else byComp[c].l++;
    });
    const compLines = Object.entries(byComp)
      .sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l))
      .slice(0, 15)
      .map(([c, s]) => {
        const t = s.w + s.l;
        const wr = Math.round(s.w / t * 100);
        const icon = wr >= 60 ? "✅" : wr >= 40 ? "⚠️" : "❌";
        return `${icon} ${c}: ${wr}% (${s.w}W/${s.l}L)`;
      }).join("\n");

    const recentLines = all.slice(0, 20).map(r => {
      const icon = r.outcome === "win" ? "✅" : "❌";
      const score = r.final_score_home != null ? `${r.final_score_home}-${r.final_score_away}` : "?";
      return `${icon} ${r.home} vs ${r.away} (${score}) — ${r.best_bet} @ ${r.confidence}%`;
    }).join("\n");

    const text = `📊 <b>BILAN COMPLET DES ANALYSES</b>

🎯 <b>Global :</b>
✅ Gagnés : <b>${wins.length}</b>
❌ Perdus : <b>${losses.length}</b>
📈 Winrate : <b>${winrate}%</b> (${total} analyses)
🎚 Seuil adaptatif : ${threshold}%

📅 <b>Aujourd'hui :</b>
✅ ${todayWins} gagné${todayWins > 1 ? "s" : ""} / ❌ ${todayLosses} perdu${todayLosses > 1 ? "s" : ""} (${todayAll.length} résolus)

🏆 <b>Par compétition (toutes) :</b>
${compLines}

📋 <b>20 dernières analyses :</b>
${recentLines}

━━━━━━━━━━━━━━━━━━
🤖 Hermes Council — Bilan quotidien 22h`;

    return await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, text);
  } catch (e) {
    console.error("[bilan-stats]", e.message);
    return false;
  }
}

app.get("/admin/send-stats-bilan", async (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorise" });
  const ok = await sendStatsBilanTelegram();
  res.json({ ok, message: ok ? "Bilan envoye sur Telegram admin" : "Echec envoi" });
});

// ── Daily results summary → FREE Telegram channel (22h Paris) ────────────────
let _lastFreeResultsBilanDate = "";
async function sendDailyResultsFreeChannel() {
  if (!TELEGRAM_CHANNEL_ID || !TELEGRAM_BOT_TOKEN) return false;
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const rows = db.prepare(`
      SELECT home, away, competition, sport, best_bet, confidence, outcome,
             final_score_home, final_score_away
      FROM concile_analyses
      WHERE date(analysed_at) = ? AND outcome IN ('win','loss')
      ORDER BY analysed_at DESC
    `).all(todayStr);

    const seen = new Set();
    const unique = [];
    for (const r of rows) {
      const k = `${r.home}_${r.away}`;
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(r);
    }
    if (unique.length < 3) return false;

    const wins = unique.filter(r => r.outcome === "win");
    const losses = unique.filter(r => r.outcome === "loss");
    const winrate = Math.round(wins.length / unique.length * 100);

    const matchLines = unique.map(r => {
      const icon = r.outcome === "win" ? "✅" : "❌";
      const score = r.final_score_home != null ? `${r.final_score_home}-${r.final_score_away}` : "?";
      const cote = Math.min(1.95, ((1 / (r.confidence / 100)) * 1.45)).toFixed(2);
      const gainStr = r.outcome === "win" ? `+${(10 * parseFloat(cote) - 10).toFixed(0)}€` : "-10€";
      return `${icon} ${r.home} vs ${r.away} (${score}) — ${r.best_bet} @ ${cote} → ${gainStr}`;
    }).join("\n");

    const totalGain = unique.reduce((sum, r) => {
      const cote = Math.min(1.95, ((1 / (r.confidence / 100)) * 1.45));
      return sum + (r.outcome === "win" ? (10 * cote - 10) : -10);
    }, 0);

    const emoji = winrate >= 70 ? "🔥" : winrate >= 50 ? "📊" : "💪";
    const msg = [
      `${emoji} <b>RÉSULTATS DU JOUR — ${todayStr}</b>`,
      ``,
      `✅ <b>${wins.length} gagnés</b> / ❌ ${losses.length} perdus — <b>${winrate}% winrate</b>`,
      ``,
      matchLines,
      ``,
      `💰 <b>Bilan du jour à 10€/analyse : ${totalGain >= 0 ? "+" : ""}${totalGain.toFixed(0)}€</b>`,
      ``,
      winrate >= 60
        ? `🚀 Ces résultats sont réservés aux membres Premium.\n👉 <a href="https://www.touslesmatchs.com/#plan-carte">⚡ Débloquer l'accès – 1 €</a>`
        : `💪 La discipline fait la différence.\n👉 <a href="https://www.touslesmatchs.com/#plan-carte">⚡ Débloquer l'accès – 1 €</a>`,
      ``,
      `━━━━━━━━━━━━━━━━━━`,
      `🤖 Concile IA — TousLesMatchs`,
      `⚠️ 18+ — Jeu responsable`,
    ].join("\n");

    const ok = await sendTelegramMessage(TELEGRAM_CHANNEL_ID, msg);
    console.log(`[daily-results-free] ${wins.length}W/${losses.length}L ${winrate}% — Telegram free: ${ok ? "OK" : "FAIL"}`);
    return ok;
  } catch (e) {
    console.error("[daily-results-free]", e.message);
    return false;
  }
}

// ── Analysis history (public, past concile analyses) ────────────────────────
app.get("/analysis-history", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = parseInt(req.query.offset) || 0;
  try {
    const rows = db.prepare(`
      SELECT id, home, away, competition, sport, best_bet, confidence, raison,
             consensus_votes, outcome, analysed_at,
             score_home_at_analysis, score_away_at_analysis, minute_at_analysis,
             final_score_home, final_score_away, resolved_at,
             home_logo, away_logo, bet_category,
             agents_json
      FROM concile_analyses
      WHERE date(analysed_at) >= '2026-07-03'
      ORDER BY analysed_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = db.prepare(`SELECT COUNT(*) as cnt FROM concile_analyses WHERE date(analysed_at) >= '2026-07-03'`).get()?.cnt || 0;

    const analyses = rows.map(r => {
      let agents = [];
      try { agents = JSON.parse(r.agents_json || "[]"); } catch {}
      return {
        id: r.id,
        home: r.home, away: r.away,
        competition: r.competition, sport: r.sport || "Football",
        bet: r.best_bet, confidence: r.confidence,
        reasoning: r.raison, consensus: r.consensus_votes,
        outcome: r.outcome,
        analysed_at: r.analysed_at,
        score: r.score_home_at_analysis != null ? `${r.score_home_at_analysis}-${r.score_away_at_analysis}` : null,
        minute: r.minute_at_analysis,
        final_score: r.final_score_home != null ? `${r.final_score_home}-${r.final_score_away}` : null,
        resolved_at: r.resolved_at,
        home_logo: r.home_logo, away_logo: r.away_logo,
        bet_category: r.bet_category,
        agents_count: agents.length,
      };
    });

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses
      WHERE date(analysed_at) >= '2026-07-03' AND outcome IS NOT NULL
    `).get() || {};

    res.json({
      ok: true, analyses, total,
      stats: { total: stats.total || 0, wins: stats.wins || 0, losses: stats.losses || 0, winrate: stats.total > 0 ? Math.round(stats.wins / stats.total * 100) : 0 },
    });
  } catch (e) {
    console.error("[analysis-history]", e.message);
    res.json({ ok: true, analyses: [], total: 0, stats: { total: 0, wins: 0, losses: 0, winrate: 0 } });
  }
});

// ── Admin — analytics reports on demand ──────────────────────────────────────
app.post("/admin/analytics-report", async (req, res) => {
  const { email, code, type } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Non autorisé" });
  if (type === "weekly") {
    const text = await buildWeeklyMarketingReport();
    const ok = await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, text);
    return res.json({ ok, message: ok ? "Rapport hebdo envoyé" : "Échec envoi" });
  }
  const text = buildDailyVisitorReport();
  const ok = await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, text);
  res.json({ ok, message: ok ? "Rapport visiteurs envoyé" : "Échec envoi" });
});

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

// ── Admin losing leagues analysis ─────────────────────────────────────────────
app.get("/admin/losing-leagues", (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.json({ ok: false, error: "Accès admin requis" });
  try {
    const rows = db.prepare(`
      SELECT competition, country, sport,
        COUNT(*) as total,
        SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
      FROM concile_analyses
      WHERE outcome IN ('win','loss') AND competition != ''
      GROUP BY competition
      HAVING total >= 2
      ORDER BY losses DESC, total DESC
    `).all();
    const leagues = rows.map(r => ({
      competition: r.competition,
      country: r.country,
      sport: r.sport,
      total: r.total,
      wins: r.wins,
      losses: r.losses,
      winrate: r.total > 0 ? Math.round(r.wins / r.total * 100) : 0,
      danger: r.total >= 3 && (r.wins / r.total) < 0.5,
    }));
    const dangerous = leagues.filter(l => l.danger);
    res.json({ ok: true, leagues, dangerous, suggestion: dangerous.map(l => l.competition.toLowerCase()) });
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
// Route appelée par Hermès bot après vérification Stripe paiement client
app.post("/internal/stripe-verify", async (req, res) => {
  const { session_id, email } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  const secret = req.headers["x-internal-secret"];
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) return res.status(403).json({ ok: false });
  if (!session_id || !email) return res.json({ ok: false, error: "session_id et email requis" });

  try {
    // Vérifier session Stripe
    if (!STRIPE_SECRET_KEY) return res.json({ ok: false, error: "Stripe non configuré" });
    const Stripe = require("stripe");
    const stripe = Stripe(STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(session_id, { expand: ["line_items"] });
    if (!session || session.payment_status !== "paid") return res.json({ ok: false, error: "Paiement non confirmé" });

    const priceId = session.line_items?.data?.[0]?.price?.id || "";
    const planMap = {
      [STRIPE_PRICE_ID_CARTE]:   { status: "carte",   durationDays: 1,  creditsMax: 1 },
      [STRIPE_PRICE_ID_PREMIUM]: { status: "premium", durationDays: 32, creditsMax: 10 },
      [STRIPE_PRICE_ID_VIP]:     { status: "vip",     durationDays: 32, creditsMax: 20 },
      [STRIPE_PRICE_ID_ELITE]:   { status: "elite",   durationDays: 32, creditsMax: 30 },
    };
    const { status = "premium", durationDays = 32, creditsMax = 10 } = planMap[priceId] || {};

    // Chercher code existant
    const cdbr = new Database(CODES_DB_PATH, { readonly: true });
    let codeRow = cdbr.prepare("SELECT code, plan FROM codes WHERE email = ? AND active = 1").get(email);
    cdbr.close();

    if (!codeRow) {
      // Créer le code
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const newCode = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      const expiresAt = new Date(Date.now() + durationDays * 86400000).toISOString().slice(0, 10);
      const cdbw = new Database(CODES_DB_PATH);
      cdbw.prepare(
        "INSERT INTO codes (code, email, plan, active, expires_at, credits_max, credits_used, credits_date) VALUES (?,?,?,1,?,?,0,?)"
      ).run(newCode, email, status, expiresAt, creditsMax, getTodayStr());
      cdbw.close();
      codeRow = { code: newCode, plan: status };
      console.log(`[stripe-verify] Code créé: ${newCode} pour ${email} plan ${status}`);
    }

    res.json({ ok: true, code: codeRow.code, plan: codeRow.plan });
  } catch(e) {
    console.error("[stripe-verify]", e.message);
    res.json({ ok: false, error: e.message });
  }
});

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
    ⚠️ Analyses sportives réservées aux +18 ans. Jeu responsable.
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

// ── Referral routes ───────────────────────────────────────────────────────────
app.get("/ref/:code", (req, res) => {
  const code = String(req.params.code || "").replace(/[^A-Z0-9\-]/gi, "").toUpperCase().slice(0, 24);
  res.redirect(302, `/?ref=${encodeURIComponent(code)}#plans`);
});

app.post("/referral/get-link", (req, res) => {
  const { email, code } = req.body || {};
  const auth = verifyCode(email, code);
  if (!auth.valid) return res.status(401).json({ ok: false, error: "Code invalide" });
  const refCode = getOrCreateRefCode(email.toLowerCase().trim());
  const link = `https://www.touslesmatchs.com/ref/${refCode}`;
  const data = loadReferrals();
  const ref = data.refs[refCode] || {};
  res.json({ ok: true, refCode, link, referrals: (ref.referrals || []).length, monthsEarned: ref.monthsEarned || 0 });
});

app.post("/referral/confirm", (req, res) => {
  const { refCode, newEmail, secret } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) return res.status(403).json({ ok: false, error: "Forbidden" });
  if (!refCode || !newEmail) return res.json({ ok: false, error: "refCode et newEmail requis" });
  const credited = creditReferrer(refCode.toUpperCase(), newEmail.toLowerCase().trim());
  res.json({ ok: credited, message: credited ? "Parrain crédité de 30 jours" : "Déjà crédité ou code invalide" });
});

// ── Signal Fort Bilan — endpoint admin + public stats ────────────────────────
app.post("/internal/signal-fort-bilan", async (req, res) => {
  const { secret } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) return res.status(403).json({ ok: false, error: "Forbidden" });
  await sendSignalFortBilanTelegram();
  res.json({ ok: true, stats: getSignalFortStats() });
});

app.get("/signal-fort-stats", (req, res) => {
  const stats = getSignalFortStats();
  const coteMoy = (c) => Math.min(1.95, ((1 / (c / 100)) * 1.45)).toFixed(2);
  res.json({
    ok: true,
    total: stats.total,
    wins: stats.wins,
    losses: stats.losses,
    winrate: stats.winrate,
    recent: stats.recent.map(r => ({
      home: r.home,
      away: r.away,
      competition: r.competition,
      sport: r.sport,
      confidence: r.confidence,
      outcome: r.outcome,
      cote: parseFloat(coteMoy(r.confidence)),
      score: r.final_score_home != null ? `${r.final_score_home}-${r.final_score_away}` : null,
      date: r.analysed_at,
    })),
    picks_feed: stats.recent.map(r => ({
      id: `sf-${r.home}-${r.away}-${r.analysed_at}`.replace(/\s+/g, '-').toLowerCase(),
      date: r.analysed_at ? r.analysed_at.slice(0, 10) : "",
      time: r.analysed_at ? r.analysed_at.slice(11, 16) : "",
      competition: r.competition || r.sport || "",
      home: r.home,
      away: r.away,
      pick: `Signal Fort ${r.confidence}%`,
      cote: parseFloat(coteMoy(r.confidence)),
      status: "finished",
      result: r.outcome === "win" ? "win" : "loss",
      score: r.final_score_home != null ? `${r.final_score_home}-${r.final_score_away}` : "?",
    })),
    threshold: getAdaptiveSignalThreshold(),
  });
});

// ── Premium teaser stats — public endpoint for NOPICK sales pitch ─────────────
app.get("/premium-teaser", (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const allRows = db.prepare(`
      SELECT home, away, competition, outcome, confidence, best_bet,
        final_score_home, final_score_away, sport, analysed_at
      FROM concile_analyses
      WHERE outcome IN ('win','loss')
      ORDER BY analysed_at DESC
    `).all();

    const deduped = [];
    const seen = new Set();
    for (const r of allRows) {
      const key = `${r.home}_${r.away}_${(r.analysed_at || "").slice(0, 10)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(r);
    }

    const todayRows = deduped.filter(r => (r.analysed_at || "").startsWith(today));
    const yesterdayRows = deduped.filter(r => (r.analysed_at || "").startsWith(yesterday));
    const week7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const weekRows = deduped.filter(r => (r.analysed_at || "").slice(0, 10) >= week7);

    const agg = (rows) => ({
      total: rows.length,
      wins: rows.filter(r => r.outcome === "win").length,
      losses: rows.filter(r => r.outcome === "loss").length,
    });

    const allTime = agg(deduped);
    const todayStats = agg(todayRows);
    const yesterdayStats = agg(yesterdayRows);
    const weekStats = agg(weekRows);
    const winrate = allTime.total > 0 ? Math.round(allTime.wins / allTime.total * 100) : 0;

    const simGain = deduped.reduce((sum, r) => {
      const cote = Math.min(1.95, ((1 / (r.confidence / 100)) * 1.45));
      return sum + (r.outcome === "win" ? (10 * cote - 10) : -10);
    }, 0);

    const todaySignals = todayRows.length;

    const recentResults = todayRows.length > 0 ? todayRows : deduped.slice(0, 20);

    res.json({
      ok: true,
      today_signals: todaySignals,
      week: weekStats,
      allTime: { total: allTime.total, wins: allTime.wins, winrate },
      simulated_gain_10: simGain > 0 ? `+${Math.round(simGain)}€` : `${Math.round(simGain)}€`,
      simulated_gain_raw: Math.round(simGain),
      today_results: todayStats,
      yesterday: yesterdayStats,
      recent: recentResults.map(r => {
        const cote = Math.min(1.95, ((1 / (r.confidence / 100)) * 1.45));
        const gain10 = r.outcome === 'win' ? Math.round((cote * 10 - 10) * 100) / 100 : -10;
        return {
          match: `${r.home} vs ${r.away}`,
          competition: r.competition || '',
          outcome: r.outcome,
          sport: r.sport || 'Football',
          score: r.final_score_home != null ? `${r.final_score_home}-${r.final_score_away}` : null,
          date: r.analysed_at ? r.analysed_at.slice(0, 10) : null,
          cote: Math.round(cote * 100) / 100,
          gain10,
        };
      }),
    });
  } catch (e) {
    res.json({ ok: true, today_signals: 0, week: { total: 0, wins: 0, losses: 0 }, allTime: { total: 0, wins: 0, winrate: 0 }, simulated_gain_10: "0€", simulated_gain_raw: 0, yesterday: { total: 0, wins: 0, losses: 0 }, recent: [], });
  }
});

// ── Internal signal notify — strong signal email to premium subscribers ───────
app.post("/internal/signal-notify", async (req, res) => {
  const { signal, secret } = req.body || {};
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) return res.status(403).json({ ok: false, error: "Forbidden" });
  if (!signal || !signal.home) return res.json({ ok: false, error: "signal manquant" });
  if (!BREVO_API_KEY) return res.json({ ok: false, error: "BREVO_API_KEY non configuré", sent: 0 });

  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const rows = codesDb.prepare(
      "SELECT email FROM codes WHERE active = 1 AND plan IN ('premium','elite','vip') AND email IS NOT NULL AND email != ''"
    ).all();
    codesDb.close();

    const sportIcons = { Football:"⚽", Basketball:"🏀", Hockey:"🏒", Baseball:"⚾", Rugby:"🏉", Handball:"🤾", Volleyball:"🏐" };
    const sportIcon = sportIcons[signal.sport] || "🎯";
    const conf = signal.confidence || "?";
    const confColor = conf >= 85 ? "#10b981" : conf >= 80 ? "#f59e0b" : "#6366f1";
    const logoHtml = signal.home_logo ? `<img src="${signal.home_logo}" alt="" style="width:40px;height:40px;object-fit:contain;border-radius:6px;vertical-align:middle;margin-right:8px">` : "";

    const htmlContent = `
<div style="background:#06080f;padding:32px 24px;font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:24px;font-weight:900;background:linear-gradient(135deg,#6366f1,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:inline-block">TousLesMatchs</div>
    <div style="font-size:11px;color:#7b82a0;letter-spacing:.1em;text-transform:uppercase;margin-top:4px">ALERTE SIGNAL FORT — CONCILE IA</div>
  </div>
  <div style="background:#0d1020;border:1px solid rgba(16,185,129,.3);border-radius:16px;padding:24px;margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <span style="font-size:28px">${sportIcon}</span>
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#10b981">🚨 Signal fort détecté</div>
        <div style="font-size:11px;color:#7b82a0">${signal.competition || signal.sport || ""}</div>
      </div>
      <div style="margin-left:auto;background:${confColor}18;border:1px solid ${confColor};border-radius:10px;padding:4px 12px;font-size:14px;font-weight:900;color:${confColor}">${conf}%</div>
    </div>
    <div style="font-size:20px;font-weight:900;color:#eceaf4;margin-bottom:6px">${logoHtml}${signal.home} vs ${signal.away}</div>
    ${signal.minute ? `<div style="font-size:12px;color:#22d3ee;margin-bottom:12px">⏱ ${signal.minute}' en cours${signal.score_home != null ? " · Score : " + signal.score_home + "-" + signal.score_away : ""}</div>` : ""}
    <div style="background:rgba(79,70,229,.12);border:1px solid rgba(79,70,229,.25);border-radius:10px;padding:14px;margin-bottom:16px">
      <div style="font-size:13px;color:#a8aec8;margin-bottom:4px">Signal Concile</div>
      <div style="font-size:18px;font-weight:800;color:#eceaf4">${signal.bet || ""}</div>
      ${signal.reason ? `<div style="font-size:12px;color:#a8aec8;margin-top:8px;font-style:italic;border-left:2px solid rgba(99,102,241,.4);padding-left:10px">${signal.reason}</div>` : ""}
    </div>
    <div style="text-align:center">
      <a href="https://www.touslesmatchs.com/live-ia" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">Voir l'analyse Live IA →</a>
    </div>
  </div>
  ${bookmakerEmailHtml()}
  <div style="text-align:center;font-size:11px;color:#7b82a0;line-height:1.6">
    TousLesMatchs — Signal automatique Concile IA<br>
    ⚠️ Analyses sportives réservées aux +18 ans. Jeu responsable. Cotes à vérifier sur les plateformes.
  </div>
</div>`;

    let sent = 0;
    const emails = [...new Set(rows.map(r => r.email).filter(Boolean))];
    for (const email of emails) {
      try {
        await brevoSendEmail(email, `🚨 Signal fort ${conf}% — ${signal.home} vs ${signal.away} (${signal.sport || "Sport"})`, htmlContent);
        sent++;
      } catch (e) {
        console.error(`[signal-notify] email to ${email}:`, e.message);
      }
    }
    console.log(`[signal-notify] Emails signal fort envoyés : ${sent}/${emails.length}`);

    // Email teaser aux inscrits GRATUITS (sans le pari, avec CTA abonnement)
    try {
      const leadRows = loadLeads().leads || [];
      const premiumEmails = new Set(emails.map(e => e.toLowerCase()));
      const freeEmails = [...new Set(leadRows.map(l => l.email).filter(e => e && !premiumEmails.has(e.toLowerCase())))];
      if (freeEmails.length > 0) {
        const teaserHtml = `
<div style="background:#06080f;padding:32px 24px;font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:24px;font-weight:900;background:linear-gradient(135deg,#6366f1,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:inline-block">TousLesMatchs</div>
    <div style="font-size:11px;color:#7b82a0;letter-spacing:.1em;text-transform:uppercase;margin-top:4px">ALERTE SIGNAL FORT</div>
  </div>
  <div style="background:#0d1020;border:1px solid rgba(99,102,241,.3);border-radius:16px;padding:24px;margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <span style="font-size:28px">${sportIcon}</span>
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#f59e0b">🚨 Signal fort détecté</div>
        <div style="font-size:11px;color:#7b82a0">${signal.competition || signal.sport || ""}</div>
      </div>
      <div style="margin-left:auto;background:${confColor}18;border:1px solid ${confColor};border-radius:10px;padding:4px 12px;font-size:14px;font-weight:900;color:${confColor}">${conf}%</div>
    </div>
    <div style="font-size:20px;font-weight:900;color:#eceaf4;margin-bottom:6px">${logoHtml}${signal.home} vs ${signal.away}</div>
    ${signal.minute ? `<div style="font-size:12px;color:#22d3ee;margin-bottom:12px">⏱ ${signal.minute}' en cours</div>` : ""}
    <div style="background:rgba(79,70,229,.12);border:1px solid rgba(79,70,229,.25);border-radius:10px;padding:16px;text-align:center">
      <div style="font-size:14px;color:#a8aec8;margin-bottom:8px">Le Concile IA a identifié une analyse à <strong style="color:#eceaf4">${conf}% de confiance</strong></div>
      <div style="font-size:16px;font-weight:800;color:#6366f1">🔒 Analyse réservée aux abonnés</div>
    </div>
  </div>
  <div style="text-align:center;margin-bottom:16px">
    <a href="https://www.touslesmatchs.com/#plans" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 20px rgba(79,70,229,.4)">Débloquer l'analyse — 9.90€/mois →</a>
  </div>
  <div style="text-align:center;margin-bottom:20px">
    <a href="https://www.touslesmatchs.com/#plan-carte" style="color:#6366f1;font-size:13px;text-decoration:none">Tester 1 analyse pour 1€</a>
  </div>
  <div style="text-align:center;font-size:11px;color:#7b82a0;line-height:1.6">
    TousLesMatchs — Signal automatique Concile IA<br>
    ⚠️ 18+ · Jeu responsable · <a href="https://www.touslesmatchs.com/mentions-legales.html" style="color:#6366f1;text-decoration:none">Se désabonner</a>
  </div>
</div>`;
        let freeSent = 0;
        for (const fe of freeEmails.slice(0, 200)) {
          try {
            await brevoSendEmail(fe, `🚨 Signal fort ${conf}% détecté — ${signal.home} vs ${signal.away}`, teaserHtml);
            freeSent++;
          } catch (_) {}
        }
        console.log(`[signal-notify] Teaser free envoyés : ${freeSent}/${freeEmails.length}`);
      }
    } catch (e) { console.error("[signal-notify] free teaser:", e.message); }

    const sportIcons2 = { Football:"⚽", Basketball:"🏀", Hockey:"🏒", Baseball:"⚾", Tennis:"🎾", Rugby:"🏉" };
    const tgIcon = sportIcons2[signal.sport] || "🎯";
    const tgPremiumText = `🚨 <b>SIGNAL FORT — ${conf}%</b>\n\n${tgIcon} <b>${signal.home} vs ${signal.away}</b>\n🏆 ${signal.competition || signal.sport || ""}\n${signal.minute ? `⏱ ${signal.minute}' · Score : ${signal.score_home ?? "?"}-${signal.score_away ?? "?"}` : ""}\n\n💡 Pari : <b>${signal.bet || ""}</b>\n📊 Confiance : <b>${conf}%</b>\n${signal.reason ? `\n<i>${String(signal.reason).slice(0, 200)}</i>` : ""}\n\n━━━━━━━━━━━━━━━━━━\n⚠️ 18+ — Jeu responsable`;
    const tgFreeText = `🚨 <b>SIGNAL FORT DÉTECTÉ — ${conf}%</b>\n\n${tgIcon} <b>${signal.home} vs ${signal.away}</b>\n🏆 ${signal.competition || signal.sport || ""}\n${signal.minute ? `⏱ ${signal.minute}' · Score : ${signal.score_home ?? "?"}-${signal.score_away ?? "?"}` : ""}\n\n🔒 <b>Le pari exact et l'analyse complète sont réservés aux abonnés Premium/Elite.</b>\n\n👉 <a href="https://www.touslesmatchs.com/#plans">S'abonner pour accéder aux picks</a>\n\n━━━━━━━━━━━━━━━━━━\n⚠️ 18+ — Jeu responsable`;
    if (TELEGRAM_PREMIUM_CHANNEL_ID) {
      const ok = await sendTelegramMessage(TELEGRAM_PREMIUM_CHANNEL_ID, tgPremiumText);
      console.log(`[signal-notify] Telegram premium: ${ok ? "OK" : "FAIL"}`);
    }
    if (TELEGRAM_CHANNEL_ID) {
      const ok = await sendTelegramMessage(TELEGRAM_CHANNEL_ID, tgFreeText);
      console.log(`[signal-notify] Telegram free: ${ok ? "OK" : "FAIL"}`);
    }

    // Épingler le signal 90 min sur Live IA pour que le lien Telegram mène au bon match
    addPinnedSignal({
      id: signal.id || `${signal.home}_${signal.away}_${Date.now()}`,
      home: signal.home, away: signal.away,
      competition: signal.competition || signal.sport || "",
      sport: signal.sport || "Football",
      minute: signal.minute,
      score_home: signal.score_home,
      score_away: signal.score_away,
      home_logo: signal.home_logo || null,
      away_logo: signal.away_logo || null,
      bet: signal.bet,
      confidence: signal.confidence,
      reason: signal.reason,
    });

    res.json({ ok: true, sent, total: emails.length });
  } catch (e) {
    console.error("[signal-notify]", e.message);
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

  const confidence = Math.max(1, Math.min(100, Number(record.confidence ?? 55)));
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

// ── Analytics — tracking beacon ──────────────────────────────────────────────
const TRACKING_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

app.get("/t", (req, res) => {
  try {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    const ipHash = crypto.createHash("sha256").update(ip + "tlm-salt").digest("hex").slice(0, 16);
    db.prepare(`
      INSERT INTO page_views (page, referrer, utm_source, utm_medium, utm_campaign, ip_hash, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(req.query.p || "/").slice(0, 200),
      String(req.query.r || "").slice(0, 500),
      String(req.query.s || "").slice(0, 100),
      String(req.query.m || "").slice(0, 100),
      String(req.query.c || "").slice(0, 100),
      ipHash,
      String(req.headers["user-agent"] || "").slice(0, 300),
    );
  } catch (e) {
    console.error("[tracking] error:", e.message);
  }
  res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store" });
  res.send(TRACKING_GIF);
});

// ── Analytics — daily visitor report (23:00 Paris) ──────────────────────────
function getParisHour() {
  return new Date().toLocaleString("en-US", { timeZone: "Europe/Paris", hour: "numeric", hour12: false });
}

function buildDailyVisitorReport() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT page, referrer, utm_source, utm_medium, utm_campaign, ip_hash
    FROM page_views
    WHERE date(created_at) = ?
  `).all(today);

  const uniqueVisitors = new Set(rows.map(r => r.ip_hash)).size;
  const totalViews = rows.length;

  const byPage = {};
  rows.forEach(r => { byPage[r.page] = (byPage[r.page] || 0) + 1; });

  const bySource = {};
  rows.forEach(r => {
    let src = r.utm_source || "direct";
    if (!r.utm_source && r.referrer) {
      try {
        const host = new URL(r.referrer).hostname.replace("www.", "");
        src = host || "direct";
      } catch { src = r.referrer.slice(0, 40) || "direct"; }
    }
    bySource[src] = (bySource[src] || new Set()).add(r.ip_hash);
  });

  const sourcesLines = Object.entries(bySource)
    .map(([src, ips]) => ({ src, count: ips.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(s => `  ${s.src}: ${s.count} visiteur${s.count > 1 ? "s" : ""}`)
    .join("\n");

  const pagesLines = Object.entries(byPage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([p, c]) => `  ${p}: ${c} vues`)
    .join("\n");

  return `📊 <b>RAPPORT VISITEURS — ${today}</b>

👥 <b>Visiteurs uniques :</b> ${uniqueVisitors}
👁 <b>Pages vues :</b> ${totalViews}

🔗 <b>Sources :</b>
${sourcesLines || "  Aucune visite"}

📄 <b>Pages :</b>
${pagesLines || "  Aucune visite"}

━━━━━━━━━━━━━━━━━━
🤖 Hermès Analytics — Rapport quotidien`;
}

function sendDailyVisitorReport() {
  if (!TELEGRAM_ADMIN_CHAT_ID) return;
  const text = buildDailyVisitorReport();
  sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, text).then(ok => {
    console.log(`[analytics] Rapport visiteurs quotidien: ${ok ? "envoyé" : "échec"}`);
  });
}

// ── Analytics — weekly marketing report (Monday 8:00 Paris) ─────────────────
async function buildWeeklyMarketingReport() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  // Visiteurs de la semaine
  const visitorsRow = db.prepare(`
    SELECT COUNT(DISTINCT ip_hash) as visitors, COUNT(*) as views
    FROM page_views WHERE date(created_at) >= ?
  `).get(weekAgo);

  // Visiteurs TikTok
  const tiktokRow = db.prepare(`
    SELECT COUNT(DISTINCT ip_hash) as visitors
    FROM page_views WHERE date(created_at) >= ? AND (utm_source LIKE '%tiktok%' OR referrer LIKE '%tiktok%')
  `).get(weekAgo);

  // Emails récupérés (leads.json)
  let newEmails = 0;
  try {
    const leadsData = loadLeads();
    newEmails = leadsData.leads.filter(l => l.created_at && l.created_at >= weekAgo).length;
  } catch {}

  // Abonnements et CA via la DB codes
  let newSubs = 0;
  let revenue = 0;
  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const subs = codesDb.prepare(`
      SELECT plan, COUNT(*) as cnt FROM codes
      WHERE active = 1 AND plan != 'free' AND created_at >= ?
      GROUP BY plan
    `).all(weekAgo);
    codesDb.close();
    const prices = { carte: 1, premium: 9.90, vip: 19.90, elite: 19.90 };
    subs.forEach(s => {
      newSubs += s.cnt;
      revenue += (prices[s.plan] || 0) * s.cnt;
    });
  } catch (e) {
    console.error("[analytics] codes query:", e.message);
  }

  // Taux de conversion
  const totalVisitors = visitorsRow?.visitors || 0;
  const conversionEmail = totalVisitors > 0 ? ((newEmails / totalVisitors) * 100).toFixed(1) : "0.0";
  const conversionPaid = totalVisitors > 0 ? ((newSubs / totalVisitors) * 100).toFixed(1) : "0.0";

  // Sources de la semaine
  const sourceRows = db.prepare(`
    SELECT
      CASE
        WHEN utm_source LIKE '%tiktok%' OR referrer LIKE '%tiktok%' THEN 'TikTok'
        WHEN utm_source LIKE '%telegram%' OR referrer LIKE '%t.me%' THEN 'Telegram'
        WHEN utm_source LIKE '%google%' OR referrer LIKE '%google%' THEN 'Google'
        WHEN utm_source LIKE '%instagram%' OR referrer LIKE '%instagram%' THEN 'Instagram'
        WHEN utm_source != '' THEN utm_source
        WHEN referrer != '' THEN referrer
        ELSE 'Direct'
      END as source,
      COUNT(DISTINCT ip_hash) as visitors
    FROM page_views WHERE date(created_at) >= ?
    GROUP BY source ORDER BY visitors DESC LIMIT 8
  `).all(weekAgo);
  const sourcesLines = sourceRows.map(s => `  ${s.source}: ${s.visitors}`).join("\n");

  return `📈 <b>RAPPORT MARKETING HEBDO</b>
📅 ${weekAgo} → ${today}

📱 <b>Visiteurs TikTok :</b> ${tiktokRow?.visitors || 0}
👥 <b>Visiteurs totaux :</b> ${totalVisitors}
📧 <b>Emails récupérés :</b> ${newEmails}
💳 <b>Abonnements :</b> ${newSubs}
💶 <b>CA généré :</b> ${revenue.toFixed(2)} €
🎯 <b>Conversion email :</b> ${conversionEmail}%
💰 <b>Conversion payant :</b> ${conversionPaid}%

🔗 <b>Top sources :</b>
${sourcesLines || "  Aucune donnée"}

━━━━━━━━━━━━━━━━━━
🤖 Hermès Analytics — Rapport hebdomadaire`;
}

function sendWeeklyMarketingReport() {
  if (!TELEGRAM_ADMIN_CHAT_ID) return;
  buildWeeklyMarketingReport().then(text => {
    sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, text).then(ok => {
      console.log(`[analytics] Rapport marketing hebdo: ${ok ? "envoyé" : "échec"}`);
    });
  });
}

// ── Analytics scheduler ─────────────────────────────────────────────────────
let _lastDailyReportDate = "";
let _lastWeeklyReportDate = "";
let _lastBilanDate = "";

function checkAnalyticsSchedule() {
  const now = new Date();
  const parisStr = now.toLocaleString("en-GB", { timeZone: "Europe/Paris" });
  const [datePart, timePart] = parisStr.split(", ");
  const hour = parseInt(timePart.split(":")[0]);
  const day = now.toLocaleDateString("en-US", { timeZone: "Europe/Paris", weekday: "long" });
  const todayKey = now.toISOString().slice(0, 10);

  if (hour === 22 && _lastBilanDate !== todayKey) {
    _lastBilanDate = todayKey;
    console.log("[bilan-stats] Envoi bilan quotidien 22h sur Telegram admin...");
    sendStatsBilanTelegram().then(ok => console.log(`[bilan-stats] ${ok ? "OK" : "ECHEC"}`));
    if (_lastFreeResultsBilanDate !== todayKey) {
      _lastFreeResultsBilanDate = todayKey;
      console.log("[daily-results-free] Envoi résultats du jour sur canal gratuit...");
      sendDailyResultsFreeChannel().then(ok => console.log(`[daily-results-free] ${ok ? "OK" : "SKIP/ECHEC"}`));
    }
  }

  if (hour === 23 && _lastDailyReportDate !== todayKey) {
    _lastDailyReportDate = todayKey;
    console.log("[analytics] Envoi rapport visiteurs quotidien (23h)...");
    sendDailyVisitorReport();
  }

  if (day === "Monday" && hour === 8 && _lastWeeklyReportDate !== todayKey) {
    _lastWeeklyReportDate = todayKey;
    console.log("[analytics] Envoi rapport marketing hebdo (lundi 8h)...");
    sendWeeklyMarketingReport();
  }
}

const PORT = process.env.PORT || 3001;
// ── Internal — liste abonnés expirant dans N jours (pour Hermès) ─────────────
app.get("/internal/expiring-codes", (req, res) => {
  const HERMES_TOKEN = process.env.HERMES_ADMIN_TLM_BOT;
  const secret = req.headers["x-internal-secret"];
  if (!HERMES_TOKEN || secret !== HERMES_TOKEN) return res.status(403).json({ ok: false });
  const days = parseInt(req.query.days) || 7;
  try {
    const codesDb = new Database(CODES_DB_PATH, { readonly: true });
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10);
    const rows = codesDb.prepare(
      "SELECT email, plan, expires_at FROM codes WHERE active = 1 AND plan != 'free' AND expires_at IS NOT NULL AND expires_at <= ? ORDER BY expires_at"
    ).all(cutoff);
    codesDb.close();
    const withDiff = rows.map(r => ({
      ...r,
      daysLeft: Math.round((new Date(r.expires_at) - now) / 86400000)
    }));
    res.json({ ok: true, count: withDiff.length, expiring: withDiff });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── Learning Engine API ──────────────────────────────────────────────────────
app.get("/admin/learning-engine", (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Accès admin requis" });
  try {
    const weights = getLatestAgentWeights();
    const stats = getLearningEngineStats();
    const topAgents = [...weights].sort((a, b) => b.weight - a.weight);
    const worstAgents = [...weights].sort((a, b) => a.weight - b.weight);
    res.json({
      ok: true,
      agents: weights,
      topAgents: topAgents.slice(0, 5),
      worstAgents: worstAgents.slice(0, 5),
      stats,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/admin/learning-engine/recompute", (req, res) => {
  const { email, code } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Accès admin requis" });
  try {
    const results = computeAgentWeights();
    res.json({ ok: true, agents: results, message: `${results.length} agent(s) recalcule(s)` });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Learning Engine — Configuration endpoints ──────────────────────────────
app.get("/admin/learning-config", (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Accès admin requis" });
  res.json({ ok: true, config: LEARNING_CONFIG, defaults: LEARNING_CONFIG_DEFAULTS, history: getLearningConfigHistory() });
});

app.post("/admin/learning-config", (req, res) => {
  const { email, code, config } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Accès admin requis" });
  if (!config || typeof config !== "object") return res.status(400).json({ ok: false, error: "config object requis" });
  try {
    const result = saveLearningConfig(config, email || "admin");
    LEARNING_CONFIG = result.config;
    res.json({ ok: true, config: result.config, changes: result.changes });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/admin/learning-config/reset", (req, res) => {
  const { email, code } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Accès admin requis" });
  try {
    const result = saveLearningConfig(LEARNING_CONFIG_DEFAULTS, email || "admin (reset)");
    LEARNING_CONFIG = result.config;
    res.json({ ok: true, config: result.config, changes: result.changes, message: "Configuration restauree aux valeurs par defaut" });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Learning Engine — Simulation, Backtest, Versions, Sandbox ──────────────���─

app.post("/admin/learning-engine/simulate", (req, res) => {
  const { email, code, config } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Accès admin requis" });
  try {
    const result = simulateWeights(config || {});
    res.json({ ok: true, ...result });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post("/admin/learning-engine/backtest", (req, res) => {
  const { email, code, config } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Accès admin requis" });
  try {
    const result = runBacktest(config || {});
    res.json({ ok: true, ...result });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get("/admin/learning-config/versions", (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Accès admin requis" });
  try {
    res.json({ ok: true, versions: listConfigVersions(), current: LEARNING_CONFIG.version });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post("/admin/learning-config/restore", (req, res) => {
  const { email, code, configId } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Accès admin requis" });
  if (!configId) return res.status(400).json({ ok: false, error: "configId requis" });
  try {
    const result = restoreConfigVersion(configId, email || "admin");
    if (!result) return res.status(404).json({ ok: false, error: "Version introuvable" });
    LEARNING_CONFIG = result.config;
    res.json({ ok: true, config: result.config, version: result.version });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post("/admin/learning-engine/sandbox", (req, res) => {
  const { email, code, config } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Accès admin requis" });
  try {
    const sandboxConfig = { ...LEARNING_CONFIG, ...config };
    const simulation = simulateWeights(sandboxConfig);
    const backtest = runBacktest(sandboxConfig);
    res.json({ ok: true, sandbox: { config: sandboxConfig, simulation: simulation.agents, backtest: backtest.results, comparison: backtest.comparison } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── Learning Lab — Science & Validation ────────────────────────────────────

app.get("/admin/learning-lab", (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Accès admin requis" });
  try {
    res.json({ ok: true, dashboard: getLearningLabDashboard() });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post("/admin/learning-lab/backtest-config", (req, res) => {
  const { email, code, configId } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Accès admin requis" });
  if (!configId) return res.status(400).json({ ok: false, error: "configId requis" });
  try {
    const row = db.prepare(`SELECT config_json FROM learning_config WHERE id = ?`).get(configId);
    if (!row) return res.status(404).json({ ok: false, error: "Config introuvable" });
    const cfg = JSON.parse(row.config_json);
    const result = runBacktestAndSave(cfg, configId, email || "admin");
    res.json({ ok: true, ...result });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post("/admin/learning-lab/validate", (req, res) => {
  const { email, code, configId } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Accès admin requis" });
  if (!configId) return res.status(400).json({ ok: false, error: "configId requis" });
  try {
    const validation = validateConfigPromotion(configId);
    res.json({ ok: true, validation });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post("/admin/learning-lab/promote", (req, res) => {
  const { email, code, configId } = req.body || {};
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Accès admin requis" });
  if (!configId) return res.status(400).json({ ok: false, error: "configId requis" });
  try {
    const result = promoteConfigToProduction(configId, email || "admin");
    if (!result.ok) return res.status(400).json({ ok: false, errors: result.errors });
    LEARNING_CONFIG = loadLearningConfig();
    res.json({ ok: true, ...result });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── Admin Dashboard — aggregated data endpoint ──────────────────────────────
app.get("/admin/dashboard-data", (req, res) => {
  const { email, code } = req.query;
  if (!isAdmin(email, code)) return res.status(403).json({ ok: false, error: "Accès admin requis" });

  try {
    // ── Health ──
    const health = {
      api: { status: "ok", uptime: Math.round(process.uptime()) },
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1048576),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1048576),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1048576),
      },
      node: process.version,
      dbSize: (() => {
        try { return Math.round(fs.statSync(DB_PATH).size / 1048576); } catch { return null; }
      })(),
    };

    // ── Business — subscriptions ──
    let business = { users: {}, expiring_soon: 0, expired_total: 0 };
    try {
      const codesDb = new Database(CODES_DB_PATH, { readonly: true });
      const all = codesDb.prepare("SELECT plan, active, expires_at, email, created_at FROM codes").all();
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
      const newToday = all.filter(r => r.created_at && r.created_at.slice(0, 10) === now.toISOString().slice(0, 10)).length;
      business = { users: counts, expiring_soon: expiring3d, expired_total: expired, new_today: newToday };
    } catch (e) { business.error = e.message; }

    // ── Analytics — visitors ──
    let analytics = {};
    try {
      const today = new Date().toISOString().slice(0, 10);
      const todayRows = db.prepare("SELECT ip_hash, page, utm_source, referrer FROM page_views WHERE date(created_at) = ?").all(today);
      const uniqueToday = new Set(todayRows.map(r => r.ip_hash)).size;
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const yesterdayCount = db.prepare("SELECT COUNT(DISTINCT ip_hash) as c FROM page_views WHERE date(created_at) = ?").get(yesterday);
      const last7 = db.prepare("SELECT date(created_at) as d, COUNT(DISTINCT ip_hash) as visitors, COUNT(*) as views FROM page_views WHERE created_at >= datetime('now', '-7 days') GROUP BY d ORDER BY d").all();
      const topPages = {};
      todayRows.forEach(r => { topPages[r.page] = (topPages[r.page] || 0) + 1; });
      const topSources = {};
      todayRows.forEach(r => {
        let src = r.utm_source || "direct";
        if (!r.utm_source && r.referrer) {
          try { src = new URL(r.referrer).hostname.replace("www.", "") || "direct"; } catch { src = "direct"; }
        }
        topSources[src] = (topSources[src] || 0) + 1;
      });
      analytics = {
        today: { visitors: uniqueToday, views: todayRows.length },
        yesterday: { visitors: yesterdayCount?.c || 0 },
        last7days: last7,
        topPages: Object.entries(topPages).sort((a, b) => b[1] - a[1]).slice(0, 10),
        topSources: Object.entries(topSources).sort((a, b) => b[1] - a[1]).slice(0, 10),
      };
    } catch (e) { analytics.error = e.message; }

    // ── Pronostics — performance ──
    const perf = getConcilePerformance();
    const signalFort = getSignalFortStats();
    const threshold = getAdaptiveSignalThreshold();
    let currentPick = null;
    try {
      const raw = JSON.parse(fs.readFileSync(HERMES_PICKS_PATH, "utf8"));
      currentPick = raw.currentPick || null;
    } catch { try { currentPick = loadPick(); } catch {} }

    const pronostics = {
      currentPick,
      signalFort: { total: signalFort.total, wins: signalFort.wins, losses: signalFort.losses, winrate: signalFort.winrate, threshold },
      recent: perf.recent || [],
      byAgent: perf.byAgent || [],
      bySport: perf.bySport || [],
    };

    // ── Alerts ──
    const alerts = [];
    if (business.expiring_soon > 0) alerts.push({ level: "warning", msg: `${business.expiring_soon} abonnement(s) expirent dans 3 jours` });
    if (health.memory.heapUsed > 400) alerts.push({ level: "danger", msg: `Mémoire heap élevée: ${health.memory.heapUsed} MB` });
    if (!API_SPORTS_KEY && !FOOTBALL_DATA_KEY) alerts.push({ level: "danger", msg: "Aucune clé API sportive configurée" });
    if (!STRIPE_SECRET_KEY) alerts.push({ level: "danger", msg: "Clé Stripe non configurée" });
    if (!TELEGRAM_BOT_TOKEN) alerts.push({ level: "warning", msg: "Bot Telegram non configuré" });
    if (!BREVO_API_KEY) alerts.push({ level: "warning", msg: "API Brevo non configurée" });
    if (signalFort.winrate > 0 && signalFort.winrate < 50 && signalFort.total >= 10) alerts.push({ level: "danger", msg: `Winrate Signal Fort bas: ${signalFort.winrate}%` });

    // ── Recent activity log ──
    let activityLog = [];
    try {
      const recentAnalyses = db.prepare("SELECT home, away, competition, best_bet, confidence, outcome, analysed_at FROM concile_analyses ORDER BY analysed_at DESC LIMIT 15").all();
      activityLog = recentAnalyses.map(r => ({
        type: "analysis",
        text: `${r.home} vs ${r.away} — ${r.best_bet} (${r.confidence}%)${r.outcome ? " → " + r.outcome : ""}`,
        date: r.analysed_at,
      }));
    } catch {}

    // ── Services status ──
    const services = {
      api_sports: !!API_SPORTS_KEY,
      football_data: !!FOOTBALL_DATA_KEY,
      stripe: !!STRIPE_SECRET_KEY,
      telegram: !!TELEGRAM_BOT_TOKEN,
      brevo: !!BREVO_API_KEY,
      groq: !!GROQ_API_KEY,
      deepseek: !!DEEPSEEK_API_KEY,
    };

    // ── VPS + Docker + Backups (from host cron script via /shared/vps-status.json) ──
    let vps = {}, docker = { containers: [] }, backups = { latest: null, files: [] };
    try {
      const statusRaw = fs.readFileSync("/shared/vps-status.json", "utf8");
      const status = JSON.parse(statusRaw);
      vps = { ram: status.ram, cpu: status.cpu, disk: status.disk, load: status.load, uptime: status.uptime, collectedAt: status.timestamp };

      if (vps.ram && vps.ram.pct > 90) alerts.push({ level: "danger", msg: `RAM VPS critique : ${vps.ram.pct}%` });
      else if (vps.ram && vps.ram.pct > 75) alerts.push({ level: "warning", msg: `RAM VPS elevee : ${vps.ram.pct}%` });
      if (vps.disk && vps.disk.pct > 90) alerts.push({ level: "danger", msg: `Disque VPS critique : ${vps.disk.pct}%` });
      else if (vps.disk && vps.disk.pct > 75) alerts.push({ level: "warning", msg: `Disque VPS eleve : ${vps.disk.pct}%` });
      if (vps.cpu != null && vps.cpu > 90) alerts.push({ level: "danger", msg: `CPU VPS critique : ${vps.cpu}%` });

      const staleMin = status.timestamp ? (Date.now() - new Date(status.timestamp).getTime()) / 60000 : 999;
      if (staleMin > 5) alerts.push({ level: "warning", msg: `Donnees VPS obsoletes (${Math.round(staleMin)} min)` });

      if (Array.isArray(status.docker)) {
        docker.containers = status.docker;
        docker.running = docker.containers.filter(c => c.state === "running").length;
        docker.stopped = docker.containers.filter(c => c.state !== "running").length;
        docker.total = docker.containers.length;
        if (docker.stopped > 0) alerts.push({ level: "warning", msg: `${docker.stopped} conteneur(s) Docker arrete(s)` });
      }

      if (Array.isArray(status.backups)) {
        backups.files = status.backups.slice(0, 10);
        backups.latest = backups.files[0] || null;
        backups.total = status.backups.length;
        if (backups.latest) {
          const hoursSince = (Date.now() - new Date(backups.latest.date).getTime()) / 3600000;
          if (hoursSince > 48) alerts.push({ level: "danger", msg: `Derniere sauvegarde il y a ${Math.round(hoursSince)}h` });
          else if (hoursSince > 24) alerts.push({ level: "warning", msg: `Derniere sauvegarde il y a ${Math.round(hoursSince)}h` });
        } else {
          alerts.push({ level: "danger", msg: "Aucune sauvegarde trouvee" });
        }
      }
    } catch (e) {
      vps.error = "vps-status.json indisponible — installer le cron sur le host";
    }

    res.json({ ok: true, health, vps, docker, backups, business, analytics, pronostics, alerts, activityLog, services, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error("[admin-dashboard]", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`TousLesMatchs API running on :${PORT}`);
    if (AUTO_CONCILE_OBSERVER) {
      console.log(`[auto-concile] enabled: every ${Math.round(AUTO_CONCILE_INTERVAL_MS / 60000)} min, max ${AUTO_CONCILE_MAX_MATCHES} match(es)`);
      setTimeout(runAutoConcileObserver, 30000);
      setInterval(runAutoConcileObserver, AUTO_CONCILE_INTERVAL_MS);
    }
    setInterval(checkAnalyticsSchedule, 60000);
    console.log("[analytics] Scheduler actif: rapport quotidien 23h + hebdo lundi 8h");
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

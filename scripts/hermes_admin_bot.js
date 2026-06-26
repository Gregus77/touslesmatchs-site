// HERMÈS ADMIN BOT — Bot Telegram d'administration TousLesMatchs
// Commandes admin : /status /analyse /setpick /setscore /win /lose /publish /publishpremium /help
"use strict";
const https = require("https");
const http  = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { buildInlineKeyboard } = require("./bookmakers.config");

// ── Config ──────────────────────────────────────────────────────────────────
const TG_TOKEN          = process.env.HERMES_ADMIN_TLM_BOT;
const ADMIN_CHAT        = process.env.TELEGRAM_ADMIN_CHAT_ID;
const PREMIUM_CHANNEL   = process.env.TELEGRAM_PREMIUM_CHANNEL_ID;
const GROQ_KEY    = process.env.GROQ_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const FD_KEY      = process.env.FOOTBALL_DATA_KEY || process.env.FOOTBALL_DATA_API_KEY;
const SPORTS_KEY  = process.env.API_SPORTS_KEY;
const PUBLIC_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PUBLIC_CHAT = process.env.TELEGRAM_CHAT_ID || "@touslesmatchs_fr";
const ADMIN_USER_ID = "309921562";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

const REPO        = "/repo";
const PICKS_FILE  = path.join(REPO, "public/data/picks.json");
const DATA_FILE   = path.join(REPO, "data/picks.json");
const GENERATED_DIR = path.join(REPO, "public/generated/picks");
const GENERATED_PUBLIC_PATH = "/generated/picks";
const MEMORY_FILE = path.join(REPO, "data/hermes_memory.json");
const IMPROVEMENT_LOG_FILE = path.join(REPO, "data/hermes_improvement_log.json");
const DAILY_RUN_FILE = path.join(REPO, "data/hermes_daily_run.json");
const DAILY_STRATEGY_FILE = path.join(REPO, "data/hermes_daily_strategy.json");
const STRONG_ALERTS_FILE = path.join(REPO, "data/hermes_strong_alerts.json");
const AUTO_DAILY_PICK = process.env.HERMES_AUTO_DAILY_PICK !== "0";
const HERMES_PICK_ALLOWED_SPORTS = (process.env.HERMES_PICK_ALLOWED_SPORTS || "Football")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const AUTO_DAILY_PICK_HOUR = Number(process.env.HERMES_AUTO_DAILY_PICK_HOUR || 0);
const AUTO_DAILY_PICK_MINUTE = Number(process.env.HERMES_AUTO_DAILY_PICK_MINUTE || 5);
const AUTO_DAILY_PICK_CATCHUP_UNTIL_HOUR = Number(process.env.HERMES_AUTO_DAILY_PICK_CATCHUP_UNTIL_HOUR || 12);
const AUTO_DAILY_PICK_RETRY_MINUTES = Math.max(15, Number(process.env.HERMES_AUTO_DAILY_PICK_RETRY_MIN || 60));
const AUTO_DAILY_STRATEGY = process.env.HERMES_AUTO_DAILY_STRATEGY !== "0";
const AUTO_DAILY_STRATEGY_HOUR = Number(process.env.HERMES_AUTO_DAILY_STRATEGY_HOUR || 8);
const AUTO_DAILY_STRATEGY_MINUTE = Number(process.env.HERMES_AUTO_DAILY_STRATEGY_MINUTE || 30);
const STRONG_ALERTS_ENABLED = process.env.HERMES_STRONG_ALERTS !== "0";
const STRONG_ALERTS_THRESHOLD = Number(process.env.HERMES_STRONG_ALERTS_THRESHOLD || 80);
const STRONG_ALERTS_MIN_RESOLVED = Number(process.env.HERMES_STRONG_ALERTS_MIN_RESOLVED || 5);
const STRONG_ALERTS_MAX_PER_DAY = Number(process.env.HERMES_STRONG_ALERTS_MAX_PER_DAY || 3);
const STRONG_ALERTS_INTERVAL_MS = Math.max(5, Number(process.env.HERMES_STRONG_ALERTS_INTERVAL_MIN || 10)) * 60 * 1000;
const STRONG_ALERTS_CLIENT_AUTO = process.env.HERMES_STRONG_ALERTS_CLIENT_AUTO === "1";
const STRONG_ALERTS_CLIENT_CHANNEL = process.env.HERMES_STRONG_ALERTS_CLIENT_CHANNEL || PREMIUM_CHANNEL || PUBLIC_CHAT;
const STRONG_ALERTS_CLIENT_TOKEN = process.env.HERMES_STRONG_ALERTS_CLIENT_TOKEN || TG_TOKEN;
const AUTO_PUBLISH_FREE = process.env.HERMES_AUTO_PUBLISH_FREE !== "0";
const AUTO_PUBLISH_PREMIUM = process.env.HERMES_AUTO_PUBLISH_PREMIUM !== "0";

if (!TG_TOKEN) { console.error("HERMES_ADMIN_TLM_BOT manquant"); process.exit(1); }

// ── Telegram helpers ─────────────────────────────────────────────────────────
function tgRequest(method, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${TG_TOKEN}/${method}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
    }, res => { let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } }); });
    req.on("error", () => resolve({}));
    req.write(data); req.end();
  });
}

function reply(chatId, text, extra = {}) {
  return tgRequest("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });
}

function sendTelegramWithToken(token, chatId, text, extra = {}) {
  return new Promise((resolve) => {
    if (!token || !chatId) return resolve({ ok: false, description: "token ou channel manquant" });
    const body = JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${token}/sendMessage`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve(JSON.parse(d)); }
        catch { resolve({ ok: false, description: d }); }
      });
    });
    req.on("error", e => resolve({ ok: false, description: e.message }));
    req.write(body); req.end();
  });
}

function sendTelegramPhotoWithToken(token, chatId, photo, caption, extra = {}) {
  return new Promise((resolve) => {
    if (!token || !chatId || !photo) return resolve({ ok: false, description: "token, channel ou photo manquant" });
    const body = JSON.stringify({ chat_id: chatId, photo, caption, parse_mode: "HTML", ...extra });
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${token}/sendPhoto`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve(JSON.parse(d)); }
        catch { resolve({ ok: false, description: d }); }
      });
    });
    req.on("error", e => resolve({ ok: false, description: e.message }));
    req.write(body); req.end();
  });
}

function bookmakerReplyMarkup(extraRows = []) {
  return {
    reply_markup: {
      inline_keyboard: buildInlineKeyboard(extraRows),
    },
  };
}

function normalizePublicImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `https://www.touslesmatchs.com${raw}`;
  return "";
}

function pickVisualUrl(pick) {
  return normalizePublicImageUrl(
    pick?.telegramImageUrl ||
    pick?.visualUrl ||
    pick?.imageUrl ||
    pick?.previewImage ||
    pick?.visual
  );
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "match";
}

function buildMatchVisualPrompt(pick) {
  return [
    "Create a premium sports betting match poster for TousLesMatchs.",
    "Style: dark luxury football stadium, neon green accents, clean modern typography, high contrast, professional Telegram preview.",
    `Match: ${pick.home || "Home"} vs ${pick.away || "Away"}.`,
    `Competition: ${pick.league || pick.competition || "Football"}.`,
    `Prediction: ${pick.prono || pick.bet || "Pick IA"}.`,
    `Odds: ${pick.cote || "N/A"}. Confidence: ${pick.confidenceTg || pick.confidence || "N/A"}.`,
    "Include team names large, VS in the center, prediction/odds/confidence at the bottom.",
    "Do not include bookmaker logos. Do not include guaranteed win wording. No real person photo."
  ].join(" ");
}

async function downloadBinary(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download_image_${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function generateMatchVisual(pick) {
  if (!OPENAI_API_KEY) return "";
  if (!pick?.home || !pick?.away) return "";

  const date = pick.date || new Date().toISOString().slice(0, 10);
  const fileName = `${date}-${slugify(pick.home)}-vs-${slugify(pick.away)}.png`;
  const filePath = path.join(GENERATED_DIR, fileName);
  const publicUrl = `https://www.touslesmatchs.com${GENERATED_PUBLIC_PATH}/${fileName}`;

  if (fs.existsSync(filePath)) return publicUrl;

  const body = {
    model: OPENAI_IMAGE_MODEL,
    prompt: buildMatchVisualPrompt(pick),
    size: "1536x1024",
    n: 1
  };

  try {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error?.message || `openai_image_${res.status}`);

    const item = json.data?.[0] || {};
    const bytes = item.b64_json
      ? Buffer.from(item.b64_json, "base64")
      : item.url ? await downloadBinary(item.url) : null;
    if (!bytes) throw new Error("openai_image_empty");

    fs.writeFileSync(filePath, bytes);
    console.log(`[visual] generated ${publicUrl}`);
    return publicUrl;
  } catch (e) {
    console.error("[visual] generation failed:", e.message);
    // Notifier l'admin Telegram de l'échec OpenAI image
    if (ADMIN_CHAT) {
      reply(ADMIN_CHAT, `⚠️ <b>Image OpenAI échouée</b>\n${e.message}`).catch(() => {});
    }
    return "";
  }
}

async function ensurePickVisual(pick) {
  if (!pick || pickVisualUrl(pick)) return pickVisualUrl(pick);
  const visualUrl = await generateMatchVisual(pick);
  if (visualUrl) {
    pick.telegramImageUrl = visualUrl;
    pick.visualUrl = visualUrl;
  }
  return visualUrl;
}

async function publishTelegramPick({ token, chatId, text, pick, extra = {} }) {
  await ensurePickVisual(pick);
  const visualUrl = pickVisualUrl(pick);
  if (visualUrl) {
    const photoResult = await sendTelegramPhotoWithToken(token, chatId, visualUrl, text, extra);
    if (photoResult.ok) return photoResult;
    console.error("[telegram] sendPhoto fallback:", photoResult.description || photoResult.error || "unknown");
  }
  return sendTelegramWithToken(token, chatId, text, { disable_web_page_preview: true, ...extra });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function getUpdates(offset) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${TG_TOKEN}/getUpdates?timeout=30&limit=10${offset ? "&offset=" + offset : ""}`,
      method: "GET"
    }, res => { let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({ result: [] }); } }); });
    req.setTimeout(35000, () => { req.destroy(); resolve({ result: [] }); });
    req.on("error", () => resolve({ result: [] }));
    req.end();
  });
}

// ── Picks helpers ─────────────────────────────────────────────────────────────
function loadPicks() {
  for (const file of [DATA_FILE, PICKS_FILE]) {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (data && typeof data === "object") return data;
    } catch {}
  }
  return { currentPick: {}, history: [] };
}

function savePicks(data) {
  const json = JSON.stringify(data, null, 2);
  try { fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true }); fs.writeFileSync(DATA_FILE, json, "utf8"); } catch {}
  fs.mkdirSync(path.dirname(PICKS_FILE), { recursive: true });
  fs.writeFileSync(PICKS_FILE, json, "utf8");
}

function appendImprovementLog(pick) {
  try {
    fs.mkdirSync(path.dirname(IMPROVEMENT_LOG_FILE), { recursive: true });
    let rows = [];
    try { rows = JSON.parse(fs.readFileSync(IMPROVEMENT_LOG_FILE, "utf8")); } catch {}
    if (!Array.isArray(rows)) rows = [];
    rows.unshift({
      date: pick.date || new Date().toISOString().slice(0, 10),
      resolvedAt: pick.resolvedAt || new Date().toISOString(),
      status: pick.status || null,
      score: pick.score || null,
      sport: pick.sport || "Football",
      home: pick.home || pick.teamA?.name || null,
      away: pick.away || pick.teamB?.name || null,
      competition: pick.league || pick.competition || null,
      bet: pick.prono || pick.bet || null,
      cote: pick.cote || null,
      liveUnavailable: pick.liveUnavailable === true,
      source: pick.source || "hermes",
      sourceMatchId: pick.sourceMatchId || null,
      fixtureId: pick.fixtureId || null,
      lesson: pick.status === "GAGNE"
        ? "Conserver les criteres qui ont valide ce pick."
        : "Analyser pourquoi ce type de pari n'a pas valide.",
    });
    fs.writeFileSync(IMPROVEMENT_LOG_FILE, JSON.stringify(rows.slice(0, 500), null, 2), "utf8");
  } catch (e) {
    console.error("[hermes] improvement log:", e.message);
  }
}

function historyMatchName(row) {
  if (Array.isArray(row)) return row[1] || "";
  return `${row.home || ""} vs ${row.away || ""}`.trim();
}

function historyDate(row) {
  return Array.isArray(row) ? row[0] : row?.date;
}

function historyRowFromPick(pick) {
  return [
    pick.date || new Date().toISOString().slice(0, 10),
    `${pick.home || ""} vs ${pick.away || ""}`.trim(),
    pick.prono || pick.bet || "",
    String(pick.cote || ""),
    pick.score || "",
    pick.status || "EN ATTENTE",
    pick.sport || "Football",
    pick.league || pick.competition || ""
  ];
}

function sameHistoryPick(row, pick) {
  const match = `${pick.home || ""} vs ${pick.away || ""}`.trim().toLowerCase();
  return historyDate(row) === pick.date && historyMatchName(row).toLowerCase() === match;
}

function archiveCurrentPick(data) {
  const p = data.currentPick;
  if (!p || !p.home || p.home === "Analyse en cours") return;
  if (!data.history) data.history = [];
  const exists = data.history.find(h => sameHistoryPick(h, p));
  if (!exists) data.history.unshift(historyRowFromPick(p));
  if (data.history.length > 60) data.history = data.history.slice(0, 60);
}

// ── HTTP GET helper ───────────────────────────────────────────────────────────
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: "GET", headers }, res => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch { reject(new Error("parse")); } });
    });
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject); req.end();
  });
}

// ── AI helpers ────────────────────────────────────────────────────────────────
function post(hostname, apiPath, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({ hostname, path: apiPath, method: "POST", headers: { ...headers, "Content-Length": Buffer.byteLength(data) } }, res => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch { reject(new Error("parse")); } });
    });
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject); req.write(data); req.end();
  });
}

function safeJSON(text) {
  try { const clean = String(text || "").replace(/```json|```/g, "").trim(); const m = clean.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; }
}

async function callAI(prompt) {
  const providers = [
    { name: "DeepSeek", available: !!DEEPSEEK_KEY, fn: async () => {
      const r = await post("api.deepseek.com", "/v1/chat/completions",
        { "Authorization": `Bearer ${DEEPSEEK_KEY}`, "Content-Type": "application/json" },
        { model: "deepseek-chat", max_tokens: 2500, temperature: 0.1, messages: [{ role: "user", content: prompt }] });
      return safeJSON(r.choices?.[0]?.message?.content || "");
    }},
    { name: "Groq", available: !!GROQ_KEY, fn: async () => {
      const r = await post("api.groq.com", "/openai/v1/chat/completions",
        { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
        { model: "llama-3.3-70b-versatile", max_tokens: 2000, temperature: 0.1, messages: [{ role: "user", content: prompt }] });
      return safeJSON(r.choices?.[0]?.message?.content || "");
    }}
  ];
  for (const p of providers) {
    if (!p.available) { console.log(`  ⏭ ${p.name}: non configuré`); continue; }
    try {
      console.log(`  🔄 ${p.name}...`);
      const r = await p.fn();
      if (r) { console.log(`  ✅ ${p.name}: OK`); return { provider: p.name, result: r }; }
    } catch (e) { console.error(`  ❌ ${p.name}: ${e.message}`); }
  }
  return { provider: null, result: null };
}

// ── Match fetching ────────────────────────────────────────────────────────────
const FINISHED_STATUS = {
  football:   ["FT","AET","PEN","CANC","PST","ABD","INT","AWD","WO"],
  basketball: ["FT","AOT","CANC","PST","ABD","INT","WO"],
  hockey:     ["FT","AOT","SO","CANC","PST","ABD","INT"],
  rugby:      ["FT","CANC","PST","ABD","INT"],
  baseball:   ["FT","CANC","PST","ABD","INT"],
  handball:   ["FT","CANC","PST","ABD","INT"],
  volleyball: ["FT","CANC","PST","ABD","INT"],
};
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

async function fetchSport(sport, today) {
  if (!SPORTS_KEY) return [];
  const hosts = {
    football:   "v3.football.api-sports.io",
    basketball: "v1.basketball.api-sports.io",
    hockey:     "v1.hockey.api-sports.io",
    rugby:      "v1.rugby.api-sports.io",
    baseball:   "v1.baseball.api-sports.io",
    handball:   "v1.handball.api-sports.io",
    volleyball: "v1.volleyball.api-sports.io",
  };
  const paths = {
    football:   `/fixtures?date=${today}`,
    basketball: `/games?date=${today}`,
    hockey:     `/games?date=${today}`,
    rugby:      `/games?date=${today}`,
    baseball:   `/games?date=${today}`,
    handball:   `/games?date=${today}`,
    volleyball: `/games?date=${today}`,
  };
  const done = FINISHED_STATUS[sport] || ["FT","CANC"];
  try {
    const d = await httpGet(`https://${hosts[sport]}${paths[sport]}`, { "x-apisports-key": SPORTS_KEY });
    const items = (d.response || []);
    if (sport === "football") {
      return items
        .filter(f => !done.includes(f.fixture?.status?.short))
        .map(f => ({
          sport: "Football", home: f.teams?.home?.name, away: f.teams?.away?.name,
          heure: f.fixture?.date ? new Date(f.fixture.date).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit", timeZone:"Europe/Paris" }).replace(":","h") : "?",
          competition: f.league?.name || "Football", arjel: true,
          matchId: String(f.fixture?.id || ""), source: "api-sports.io"
        }))
        .filter(m => !isLowTrustCompetition(m));
    } else {
      const sportLabel = { basketball:"Basketball", hockey:"Hockey", rugby:"Rugby", baseball:"Baseball", handball:"Handball", volleyball:"Volleyball" }[sport] || sport;
      return items
        .filter(g => !done.includes(g.status?.short || g.game?.status?.short))
        .map(g => {
          const home = g.teams?.home?.name || g.home?.name;
          const away = g.teams?.away?.name || g.away?.name;
          const league = g.league?.name || g.country?.name || sportLabel;
          const dt = g.date || g.time || g.game?.date;
          const heure = dt ? new Date(dt).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit", timeZone:"Europe/Paris" }).replace(":","h") : "?";
          if (!home || !away) return null;
          return { sport: sportLabel, home, away, heure, competition: league, arjel: true,
            matchId: String(g.id || g.game?.id || ""), source: "api-sports.io" };
        })
        .filter(Boolean)
        .filter(m => !isLowTrustCompetition(m));
    }
  } catch(e) { console.error(`  API-Sports ${sport}:`, e.message); return []; }
}

async function fetchTodayMatches() {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  let allMatches = [];

  // football-data.org (football uniquement)
  if (FD_KEY) {
    try {
      const d = await httpGet(`https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${tomorrow}`, { "X-Auth-Token": FD_KEY });
      const matches = (d.matches || []).filter(m => !["FINISHED","CANCELLED","POSTPONED"].includes(m.status));
      if (matches.length) {
        const formatted = matches.map(m => ({
          sport: "Football", home: m.homeTeam.name, away: m.awayTeam.name,
          heure: m.utcDate ? new Date(m.utcDate).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit", timeZone:"Europe/Paris" }).replace(":","h") : "?",
          competition: m.competition?.name || "Football", arjel: true,
          matchId: String(m.id || ""), source: "football-data.org"
        })).filter(m => !isLowTrustCompetition(m));
        allMatches.push(...formatted);
        console.log(`  football-data.org: ${formatted.length} match(s)`);
      }
    } catch(e) { console.error("  football-data.org:", e.message); }
  }

  // API-Sports : tous les sports en parallèle
  if (SPORTS_KEY) {
    const sports = ["football","basketball","hockey","rugby","handball","volleyball"];
    const results = await Promise.allSettled(sports.map(s => fetchSport(s, today)));
    for (let i = 0; i < sports.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled" && r.value.length) {
        // dédoublonner le football si football-data.org a déjà répondu
        const filtered = sports[i] === "football" && allMatches.length
          ? [] : r.value;
        allMatches.push(...filtered);
        if (filtered.length) console.log(`  API-Sports ${sports[i]}: ${filtered.length} match(s)`);
      }
    }
  }

  console.log(`  TOTAL multi-sport: ${allMatches.length} event(s)`);
  return allMatches;
}

function normalizeTeamName(value) {
  return String(value || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function findCoveredLiveMatch(pick, matches) {
  const home = normalizeTeamName(pick.home);
  const away = normalizeTeamName(pick.away);
  if (!home || !away || !Array.isArray(matches)) return null;
  const sameTeam = (a, b) => a === b || a.includes(b) || b.includes(a);
  return matches.find((m) => {
    const mh = normalizeTeamName(m.home);
    const ma = normalizeTeamName(m.away);
    return (sameTeam(mh, home) && sameTeam(ma, away)) || (sameTeam(mh, away) && sameTeam(ma, home));
  }) || null;
}

function stampLiveAvailability(pick, matches) {
  const covered = findCoveredLiveMatch(pick, matches);
  if (!covered) {
    return {
      ...pick,
      liveUnavailable: true,
      liveAvailabilityReason: "Match non couvert par l'API live",
      sourceMatchId: pick.sourceMatchId || null,
      fixtureId: pick.fixtureId || null,
    };
  }
  return {
    ...pick,
    liveUnavailable: false,
    liveAvailabilityReason: null,
    sourceMatchId: pick.sourceMatchId || covered.sourceMatchId || covered.sourceId || covered.id || null,
    fixtureId: pick.fixtureId || covered.fixtureId || null,
  };
}

// ── Vérification pick vs liste API ────────────────────────────────────────────
function verifyPickMatchesAPI(pick, matches) {
  if (!pick?.home || !pick?.away || !Array.isArray(matches) || !matches.length) return false;
  // 1. matchId exact (le plus fiable)
  if (pick.matchId) {
    if (matches.some(m => m.matchId && String(m.matchId) === String(pick.matchId))) return true;
  }
  // 2. noms d'équipes normalisés
  const ph = normalizeTeamName(pick.home);
  const pa = normalizeTeamName(pick.away);
  return matches.some(m => {
    const mh = normalizeTeamName(m.home || "");
    const ma = normalizeTeamName(m.away || "");
    return mh === ph && ma === pa;
  });
}

// ── Mémoire d'apprentissage ───────────────────────────────────────────────────
function loadMemory() {
  try { return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8")); } catch { return null; }
}

function memoryBlock() {
  const m = loadMemory();
  if (!m) return "";
  const rules = (m.rules_derived || []).join("\n");
  const stats = m.general ? `Winrate global : ${m.general.winrate}% sur ${m.picks_analysed} picks analysés` : "";
  return `\nMÉMOIRE HERMÈS (${m.picks_analysed} picks analysés) :\n${stats}\nRÈGLES APPRISES :\n${rules}\n`;
}

async function refreshHermesMemory(chatId, reason = "resultat") {
  try {
    delete require.cache[require.resolve("./hermes_learn.js")];
    const { generateMemory } = require("./hermes_learn.js");
    const memory = generateMemory();
    if (!memory) {
      if (chatId) await reply(chatId, "Mémoire Hermès non mise à jour : pas encore assez de résultats propres.");
      return null;
    }
    const msg = `Mémoire Hermès mise à jour (${reason}) : ${memory.picks_analysed} picks analysés, winrate ${memory.general?.winrate ?? 0}%.`;
    console.log(`[hermes_learn] ${msg}`);
    if (chatId) await reply(chatId, msg);
    return memory;
  } catch (e) {
    console.error("[hermes_learn]", e.message);
    if (chatId) await reply(chatId, `Erreur mémoire Hermès : ${e.message}`);
    return null;
  }
}

async function cmdLearn(chatId) {
  await reply(chatId, "🧠 <b>Analyse de l'historique en cours...</b>");
  try {
    const { generateMemory, formatForTelegram } = require("./hermes_learn.js");
    const memory = generateMemory();
    const msg = formatForTelegram(memory);
    await reply(chatId, msg);
  } catch (e) {
    await reply(chatId, `❌ Erreur lors de l'analyse : ${e.message}`);
  }
}

// ── Analyse pick ──────────────────────────────────────────────────────────────
// Compétitions jouées sur terrain neutre — avantage domicile = 0
const NEUTRAL_VENUE_KEYWORDS = [
  "world cup","coupe du monde","fifa world","mundial",
  "euro ","uefa euro","european championship",
  "copa america","gold cup","afcon","africa cup","can 20",
  "nations league final","ligue des nations final",
  "champions league final","europa league final","conference league final",
  "supercup","super cup","supercoupe","trophée des champions"
];
function isNeutralVenue(competition = "") {
  const c = competition.toLowerCase();
  return NEUTRAL_VENUE_KEYWORDS.some(k => c.includes(k));
}
function neutralWarning(matches) {
  const neutral = matches.filter(m => isNeutralVenue(m.competition));
  if (!neutral.length) return "";
  const comps = [...new Set(neutral.map(m => m.competition))].join(", ");
  return `\n⚠️ TERRAIN NEUTRE DÉTECTÉ (${comps}) :\n- L'étiquette "domicile/extérieur" est arbitraire (calendrier FIFA), PAS un avantage réel\n- NE PAS ajouter de points pour "domicile" sur ces matchs\n- Baser l'analyse uniquement sur : forme récente, classement FIFA/UEFA, H2H, enjeu, effectif\n`;
}

const HERMES_PROMPT = (matches) => `Tu es HERMÈS, expert en pronostics sportifs avec une approche mathématique rigoureuse pour TousLesMatchs.
${memoryBlock()}
MATCHS DISPONIBLES AUJOURD'HUI (chaque match a un matchId unique) :
${JSON.stringify(matches, null, 2)}
${neutralWarning(matches)}

⚠️ RÈGLE ANTI-INVENTION : Tu ne peux choisir QUE parmi les matchs listés ci-dessus. Tu dois recopier exactement le champ "matchId" du match choisi dans ta réponse JSON. Si matchId est vide (""), utilise les noms d'équipes exacts tels qu'écrits dans la liste.

━━━ ÉTAPE 1 — FILTRER ━━━
- ACCEPTER : grandes compétitions officielles (Coupe du Monde, championnats nationaux Top 5, NBA, NHL playoffs, EuroLeague, etc.)
- REFUSER : matchs amicaux, U17-U23, exhibitions, ligues régionales inconnues, qualifications lointaines sans enjeu

━━━ ÉTAPE 2 — ANALYSER MATHÉMATIQUEMENT chaque match candidat ━━━
Pour chaque match retenu, estime :
  a) Ta probabilité réelle pour chaque marché disponible (1X2, Double chance, Over/Under 1.5 / 2.5 / 3.5, BTTS, Handicap)
  b) La cote implicite = 1 / probabilité (ex: 70% → cote implicite = 1.43)
  c) Edge = (ta_probabilité × cote_estimée_bookmaker) - 1 → positif = value bet

━━━ ÉTAPE 3 — CHOISIR le meilleur value bet ━━━
- Sélectionne le marché avec l'edge le plus élevé (pas forcément le vainqueur)
- Probabilité minimale requise : 58% pour un pari simple
- Cote fourchette acceptable : 1.30 à 2.80
- Ne jamais choisir un pari sans edge positif, même sur un favori "évident"

━━━ RÈGLES PAR SPORT ━━━
Football :
  - Forme 5 derniers matchs + H2H + buts/match moyen
  - Éliminatoire → moins de buts (préfère Under ou DC)
  - Domicile +0.5 note UNIQUEMENT en championnat national — JAMAIS terrain neutre

Basketball (NBA/EuroLeague) :
  - Back-to-back game (2e match consécutif) → équipe fatiguée, -4 pts de marge moyenne
  - Domicile +4 pts d'avantage statistique en NBA
  - Préfère les totaux de points (Over/Under) aux victoires en playoffs

Hockey (NHL/KHL) :
  - Gardien = facteur #1, Under 5.5 buts si deux top-gardiens
  - Overtime fréquent en playoffs → évite victoire régulière si match serré
  - Domicile moins décisif qu'au football

Rugby :
  - Conditions météo cruciales (vent/pluie → moins de points)
  - Force mêlée + ligne arrière = bons indicateurs
  - Double chance ou handicap + plutôt que vainqueur sec

━━━ ANTI-PATTERNS — à ne JAMAIS faire ━━━
- Ne pas parier Over 2.5 si les deux équipes ont moins de 2.0 buts/match en moyenne
- Ne pas parier Victoire domicile sur terrain neutre (Coupe du Monde, Euro, Copa, finales)
- Ne pas parier BTTS Oui si une équipe n'a pas marqué dans ses 4 derniers matchs
- Ne pas parier sur la prolongation ou penalties en coup à élimination directe
- Ne pas Over 3.5 si moins de 3.5 buts/match combiné pour les deux équipes
- Ne jamais parier si edge négatif ou < 2%, même sur un match "sûr"

━━━ BARÈME DE NOTATION ━━━
- Commence à 5.0
- +0.5 par avantage concret : forme récente, H2H favorable, enjeu vital, classement
- +0.5 si domicile en championnat national (jamais terrain neutre)
- +1.0 si probabilité estimée > 70% avec edge > 10%
- -1.0 si terrain neutre ou contexte très incertain
- Publie UNIQUEMENT si note ≥ 6.5

RÉPONDS EN JSON STRICT :
{
  "pick": {
    "matchId": "RECOPIE ICI le matchId exact du match choisi dans la liste ci-dessus",
    "home": "Équipe A — copie exacte de la liste",
    "away": "Équipe B — copie exacte de la liste",
    "league": "Nom de la compétition",
    "sport": "Football",
    "time": "20h45",
    "prono": "Victoire Équipe A",
    "bet": "Victoire Équipe A",
    "cote": 1.65,
    "probabilite_estimee": 72,
    "edge": 0.19,
    "note": 7.5,
    "raison": "1 phrase avec stat concrète + pourquoi ce marché (ex: 'Over 2.5 — 3.2 buts/match combinés, Over 2.5 sorti dans 8/10 derniers H2H')"
  },
  "alternatives": [
    {"bet": "Double chance 1X", "cote_estimee": 1.25, "probabilite_estimee": 85, "edge": 0.06}
  ],
  "nopick_raison": null
}

Si VRAIMENT aucun match ne mérite :
{
  "pick": null,
  "nopick_raison": "Explication précise du pourquoi"
}`;

async function runAnalyse(chatId) {
  await reply(chatId, "🔍 <b>Analyse en cours...</b>\nRécupération des matchs du jour...");

  const allMatches = await fetchTodayMatches();
  // Filtrer par sport autorisé (Football par défaut)
  const matches = allMatches.filter(m =>
    HERMES_PICK_ALLOWED_SPORTS.includes((m.sport || "Football").toLowerCase())
  );
  if (!matches.length) {
    const sportsLabel = HERMES_PICK_ALLOWED_SPORTS.join(", ");
    await reply(chatId, `⚠️ <b>Aucun match disponible (${sportsLabel})</b>\nLes APIs ne retournent pas de matchs pour aujourd'hui.\nUtilise /setpick pour définir manuellement.`);
    return;
  }

  await reply(chatId, `📋 <b>${matches.length} match(s) récupéré(s)</b>\nLancement de l'analyse IA...`);

  const { provider, result } = await callAI(HERMES_PROMPT(matches));

  if (!provider) {
    await reply(chatId, "❌ <b>Aucune IA disponible</b>\nVérifie DEEPSEEK_API_KEY et GROQ_API_KEY.");
    return;
  }

  if (!result?.pick) {
    const raison = result?.nopick_raison || "Aucun match ne passe les filtres";
    await reply(chatId, `🛑 <b>NOPICK — ${provider}</b>\n\n${raison}`);
    // Écrit NOPICK dans picks.json
    const data = loadPicks();
    archiveCurrentPick(data);
    data.currentPick = {
      date: new Date().toISOString().slice(0, 10),
      home: "PAS DE PICK",
      away: "",
      league: "",
      time: "",
      prono: "Aucun pick aujourd'hui",
      bet: "",
      cote: "",
      status: "NOPICK",
      score: "",
      nopick_raison: raison,
      source: "hermes",
      updatedAt: new Date().toISOString(),
    };
    savePicks(data);
    return;
  }

  // ── Vérification anti-invention : le pick doit correspondre à un match API réel ──
  if (!verifyPickMatchesAPI(result.pick, matches)) {
    const homeAway = `${result.pick?.home || "?"} vs ${result.pick?.away || "?"}`;
    await reply(chatId, `🚫 <b>Pick refusé : match non vérifié</b>\n\nL'IA a proposé <b>${homeAway}</b> mais ce match ne figure pas dans les ${matches.length} matchs récupérés depuis l'API.\n\nAucun pick n'a été sauvegardé. Relance /analyse ou utilise /setpick pour définir manuellement.`);
    return;
  }

  const p = result.pick;
  const alts = result.alternatives || [];
  const data = loadPicks();
  archiveCurrentPick(data);
  data.currentPick = stampLiveAvailability({
    date: new Date().toISOString().slice(0, 10),
    home: p.home || "",
    away: p.away || "",
    league: p.league || "Football",
    sport: p.sport || "Football",
    time: p.time || "",
    prono: p.prono || `Victoire ${p.home}`,
    bet: p.bet || p.prono || `Victoire ${p.home}`,
    cote: String(p.cote || ""),
    probabilite_estimee: p.probabilite_estimee || null,
    edge: p.edge || null,
    confidence: p.note || 0,
    confidenceTg: `${p.note || ""}/10`,
    status: "EN ATTENTE",
    score: "",
    source: "hermes",
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    sourceMatchId: p.sourceMatchId || p.fixtureId || null,
    fixtureId: p.fixtureId || null,
  }, matches);
  await ensurePickVisual(data.currentPick);
  savePicks(data);

  const edgeStr = p.edge ? ` · Edge: +${Math.round(p.edge * 100)}%` : "";
  const probStr = p.probabilite_estimee ? ` · Proba: ${p.probabilite_estimee}%` : "";
  const altsStr = alts.length
    ? "\n📌 <b>Alternatives :</b> " + alts.map(alt => `${alt.bet} @${alt.cote_estimee} (${alt.probabilite_estimee}%)`).join(", ")
    : "";

  const msg = `✅ <b>PICK GÉNÉRÉ par ${provider}</b>

⚽ <b>${p.home} vs ${p.away}</b>
🏆 ${p.league || ""}  🕐 ${p.time || ""}
🎯 <b>${p.prono || p.bet}</b> @ <b>${p.cote}</b>
📊 Note : <b>${p.note}/10</b>${probStr}${edgeStr}
💡 ${p.raison || ""}${altsStr}

✅ Pick sauvegardé. Publication Telegram/email automatique en cours.`;

  await reply(chatId, msg);
  if (data.currentPick.liveUnavailable) {
    await reply(chatId, "Analyse Live IA indisponible : ce match n'est pas couvert par l'API live.");
  }

  // Notification email automatique aux abonnés payants
  try {
    const emailResult = await notifyPickByEmail(data.currentPick);
    if (emailResult.ok) {
      await reply(chatId, `📧 Emails envoyés à <b>${emailResult.sent || 0}</b> abonné(s)`);
    } else if (emailResult.error && emailResult.error !== "timeout") {
      console.error("[hermes] pick-notify email:", emailResult.error);
      await reply(chatId, `Email pick non envoye : ${emailResult.error}`);
    }
  } catch (e) {
    console.error("[hermes] notifyPickByEmail:", e.message);
    await reply(chatId, `Email pick non envoye : ${e.message}`).catch(() => {});
  }

  if (AUTO_PUBLISH_FREE) {
    await cmdPublish(chatId, { automatic: true });
  }
  if (AUTO_PUBLISH_PREMIUM && PREMIUM_CHANNEL) {
    await cmdPublishPremium(chatId, { automatic: true });
  }
}

// ── Commandes ─────────────────────────────────────────────────────────────────
async function cmdStatus(chatId) {
  const data = loadPicks();
  const p = data.currentPick || {};
  const hist = (data.history || []).length;

  // Containers
  let containers = "";
  try {
    const out = execSync("docker ps --format '{{.Names}} {{.Status}}' 2>/dev/null | grep touslesmatchs", { timeout: 5000 }).toString();
    containers = "\n\n🐳 <b>Containers :</b>\n" + out.split("\n").filter(Boolean).map(l => "  " + l).join("\n");
  } catch { containers = "\n\n🐳 <i>Docker non accessible</i>"; }

  const status = `📊 <b>STATUS TOUSLESMATCHS</b>

📅 Pick du <b>${p.date || "?"}</b>
⚽ <b>${p.home || "?"} vs ${p.away || "?"}</b>
🏆 ${p.league || "?"} — 🕐 ${p.time || "?"}
🎯 ${p.prono || "?"} @ ${p.cote || "?"}
📊 Statut : <b>${p.status || "?"}</b>  Score : <b>${p.score || "—"}</b>
📚 Historique : ${hist} entrée(s)${containers}`;

  await reply(chatId, status);
}

async function cmdSetPick(chatId, args) {
  // Syntaxe: /setpick Maroc|Ecosse|Coupe du Monde 2026|20h00|Victoire Maroc|1.78
  const parts = args.split("|").map(s => s.trim());
  if (parts.length < 6) {
    await reply(chatId, `❌ Syntaxe : <code>/setpick Équipe A|Équipe B|Ligue|Heure|Prono|Cote</code>\nEx: <code>/setpick France|Brésil|Coupe du Monde|21h00|Victoire France|1.85</code>`);
    return;
  }
  const [home, away, league, time, prono, cote] = parts;
  const matches = await fetchTodayMatches();
  const data = loadPicks();
  archiveCurrentPick(data);
  data.currentPick = stampLiveAvailability({
    date: new Date().toISOString().slice(0, 10),
    home, away, league, time, prono, bet: prono,
    cote: String(cote), status: "EN ATTENTE", score: "",
    source: "hermes",
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString()
  }, matches);
  savePicks(data);
  await reply(chatId, `✅ <b>Pick défini manuellement</b>\n\n⚽ <b>${home} vs ${away}</b>\n🏆 ${league}  🕐 ${time}\n🎯 ${prono} @ ${cote}`);
  if (data.currentPick.liveUnavailable) {
    await reply(chatId, "Analyse Live IA indisponible : ce match n'est pas couvert par l'API live.");
  }
}

async function cmdSetScore(chatId, args) {
  const score = args.trim();
  if (!score.match(/^\d+-\d+$/)) {
    await reply(chatId, "❌ Syntaxe : <code>/setscore 1-0</code>");
    return;
  }
  const data = loadPicks();
  if (data.currentPick) data.currentPick.score = score;
  savePicks(data);
  // Aussi dans live_score.json
  try {
    fs.mkdirSync("/var/touslesmatchs", { recursive: true });
    const [h, a] = score.split("-");
    fs.writeFileSync("/var/touslesmatchs/live_score.json", JSON.stringify({ home: parseInt(h), away: parseInt(a), source: "manual" }, null, 2));
  } catch {}
  await reply(chatId, `✅ Score mis à jour : <b>${score}</b>`);
}

async function cmdResult(chatId, status) {
  const data = loadPicks();
  if (!data.currentPick?.home) { await reply(chatId, "❌ Aucun pick actif"); return; }
  data.currentPick.status = status;
  data.currentPick.resolvedAt = new Date().toISOString();
  // Archive avec résultat
  if (!data.history) data.history = [];
  const idx = data.history.findIndex(h => sameHistoryPick(h, data.currentPick));
  const row = historyRowFromPick(data.currentPick);
  if (idx >= 0) data.history[idx] = row;
  else data.history.unshift(row);
  savePicks(data);
  appendImprovementLog(data.currentPick);
  const emoji = status === "GAGNE" ? "🏆" : "❌";
  await reply(chatId, `${emoji} Pick marqué <b>${status}</b>\n${data.currentPick.home} vs ${data.currentPick.away} — ${data.currentPick.score || "?"}`);

  try {
    const emailResult = await notifyResultByEmail(data.currentPick);
    if (emailResult.ok) {
      await reply(chatId, `Email resultat envoye a <b>${emailResult.sent || 0}</b> abonne(s)`);
    } else if (emailResult.error && emailResult.error !== "timeout") {
      console.error("[hermes] result email:", emailResult.error);
    }
  } catch (e) {
    console.error("[hermes] notifyResultByEmail:", e.message);
  }

  // Auto-apprentissage après chaque résultat
  await refreshHermesMemory(chatId, status.toLowerCase());
}

async function cmdResultPreview(chatId) {
  const data = loadPicks();
  const p = data.currentPick || {};
  const status = String(p.status || "").toUpperCase();
  if (!p.home || !p.away) {
    await reply(chatId, "❌ Aucun pick actif.");
    return;
  }
  if (!["GAGNE", "PERDU", "WIN", "LOSS"].includes(status) || !p.score) {
    await reply(chatId, "❌ Résultat non publiable : score final ou statut fiable manquant. Utilise /setscore puis /win ou /lose, ou valide avec /record.");
    return;
  }
  const won = status === "GAGNE" || status === "WIN";
  const message = `${won ? "✅" : "📊"} Résultat du pick du jour

${p.home} vs ${p.away}
🎯 ${p.prono || p.bet || "Pick officiel"}
Score final : ${p.score}
Résultat : ${won ? "GAGNÉ" : "PERDU"}

${won ? "Le Conseil des IA avait vu juste." : "Résultat enregistré. On garde la donnée pour améliorer le modèle."}

https://www.touslesmatchs.com`;

  await reply(chatId, `<b>Message prêt à publier :</b>\n\n<code>${escapeHtml(message)}</code>`);
}

async function cmdPublish(chatId, opts = {}) {
  if (!PUBLIC_BOT_TOKEN) { await reply(chatId, "TELEGRAM_BOT_TOKEN manquant"); return; }
  const data = loadPicks();
  const p = data.currentPick;
  if (!p?.home || p.home === "PAS DE PICK") { await reply(chatId, "Aucun pick a publier"); return; }
  await ensurePickVisual(p);
  savePicks(data);

  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const text = `<b>Pick IA du jour - ${today}</b>

<b>${escapeHtml(p.home)} vs ${escapeHtml(p.away)}</b>
${escapeHtml(p.league || "")}
${escapeHtml(p.time || "")}

<b>Pronostic :</b> ${escapeHtml(p.prono || p.bet || "")}
<b>Cote :</b> ${escapeHtml(p.cote || "")}
<b>Confiance Hermes :</b> ${escapeHtml(p.confidenceTg || "")}

Analyse complete : https://www.touslesmatchs.com

18+ uniquement. Jeu responsable.`;

  const sent = await publishTelegramPick({
    token: PUBLIC_BOT_TOKEN,
    chatId: PUBLIC_CHAT,
    text,
    pick: p,
    extra: bookmakerReplyMarkup([
      { text: "Voir l'analyse TousLesMatchs", url: "https://www.touslesmatchs.com" },
      { text: "Passer Pro/Premium", url: "https://www.touslesmatchs.com/#plans" },
    ]),
  });
  const ok = !!sent.ok;
  const err = sent.description || sent.error || "";
  await reply(chatId, ok ? `Pick publie sur ${PUBLIC_CHAT}` : `Erreur publication Telegram Free (${PUBLIC_CHAT}) : ${err || "reponse inconnue"}`);
}

async function cmdPublishPremium(chatId, opts = {}) {
  if (!TG_TOKEN) { await reply(chatId, "Token Telegram manquant"); return; }
  if (!PREMIUM_CHANNEL) { await reply(chatId, "TELEGRAM_PREMIUM_CHANNEL_ID manquant"); return; }
  const data = loadPicks();
  const p = data.currentPick;
  if (!p?.home || p.home === "PAS DE PICK") { await reply(chatId, "Aucun pick a publier"); return; }
  await ensurePickVisual(p);
  savePicks(data);

  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const edgeStr = p.edge ? ` - Edge: +${Math.round(p.edge * 100)}%` : "";
  const probStr = p.probabilite_estimee ? `\nProba estimee : <b>${p.probabilite_estimee}%</b>${edgeStr}` : "";
  const text = `<b>Pick PREMIUM du jour - ${today}</b>

<b>${escapeHtml(p.home)} vs ${escapeHtml(p.away)}</b>
${escapeHtml(p.league || "")}
${escapeHtml(p.time || "")}

<b>Pronostic :</b> ${escapeHtml(p.prono || p.bet || "")}
<b>Cote :</b> <b>${escapeHtml(p.cote || "")}</b>
<b>Confiance Concile :</b> ${escapeHtml(p.confidenceTg || "")}${probStr}
${p.raison ? `\n<i>${escapeHtml(p.raison)}</i>` : ""}

Analyse complete : https://www.touslesmatchs.com/live-ia

18+ uniquement. Jeu responsable.`;

  const sent = await publishTelegramPick({
    token: TG_TOKEN,
    chatId: PREMIUM_CHANNEL,
    text,
    pick: p,
    extra: bookmakerReplyMarkup([
      { text: "Live IA TousLesMatchs", url: "https://www.touslesmatchs.com/live-ia" },
    ]),
  });
  const ok = !!sent.ok;
  const err = sent.description || sent.error || "";
  await reply(chatId, ok ? `Pick publie sur le canal Premium (${PREMIUM_CHANNEL})` : `Erreur publication Premium (${PREMIUM_CHANNEL}) : ${err || "verifie que le bot est admin du canal"}`);
}

async function notifyPickByEmail(pick) {
  const API_HOST = "touslesmatchs-api";
  const API_PORT = 3001;
  const body = JSON.stringify({ pick, secret: TG_TOKEN });
  return new Promise((resolve) => {
    const req = http.request({
      hostname: API_HOST,
      port: API_PORT,
      path: "/internal/pick-notify",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.setTimeout(15000, () => { req.destroy(); resolve({ ok: false, error: "timeout" }); });
    req.on("error", () => resolve({ ok: false }));
    req.write(body); req.end();
  });
}

async function notifyResultByEmail(pick) {
  const API_HOST = "touslesmatchs-api";
  const API_PORT = 3001;
  const body = JSON.stringify({ pick, secret: TG_TOKEN });
  return new Promise((resolve) => {
    const req = http.request({
      hostname: API_HOST,
      port: API_PORT,
      path: "/internal/pick-result-notify",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.setTimeout(15000, () => { req.destroy(); resolve({ ok: false, error: "timeout" }); });
    req.on("error", () => resolve({ ok: false }));
    req.write(body); req.end();
  });
}

async function recordConcileResult(record) {
  const API_HOST = "touslesmatchs-api";
  const API_PORT = 3001;
  const body = JSON.stringify({ record, secret: TG_TOKEN });
  return new Promise((resolve) => {
    const req = http.request({
      hostname: API_HOST,
      port: API_PORT,
      path: "/internal/record-concile-result",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.setTimeout(15000, () => { req.destroy(); resolve({ ok: false, error: "timeout" }); });
    req.on("error", () => resolve({ ok: false }));
    req.write(body); req.end();
  });
}

async function fetchStrategyReport() {
  const API_HOST = "touslesmatchs-api";
  const API_PORT = 3001;
  const body = JSON.stringify({ secret: TG_TOKEN });
  return new Promise((resolve) => {
    const req = http.request({
      hostname: API_HOST,
      port: API_PORT,
      path: "/internal/strategy-report",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.setTimeout(15000, () => { req.destroy(); resolve({ ok: false, error: "timeout" }); });
    req.on("error", () => resolve({ ok: false }));
    req.write(body); req.end();
  });
}

async function fetchStrongSignals() {
  const API_HOST = "touslesmatchs-api";
  const API_PORT = 3001;
  const body = JSON.stringify({
    secret: TG_TOKEN,
    threshold: STRONG_ALERTS_THRESHOLD,
    minResolved: STRONG_ALERTS_MIN_RESOLVED,
    limit: STRONG_ALERTS_MAX_PER_DAY,
  });
  return new Promise((resolve) => {
    const req = http.request({
      hostname: API_HOST,
      port: API_PORT,
      path: "/internal/strong-signals",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.setTimeout(15000, () => { req.destroy(); resolve({ ok: false, error: "timeout" }); });
    req.on("error", () => resolve({ ok: false }));
    req.write(body); req.end();
  });
}

function formatStrongSignal(signal) {
  return `<b>🚨 Signal fort détecté</b>

<b>Match</b> : ${escapeHtml(signal.home)} vs ${escapeHtml(signal.away)}
<b>Compétition</b> : ${escapeHtml(signal.competition)}
<b>Score/minute</b> : ${escapeHtml(signal.score)}${signal.minute ? ` à ${signal.minute}'` : ""}
<b>Marché</b> : ${escapeHtml(signal.bet)}
<b>Probabilité Concile</b> : ${signal.confidence}%
<b>Historique marché</b> : ${signal.market?.winrate ?? "?"}% (${signal.market?.wins ?? 0}/${signal.market?.total ?? 0})

<b>Pourquoi</b>
${escapeHtml(signal.reason || "Signal élevé détecté par le Concile.")}

<b>Action</b>
À vérifier avant publication ou mise.`;
}

function formatClientStrongSignal(signal) {
  return `<b>Alerte Concile IA</b>

<b>Match</b> : ${escapeHtml(signal.home)} vs ${escapeHtml(signal.away)}
<b>Competition</b> : ${escapeHtml(signal.competition)}
<b>Moment</b> : ${signal.minute ? `${signal.minute}'` : "Live"}

<b>Signal</b> : ${escapeHtml(signal.bet)}
<b>Confiance</b> : signal fort valide par le Concile

Analyse : https://www.touslesmatchs.com/live-ia

18+ uniquement. Jeu responsable. Aucun gain garanti.`;
}

function formatStrategyTop(rows) {
  return (rows || []).slice(0, 5).map((r, i) =>
    `${i + 1}. ${r.label}: ${r.winrate ?? "?"}% (${r.wins}/${r.total})${r.confidence === "sample_faible" ? " — échantillon faible" : ""}`
  ).join("\n") || "Pas assez de données.";
}

async function cmdStrategy(chatId) {
  const report = await fetchStrategyReport();
  if (!report.ok) {
    await reply(chatId, `❌ Rapport stratégie indisponible : ${report.error || "erreur inconnue"}`);
    return;
  }
  await reply(chatId, `<b>🎯 Codex Prono Hunter — note du jour</b>

${escapeHtml(report.note || "Pas assez de données pour conclure.")}

<b>Marchés</b>
<code>${escapeHtml(formatStrategyTop(report.top?.markets))}</code>

<b>Compétitions</b>
<code>${escapeHtml(formatStrategyTop(report.top?.competitions))}</code>

<b>IA</b>
<code>${escapeHtml(formatStrategyTop(report.top?.agents))}</code>`);
}

async function scanStrongSignals({ manual = false } = {}) {
  if (!STRONG_ALERTS_ENABLED && !manual) return;
  if (!ADMIN_CHAT) return;

  const today = parisNowParts().date;
  const state = loadStrongAlertsState();
  const sent = Array.isArray(state.sent) ? state.sent : [];
  const clientSent = Array.isArray(state.clientSent) ? state.clientSent : [];
  const sentToday = sent.filter(a => a.date === today);

  if (!manual && sentToday.length >= STRONG_ALERTS_MAX_PER_DAY) return;

  const result = await fetchStrongSignals();
  if (!result.ok) {
    if (manual) await reply(ADMIN_CHAT, `❌ Radar signaux forts indisponible : ${result.error || "erreur inconnue"}`);
    return;
  }

  const already = new Set(sent.map(a => a.id));
  const candidates = (result.signals || []).filter(s => s.id && !already.has(s.id));
  if (!candidates.length) {
    if (manual) await reply(ADMIN_CHAT, "Aucun nouveau signal fort pour le moment.");
    return;
  }

  const remaining = Math.max(0, STRONG_ALERTS_MAX_PER_DAY - sentToday.length);
  const toSend = candidates.slice(0, manual ? candidates.length : remaining);
  for (const signal of toSend) {
    await reply(ADMIN_CHAT, formatStrongSignal(signal), bookmakerReplyMarkup([
      { text: "Voir Live IA", url: "https://www.touslesmatchs.com/live-ia" },
    ]));
    sent.unshift({
      id: signal.id,
      date: today,
      sentAt: new Date().toISOString(),
      home: signal.home,
      away: signal.away,
      competition: signal.competition,
      score: signal.score,
      minute: signal.minute,
      bet: signal.bet,
      confidence: signal.confidence,
      reason: signal.reason,
      market: signal.market,
    });

    if (STRONG_ALERTS_CLIENT_AUTO && !clientSent.some(a => a.id === signal.id)) {
      const published = await publishClientStrongSignal(signal, { silentAdmin: true });
      if (published.ok) {
        clientSent.unshift({ id: signal.id, date: today, sentAt: new Date().toISOString(), channel: STRONG_ALERTS_CLIENT_CHANNEL });
      }
    }
  }
  saveStrongAlertsState({ sent: sent.slice(0, 300), clientSent: clientSent.slice(0, 300) });
}

async function cmdAlerts(chatId) {
  await scanStrongSignals({ manual: true });
}

async function publishClientStrongSignal(signal, { silentAdmin = false } = {}) {
  if (!signal?.id) return { ok: false, error: "signal manquant" };
  const sent = await sendTelegramWithToken(
    STRONG_ALERTS_CLIENT_TOKEN,
    STRONG_ALERTS_CLIENT_CHANNEL,
    formatClientStrongSignal(signal),
    bookmakerReplyMarkup([
      { text: "Voir l'analyse Live IA", url: "https://www.touslesmatchs.com/live-ia" },
    ])
  );
  if (!silentAdmin && ADMIN_CHAT) {
    await reply(
      ADMIN_CHAT,
      sent.ok
        ? `Alerte client publiee sur ${STRONG_ALERTS_CLIENT_CHANNEL}`
        : `Publication alerte client impossible : ${escapeHtml(sent.description || sent.error || "erreur inconnue")}`
    );
  }
  return sent.ok ? { ok: true } : { ok: false, error: sent.description || sent.error || "erreur inconnue" };
}

async function cmdPublishAlert(chatId, args) {
  const state = loadStrongAlertsState();
  const sent = Array.isArray(state.sent) ? state.sent : [];
  const clientSent = Array.isArray(state.clientSent) ? state.clientSent : [];
  const wanted = String(args || "").trim();
  const signal = wanted
    ? sent.find(s => s.id === wanted || `${s.home} ${s.away}`.toLowerCase().includes(wanted.toLowerCase()))
    : sent.find(s => !clientSent.some(c => c.id === s.id)) || sent[0];

  if (!signal) {
    await reply(chatId, "Aucune alerte forte disponible. Lance d'abord /alerts.");
    return;
  }
  if (clientSent.some(c => c.id === signal.id)) {
    await reply(chatId, "Cette alerte a deja ete publiee cote client.");
    return;
  }

  const result = await publishClientStrongSignal(signal);
  if (result.ok) {
    clientSent.unshift({ id: signal.id, date: parisNowParts().date, sentAt: new Date().toISOString(), channel: STRONG_ALERTS_CLIENT_CHANNEL });
    saveStrongAlertsState({ ...state, clientSent: clientSent.slice(0, 300) });
  }
}

async function cmdRecord(chatId, args) {
  const parts = args.split("|").map(s => s.trim()).filter(Boolean);
  if (parts.length < 7) {
    await reply(chatId, "❌ Syntaxe : <code>/record Portugal|Ghana|Coupe du Monde|90|Match nul|80|0-0</code>");
    return;
  }
  const [home, away, competition, minute, bet, confidence, score] = parts;
  if (!/^\d+\s*[-:]\s*\d+$/.test(score)) {
    await reply(chatId, "❌ Score final invalide. Exemple : <code>0-0</code>");
    return;
  }
  const result = await recordConcileResult({
    home, away, competition, minute, bet, confidence, score,
    reason: "Prediction du Concile verifiee apres match par Gregory.",
    agent: "Claude Chief",
  });
  if (!result.ok) {
    await reply(chatId, `❌ Enregistrement impossible : ${result.error || "erreur inconnue"}`);
    return;
  }
  appendImprovementLog({
    date: new Date().toISOString().slice(0, 10),
    resolvedAt: new Date().toISOString(),
    status: result.outcome === "win" ? "GAGNE" : "PERDU",
    score,
    sport: "Football",
    home,
    away,
    league: competition,
    prono: bet,
    bet,
    cote: null,
    source: "manual_record",
  });
  await reply(chatId, `✅ Prédiction enregistrée dans les stats Concile\n\n${home} vs ${away} — ${score}\n🎯 ${bet} → <b>${result.outcome === "win" ? "GAGNÉ" : "PERDU"}</b>`);
  await refreshHermesMemory(chatId, "record");
}

async function cmdDeploy(chatId) {
  await reply(chatId,
    "\u{1F512} <b>D\u00E9ploiement verrouill\u00E9</b>\n\n" +
    "Hermes ne lance plus git pull ni rebuild automatiquement.\n" +
    "Branche autoris\u00E9e : <code>claude/happy-bell-h9zj83</code>\n\n" +
    "Commande humaine sur VPS apr\u00E8s validation :\n" +
    "<code>cd /opt/touslesmatchs\n" +
    "git fetch origin claude/happy-bell-h9zj83\n" +
    "git reset --hard origin/claude/happy-bell-h9zj83\n" +
    "docker compose up -d --build [site|api|hermes-admin]</code>"
  );
}

function parisNowParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date()).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  };
}

function loadDailyRunState() {
  try { return JSON.parse(fs.readFileSync(DAILY_RUN_FILE, "utf8")); } catch { return {}; }
}

function saveDailyRunState(state) {
  try {
    fs.mkdirSync(path.dirname(DAILY_RUN_FILE), { recursive: true });
    fs.writeFileSync(DAILY_RUN_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {}
}

function loadDailyStrategyState() {
  try { return JSON.parse(fs.readFileSync(DAILY_STRATEGY_FILE, "utf8")); } catch { return {}; }
}

function saveDailyStrategyState(state) {
  try {
    fs.mkdirSync(path.dirname(DAILY_STRATEGY_FILE), { recursive: true });
    fs.writeFileSync(DAILY_STRATEGY_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {}
}

function loadStrongAlertsState() {
  try {
    const data = JSON.parse(fs.readFileSync(STRONG_ALERTS_FILE, "utf8"));
    return data && typeof data === "object" ? data : { sent: [] };
  } catch {
    return { sent: [] };
  }
}

function saveStrongAlertsState(state) {
  try {
    fs.mkdirSync(path.dirname(STRONG_ALERTS_FILE), { recursive: true });
    fs.writeFileSync(STRONG_ALERTS_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {}
}

function hasPickForDate(date) {
  const data = loadPicks();
  return data.currentPick?.date === date && data.currentPick?.status !== "NOPICK";
}

function minutesSinceIso(value) {
  if (!value) return Infinity;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return Infinity;
  return Math.floor((Date.now() - ts) / 60000);
}

let dailyAutoPickRunning = false;
async function maybeRunDailyAutoPick() {
  if (!AUTO_DAILY_PICK || !ADMIN_CHAT || dailyAutoPickRunning) return;

  const now = parisNowParts();
  const targetMinute = (AUTO_DAILY_PICK_HOUR * 60) + AUTO_DAILY_PICK_MINUTE;
  const currentMinute = (now.hour * 60) + now.minute;

  const state = loadDailyRunState();
  if (hasPickForDate(now.date)) return;

  const inPrimaryWindow = currentMinute >= targetMinute && currentMinute <= targetMinute + 20;
  const inCatchupWindow = currentMinute > targetMinute + 20 && now.hour < AUTO_DAILY_PICK_CATCHUP_UNTIL_HOUR;
  if (!inPrimaryWindow && !inCatchupWindow) return;

  if (inCatchupWindow && minutesSinceIso(state.lastAttemptAt) < AUTO_DAILY_PICK_RETRY_MINUTES) return;

  dailyAutoPickRunning = true;
  state.lastAttemptDate = now.date;
  state.startedAt = new Date().toISOString();
  state.lastAttemptAt = state.startedAt;
  saveDailyRunState(state);

  try {
    const mode = inCatchupWindow ? "rattrapage" : "quotidien";
    await reply(ADMIN_CHAT, `Auto-pick ${mode} ${now.date} : lancement de l'analyse.`);
    await runAnalyse(ADMIN_CHAT);
    const saved = hasPickForDate(now.date);
    saveDailyRunState({
      lastAttemptDate: now.date,
      lastAttemptAt: state.lastAttemptAt,
      lastRunDate: saved ? now.date : state.lastRunDate || null,
      finishedAt: new Date().toISOString(),
      ok: saved,
      retryReason: saved ? null : "aucun pick reel publie, retry possible"
    });
  } catch (e) {
    saveDailyRunState({ lastAttemptDate: now.date, lastAttemptAt: state.lastAttemptAt, finishedAt: new Date().toISOString(), ok: false, error: e.message });
    await reply(ADMIN_CHAT, `Auto-pick quotidien en erreur : ${e.message}`).catch(() => {});
  } finally {
    dailyAutoPickRunning = false;
  }
}

let dailyStrategyRunning = false;
async function maybeRunDailyStrategy() {
  if (!AUTO_DAILY_STRATEGY || !ADMIN_CHAT || dailyStrategyRunning) return;

  const now = parisNowParts();
  const targetMinute = (AUTO_DAILY_STRATEGY_HOUR * 60) + AUTO_DAILY_STRATEGY_MINUTE;
  const currentMinute = (now.hour * 60) + now.minute;
  if (currentMinute < targetMinute || currentMinute > targetMinute + 20) return;

  const state = loadDailyStrategyState();
  if (state.lastRunDate === now.date) return;

  dailyStrategyRunning = true;
  saveDailyStrategyState({ lastRunDate: now.date, startedAt: new Date().toISOString() });
  try {
    await cmdStrategy(ADMIN_CHAT);
    saveDailyStrategyState({ lastRunDate: now.date, finishedAt: new Date().toISOString(), ok: true });
  } catch (e) {
    saveDailyStrategyState({ lastRunDate: now.date, finishedAt: new Date().toISOString(), ok: false, error: e.message });
    await reply(ADMIN_CHAT, `Rapport stratégie quotidien en erreur : ${e.message}`).catch(() => {});
  } finally {
    dailyStrategyRunning = false;
  }
}
async function cmdHelp(chatId) {
  await reply(chatId, `🤖 <b>HERMÈS — Commandes disponibles</b>

/status — État actuel (pick + containers)
/analyse — Générer le pick du jour via IA
/setpick A|B|Ligue|Heure|Prono|Cote — Définir pick manuellement
/setscore 1-0 — Mettre à jour le score
/win — Marquer le pick comme GAGNÉ
/lose — Marquer le pick comme PERDU
/result — Préparer le message résultat Telegram sans publier
/record Portugal|Ghana|Coupe du Monde|90|Match nul|80|0-0 — Ajouter une prédiction vérifiée aux stats Concile
/strategy — Rapport Codex Prono Hunter (marchés, IA, compétitions)
/alerts — Scanner maintenant les signaux forts privés
/learn — Analyser l'historique et mettre à jour la mémoire IA
/publish — Publier sur le canal Telegram public (gratuit)
/publishpremium — Publier sur le canal Telegram Premium
/deploy — guidance de déploiement verrouillée
/diagtelegram — Diagnostiquer la connexion Telegram (canaux, tokens)
/help — Cette aide`);
}

async function cmdDiagTelegram(chatId) {
  let msg = "🔎 <b>DIAG TELEGRAM</b>\n\n";
  // Tokens
  msg += `• HERMES_ADMIN_TLM_BOT : ${TG_TOKEN ? "✅ défini" : "❌ manquant"}\n`;
  msg += `• TELEGRAM_BOT_TOKEN (public) : ${PUBLIC_BOT_TOKEN ? "✅ défini" : "❌ manquant"}\n`;
  msg += `• TELEGRAM_FREE_CHANNEL_ID : ${PUBLIC_CHAT ? `✅ ${PUBLIC_CHAT}` : "❌ manquant"}\n`;
  msg += `• TELEGRAM_PREMIUM_CHANNEL_ID : ${PREMIUM_CHANNEL ? `✅ ${PREMIUM_CHANNEL}` : "❌ manquant — publishpremium désactivé"}\n`;
  msg += `• TELEGRAM_ADMIN_CHAT_ID : ${ADMIN_CHAT ? `✅ ${ADMIN_CHAT}` : "⚠️ non défini"}\n\n`;
  // Teste le canal public
  if (PUBLIC_BOT_TOKEN && PUBLIC_CHAT) {
    try {
      const r = await tgRequestWithToken(PUBLIC_BOT_TOKEN, "getChat", { chat_id: PUBLIC_CHAT });
      msg += r.ok ? `• Canal public ✅ (${r.result?.title || PUBLIC_CHAT})\n` : `• Canal public ❌ : ${r.description || "erreur inconnue"}\n`;
    } catch (e) { msg += `• Canal public ❌ : ${e.message}\n`; }
  }
  // Teste le canal premium
  if (TG_TOKEN && PREMIUM_CHANNEL) {
    try {
      const r = await tgRequest("getChat", { chat_id: PREMIUM_CHANNEL });
      msg += r.ok ? `• Canal premium ✅ (${r.result?.title || PREMIUM_CHANNEL})\n` : `• Canal premium ❌ : ${r.description || "erreur inconnue"}\n`;
    } catch (e) { msg += `• Canal premium ❌ : ${e.message}\n`; }
  }
  msg += `\n• OPENAI_API_KEY : ${OPENAI_API_KEY ? "✅ défini" : "⚠️ manquant (images désactivées)"}\n`;
  msg += `• Sports autorisés (pick) : ${HERMES_PICK_ALLOWED_SPORTS.join(", ")}`;
  await reply(chatId, msg);
}

function tgRequestWithToken(token, method, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${token}/${method}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
    }, res => { let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } }); });
    req.on("error", () => resolve({}));
    req.write(data); req.end();
  });
}

// ── Message router ────────────────────────────────────────────────────────────
async function handleCommandLine(chatId, text) {
  const [cmd, ...rest] = text.split(" ");
  const args = rest.join(" ");

  console.log(`[CMD] ${cmd} ${args}`);

  switch (cmd.toLowerCase()) {
    case "/status":   return cmdStatus(chatId);
    case "/analyse":
    case "/pick":     return runAnalyse(chatId);
    case "/setpick":  return cmdSetPick(chatId, args);
    case "/setscore": return cmdSetScore(chatId, args);
    case "/win":             return cmdResult(chatId, "GAGNE");
    case "/lose":            return cmdResult(chatId, "PERDU");
    case "/result":          return cmdResultPreview(chatId);
    case "/record":          return cmdRecord(chatId, args);
    case "/strategy":        return cmdStrategy(chatId);
    case "/alerts":          return cmdAlerts(chatId);
    case "/publishalert":    return cmdPublishAlert(chatId, args);
    case "/learn":           return cmdLearn(chatId);
    case "/publish":         return cmdPublish(chatId);
    case "/publishpremium":  return cmdPublishPremium(chatId);
    case "/deploy":          return cmdDeploy(chatId);
    case "/diagtelegram":    return cmdDiagTelegram(chatId);
    case "/help":
    default:          return cmdHelp(chatId);
  }
}

async function handleMessage(msg) {
  const chatId = String(msg.chat?.id);
  const fromId = String(msg.from?.id);
  const text   = (msg.text || "").trim();

  // Sécurité : seulement l'admin
  if (fromId !== ADMIN_USER_ID) {
    console.log(`  ⚠️ Message ignoré de user ${fromId}`);
    return;
  }

  const commandLines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith("/"));

  if (!commandLines.length) return cmdHelp(chatId);

  for (const line of commandLines) {
    await handleCommandLine(chatId, line);
  }
}

// ── Long polling loop ─────────────────────────────────────────────────────────
async function poll() {
  let offset = 0;
  console.log("🚀 Hermès Admin Bot démarré");
  console.log(`   Admin chat : ${ADMIN_CHAT}`);
  console.log(`   DeepSeek   : ${DEEPSEEK_KEY ? "✅" : "❌"}`);
  console.log(`   Groq        : ${GROQ_KEY ? "✅" : "❌"}`);
  console.log(`   football-data: ${FD_KEY ? "✅" : "❌"}`);

  // Message de démarrage
  if (ADMIN_CHAT) {
    await reply(ADMIN_CHAT, "🟢 <b>Hermès Admin Bot démarré</b>\nTape /help pour voir les commandes.").catch(() => {});
  }

  maybeRunDailyAutoPick().catch(e => console.error("daily auto-pick:", e.message));
  maybeRunDailyStrategy().catch(e => console.error("daily strategy:", e.message));
  scanStrongSignals().catch(e => console.error("strong signals:", e.message));
  setInterval(() => {
    maybeRunDailyAutoPick().catch(e => console.error("daily auto-pick:", e.message));
    maybeRunDailyStrategy().catch(e => console.error("daily strategy:", e.message));
  }, 60 * 1000);
  setInterval(() => {
    scanStrongSignals().catch(e => console.error("strong signals:", e.message));
  }, STRONG_ALERTS_INTERVAL_MS);

  while (true) {
    try {
      const res = await getUpdates(offset || undefined);
      for (const upd of res.result || []) {
        offset = upd.update_id + 1;
        if (upd.message) {
          await handleMessage(upd.message).catch(e => console.error("handleMessage:", e.message));
        }
      }
    } catch (e) {
      console.error("poll error:", e.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

poll();

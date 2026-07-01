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
const STRONG_ALERTS_MAX_PER_DAY = Number(process.env.HERMES_STRONG_ALERTS_MAX_PER_DAY || 8);
const STRONG_ALERTS_INTERVAL_MS = Math.max(5, Number(process.env.HERMES_STRONG_ALERTS_INTERVAL_MIN || 10)) * 60 * 1000;
const STRONG_ALERTS_CLIENT_AUTO = process.env.HERMES_STRONG_ALERTS_CLIENT_AUTO === "1";
const STRONG_ALERTS_CLIENT_CHANNEL = process.env.HERMES_STRONG_ALERTS_CLIENT_CHANNEL || PREMIUM_CHANNEL || PUBLIC_CHAT;
const STRONG_ALERTS_CLIENT_TOKEN = process.env.HERMES_STRONG_ALERTS_CLIENT_TOKEN || TG_TOKEN;
const AUTO_PUBLISH_FREE = process.env.HERMES_AUTO_PUBLISH_FREE !== "0";
const AUTO_PUBLISH_PREMIUM = process.env.HERMES_AUTO_PUBLISH_PREMIUM !== "0";
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const API_BASE_URL = process.env.API_BASE_URL || "http://touslesmatchs-api:3001";

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

// Quand OpenAI est en limite de facturation/quota, on coupe la génération
// d'image pour un moment au lieu de réessayer (et spammer l'admin) à chaque pick.
let imageGenDisabledUntil = 0;

async function generateMatchVisual(pick) {
  if (!OPENAI_API_KEY) return "";
  if (!pick?.home || !pick?.away) return "";
  if (Date.now() < imageGenDisabledUntil) return ""; // quota épuisé → fallback silencieux

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
    // Erreur de facturation/quota → on désactive 6h et on prévient UNE seule fois.
    const isQuota = /billing|quota|hard limit|insufficient|exceeded|429/i.test(e.message || "");
    if (isQuota) {
      const wasActive = Date.now() >= imageGenDisabledUntil;
      imageGenDisabledUntil = Date.now() + 6 * 60 * 60 * 1000;
      if (wasActive && ADMIN_CHAT) {
        reply(ADMIN_CHAT, `ℹ️ Génération d'image OpenAI en pause 6h (quota atteint). Les picks partent normalement avec le blason de l'équipe — aucune action requise.`).catch(() => {});
      }
    }
    // Sinon (erreur ponctuelle) : pas de notification, fallback silencieux.
    return "";
  }
}

async function ensurePickVisual(pick) {
  if (!pick || pickVisualUrl(pick)) return pickVisualUrl(pick);
  const visualUrl = await generateMatchVisual(pick);
  if (visualUrl) {
    pick.telegramImageUrl = visualUrl;
    pick.visualUrl = visualUrl;
  } else if (pick.home_logo) {
    // Fallback : blason de l'équipe domicile depuis l'API
    pick.telegramImageUrl = pick.home_logo;
    pick.visualUrl = pick.home_logo;
  }
  return pickVisualUrl(pick);
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

// ── Drapeaux équipes ───────────────────────────────────────────────────────────
// Nom de pays (FR + EN) → code ISO2, pour générer le drapeau emoji.
// Les clubs (non trouvés) reçoivent ⚽ par défaut.
const COUNTRY_ISO = {
  "france": "FR", "bresil": "BR", "brazil": "BR", "bresil": "BR", "japon": "JP", "japan": "JP",
  "allemagne": "DE", "germany": "DE", "paraguay": "PY", "argentine": "AR", "argentina": "AR",
  "espagne": "ES", "spain": "ES", "italie": "IT", "italy": "IT", "angleterre": "GB-ENG", "england": "GB-ENG",
  "portugal": "PT", "pays-bas": "NL", "hollande": "NL", "netherlands": "NL", "belgique": "BE", "belgium": "BE",
  "croatie": "HR", "croatia": "HR", "maroc": "MA", "morocco": "MA", "ecosse": "GB-SCT", "scotland": "GB-SCT",
  "uruguay": "UY", "mexique": "MX", "mexico": "MX", "etats-unis": "US", "usa": "US", "united states": "US",
  "canada": "CA", "ouzbekistan": "UZ", "uzbekistan": "UZ", "turquie": "TR", "turkey": "TR",
  "suisse": "CH", "switzerland": "CH", "danemark": "DK", "denmark": "DK", "pologne": "PL", "poland": "PL",
  "senegal": "SN", "cameroun": "CM", "cameroon": "CM", "ghana": "GH", "nigeria": "NG", "nigéria": "NG",
  "coree du sud": "KR", "south korea": "KR", "australie": "AU", "australia": "AU", "iran": "IR",
  "arabie saoudite": "SA", "saudi arabia": "SA", "qatar": "QA", "equateur": "EC", "ecuador": "EC",
  "colombie": "CO", "colombia": "CO", "perou": "PE", "peru": "PE", "chili": "CL", "chile": "CL",
  "serbie": "RS", "serbia": "RS", "suede": "SE", "sweden": "SE", "norvege": "NO", "norway": "NO",
  "autriche": "AT", "austria": "AT", "grece": "GR", "greece": "GR", "irak": "IQ", "iraq": "IQ",
  "irlande": "IE", "ireland": "IE", "republique tcheque": "CZ", "czech republic": "CZ",
  "ukraine": "UA", "russie": "RU", "russia": "RU", "egypte": "EG", "egypt": "EG", "tunisie": "TN",
  "algerie": "DZ", "algeria": "DZ", "cote d'ivoire": "CI", "ivory coast": "CI",
};
// Drapeaux régionaux non couverts par ISO2 standard (nations britanniques)
const SPECIAL_FLAGS = {
  "GB-ENG": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "GB-SCT": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "GB-WLS": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
};
function iso2ToFlag(iso2) {
  if (SPECIAL_FLAGS[iso2]) return SPECIAL_FLAGS[iso2];
  if (!/^[A-Z]{2}$/.test(iso2)) return "";
  return String.fromCodePoint(...[...iso2].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}
function teamFlag(name) {
  const key = String(name || "").toLowerCase().trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, ""); // enlève les accents
  const iso = COUNTRY_ISO[key];
  if (iso) return iso2ToFlag(iso);
  return "⚽"; // club ou pays inconnu
}
// "France vs Brésil" → "🇫🇷 France vs 🇯🇵 Japon" (avec drapeaux)
function matchWithFlags(home, away) {
  return `${teamFlag(home)} ${escapeHtml(home)} vs ${teamFlag(away)} ${escapeHtml(away)}`;
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
    pick.league || pick.competition || "",
    pick.provider || ""
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
          home_logo: f.teams?.home?.logo || null, away_logo: f.teams?.away?.logo || null,
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
            home_logo: g.teams?.home?.logo || null, away_logo: g.teams?.away?.logo || null,
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
          home_logo: m.homeTeam?.crest || null, away_logo: m.awayTeam?.crest || null,
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
  let block = `\nMÉMOIRE HERMÈS (${m.picks_analysed} picks analysés) :\n${stats}\nRÈGLES APPRISES :\n${rules}\n`;
  try {
    delete require.cache[require.resolve("./hermes_learn.js")];
    const { strategyDirective } = require("./hermes_learn.js");
    block += strategyDirective(m);
  } catch (e) { console.error("[memoryBlock] strategyDirective:", e.message); }
  return block;
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
  // Récupérer les logos depuis la liste des matchs API
  const matchedM = matches.find(m => {
    const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return norm(m.home).includes(norm(p.home).slice(0,4)) || norm(p.home).includes(norm(m.home).slice(0,4));
  });
  const data = loadPicks();
  archiveCurrentPick(data);
  data.currentPick = stampLiveAvailability({
    date: new Date().toISOString().slice(0, 10),
    home: p.home || "",
    away: p.away || "",
    home_logo: matchedM?.home_logo || null,
    away_logo: matchedM?.away_logo || null,
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
    provider, // DeepSeek ou Groq — pour les stats de performance par IA
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

async function cmdExpiring(chatId) {
  await reply(chatId, "🔍 Récupération des abonnements expirant sous 7 jours...");
  try {
    const d = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: "touslesmatchs-api",
        port: 3001,
        path: "/internal/expiring-codes?days=7",
        method: "GET",
        headers: { "x-internal-secret": TG_TOKEN }
      }, res => {
        let body = ""; res.on("data", c => body += c);
        res.on("end", () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
      });
      req.setTimeout(10000, () => { req.destroy(); reject(new Error("timeout")); });
      req.on("error", reject); req.end();
    });

    if (!d.ok) { await reply(chatId, `❌ Erreur API: ${d.error || "inconnue"}`); return; }
    if (!d.count) { await reply(chatId, "✅ Aucun abonnement n'expire dans les 7 prochains jours."); return; }

    let msg = `⏰ <b>${d.count} abonnement(s) expirant sous 7 jours</b>\n\n`;
    for (const r of d.expiring) {
      const emoji = r.daysLeft <= 1 ? "🔴" : r.daysLeft <= 3 ? "🟠" : "🟡";
      msg += `${emoji} <b>${escapeHtml(r.plan)}</b> — ${escapeHtml(r.email)}\n   Expire : ${r.expires_at} (J-${r.daysLeft})\n\n`;
    }
    await reply(chatId, msg);
  } catch(e) {
    await reply(chatId, `❌ Erreur: ${e.message}`);
  }
}

// Cherche le score final d'un match (hier + aujourd'hui) via football-data
// puis api-sports en repli. Réutilisé pour le pick du jour ET le rattrapage
// des picks archivés dans l'historique (voir resolveStaleHistoryPicks).
async function findFinalScoreForTeams(home, away) {
  const homeN = normalizeTeamName(home);
  const awayN = normalizeTeamName(away);
  const sameTeam = (a, b) => a === b || a.includes(b) || b.includes(a);

  if (FD_KEY) {
    try {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const d = await httpGet(`https://api.football-data.org/v4/matches?dateFrom=${yesterday}&dateTo=${today}`, { "X-Auth-Token": FD_KEY });
      const finished = (d.matches || []).filter(m => m.status === "FINISHED");
      const match = finished.find(m => {
        const mh = normalizeTeamName(m.homeTeam?.name || "");
        const ma = normalizeTeamName(m.awayTeam?.name || "");
        return (sameTeam(mh, homeN) && sameTeam(ma, awayN)) || (sameTeam(mh, awayN) && sameTeam(ma, homeN));
      });
      if (match) {
        const sh = match.score?.fullTime?.home ?? match.score?.fullTime?.homeTeam ?? null;
        const sa = match.score?.fullTime?.away ?? match.score?.fullTime?.awayTeam ?? null;
        if (sh !== null && sa !== null) {
          const reversed = normalizeTeamName(match.homeTeam?.name || "").includes(awayN) || normalizeTeamName(match.awayTeam?.name || "").includes(homeN);
          return { scoreHome: reversed ? sa : sh, scoreAway: reversed ? sh : sa, source: "football-data.org", competition: match.competition?.name };
        }
      }
    } catch(e) { console.error("[checkresult] football-data:", e.message); }
  }

  if (SPORTS_KEY) {
    try {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      for (const date of [today, yesterday]) {
        const d = await httpGet(`https://v3.football.api-sports.io/fixtures?date=${date}&status=FT`, { "x-apisports-key": SPORTS_KEY });
        const fixtures = d.response || [];
        const match = fixtures.find(f => {
          const mh = normalizeTeamName(f.teams?.home?.name || "");
          const ma = normalizeTeamName(f.teams?.away?.name || "");
          return (sameTeam(mh, homeN) && sameTeam(ma, awayN)) || (sameTeam(mh, awayN) && sameTeam(ma, homeN));
        });
        if (match) {
          const sh = match.goals?.home ?? null;
          const sa = match.goals?.away ?? null;
          if (sh !== null && sa !== null) {
            const reversed = normalizeTeamName(match.teams?.home?.name || "").includes(awayN);
            return { scoreHome: reversed ? sa : sh, scoreAway: reversed ? sh : sa, source: "api-sports.io", competition: match.league?.name };
          }
        }
      }
    } catch(e) { console.error("[checkresult] api-sports:", e.message); }
  }
  return null;
}

// Déduit GAGNE/PERDU à partir du texte du pari et du score final.
// IMPORTANT : les marchés over/under/btts/double-chance contiennent souvent
// des chiffres ("2.5", "+2.5"...) qui matchaient à tort les anciens tests
// bet.includes("1")/bet.includes("2") (ex: "Moins de 2.5 buts" → mal classé
// comme "victoire extérieur" car il contient "2"). On teste donc en premier
// les marchés spécifiques (over/under/btts/double chance/handicap), et on
// ne teste 1/X/2 qu'en dernier recours, avec une correspondance stricte.
function classifyAutoResult(betRaw, scoreHome, scoreAway, home) {
  const bet = String(betRaw || "").toLowerCase();
  const totalGoals = scoreHome + scoreAway;
  if (/over\s*2[.,]5|plus\s*de\s*2[.,]?5?\s*buts|\+\s*2[.,]5/.test(bet)) {
    return totalGoals > 2.5 ? "GAGNE" : "PERDU";
  } else if (/under\s*2[.,]5|moins\s*de\s*(2[.,]?5?|3)\s*buts|-\s*2[.,]5/.test(bet)) {
    return totalGoals < 2.5 ? "GAGNE" : "PERDU";
  } else if (/\bbtts\b|les deux équipes marquent|both teams to score/.test(bet)) {
    return (scoreHome > 0 && scoreAway > 0) ? "GAGNE" : "PERDU";
  } else if (/\b1x\b|double chance.*(1|domicile).*(nul|x)/.test(bet)) {
    return scoreHome >= scoreAway ? "GAGNE" : "PERDU";
  } else if (/\bx2\b|double chance.*(nul|x).*(2|extérieur)/.test(bet)) {
    return scoreAway >= scoreHome ? "GAGNE" : "PERDU";
  } else if (/\b12\b/.test(bet)) {
    return scoreHome !== scoreAway ? "GAGNE" : "PERDU";
  } else if (/\bnul\b|\bdraw\b|\bmatch nul\b/.test(bet) || bet === "x") {
    return scoreHome === scoreAway ? "GAGNE" : "PERDU";
  } else if (/\bdomicile\b|\bhome\b|\b1\b/.test(bet) || (home && bet.includes(normalizeTeamName(home)))) {
    return scoreHome > scoreAway ? "GAGNE" : "PERDU";
  } else if (/\bextérieur\b|\baway\b|\b2\b/.test(bet)) {
    return scoreAway > scoreHome ? "GAGNE" : "PERDU";
  }
  return null;
}

async function cmdCheckResult(chatId, autoApply = false) {
  const data = loadPicks();
  const p = data.currentPick;
  if (!p?.home || p.home === "PAS DE PICK") { await reply(chatId, "Aucun pick actif à vérifier"); return; }
  if (["GAGNE", "PERDU", "WIN", "LOSS"].includes(String(p.status || "").toUpperCase())) {
    await reply(chatId, `Pick déjà résolu : <b>${p.status}</b>`); return;
  }

  await reply(chatId, `🔍 Recherche du score pour <b>${escapeHtml(p.home)} vs ${escapeHtml(p.away)}</b>...`);

  const found = await findFinalScoreForTeams(p.home, p.away);

  if (!found) {
    await reply(chatId, `⏳ Match pas encore terminé ou introuvable dans les APIs.\n\nTu peux mettre le score manuellement : <code>/setscore 1-0</code> puis <code>/win</code> ou <code>/lose</code>`);
    return;
  }

  const { scoreHome, scoreAway, source, competition } = found;
  const score = `${scoreHome}-${scoreAway}`;

  // Mettre à jour le score dans les picks
  data.currentPick.score = score;
  savePicks(data);
  try {
    fs.mkdirSync("/var/touslesmatchs", { recursive: true });
    fs.writeFileSync("/var/touslesmatchs/live_score.json", JSON.stringify({ home: scoreHome, away: scoreAway, source }, null, 2));
  } catch {}

  const autoResult = classifyAutoResult(p.prono || p.bet, scoreHome, scoreAway, p.home);

  // Mode automatique (cron) : si le résultat est déduit avec confiance, on l'applique
  // directement (archive + publication + email) au lieu d'attendre une confirmation
  // manuelle — c'est le but du check auto, sinon Grégory doit confirmer tous les jours.
  if (autoApply && autoResult) {
    const emoji = autoResult === "GAGNE" ? "✅" : "❌";
    await reply(chatId, `${emoji} <b>Résultat auto-détecté</b> (via ${source}) : <b>${score}</b> — ${escapeHtml(p.home)} vs ${escapeHtml(p.away)}\n📌 ${escapeHtml(p.prono || p.bet || "—")} → <b>${autoResult}</b>\n\nApplication automatique...`);
    await cmdResult(chatId, autoResult);
    return;
  }

  let msg = `📊 <b>Résultat trouvé</b> (via ${source})\n\n`;
  msg += `<b>${escapeHtml(p.home)} vs ${escapeHtml(p.away)}</b>\n`;
  msg += `🏆 Score : <b>${score}</b>`;
  if (competition) msg += ` — ${escapeHtml(competition)}`;
  msg += `\n\n📌 Pari : <i>${escapeHtml(p.prono || p.bet || "—")}</i>\n`;

  if (autoResult) {
    const emoji = autoResult === "GAGNE" ? "✅" : "❌";
    msg += `\n${emoji} Résultat probable : <b>${autoResult}</b>\n\n`;
    msg += `Confirme avec <code>/${autoResult === "GAGNE" ? "win" : "lose"}</code>`;
  } else {
    msg += `\n⚠️ Impossible de déduire le résultat automatiquement.\n`;
    msg += `Utilise <code>/win</code> ou <code>/lose</code> manuellement.`;
  }

  await reply(chatId, msg);
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

  const pub = await publishPickResultToChannels(data.currentPick);
  if (pub.sent > 0) {
    data.currentPick.resultPublishedAt = new Date().toISOString();
    savePicks(data);
    await reply(chatId, `Resultat publie sur ${pub.sent} canal(aux).`);
  }

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

async function publishPickResultToChannels(p) {
  const status = String(p?.status || "").toUpperCase();
  if (!p?.home || !p?.away || !p?.score || !["GAGNE", "PERDU", "WIN", "LOSS"].includes(status)) {
    return { ok: false, sent: 0, error: "resultat incomplet" };
  }
  if (p.resultPublishedAt) return { ok: true, sent: 0, skipped: true };
  const won = status === "GAGNE" || status === "WIN";
  const text = `<b>${won ? "✅" : "📊"} Resultat du pick du jour</b>

<b>${matchWithFlags(p.home, p.away)}</b>
${escapeHtml(p.league || "")}
🎯 ${escapeHtml(p.prono || p.bet || "Pick officiel")}
Score final : <b>${escapeHtml(p.score)}</b>
Resultat : <b>${won ? "GAGNE" : "PERDU"}</b>

${won ? "Le Conseil des IA avait vu juste." : "Resultat enregistre. On garde la donnee pour ameliorer le modele."}

Historique : https://www.touslesmatchs.com/historique
18+ uniquement. Jeu responsable.`;

  let sent = 0;
  if (PUBLIC_BOT_TOKEN && PUBLIC_CHAT) {
    const r = await sendTelegramWithToken(PUBLIC_BOT_TOKEN, PUBLIC_CHAT, text);
    if (r.ok) sent++;
  }
  if (TG_TOKEN && PREMIUM_CHANNEL) {
    const r = await sendTelegramWithToken(TG_TOKEN, PREMIUM_CHANNEL, text);
    if (r.ok) sent++;
  }
  return { ok: sent > 0, sent };
}

async function cmdPublishResult(chatId) {
  const data = loadPicks();
  const p = data.currentPick || {};
  const result = await publishPickResultToChannels(p);
  if (result.skipped) {
    await reply(chatId, "Resultat deja publie.");
    return;
  }
  if (!result.ok) {
    await reply(chatId, `Publication resultat impossible : ${escapeHtml(result.error || "verifie score/statut")}`);
    return;
  }
  data.currentPick.resultPublishedAt = new Date().toISOString();
  savePicks(data);
  await reply(chatId, `Resultat publie sur ${result.sent} canal(aux).`);
}

async function cmdPreview(chatId) {
  const data = loadPicks();
  const p = data.currentPick;
  if (!p?.home || p.home === "PAS DE PICK") { await reply(chatId, "Aucun pick défini pour le preview"); return; }

  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const conf = p.confidenceTg || p.confidence || "";
  const confNum = parseInt(conf) || 0;
  const signalEmoji = confNum >= 80 ? "🔥" : confNum >= 70 ? "⚡" : "📊";
  const signalLabel = confNum >= 80 ? "FORT" : confNum >= 70 ? "BON" : "MODÉRÉ";

  const freeMsg = `${signalEmoji} <b>Pick du jour — ${today}</b>

<b>${matchWithFlags(p.home, p.away)}</b>
📋 ${escapeHtml(p.league || "Compétition")}
🕐 ${escapeHtml(p.time || "")}

━━━━━━━━━━━━━━━
🤖 <b>Le Concile a analysé ce match</b>
Signal : <b>${signalLabel}</b> ${signalEmoji}
Confiance : <b>${escapeHtml(String(conf))}</b>

🔒 <i>Le pari retenu par le Chief est réservé aux membres Pro & Elite</i>
━━━━━━━━━━━━━━━

📈 Rejoins <b>+de 50 membres</b> qui reçoivent le pick complet chaque matin.
👉 <a href="https://www.touslesmatchs.com/#plans">Voir les abonnements →</a>

<i>18+ · Jeu responsable · 09 74 75 13 13</i>`;

  const todayLong = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", weekday: "long" });
  const edgeStr = p.edge ? ` · Edge +${Math.round(p.edge * 100)}%` : "";
  const probStr = p.probabilite_estimee ? `\n📐 Probabilité estimée : <b>${p.probabilite_estimee}%</b>${edgeStr}` : "";
  const confNum2 = parseInt(p.confidenceTg || p.confidence || 0);
  const confEmoji = confNum2 >= 85 ? "🔥🔥" : confNum2 >= 75 ? "🔥" : "⚡";
  const bankrollSugg = confNum2 >= 85 ? "3-5%" : confNum2 >= 75 ? "2-3%" : "1-2%";

  const premiumMsg = `⚡ <b>PICK PREMIUM — ${todayLong}</b>

<b>${matchWithFlags(p.home, p.away)}</b>
📋 ${escapeHtml(p.league || "Compétition")}
🕐 ${escapeHtml(p.time || "")}

━━━ VERDICT CONCILE ━━━
📌 <b>Pari : ${escapeHtml(p.prono || p.bet || "")}</b>
💰 Cote : <b>${escapeHtml(p.cote || "")}</b>
${confEmoji} Confiance : <b>${escapeHtml(String(p.confidenceTg || p.confidence || ""))}</b>${probStr}
💼 Mise suggérée : <b>${bankrollSugg} bankroll</b>

━━━ ANALYSE CHIEF ━━━
${p.raison ? `<i>${escapeHtml(p.raison)}</i>` : "<i>Analyse disponible sur Live IA</i>"}

━━━━━━━━━━━━━━━
📊 Analyse complète → <a href="https://www.touslesmatchs.com/live-ia">Live IA</a>

<i>18+ · Jeu responsable · 09 74 75 13 13</i>`;

  await reply(chatId, `📋 <b>PREVIEW — Canal GRATUIT</b>\n\n${freeMsg}\n\n─────\n\n📋 <b>PREVIEW — Canal PREMIUM</b>\n\n${premiumMsg}\n\n─────\n✅ <b>Envoie /publish pour le gratuit, /publishpremium pour le premium</b>`);
}

async function cmdPublish(chatId, opts = {}) {
  if (!PUBLIC_BOT_TOKEN) { await reply(chatId, "TELEGRAM_BOT_TOKEN manquant"); return; }
  const data = loadPicks();
  const p = data.currentPick;
  if (!p?.home || p.home === "PAS DE PICK") { await reply(chatId, "Aucun pick a publier"); return; }
  if (["GAGNE", "PERDU", "WIN", "LOSS"].includes(String(p.status || "").toUpperCase())) {
    await reply(chatId, "Pick deja termine : utilise /result pour preparer le message resultat.");
    return;
  }
  await ensurePickVisual(p);
  savePicks(data);

  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const conf = p.confidenceTg || p.confidence || "";
  const confNum = parseInt(conf) || 0;
  const signalEmoji = confNum >= 80 ? "🔥" : confNum >= 70 ? "⚡" : "📊";
  const signalLabel = confNum >= 80 ? "FORT" : confNum >= 70 ? "BON" : "MODÉRÉ";

  const text = `${signalEmoji} <b>Pick du jour — ${today}</b>

<b>${matchWithFlags(p.home, p.away)}</b>
📋 ${escapeHtml(p.league || "Compétition")}
🕐 ${escapeHtml(p.time || "")}

━━━━━━━━━━━━━━━
🤖 <b>Le Concile a analysé ce match</b>
Signal : <b>${signalLabel}</b> ${signalEmoji}
Confiance : <b>${escapeHtml(String(conf))}</b>

🔒 <i>Le pari retenu par le Chief est réservé aux membres Pro & Elite</i>
━━━━━━━━━━━━━━━

📈 Rejoins <b>+de 50 membres</b> qui reçoivent le pick complet chaque matin.
👉 <a href="https://www.touslesmatchs.com/#plans">Voir les abonnements →</a>

<i>18+ · Jeu responsable · 09 74 75 13 13</i>`;

  const sent = await publishTelegramPick({
    token: PUBLIC_BOT_TOKEN,
    chatId: PUBLIC_CHAT,
    text,
    pick: p,
    extra: bookmakerReplyMarkup([
      { text: "🔓 Voir le pick complet (Pro/Elite)", url: "https://www.touslesmatchs.com/#plans" },
      { text: "📊 Voir l'analyse Live IA", url: "https://www.touslesmatchs.com/live-ia" },
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
  if (["GAGNE", "PERDU", "WIN", "LOSS"].includes(String(p.status || "").toUpperCase())) {
    await reply(chatId, "Pick deja termine : utilise /result pour preparer le message resultat.");
    return;
  }
  await ensurePickVisual(p);
  savePicks(data);

  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", weekday: "long" });
  const edgeStr = p.edge ? ` · Edge +${Math.round(p.edge * 100)}%` : "";
  const probStr = p.probabilite_estimee ? `\n📐 Probabilité estimée : <b>${p.probabilite_estimee}%</b>${edgeStr}` : "";
  const conf = parseInt(p.confidenceTg || p.confidence || 0);
  const confEmoji = conf >= 85 ? "🔥🔥" : conf >= 75 ? "🔥" : "⚡";
  const bankrollSugg = conf >= 85 ? "3-5%" : conf >= 75 ? "2-3%" : "1-2%";
  const text = `⚡ <b>PICK PREMIUM — ${today}</b>

<b>${matchWithFlags(p.home, p.away)}</b>
📋 ${escapeHtml(p.league || "Compétition")}
🕐 ${escapeHtml(p.time || "")}

━━━ VERDICT CONCILE ━━━
📌 <b>Pari : ${escapeHtml(p.prono || p.bet || "")}</b>
💰 Cote : <b>${escapeHtml(p.cote || "")}</b>
${confEmoji} Confiance : <b>${escapeHtml(String(p.confidenceTg || p.confidence || ""))}</b>${probStr}
💼 Mise suggérée : <b>${bankrollSugg} bankroll</b>

━━━ ANALYSE CHIEF ━━━
${p.raison ? `<i>${escapeHtml(p.raison)}</i>` : "<i>Analyse disponible sur Live IA</i>"}

━━━━━━━━━━━━━━━
📊 Analyse complète → <a href="https://www.touslesmatchs.com/live-ia">Live IA</a>
🤝 1 ami abonné = 1 mois offert → <a href="https://www.touslesmatchs.com/#plans">Partager</a>

<i>18+ · Jeu responsable · 09 74 75 13 13</i>`;

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
  await reply(chatId, ok ? `Pick publie sur le canal Elite (${PREMIUM_CHANNEL})` : `Erreur publication Elite (${PREMIUM_CHANNEL}) : ${err || "verifie que le bot est admin du canal"}`);
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
<b>Sport</b> : ${escapeHtml(signal.sport || "Football")}
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

async function cmdPronoStats(chatId) {
  try {
    const payload = JSON.stringify({ secret: TG_TOKEN });
    const raw = await new Promise((resolve, reject) => {
      const req = http.request(
        { hostname: "touslesmatchs-api", port: 3001, path: "/internal/prono-stats", method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
        res => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve(d)); }
      );
      req.on("error", reject);
      req.write(payload); req.end();
    });
    const data = JSON.parse(raw);
    if (!data.ok) { await reply(chatId, `❌ Prono stats : ${data.error}`); return; }

    const s = data.summary;
    const win = v => v != null ? `${v}%` : "—";

    // Résumé global
    let msg = `📊 <b>PRONO STATS — TousLesMatchs</b>\n\n`;
    msg += `🎯 Global : <b>${s.total_resolved}</b> pronos résolus — winrate <b>${win(s.winrate_global)}</b>\n`;
    msg += `📅 7 derniers jours : ${s.trend_7j.total} pronos → <b>${win(s.trend_7j.winrate)}</b>\n`;
    msg += `📅 30 derniers jours : ${s.trend_30j.total} pronos → <b>${win(s.trend_30j.winrate)}</b>\n\n`;

    // Par type de pari
    msg += `<b>🏷 Par type de pari</b>\n`;
    (data.by_category || []).filter(c => c.total >= 3).slice(0, 6).forEach(c => {
      const bar = c.winrate >= 60 ? "✅" : c.winrate >= 50 ? "⚠️" : "❌";
      msg += `${bar} <b>${c.category}</b> : ${win(c.winrate)} (${c.wins}/${c.total})\n`;
    });

    // Par pays
    if ((data.by_country || []).length > 0) {
      msg += `\n<b>🌍 Par pays</b>\n`;
      (data.by_country || []).filter(c => c.total >= 3).slice(0, 5).forEach(c => {
        const bar = c.winrate >= 60 ? "✅" : c.winrate >= 50 ? "⚠️" : "❌";
        msg += `${bar} ${c.country} : ${win(c.winrate)} (${c.wins}/${c.total})\n`;
      });
    }

    // Par niveau de confiance
    if ((data.by_confidence || []).length > 0) {
      msg += `\n<b>🎯 Par confiance</b>\n`;
      (data.by_confidence || []).forEach(c => {
        const bar = c.winrate >= 60 ? "✅" : c.winrate >= 50 ? "⚠️" : "❌";
        msg += `${bar} ${c.confidence} : ${win(c.winrate)} (${c.wins}/${c.total})\n`;
      });
    }

    // Meilleur agent par type de pari
    const bap = data.best_agent_per_category || {};
    if (Object.keys(bap).length > 0) {
      msg += `\n<b>🤖 Meilleur agent par marché</b>\n`;
      Object.entries(bap).slice(0, 6).forEach(([cat, info]) => {
        msg += `• ${cat} → <b>${info.agent}</b> ${win(info.winrate)} (${info.total} pronos)\n`;
      });
    }

    await reply(chatId, msg);

    // Derniers pronos
    if ((data.recent || []).length > 0) {
      let recent = `<b>📋 Derniers pronos résolus</b>\n\n`;
      data.recent.slice(0, 8).forEach(p => {
        const ico = p.outcome === "win" ? "✅" : "❌";
        recent += `${ico} <b>${escapeHtml(p.home)} vs ${escapeHtml(p.away)}</b>\n`;
        recent += `   ${p.bet || "—"} · ${p.confidence}% · ${p.category || "?"} · ${p.date || "?"}\n`;
        if (p.competition) recent += `   🏆 ${escapeHtml(p.competition)}${p.country ? " · " + p.country : ""}\n`;
        recent += "\n";
      });
      await reply(chatId, recent);
    }
  } catch (e) {
    await reply(chatId, `❌ Erreur prono-stats : ${e.message}`);
  }
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

<b>Sports</b>
<code>${escapeHtml(formatStrategyTop(report.top?.sports))}</code>

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
        // On stocke home/away/bet pour pouvoir poster le résultat plus tard
        // (preuve sociale : "le signal qu'on t'a montré a gagné").
        clientSent.unshift({
          id: signal.id, date: today, sentAt: new Date().toISOString(),
          channel: STRONG_ALERTS_CLIENT_CHANNEL,
          home: signal.home, away: signal.away, bet: signal.bet, sport: signal.sport,
          resultPosted: false,
        });
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
  const caption = formatClientStrongSignal(signal);
  const matchParam = encodeURIComponent(`${signal.home || ""} vs ${signal.away || ""}`);
  const liveIaUrl = `https://www.touslesmatchs.com/live-ia?match=${matchParam}`;
  const markup = bookmakerReplyMarkup([{ text: "Voir l'analyse Live IA", url: liveIaUrl }]);
  // Envoyer avec le blason si disponible
  const logoUrl = signal.home_logo || signal.away_logo || null;
  let sent;
  if (logoUrl) {
    sent = await sendTelegramPhotoWithToken(STRONG_ALERTS_CLIENT_TOKEN, STRONG_ALERTS_CLIENT_CHANNEL, logoUrl, caption, markup);
    if (!sent.ok) sent = await sendTelegramWithToken(STRONG_ALERTS_CLIENT_TOKEN, STRONG_ALERTS_CLIENT_CHANNEL, caption, { disable_web_page_preview: true, ...markup });
  } else {
    sent = await sendTelegramWithToken(STRONG_ALERTS_CLIENT_TOKEN, STRONG_ALERTS_CLIENT_CHANNEL, caption, { disable_web_page_preview: true, ...markup });
  }

  // Teaser canal public (Hermès free) — version courte sans le signal détaillé
  if (PUBLIC_BOT_TOKEN && PUBLIC_CHAT && STRONG_ALERTS_CLIENT_CHANNEL !== PUBLIC_CHAT) {
    const sport = signal.sport ? ` · ${escapeHtml(signal.sport)}` : "";
    const matchParamPublic = encodeURIComponent(`${signal.home || ""} vs ${signal.away || ""}`);
    const publicText = `🚨 <b>Signal fort détecté par le Concile IA</b>\n\n<b>${escapeHtml(signal.home)} vs ${escapeHtml(signal.away)}</b>${sport}\n${signal.minute ? `⏱ ${signal.minute}'` : "🔴 En direct"}\n\n<i>Confiance élevée — détails réservés aux abonnés Premium</i>\n\n📊 <a href="https://www.touslesmatchs.com/live-ia?match=${matchParamPublic}">Voir l'analyse Live IA</a>`;
    await sendTelegramWithToken(PUBLIC_BOT_TOKEN, PUBLIC_CHAT, publicText).catch(() => {});
  }

  // Email Brevo aux abonnés premium via API
  if (sent.ok && TG_TOKEN) {
    const apiPayload = JSON.stringify({ signal, secret: TG_TOKEN });
    const req = http.request({ hostname: "touslesmatchs-api", port: 3001, path: "/internal/signal-notify", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(apiPayload) } }, res => {
      res.resume();
      console.log(`[signal-notify] email HTTP ${res.statusCode}`);
    });
    req.on("error", e => console.error("[signal-notify] email:", e.message));
    req.write(apiPayload);
    req.end();
  }

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

async function cmdAddMonth(chatId, args) {
  // Usage: /addmonth email@... [refCode]
  // Prolonge l'abonnement d'un email de 30 jours (récompense parrainage manuel)
  const parts = (args || "").trim().split(/\s+/);
  const email = parts[0];
  if (!email || !email.includes("@")) {
    await reply(chatId, "Usage: /addmonth email@... [REF-CODE-OPTIONNEL]");
    return;
  }
  const refCode = parts[1] || null;
  const endpoint = refCode ? "/referral/confirm" : null;
  if (refCode && TG_TOKEN) {
    const payload = JSON.stringify({ refCode, newEmail: email, secret: TG_TOKEN });
    const r = await new Promise(resolve => {
      const req = http.request({ hostname: "touslesmatchs-api", port: 3001, path: "/referral/confirm", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } }, res => {
        let d = ""; res.on("data", c => d += c); res.on("end", () => resolve(JSON.parse(d || "{}")));
      });
      req.on("error", e => resolve({ ok: false, error: e.message }));
      req.write(payload); req.end();
    });
    await reply(chatId, r.ok ? `✅ ${email} crédité — parrain prolongé de 30 jours (code: ${refCode})` : `⚠️ ${r.message || r.error}`);
  } else {
    // Prolongation directe sans code de parrainage
    const payload = JSON.stringify({ refCode: "ADMIN-MANUAL", newEmail: email, secret: TG_TOKEN });
    // Appel direct API pour prolonger
    const r = await new Promise(resolve => {
      const req = http.request({ hostname: "touslesmatchs-api", port: 3001, path: "/referral/confirm", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } }, res => {
        let d = ""; res.on("data", c => d += c); res.on("end", () => resolve(JSON.parse(d || "{}")));
      });
      req.on("error", e => resolve({ ok: false, error: e.message }));
      req.write(payload); req.end();
    });
    await reply(chatId, `✅ 30 jours ajoutés pour ${email} (cadeau manuel admin)`);
  }
}

async function cmdConfirmRef(chatId, args) {
  // Usage: /confirmref REF-CODE-XXX email@abonne.com
  const parts = (args || "").trim().split(/\s+/);
  const [refCode, newEmail] = parts;
  if (!refCode || !newEmail) {
    await reply(chatId, "Usage: /confirmref REF-CODE-XXX email@nouvelab.com");
    return;
  }
  const payload = JSON.stringify({ refCode: refCode.toUpperCase(), newEmail: newEmail.toLowerCase(), secret: TG_TOKEN });
  const r = await new Promise(resolve => {
    const req = http.request({ hostname: "touslesmatchs-api", port: 3001, path: "/referral/confirm", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } }, res => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => resolve(JSON.parse(d || "{}")));
    });
    req.on("error", e => resolve({ ok: false, error: e.message }));
    req.write(payload); req.end();
  });
  await reply(chatId, r.ok ? `✅ Parrainage confirmé : ${refCode} → ${newEmail}\nParrain crédité de 30 jours + email envoyé.` : `⚠️ ${r.message || r.error}`);
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
  await reply(chatId, "\uD83D\uDE80 <b>D\u00E9ploiement en cours...</b>\nJe r\u00E9cup\u00E8re la derni\u00E8re version de Claude, \u00E7a prend 1-2 minutes.");
  try {
    const repoPath = REPO; // /repo dans le container
    const branch = "claude/happy-bell-h9zj83";

    execSync(`git -C ${repoPath} fetch origin ${branch} 2>&1`, { timeout: 30000 });
    execSync(`git -C ${repoPath} reset --hard origin/${branch} 2>&1`, { timeout: 30000 });

    const lastCommit = execSync(`git -C ${repoPath} log --oneline -1`, { timeout: 10000 }).toString().trim();

    await reply(chatId,
      `\u2705 <b>Code mis \u00E0 jour !</b>\n\n` +
      `\uD83D\uDCE6 Dernier commit : <code>${lastCommit}</code>\n\n` +
      `\uD83D\uDD04 Red\u00E9marrage des services site et api...`
    );

    // Docker socket mont\u00E9 dans le container \u2014 docker-compose.yml est \u00E0 /repo
    const { exec } = require("child_process");
    const dockerCmd = "docker compose -f /repo/docker-compose.yml up -d --force-recreate site api 2>&1";
    exec(dockerCmd, { timeout: 120000 }, async (err, stdout, stderr) => {
      if (err) {
        await reply(chatId,
          `\u26A0\uFE0F Red\u00E9marrage \u00E9chou\u00E9 :\n<code>${String(err.message).slice(0, 300)}</code>`
        ).catch(() => {});
      } else {
        await reply(chatId, `\u2705 <b>D\u00E9ploiement termin\u00E9 !</b>\n\uD83C\uDF10 touslesmatchs.com est \u00E0 jour.`).catch(() => {});
      }
    });

  } catch(e) {
    await reply(chatId, `\u274C Erreur d\u00E9ploiement :\n<code>${String(e.message).slice(0, 400)}</code>`);
  }
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

const STRATEGY_WATCH_FILE = path.join(REPO, "data/hermes_strategy_watch.json");
function loadStrategyWatchState() {
  try { return JSON.parse(fs.readFileSync(STRATEGY_WATCH_FILE, "utf8")); } catch { return {}; }
}
function saveStrategyWatchState(state) {
  try {
    fs.mkdirSync(path.dirname(STRATEGY_WATCH_FILE), { recursive: true });
    fs.writeFileSync(STRATEGY_WATCH_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {}
}

// Détecte si le marché le plus rentable a changé depuis la dernière fois et
// alerte Grégory — "Évolution permanente" : Hermès n'a pas besoin qu'on lui
// dise de changer de stratégie, il le fait tout seul dès que les données le
// justifient (voir strategyDirective, injectée dans chaque prompt de pick).
async function checkMarketStrategyShift(chatId) {
  try {
    delete require.cache[require.resolve("./hermes_learn.js")];
    const { generateMemory, computeMarketStrategy } = require("./hermes_learn.js");
    const memory = generateMemory();
    if (!memory) return;
    const strat = computeMarketStrategy(memory.by_prono_type);
    if (!strat) return;

    const state = loadStrategyWatchState();
    const newBest = strat.best.key;
    if (state.currentBest && state.currentBest !== newBest && chatId) {
      await reply(chatId, `📈 <b>Changement de stratégie détecté</b>\n\nLe marché le plus rentable n'est plus « <b>${escapeHtml(state.currentBest)}</b> » mais « <b>${escapeHtml(newBest)}</b> » (ROI ${strat.best.roiPct >= 0 ? "+" : ""}${strat.best.roiPct}%, ${strat.best.total} picks résolus).\n\nHermès va désormais le prioriser automatiquement dans ses prochains picks.`).catch(() => {});
    }
    if (state.currentBest !== newBest) {
      state.currentBest = newBest;
      state.updatedAt = new Date().toISOString();
      saveStrategyWatchState(state);
    }
  } catch (e) { console.error("[strategy-watch]", e.message); }
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
    await checkMarketStrategyShift(ADMIN_CHAT);
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
/publishalert — Republier manuellement la dernière alerte forte dans le groupe Elite
/learn — Analyser l'historique et mettre à jour la mémoire IA
/publishresult — Publier le résultat validé sur les canaux
/expiring — Lister les abonnements expirant dans les 7 prochains jours
/checkresult — Vérifier le score final via API et proposer /win ou /lose
/resolvehistory — Forcer la résolution des picks archivés restés "EN ATTENTE"
/preview — Prévisualiser les messages avant publication (gratuit + premium)
/publish — Publier sur le canal Telegram public (gratuit)
/publishpremium — Publier sur le canal Telegram Elite
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

// ── Vérification paiement Stripe pour les clients ─────────────────────────────
async function stripeGet(path) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.stripe.com",
      path,
      method: "GET",
      headers: { "Authorization": `Bearer ${STRIPE_KEY}` }
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on("error", () => resolve({}));
    req.end();
  });
}

async function cmdVerifyPayment(chatId, sessionId) {
  if (!STRIPE_KEY) {
    return reply(chatId, "⚠️ Vérification indisponible. Contacte le support sur @touslesmatchs_fr");
  }
  await reply(chatId, "⏳ Vérification de ton paiement en cours...");
  try {
    const session = await stripeGet(`/v1/checkout/sessions/${sessionId}?expand[]=line_items`);
    if (!session || session.error) {
      return reply(chatId, "❌ Session introuvable. Si tu viens de payer, attends 1 minute et tape /start verify_" + sessionId);
    }
    if (session.payment_status !== "paid") {
      return reply(chatId, "❌ Paiement non confirmé. Si tu viens de payer, attends quelques secondes puis réessaie en cliquant à nouveau sur le lien dans le mail de confirmation Stripe.");
    }
    const customerEmail = (session.customer_details?.email || "").toLowerCase().trim();
    if (!customerEmail) {
      return reply(chatId, "⚠️ Email non trouvé dans la session. Contacte le support.");
    }

    // Demander à l'API de créer le code si pas encore fait
    const apiRes = await new Promise((resolve) => {
      const data = JSON.stringify({ session_id: sessionId, email: customerEmail });
      const req = http.request({
        hostname: "touslesmatchs-api",
        port: 3001,
        path: "/internal/stripe-verify",
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data),
          "x-internal-secret": TG_TOKEN }
      }, res => { let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } }); });
      req.on("error", () => resolve({ ok: false }));
      req.write(data); req.end();
    });

    const code = apiRes.code || "";
    const plan = apiRes.plan || "premium";
    const planLabels = { carte: "Analyse 1€", premium: "Pro", vip: "VIP", elite: "Elite" };
    const planLabel = planLabels[plan] || plan;

    if (code) {
      await reply(chatId,
        `✅ <b>Paiement confirmé — Plan ${planLabel} !</b>\n\n` +
        `📧 Compte : <b>${customerEmail}</b>\n` +
        `🔑 Ton code d'accès : <code>${code}</code>\n\n` +
        `<b>Comment l'utiliser :</b>\n` +
        `1. Va sur <a href="https://touslesmatchs.com">touslesmatchs.com</a>\n` +
        `2. Clique sur "Se connecter"\n` +
        `3. Entre ton email + ce code\n\n` +
        `Un email de confirmation a aussi été envoyé à ${customerEmail}.\n` +
        `Bienvenue dans l'équipe ! 🚀`
      );
    } else {
      await reply(chatId,
        `✅ Paiement bien reçu pour <b>${customerEmail}</b> !\n\n` +
        `Ton code d'accès arrive par email dans quelques minutes.\n` +
        `Si tu ne reçois rien dans 10 minutes, contacte le support.`
      );
    }
  } catch(e) {
    console.error("[verify-payment]", e.message);
    await reply(chatId, "⚠️ Erreur technique. Ton paiement est bien enregistré — contacte le support si tu n'as pas reçu ton code.");
  }
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
    case "/checkresult":    return cmdCheckResult(chatId);
    case "/resolvehistory": return cmdResolveHistory(chatId);
    case "/expiring":       return cmdExpiring(chatId);
    case "/win":             return cmdResult(chatId, "GAGNE");
    case "/lose":            return cmdResult(chatId, "PERDU");
    case "/result":          return cmdResultPreview(chatId);
    case "/publishresult":   return cmdPublishResult(chatId);
    case "/record":          return cmdRecord(chatId, args);
    case "/addmonth":        return cmdAddMonth(chatId, args);
    case "/confirmref":      return cmdConfirmRef(chatId, args);
    case "/strategy":        return cmdStrategy(chatId);
    case "/pronos":
    case "/pronostats":      return cmdPronoStats(chatId);
    case "/alerts":          return cmdAlerts(chatId);
    case "/publishalert":    return cmdPublishAlert(chatId, args);
    case "/learn":           return cmdLearn(chatId);
    case "/preview":         return cmdPreview(chatId);
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

  // Vérification paiement Stripe — accessible à tous les utilisateurs
  const verifyMatch = text.match(/^\/start\s+verify_(.+)$/);
  if (verifyMatch) {
    return cmdVerifyPayment(chatId, verifyMatch[1].trim());
  }

  // Sécurité : seulement l'admin pour les autres commandes
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

// ── Bilan hebdomadaire automatique (lundi matin) ──────────────────────────────
const WEEKLY_BILAN_FILE = path.join(REPO, "data/hermes_weekly_bilan.json");

async function maybeRunWeeklyBilan() {
  const now = new Date();
  if (now.getDay() !== 1) return; // 1 = lundi
  const hour = now.getHours();
  if (hour < 9 || hour > 10) return; // entre 9h et 10h

  let state = {};
  try { state = JSON.parse(fs.readFileSync(WEEKLY_BILAN_FILE, "utf8")); } catch {}
  const todayStr = now.toISOString().slice(0, 10);
  if (state.lastBilanDate === todayStr) return;

  // Marquer comme envoyé
  try {
    fs.mkdirSync(path.dirname(WEEKLY_BILAN_FILE), { recursive: true });
    fs.writeFileSync(WEEKLY_BILAN_FILE, JSON.stringify({ lastBilanDate: todayStr }));
  } catch {}

  // Lire l'historique
  let picks = [];
  try {
    const data = loadPicks();
    picks = Array.isArray(data.history) ? data.history : [];
  } catch {}

  // Filtrer les 7 derniers jours
  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const week = picks.filter(p => {
    const d = historyDate(p);
    return d && d >= since;
  });

  const wins = week.filter(p => {
    const s = (Array.isArray(p) ? p[5] : p?.result || p?.status || "");
    return s === "GAGNE" || s === "win";
  });
  const losses = week.filter(p => {
    const s = (Array.isArray(p) ? p[5] : p?.result || p?.status || "");
    return s === "PERDU" || s === "loss";
  });
  const pending = week.length - wins.length - losses.length;
  const total = wins.length + losses.length;
  const winrate = total > 0 ? Math.round(wins.length / total * 100) : null;

  const emoji = winrate === null ? "📊" : winrate >= 60 ? "🔥" : winrate >= 50 ? "✅" : "📉";

  let msg = `${emoji} <b>Bilan de la semaine — TousLesMatchs</b>\n\n`;

  if (week.length === 0) {
    msg += `Aucun pick cette semaine.\n`;
  } else {
    msg += `📅 Du ${since} au ${todayStr}\n\n`;
    msg += `✅ Gagnés : <b>${wins.length}</b>\n`;
    msg += `❌ Perdus : <b>${losses.length}</b>\n`;
    if (pending > 0) msg += `⏳ En attente : <b>${pending}</b>\n`;
    if (winrate !== null) msg += `\n🎯 Winrate : <b>${winrate}%</b> (${total} picks résolus)\n`;

    // Meilleur pick de la semaine
    const bestWin = wins.reduce((best, p) => {
      const cote = parseFloat(Array.isArray(p) ? p[3] : p?.cote) || 0;
      return cote > (parseFloat(Array.isArray(best) ? best[3] : best?.cote) || 0) ? p : best;
    }, wins[0]);
    if (bestWin) {
      const name = historyMatchName(bestWin);
      const cote = Array.isArray(bestWin) ? bestWin[3] : bestWin?.cote;
      if (name) msg += `\n⭐ Meilleur pick : <b>${name}</b>${cote ? ` @${cote}` : ""}\n`;
    }
  }

  msg += `\n🤖 Analysé par 4 agents IA + 1 Chief\n`;
  msg += `📲 Picks complets → <a href="https://www.touslesmatchs.com/#plans">touslesmatchs.com</a>`;

  try {
    const token = PUBLIC_BOT_TOKEN || TG_TOKEN;
    const chat = PUBLIC_CHAT;
    if (token && chat) {
      await new Promise((resolve) => {
        const data = JSON.stringify({ chat_id: chat, text: msg, parse_mode: "HTML", disable_web_page_preview: true });
        const req = https.request({
          hostname: "api.telegram.org",
          path: `/bot${token}/sendMessage`,
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
        }, res => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve(JSON.parse(d))); });
        req.on("error", () => resolve({}));
        req.write(data); req.end();
      });
      console.log("[weekly-bilan] Publié sur le canal gratuit");
      if (ADMIN_CHAT) await reply(ADMIN_CHAT, "✅ Bilan hebdomadaire publié sur le canal gratuit.").catch(() => {});
    }
  } catch(e) { console.error("[weekly-bilan]", e.message); }

  // Alerte admin si un agent dépasse 70% winrate sur 10+ picks (privé, admin seulement)
  if (ADMIN_CHAT) {
    try {
      const d = await httpGet(`http://touslesmatchs-api:3001/agent-performance`).catch(() => null);
      if (d?.agents) {
        const stars = d.agents.filter(a => a.resolved >= 10 && a.winrate >= 70);
        if (stars.length) {
          let alertMsg = `🌟 <b>Alerte performance Concile</b>\n\n`;
          for (const a of stars) {
            alertMsg += `${a.winrate >= 80 ? "🔥🔥" : "🔥"} <b>${escapeHtml(a.name)}</b> : ${a.winrate}% winrate (${a.wins}/${a.resolved} picks)\n`;
          }
          alertMsg += `\nCes agents performent exceptionnellement — consider aligning the Chief to weight them higher.`;
          await reply(ADMIN_CHAT, alertMsg).catch(() => {});
        }
      }
    } catch(e) { console.error("[weekly-bilan agent alert]", e.message); }
  }
}

async function maybeAutoCheckResult() {
  if (!ADMIN_CHAT) return;
  const data = loadPicks();
  const p = data.currentPick;
  if (!p?.home || p.home === "PAS DE PICK") return;
  const status = String(p.status || "").toUpperCase();
  if (["GAGNE", "PERDU", "WIN", "LOSS"].includes(status)) return;

  // Vérifier si l'heure estimée de fin du match est passée (heure + 2h30)
  const now = parisNowParts();
  const timeStr = p.time || "";
  const timeMatch = timeStr.match(/(\d{1,2})[h:H](\d{2})?/);
  if (timeMatch) {
    const matchHour = parseInt(timeMatch[1]);
    const matchMin = parseInt(timeMatch[2] || "0");
    const endHour = matchHour + 2; // Match + 2h = fin probable avec débordements
    const currentMinutes = now.hour * 60 + now.minute;
    const endMinutes = endHour * 60 + matchMin;
    if (currentMinutes < endMinutes) return; // Match pas encore terminé
  } else if (p.date && p.date >= now.date) {
    // Pas d'heure exploitable ET le pick date d'aujourd'hui : on ne peut pas
    // savoir si le match est fini, on attend. Si le pick date d'hier ou avant,
    // on tente quand même la vérification (mieux que de rester bloqué à vie —
    // c'est ce qui arrivait avant : un pick sans heure valide n'était PLUS
    // JAMAIS revérifié).
    return;
  }

  // Ne pas relancer trop souvent — 30 min entre deux tentatives (au lieu de
  // 90) pour que le résultat soit intégré aux stats/Telegram plus vite une
  // fois le match terminé, sans spammer les APIs.
  const stateFile = path.join(REPO, "data/hermes_autoresult.json");
  let state = {};
  try { state = JSON.parse(fs.readFileSync(stateFile, "utf8")); } catch {}
  const pickKey = `${p.home}|${p.away}|${p.date}`;
  if (state.lastCheck === pickKey && state.checkedAt) {
    const minsSince = (Date.now() - new Date(state.checkedAt).getTime()) / 60000;
    if (minsSince < 30) return;
  }

  state.lastCheck = pickKey;
  state.checkedAt = new Date().toISOString();
  try { fs.mkdirSync(path.dirname(stateFile), { recursive: true }); fs.writeFileSync(stateFile, JSON.stringify(state)); } catch {}

  console.log(`[auto-result] Vérification score pour ${p.home} vs ${p.away}`);
  await cmdCheckResult(ADMIN_CHAT, true).catch(e => console.error("[auto-result]", e.message));
}

async function cmdResolveHistory(chatId) {
  await reply(chatId, "🔍 Vérification des picks archivés encore en attente...");
  const before = (loadPicks().history || []).filter(r => Array.isArray(r) && !["GAGNE","PERDU","WIN","LOSS"].includes(String(r[5]||"").toUpperCase())).length;
  await resolveStaleHistoryPicks();
  const after = (loadPicks().history || []).filter(r => Array.isArray(r) && !["GAGNE","PERDU","WIN","LOSS"].includes(String(r[5]||"").toUpperCase())).length;
  const resolved = before - after;
  if (resolved > 0) {
    await reply(chatId, `✅ ${resolved} pick(s) résolu(s). Détail envoyé ci-dessus.`);
  } else {
    await reply(chatId, `ℹ️ Rien à résoudre pour l'instant (${after} en attente — matchs pas encore terminés ou introuvables dans les APIs).`);
  }
}

// Rattrapage des picks ARCHIVÉS dans l'historique restés "EN ATTENTE".
// PROBLÈME CORRIGÉ : maybeAutoCheckResult() ne vérifiait QUE le pick du jour
// (data.currentPick). Dès qu'un nouveau pick était publié, l'ancien partait
// dans data.history (archiveCurrentPick) et n'était PLUS JAMAIS revérifié —
// il restait bloqué "EN ATTENTE" pour toujours, même des semaines après.
// Cette fonction balaie l'historique et résout ceux qui sont réellement finis.
let historyResolveRunning = false;
async function resolveStaleHistoryPicks() {
  if (historyResolveRunning) return;
  historyResolveRunning = true;
  try {
    const data = loadPicks();
    if (!Array.isArray(data.history) || !data.history.length) return;
    const now = parisNowParts();
    let resolvedCount = 0;
    const resolvedList = [];

    for (const row of data.history) {
      if (!Array.isArray(row)) continue; // format inattendu, on ignore
      const [date, matchName, prono, cote, , status] = row;
      if (["GAGNE", "PERDU", "WIN", "LOSS"].includes(String(status || "").toUpperCase())) continue;
      if (!date || date >= now.date) continue; // pas d'hier ou plus ancien → on laisse le temps
      const parts = String(matchName || "").split(" vs ");
      if (parts.length !== 2) continue;
      const [home, away] = parts.map(s => s.trim());
      if (!home || !away) continue;

      const found = await findFinalScoreForTeams(home, away);
      if (!found) continue;
      const autoResult = classifyAutoResult(prono, found.scoreHome, found.scoreAway, home);
      if (!autoResult) continue;

      row[4] = `${found.scoreHome}-${found.scoreAway}`;
      row[5] = autoResult;
      resolvedCount++;
      resolvedList.push(`${autoResult === "GAGNE" ? "✅" : "❌"} ${matchName} — ${row[4]} (${prono})`);
    }

    if (resolvedCount > 0) {
      savePicks(data);
      if (ADMIN_CHAT) {
        await reply(ADMIN_CHAT, `🔄 <b>Rattrapage historique</b> — ${resolvedCount} pick(s) archivé(s) résolu(s) :\n\n${resolvedList.join("\n")}`).catch(() => {});
      }
      console.log(`[history-catchup] ${resolvedCount} picks résolus`);
    }
  } catch (e) {
    console.error("[history-catchup]", e.message);
  } finally {
    historyResolveRunning = false;
  }
}

// Preuve sociale : quand un signal fort envoyé au groupe Free se termine, on
// poste le RÉSULTAT (gagné/perdu) — sans révéler le pari exact (qui reste
// Premium) — pour montrer aux membres gratuits que suivre le groupe aurait
// donné des paris gagnants. Honnête : on poste aussi les perdants (pas de
// fausse preuve), mais les gagnants font la démonstration commerciale.
let clientSignalResultRunning = false;
async function checkClientSignalResults() {
  if (clientSignalResultRunning || !PUBLIC_BOT_TOKEN || !PUBLIC_CHAT) return;
  clientSignalResultRunning = true;
  try {
    const state = loadStrongAlertsState();
    const clientSent = Array.isArray(state.clientSent) ? state.clientSent : [];
    let changed = false;

    for (const sig of clientSent) {
      if (sig.resultPosted || !sig.home || !sig.away || !sig.bet) continue;
      // Laisser le temps au match de finir (au moins ~3h après l'envoi)
      if (sig.sentAt && (Date.now() - new Date(sig.sentAt).getTime()) < 3 * 60 * 60 * 1000) continue;

      const found = await findFinalScoreForTeams(sig.home, sig.away);
      if (!found) continue;
      const outcome = classifyAutoResult(sig.bet, found.scoreHome, found.scoreAway, sig.home);
      if (!outcome) { sig.resultPosted = true; changed = true; continue; }

      const won = outcome === "GAGNE";
      const text = won
        ? `✅ <b>Signal fort GAGNÉ !</b>\n\n<b>${escapeHtml(sig.home)} vs ${escapeHtml(sig.away)}</b> — score final ${found.scoreHome}-${found.scoreAway}\n\nLe signal fort que le Concile a détecté en direct s'est confirmé. 📈\n\n💎 Les abonnés <b>Premium</b> avaient le pari exact + l'analyse complète.\n👉 <a href="https://www.touslesmatchs.com/#plans">Rejoins-les pour ne rien rater →</a>`
        : `📊 <b>Signal fort — résultat</b>\n\n<b>${escapeHtml(sig.home)} vs ${escapeHtml(sig.away)}</b> — score final ${found.scoreHome}-${found.scoreAway}\n\nCe signal n'est pas passé cette fois. On publie les résultats en toute transparence, gagnants comme perdants.`;

      await sendTelegramWithToken(PUBLIC_BOT_TOKEN, PUBLIC_CHAT, text).catch(() => {});
      sig.resultPosted = true;
      sig.outcome = outcome;
      changed = true;
    }

    if (changed) saveStrongAlertsState({ sent: state.sent || [], clientSent });
  } catch (e) {
    console.error("[signal-result]", e.message);
  } finally {
    clientSignalResultRunning = false;
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
  maybeRunWeeklyBilan().catch(e => console.error("weekly bilan:", e.message));
  setInterval(() => {
    maybeRunDailyAutoPick().catch(e => console.error("daily auto-pick:", e.message));
    maybeRunDailyStrategy().catch(e => console.error("daily strategy:", e.message));
    maybeRunWeeklyBilan().catch(e => console.error("weekly bilan:", e.message));
    maybeAutoCheckResult().catch(e => console.error("auto-result:", e.message));
  }, 60 * 1000);
  setInterval(() => {
    scanStrongSignals().catch(e => console.error("strong signals:", e.message));
  }, STRONG_ALERTS_INTERVAL_MS);
  setTimeout(() => resolveStaleHistoryPicks().catch(e => console.error("history-catchup:", e.message)), 30 * 1000);
  setInterval(() => {
    resolveStaleHistoryPicks().catch(e => console.error("history-catchup:", e.message));
    checkClientSignalResults().catch(e => console.error("signal-result:", e.message));
  }, 30 * 60 * 1000);

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

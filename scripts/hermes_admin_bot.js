// HERMÈS ADMIN BOT — Bot Telegram d'administration TousLesMatchs
// Commandes admin : /status /analyse /setpick /setscore /win /lose /publish /help
"use strict";
const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ── Config ──────────────────────────────────────────────────────────────────
const TG_TOKEN    = process.env.HERMES_ADMIN_TLM_BOT;
const ADMIN_CHAT  = process.env.TELEGRAM_ADMIN_CHAT_ID;
const GROQ_KEY    = process.env.GROQ_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const FD_KEY      = process.env.FOOTBALL_DATA_KEY || process.env.FOOTBALL_DATA_API_KEY;
const SPORTS_KEY  = process.env.API_SPORTS_KEY;
const PUBLIC_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PUBLIC_CHAT = process.env.TELEGRAM_CHAT_ID || "@touslesmatchs_fr";
const ADMIN_USER_ID = "309921562";

const REPO        = "/repo";
const PICKS_FILE  = path.join(REPO, "public/data/picks.json");
const DATA_FILE   = path.join(REPO, "data/picks.json");
const MEMORY_FILE = path.join(REPO, "data/hermes_memory.json");

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
  try { return JSON.parse(fs.readFileSync(PICKS_FILE, "utf8")); } catch { return { currentPick: {}, history: [] }; }
}

function savePicks(data) {
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(PICKS_FILE, json, "utf8");
  try { fs.mkdirSync(path.join(REPO, "data"), { recursive: true }); fs.writeFileSync(DATA_FILE, json, "utf8"); } catch {}
}

function archiveCurrentPick(data) {
  const p = data.currentPick;
  if (!p || !p.home || p.home === "Analyse en cours") return;
  if (!data.history) data.history = [];
  const exists = data.history.find(h => h.date === p.date && h.home === p.home && h.away === p.away);
  if (!exists) data.history.unshift({ ...p });
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
async function fetchTodayMatches() {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  // football-data.org
  if (FD_KEY) {
    try {
      const d = await httpGet(`https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${tomorrow}`, { "X-Auth-Token": FD_KEY });
      const matches = (d.matches || []).filter(m => !["FINISHED","CANCELLED","POSTPONED"].includes(m.status));
      if (matches.length) {
        console.log(`  football-data.org: ${matches.length} match(s)`);
        return matches.map(m => ({
          home: m.homeTeam.name, away: m.awayTeam.name,
          heure: m.utcDate ? new Date(m.utcDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":", "h") : "?",
          competition: m.competition?.name || "Football",
          leagueId: m.competition?.id || 0,
          arjel: true
        }));
      }
    } catch (e) { console.error("  football-data.org:", e.message); }
  }

  // API-Sports fallback
  if (SPORTS_KEY) {
    try {
      const d = await httpGet(`https://v3.football.api-sports.io/fixtures?date=${today}`, { "x-apisports-key": SPORTS_KEY });
      const fixtures = (d.response || []).filter(f => !["FT","AET","PEN","CANC","PST","ABD","INT"].includes(f.fixture?.status?.short));
      if (fixtures.length) {
        console.log(`  API-Sports: ${fixtures.length} match(s)`);
        return fixtures.map(f => ({
          home: f.teams?.home?.name, away: f.teams?.away?.name,
          heure: f.fixture?.date ? new Date(f.fixture.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":", "h") : "?",
          competition: f.league?.name || "Football",
          leagueId: f.league?.id || 0,
          arjel: true
        }));
      }
    } catch (e) { console.error("  API-Sports:", e.message); }
  }

  return [];
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
const HERMES_PROMPT = (matches) => `Tu es HERMÈS, expert en pronostics sportifs pour TousLesMatchs.
${memoryBlock()}
MATCHS DISPONIBLES AUJOURD'HUI :
${JSON.stringify(matches, null, 2)}

RÈGLES DE SÉLECTION :
- ACCEPTER : toutes grandes compétitions officielles (Coupes du Monde, Euro, Copa América, Champions League, championnats nationaux Top 5, Coupe du Monde FIFA toutes phases)
- REFUSER UNIQUEMENT : matchs amicaux sans enjeu, U17/U18/U20/U23, matchs de gala/exhibition
- Phase de groupes Coupe du Monde = enjeu réel (qualification en jeu) → ACCEPTER
- Note minimale pour publier : 6.5/10 (pas 7.0)
- Barème : commence à 5.5, +0.5 pour chaque avantage concret (forme récente, domicile, H2H, enjeu vital, classement FIFA)
- La cote estimée doit être dans la fourchette 1.35 à 2.50 selon ton analyse (tu estimes la cote probable)

RÉPONDS EN JSON STRICT :
{
  "pick": {
    "home": "Équipe A",
    "away": "Équipe B",
    "league": "Nom de la compétition",
    "time": "20h45",
    "prono": "Victoire Équipe A",
    "bet": "Victoire Équipe A",
    "cote": 1.65,
    "note": 7.5,
    "raison": "Explication en 1 phrase avec stat concrète (ex: 5 victoires consécutives, classement FIFA)"
  },
  "nopick_raison": null
}

Si VRAIMENT aucun match ne mérite (uniquement amicaux/U20/etc.) :
{
  "pick": null,
  "nopick_raison": "Explication précise"
}`;

async function runAnalyse(chatId) {
  await reply(chatId, "🔍 <b>Analyse en cours...</b>\nRécupération des matchs du jour...");

  const matches = await fetchTodayMatches();
  if (!matches.length) {
    await reply(chatId, "⚠️ <b>Aucun match disponible</b>\nLes APIs ne retournent pas de matchs pour aujourd'hui.\nUtilise /setpick pour définir manuellement.");
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
      nopick_raison: raison
    };
    savePicks(data);
    return;
  }

  const p = result.pick;
  const data = loadPicks();
  archiveCurrentPick(data);
  data.currentPick = {
    date: new Date().toISOString().slice(0, 10),
    home: p.home || "",
    away: p.away || "",
    league: p.league || "Football",
    time: p.time || "",
    prono: p.prono || `Victoire ${p.home}`,
    bet: p.bet || p.prono || `Victoire ${p.home}`,
    cote: String(p.cote || ""),
    confidence: p.note || 0,
    confidenceTg: `${p.note || ""}/10`,
    status: "EN ATTENTE",
    score: ""
  };
  savePicks(data);

  const msg = `✅ <b>PICK GÉNÉRÉ par ${provider}</b>

⚽ <b>${p.home} vs ${p.away}</b>
🏆 ${p.league || ""}  🕐 ${p.time || ""}
🎯 <b>${p.prono || p.bet}</b> @ <b>${p.cote}</b>
📊 Note Hermès : <b>${p.note}/10</b>
💡 ${p.raison || ""}

✅ Pick sauvegardé dans picks.json
Tape /publish pour envoyer sur le canal public.`;

  await reply(chatId, msg);
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
  const data = loadPicks();
  archiveCurrentPick(data);
  data.currentPick = {
    date: new Date().toISOString().slice(0, 10),
    home, away, league, time, prono, bet: prono,
    cote: String(cote), status: "EN ATTENTE", score: ""
  };
  savePicks(data);
  await reply(chatId, `✅ <b>Pick défini manuellement</b>\n\n⚽ <b>${home} vs ${away}</b>\n🏆 ${league}  🕐 ${time}\n🎯 ${prono} @ ${cote}`);
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
  // Archive avec résultat
  if (!data.history) data.history = [];
  const idx = data.history.findIndex(h => h.date === data.currentPick.date && h.home === data.currentPick.home);
  if (idx >= 0) data.history[idx] = { ...data.currentPick };
  else data.history.unshift({ ...data.currentPick });
  savePicks(data);
  const emoji = status === "GAGNE" ? "🏆" : "❌";
  await reply(chatId, `${emoji} Pick marqué <b>${status}</b>\n${data.currentPick.home} vs ${data.currentPick.away} — ${data.currentPick.score || "?"}`);

  // Auto-apprentissage après chaque résultat
  try {
    const { generateMemory } = require("./hermes_learn.js");
    generateMemory();
    console.log("🧠 Mémoire Hermès mise à jour");
  } catch (e) { console.error("hermes_learn:", e.message); }
}

async function cmdPublish(chatId) {
  if (!PUBLIC_BOT_TOKEN) { await reply(chatId, "❌ TELEGRAM_BOT_TOKEN manquant"); return; }
  const data = loadPicks();
  const p = data.currentPick;
  if (!p?.home || p.home === "PAS DE PICK") { await reply(chatId, "❌ Aucun pick à publier"); return; }

  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const text = `🔥 <b>Pick IA du jour — ${today}</b>

🏟️ <b>${p.home} vs ${p.away}</b>
🏆 ${p.league || ""}
🕒 ${p.time || ""}

🎯 <b>Pronostic :</b> ${p.prono || p.bet || ""}
📊 <b>Cote :</b> ${p.cote || ""}
✅ <b>Confiance Hermès :</b> ${p.confidenceTg || ""}

🔎 Analyse complète : https://www.touslesmatchs.com

⚠️ 18+ uniquement. Jeu responsable.`;

  const body = JSON.stringify({ chat_id: PUBLIC_CHAT, text, parse_mode: "HTML", disable_web_page_preview: false });
  await new Promise((resolve) => {
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${PUBLIC_BOT_TOKEN}/sendMessage`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, res => { res.on("data", () => {}); res.on("end", resolve); });
    req.on("error", resolve);
    req.write(body); req.end();
  });
  await reply(chatId, `✅ Pick publié sur ${PUBLIC_CHAT}`);
}

async function cmdDeploy(chatId) {
  await reply(chatId, "🔄 <b>Déploiement en cours...</b>");
  try {
    execSync("cd /repo && git pull origin $(git branch --show-current) 2>&1", { timeout: 30000 });
    await reply(chatId, "✅ git pull OK\n⚠️ Rebuild Docker non disponible depuis ce container.\nFais : <code>docker compose up -d --build site api</code> depuis le VPS");
  } catch (e) {
    await reply(chatId, `❌ git pull échoué :\n<code>${e.message.slice(0, 300)}</code>`);
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
/learn — Analyser l'historique et mettre à jour la mémoire IA
/publish — Publier sur le canal Telegram public
/deploy — git pull sur le VPS
/help — Cette aide`);
}

// ── Message router ────────────────────────────────────────────────────────────
async function handleMessage(msg) {
  const chatId = String(msg.chat?.id);
  const fromId = String(msg.from?.id);
  const text   = (msg.text || "").trim();

  // Sécurité : seulement l'admin
  if (fromId !== ADMIN_USER_ID) {
    console.log(`  ⚠️ Message ignoré de user ${fromId}`);
    return;
  }

  const [cmd, ...rest] = text.split(" ");
  const args = rest.join(" ");

  console.log(`[CMD] ${cmd} ${args}`);

  switch (cmd.toLowerCase()) {
    case "/status":   return cmdStatus(chatId);
    case "/analyse":
    case "/pick":     return runAnalyse(chatId);
    case "/setpick":  return cmdSetPick(chatId, args);
    case "/setscore": return cmdSetScore(chatId, args);
    case "/win":      return cmdResult(chatId, "GAGNE");
    case "/lose":     return cmdResult(chatId, "PERDU");
    case "/learn":    return cmdLearn(chatId);
    case "/publish":  return cmdPublish(chatId);
    case "/deploy":   return cmdDeploy(chatId);
    case "/help":
    default:          return cmdHelp(chatId);
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

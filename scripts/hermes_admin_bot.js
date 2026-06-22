// HERMÈS ADMIN BOT — Bot Telegram d'administration TousLesMatchs
// Commandes admin : /status /analyse /setpick /setscore /win /lose /publish /publishpremium /help
"use strict";
const https = require("https");
const http  = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ── Config ──────────────────────────────────────────────────────────────────
const TG_TOKEN          = process.env.HERMES_ADMIN_TLM_BOT;
const ADMIN_CHAT        = process.env.TELEGRAM_ADMIN_CHAT_ID;
const PREMIUM_CHANNEL   = process.env.TELEGRAM_PREMIUM_CHANNEL_ID;
const GROQ_KEY    = process.env.GROQ_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

// ── Liens bookmakers (affiliation) ───────────────────────────────────────────
const BOOKMAKERS_MSG = `\n\n🎰 <b>Pariez maintenant :</b>\n<a href="https://www.winamax.fr/parrain?code=77953728">🔴 Winamax</a> · <a href="https://www.betclic.fr/fr-fr/sports/?promocode=GREGA3GZ">🔵 Betclic</a> · <a href="https://www.unibet.fr/inscription/?campaign=120526&parrain=5EBF919DF1008254">🟢 Unibet</a> · <a href="https://www.pmu.fr/turf/static/offre-parrainage/?codeParrainage=779753728">🟡 PMU</a>`;
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

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function httpGetInternal(apiPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "touslesmatchs-api", port: 3001, path: apiPath, method: "GET",
      headers: { "Content-Type": "application/json", ...headers }
    }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { reject(new Error("parse")); } });
    });
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject); req.end();
  });
}

function httpPostInternal(apiPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: "touslesmatchs-api", port: 3001, path: apiPath, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data), ...headers }
    }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { reject(new Error("parse")); } });
    });
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject); req.write(data); req.end();
  });
}

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
          competition: f.league?.name || "Football", arjel: true
        }));
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
          return { sport: sportLabel, home, away, heure, competition: league, arjel: true };
        })
        .filter(Boolean);
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
          competition: m.competition?.name || "Football", arjel: true
        }));
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
MATCHS DISPONIBLES AUJOURD'HUI :
${JSON.stringify(matches, null, 2)}
${neutralWarning(matches)}

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
    "home": "Équipe A",
    "away": "Équipe B",
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
  const alts = result.alternatives || [];
  const data = loadPicks();
  archiveCurrentPick(data);
  data.currentPick = {
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
    score: ""
  };
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

✅ Pick sauvegardé. Tape /publish pour le canal public · /publishpremium pour Premium.`;

  await reply(chatId, msg);

  // Publication automatique sur les deux canaux Telegram
  await reply(chatId, "📤 <b>Publication automatique en cours...</b>");
  await doPublishFree(data.currentPick, chatId);
  await doPublishPremium(data.currentPick, chatId);

  // Notification email automatique aux abonnés payants
  try {
    const emailResult = await notifyPickByEmail(data.currentPick);
    if (emailResult.ok && emailResult.sent > 0) {
      await reply(chatId, `📧 Emails envoyés à <b>${emailResult.sent}</b> abonné(s) payant(s)`);
    }
  } catch (e) {
    console.error("[hermes] notifyPickByEmail:", e.message);
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
  const data = loadPicks();
  archiveCurrentPick(data);
  data.currentPick = {
    date: new Date().toISOString().slice(0, 10),
    home, away, league, time, prono, bet: prono,
    cote: String(cote), status: "EN ATTENTE", score: ""
  };
  savePicks(data);
  await reply(chatId, `✅ <b>Pick défini manuellement</b>\n\n⚽ <b>${home} vs ${away}</b>\n🏆 ${league}  🕐 ${time}\n🎯 ${prono} @ ${cote}\n\n📤 Publication sur les canaux...`);
  await doPublishFree(data.currentPick, chatId);
  await doPublishPremium(data.currentPick, chatId);
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

// ── Envoi Telegram générique (retourne {ok, error_code, description}) ─────────
async function tgSend(botToken, targetChat, text) {
  const body = JSON.stringify({ chat_id: targetChat, text, parse_mode: "HTML", disable_web_page_preview: true });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${botToken}/sendMessage`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({ ok: false, description: "parse error" }); } });
    });
    req.on("error", (e) => resolve({ ok: false, description: e.message }));
    req.write(body); req.end();
  });
}

function tgHint(r) {
  if (!r || r.ok) return "";
  const code = r.error_code || "";
  const desc = r.description || "Erreur inconnue";
  if (code === 400 && desc.includes("chat not found")) return "\n→ Canal introuvable — vérifie TELEGRAM_CHAT_ID dans le .env";
  if (code === 403) return "\n→ Bot pas admin du canal — ajoute-le comme admin dans les paramètres du canal";
  if (!code) return "\n→ Token invalide ? Vérifie le .env";
  return `\n→ ${desc}`;
}

// ── Publication pick GRATUIT ───────────────────────────────────────────────────
async function doPublishFree(p, adminChatId) {
  if (!PUBLIC_BOT_TOKEN) {
    if (adminChatId) await reply(adminChatId, "⚠️ Canal public : <code>TELEGRAM_BOT_TOKEN</code> manquant dans le .env");
    return { ok: false, reason: "no_token" };
  }
  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const text = `🔥 <b>Pick IA du jour — ${today}</b>

🏟️ <b>${p.home} vs ${p.away}</b>
🏆 ${p.league || ""}  🕒 ${p.time || ""}

🎯 <b>Pronostic :</b> ${p.prono || p.bet || ""}
📊 <b>Cote :</b> ${p.cote || ""}
✅ <b>Confiance Hermès :</b> ${p.confidenceTg || ""}

🔎 Analyse complète : https://www.touslesmatchs.com${BOOKMAKERS_MSG}

⚠️ 18+ uniquement. Jeu responsable.`;

  const r = await tgSend(PUBLIC_BOT_TOKEN, PUBLIC_CHAT, text);
  if (adminChatId) {
    if (r.ok) await reply(adminChatId, `✅ Pick publié sur le canal gratuit <b>${PUBLIC_CHAT}</b>`);
    else await reply(adminChatId, `❌ Canal gratuit — Erreur ${r.error_code || "?"} : ${r.description || "?"}${tgHint(r)}`);
  }
  return r;
}

// ── Publication pick PREMIUM ───────────────────────────────────────────────────
async function doPublishPremium(p, adminChatId) {
  if (!PREMIUM_CHANNEL) {
    if (adminChatId) await reply(adminChatId, "⚠️ Canal premium : <code>TELEGRAM_PREMIUM_CHANNEL_ID</code> manquant dans le .env");
    return { ok: false, reason: "no_channel" };
  }
  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const edgeStr = p.edge ? ` · Edge: +${Math.round(p.edge * 100)}%` : "";
  const probStr = p.probabilite_estimee ? `\n📈 Proba estimée : <b>${p.probabilite_estimee}%</b>${edgeStr}` : "";
  const text = `🏆 <b>Pick PREMIUM du jour — ${today}</b>

🏟️ <b>${p.home} vs ${p.away}</b>
🏆 ${p.league || ""}  🕒 ${p.time || ""}

🎯 <b>Pronostic :</b> ${p.prono || p.bet || ""}
📊 <b>Cote :</b> <b>${p.cote || ""}</b>
✅ <b>Confiance Concile :</b> ${p.confidenceTg || ""}${probStr}
${p.raison ? `\n💡 <i>${p.raison}</i>` : ""}
🔎 Analyse complète : https://www.touslesmatchs.com/live-ia${BOOKMAKERS_MSG}

⚠️ 18+ uniquement. Jeu responsable.`;

  const r = await tgSend(TG_TOKEN, PREMIUM_CHANNEL, text);
  if (adminChatId) {
    if (r.ok) await reply(adminChatId, `✅ Pick publié sur le canal Premium <b>${PREMIUM_CHANNEL}</b>`);
    else await reply(adminChatId, `❌ Canal premium — Erreur ${r.error_code || "?"} : ${r.description || "?"}${tgHint(r)}`);
  }
  return r;
}

async function cmdPublish(chatId) {
  const data = loadPicks();
  const p = data.currentPick;
  if (!p?.home || p.home === "PAS DE PICK") { await reply(chatId, "❌ Aucun pick à publier — définis-en un avec /setpick ou /analyse"); return; }
  await doPublishFree(p, chatId);
}

async function cmdPublishPremium(chatId) {
  const data = loadPicks();
  const p = data.currentPick;
  if (!p?.home || p.home === "PAS DE PICK") { await reply(chatId, "❌ Aucun pick à publier"); return; }
  await doPublishPremium(p, chatId);
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

async function cmdDeploy(chatId) {
  await reply(chatId, "🔄 <b>Déploiement en cours...</b>");
  try {
    execSync("cd /repo && git pull origin $(git branch --show-current) 2>&1", { timeout: 30000 });
    await reply(chatId, "✅ git pull OK\n⚠️ Rebuild Docker non disponible depuis ce container.\nFais : <code>docker compose up -d --build site api</code> depuis le VPS");
  } catch (e) {
    await reply(chatId, `❌ git pull échoué :\n<code>${e.message.slice(0, 300)}</code>`);
  }
}

async function cmdMemoire(chatId) {
  await reply(chatId, "🧠 <b>Chargement de la mémoire Hermès...</b>");
  try {
    const data = await httpGetInternal("/admin/analysis-performance", { "x-hermes-token": TG_TOKEN });
    if (!data.ok) return reply(chatId, `❌ Erreur: ${data.error}`);

    const { totals, byBet, byCompetition, recent } = data;
    const resolved = (totals.wins || 0) + (totals.losses || 0);
    const globalWR = resolved > 0 ? Math.round(totals.wins / resolved * 100) : "—";

    let msg = `🧠 <b>MÉMOIRE HERMÈS — Performances</b>\n\n`;
    msg += `📊 <b>Global :</b> ${totals.total} analyses — ${totals.wins}W / ${totals.losses}L / ${totals.pending} en attente\n`;
    msg += `🎯 <b>Winrate global :</b> ${globalWR}%\n\n`;

    if (byBet && byBet.length) {
      msg += `<b>Par type de pari :</b>\n`;
      byBet.forEach(r => {
        const res = (r.wins || 0) + (r.losses || 0);
        const wr = res > 0 ? Math.round(r.wins / res * 100) : "—";
        const icon = wr >= 65 ? "✅" : wr >= 50 ? "⚠️" : (wr === "—" ? "⏳" : "❌");
        msg += `${icon} ${r.bet}: ${wr}% (${r.wins}W/${r.losses}L, ${r.pending} en att.)\n`;
      });
    }

    if (byCompetition && byCompetition.length) {
      msg += `\n<b>Par compétition :</b>\n`;
      byCompetition.forEach(r => {
        const res = (r.wins || 0) + (r.losses || 0);
        const wr = res > 0 ? Math.round(r.wins / res * 100) : "—";
        msg += `  ${r.competition}: ${wr}% (${res} résolus)\n`;
      });
    }

    if (recent && recent.length) {
      msg += `\n<b>Dernières analyses :</b>\n`;
      recent.slice(0, 5).forEach(r => {
        const icon = r.outcome === "win" ? "✅" : r.outcome === "loss" ? "❌" : "⏳";
        const score = r.outcome ? `${r.score_home}-${r.score_away}` : `${r.score_home}-${r.score_away}@${r.minute}'`;
        msg += `${icon} ${r.home} vs ${r.away} (${score}) → ${r.bet}\n`;
      });
    }

    await reply(chatId, msg);
  } catch(e) {
    await reply(chatId, `❌ Erreur mémoire: ${e.message}`);
  }
}

// ── Statut de l'auto-analyse ─────────────────────────────────────────────────
async function cmdAutoAnalyse(chatId) {
  try {
    const data = await httpGetInternal("/admin/auto-analyse-status", { "x-hermes-token": TG_TOKEN });
    if (!data.ok) return reply(chatId, `❌ Erreur: ${data.error}`);

    let msg = `🤖 <b>AUTO-ANALYSE — Statut</b>\n\n`;
    msg += `📊 Analyses automatiques effectuées : <b>${data.total_auto}</b>\n`;
    const mins = Math.floor(data.next_run_in_seconds / 60);
    const secs = data.next_run_in_seconds % 60;
    msg += `⏱️ Prochain run dans : ${mins}m${secs}s\n\n`;

    if (data.last_runs && data.last_runs.length) {
      msg += `<b>5 dernières analyses auto :</b>\n`;
      data.last_runs.forEach(r => {
        msg += `  🔍 ${r.home} vs ${r.away} (${r.minute}') → ${r.bet} (${r.confidence}%)\n`;
      });
    } else {
      msg += `Aucune analyse auto encore effectuée.\n`;
      msg += `Le premier run se lance 30s après le démarrage du serveur, puis toutes les 10 min.`;
    }

    await reply(chatId, msg);
  } catch(e) {
    await reply(chatId, `❌ Erreur: ${e.message}`);
  }
}

// ── Résolution manuelle d'un match terminé ────────────────────────────────────
// Syntaxe : /resolve Japon|Tunisie|4|0
async function cmdResolve(chatId, args) {
  const parts = args.split("|").map(s => s.trim());
  if (parts.length < 4) {
    return reply(chatId, `❌ Syntaxe : <code>/resolve Equipe1|Equipe2|score1|score2</code>\nExemple : <code>/resolve Japon|Tunisie|4|0</code>`);
  }
  const [home, away, sh, sa] = parts;
  const score_home = parseInt(sh), score_away = parseInt(sa);
  if (isNaN(score_home) || isNaN(score_away)) {
    return reply(chatId, `❌ Scores invalides : "${sh}" et "${sa}" doivent être des nombres.`);
  }

  try {
    // 1. Résoudre dans la DB
    const data = await httpPostInternal("/internal/resolve-analysis",
      { home, away, score_home, score_away },
      { "x-hermes-token": TG_TOKEN }
    );
    if (!data.ok) return reply(chatId, `❌ Erreur: ${data.error}`);

    // 2. Récupérer les prédictions résolues pour ce match (uniquement les paris prédits)
    const perfData = await httpGetInternal(
      `/admin/analysis-performance`,
      { "x-hermes-token": TG_TOKEN }
    );

    // Trouver dans les analyses récentes ce match spécifiquement
    const matchPreds = (perfData.recent || []).filter(r =>
      r.home.toLowerCase().includes(home.toLowerCase().split(' ')[0]) ||
      r.away.toLowerCase().includes(away.toLowerCase().split(' ')[0])
    );

    // Construire le rapport : uniquement les paris qui ont été prédits
    let adminMsg = `✅ <b>Résolution enregistrée</b>\n`;
    adminMsg += `⚽ <b>${home} ${score_home}–${score_away} ${away}</b>\n\n`;

    if (matchPreds.length > 0) {
      adminMsg += `<b>Prédictions du Concile :</b>\n`;
      matchPreds.forEach(r => {
        const icon = r.outcome === 'win' ? '✅ GAGNÉ' : r.outcome === 'loss' ? '❌ PERDU' : '⏳ en attente';
        adminMsg += `  ${icon} — ${r.bet} (${r.confidence}%) [${r.source}]\n`;
      });
    } else {
      adminMsg += `ℹ️ Aucune prédiction enregistrée trouvée pour ce match.\n`;
    }
    adminMsg += `\n📊 Stats /memoire mises à jour.`;
    await reply(chatId, adminMsg);

    // 3. Publier le résultat sur les canaux Telegram (gratuit + premium)
    const wins = matchPreds.filter(r => r.outcome === 'win');
    const losses = matchPreds.filter(r => r.outcome === 'loss');

    if (matchPreds.length > 0) {
      // Prendre la prédiction la plus confiante
      const mainPred = [...matchPreds].sort((a,b) => b.confidence - a.confidence)[0];
      const isWin = mainPred.outcome === 'win';
      const resultIcon = isWin ? '✅' : '❌';
      const resultLabel = isWin ? 'GAGNÉ !' : 'PERDU';

      const pubMsg = `${resultIcon} <b>RÉSULTAT — ${home} vs ${away}</b>\n\n` +
        `⚽ Score final : <b>${score_home}–${score_away}</b>\n` +
        `🎯 Notre pari : <b>${mainPred.bet}</b>\n` +
        `📊 Confiance Concile : ${mainPred.confidence}%\n\n` +
        `<b>${resultIcon} ${resultLabel}</b>\n\n` +
        (isWin
          ? `💰 Félicitations à tous ceux qui ont suivi le Concile !\n`
          : `📉 Pas de chance cette fois. Le Concile analyse pour mieux prédire.\n`) +
        BOOKMAKERS_MSG;

      // Publier sur canal gratuit
      if (PUBLIC_BOT_TOKEN) {
        const rFree = await tgSend(PUBLIC_BOT_TOKEN, PUBLIC_CHAT, pubMsg);
        await reply(chatId, rFree.ok
          ? `✅ Résultat publié sur le canal gratuit ${PUBLIC_CHAT}`
          : `❌ Canal gratuit — ${rFree.description || 'erreur'}${tgHint(rFree)}`);
      }
      // Publier sur canal premium
      if (PREMIUM_CHANNEL) {
        const rPrem = await tgSend(TG_TOKEN, PREMIUM_CHANNEL, pubMsg);
        await reply(chatId, rPrem.ok
          ? `✅ Résultat publié sur le canal premium ${PREMIUM_CHANNEL}`
          : `❌ Canal premium — ${rPrem.description || 'erreur'}${tgHint(rPrem)}`);
      }
    }
  } catch(e) {
    await reply(chatId, `❌ Erreur: ${e.message}`);
  }
}

// ── Live pick manuel — analyse Concile + publication immédiate ────────────────
async function cmdLivePick(chatId, args) {
  // Syntaxe : /livepick Japon|Tunisie|FIFA World Cup|4-0|85|Victoire extérieur
  // Champs : home|away|compétition|score|minute|pari (pari optionnel → Concile décide)
  const parts = args.split("|").map(s => s.trim());
  if (parts.length < 2) {
    await reply(chatId, `❌ Syntaxe : <code>/livepick Japon|Tunisie|FIFA World Cup|4-0|85</code>\nLe Concile choisit le pari automatiquement.`);
    return;
  }
  const [home, away, competition = "International", scoreStr = "0-0", minuteStr = "50"] = parts;
  const [sh, sa] = scoreStr.split("-").map(Number);
  const minute = parseInt(minuteStr) || 50;

  await reply(chatId, `🧠 <b>Concile Live en cours...</b>\n⚽ ${home} vs ${away} (${sh}-${sa} à la ${minute}')`);

  // Appel API interne Concile
  const matchBody = JSON.stringify({
    email: "hermes@admin", code: "internal",
    match: { home, away, competition, score_home: sh, score_away: sa, minute, status: "IN_PLAY" },
    force: true
  });

  let analysis = null;
  await new Promise((resolve) => {
    const req = http.request({
      hostname: "touslesmatchs-api", port: 3001,
      path: "/concile-analysis", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(matchBody) }
    }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { analysis = JSON.parse(d); } catch {} resolve(); });
    });
    req.setTimeout(60000, () => { req.destroy(); resolve(); });
    req.on("error", () => resolve());
    req.write(matchBody); req.end();
  });

  if (!analysis?.ok) {
    await reply(chatId, `❌ Concile échoué : ${analysis?.error || "Timeout ou API indisponible"}`);
    return;
  }

  const a = analysis;
  const votes = a.agents?.map(ag => `${ag.icon} ${ag.name}: <b>${ag.bet}</b> (${ag.confidence}%)`).join("\n") || "";
  const consensus = a.consensus_votes || 0;

  await reply(chatId, `✅ <b>CONCILE LIVE — ${home} vs ${away} (${sh}-${sa} à ${minute}')</b>

🎯 <b>Verdict : ${a.best_bet}</b> — ${a.confidence}% confiance
🗳️ Consensus : ${consensus}/5 agents d'accord
💡 ${a.raison || ""}

${votes}`);

  // Construire un pick synthétique et publier sur les deux canaux
  const livePick = {
    home, away,
    league: competition,
    time: `${minute}'`,
    prono: a.best_bet,
    bet: a.best_bet,
    cote: "",
    confidenceTg: `${a.confidence}%`,
    raison: a.raison,
    status: "EN ATTENTE"
  };

  await reply(chatId, "📤 <b>Publication sur les canaux...</b>");
  await doPublishFree(livePick, chatId);
  await doPublishPremium(livePick, chatId);
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
/memoire — Statistiques de performance par type de pari/compétition
/autoanalyse — Statut de l'analyse automatique toutes les 10 min
/resolve Japon|Tunisie|4|0 — Enregistrer le score final d'un match terminé
/livepick Japon|Tunisie|FIFA WC|4-0|85 — Analyse Concile live + publication immédiate
/publish — Publier sur le canal Telegram public (gratuit)
/publishpremium — Publier sur le canal Telegram Premium
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
    case "/win":             return cmdResult(chatId, "GAGNE");
    case "/lose":            return cmdResult(chatId, "PERDU");
    case "/learn":           return cmdLearn(chatId);
    case "/memoire":         return cmdMemoire(chatId);
    case "/autoanalyse":     return cmdAutoAnalyse(chatId);
    case "/resolve":         return cmdResolve(chatId, args);
    case "/livepick":        return cmdLivePick(chatId, args);
    case "/publish":         return cmdPublish(chatId);
    case "/publishpremium":  return cmdPublishPremium(chatId);
    case "/deploy":          return cmdDeploy(chatId);
    case "/help":
    default:          return cmdHelp(chatId);
  }
}

// ── Long polling loop ─────────────────────────────────────────────────────────
// ── Rapport hebdomadaire automatique (lundi 8h00) ────────────────────────────
async function sendWeeklyStats() {
  if (!ADMIN_CHAT) return;
  try {
    const data = await httpGetInternal("/admin/analysis-performance", { "x-hermes-token": TG_TOKEN });
    if (!data.ok) return;

    const { totals, byBet } = data;
    const resolved = (totals.wins || 0) + (totals.losses || 0);
    const wr = resolved > 0 ? Math.round(totals.wins / resolved * 100) : 0;
    const trend = wr >= 65 ? "🔥 Excellente semaine !" : wr >= 55 ? "✅ Bonne semaine" : wr >= 45 ? "⚠️ Semaine mitigée" : "📉 Semaine difficile";

    let msg = `📊 <b>RAPPORT HEBDOMADAIRE HERMÈS</b>\n`;
    msg += `Semaine du ${new Date(Date.now() - 7 * 86400000).toLocaleDateString('fr-FR')} au ${new Date().toLocaleDateString('fr-FR')}\n\n`;
    msg += `🎯 <b>Résultats :</b> ${totals.wins}W / ${totals.losses}L — <b>${wr}% winrate</b>\n`;
    msg += `${trend}\n\n`;

    if (byBet && byBet.length) {
      msg += `<b>Meilleurs paris de la semaine :</b>\n`;
      byBet
        .map(r => ({ ...r, res: (r.wins || 0) + (r.losses || 0), wr: r.wins + r.losses > 0 ? Math.round(r.wins / (r.wins + r.losses) * 100) : 0 }))
        .filter(r => r.res >= 2)
        .sort((a, b) => b.wr - a.wr)
        .slice(0, 5)
        .forEach(r => {
          const icon = r.wr >= 65 ? "✅" : r.wr >= 50 ? "⚠️" : "❌";
          msg += `  ${icon} ${r.bet}: ${r.wr}% (${r.wins}W/${r.losses}L)\n`;
        });
    }

    msg += `\n📈 Total analyses : ${totals.total} | En attente : ${totals.pending}`;
    await reply(ADMIN_CHAT, msg);
  } catch(e) {
    console.error("[weekly-stats]", e.message);
  }
}

function scheduleDailyPick() {
  const now = new Date();
  // Prochain 10h00 heure Paris (UTC+2 été / UTC+1 hiver → on utilise 8h UTC)
  const next = new Date(now);
  next.setUTCHours(8, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  const msUntil = next.getTime() - now.getTime();
  console.log(`[daily-pick] Prochain pick automatique dans ${Math.round(msUntil / 3600000)}h (${next.toISOString()})`);
  setTimeout(async () => {
    console.log("[daily-pick] Lancement analyse automatique du pick du jour...");
    if (ADMIN_CHAT) {
      await reply(ADMIN_CHAT, "⏰ <b>Pick du jour automatique</b>\nLancement de l'analyse...").catch(() => {});
    }
    await runAnalyse(ADMIN_CHAT).catch(e => console.error("[daily-pick] Erreur:", e.message));
    // Relancer chaque 24h
    setInterval(async () => {
      console.log("[daily-pick] Lancement analyse automatique du pick du jour...");
      await runAnalyse(ADMIN_CHAT).catch(e => console.error("[daily-pick] Erreur:", e.message));
    }, 24 * 3600 * 1000);
  }, msUntil);
}

function scheduleWeeklyStats() {
  const now = new Date();
  // Prochain lundi à 8h00 (heure Paris = UTC+2)
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7));
  nextMonday.setHours(6, 0, 0, 0); // 8h Paris = 6h UTC
  const msUntilMonday = nextMonday.getTime() - now.getTime();
  console.log(`[weekly-stats] Prochain rapport lundi dans ${Math.round(msUntilMonday / 3600000)}h`);
  setTimeout(() => {
    sendWeeklyStats();
    setInterval(sendWeeklyStats, 7 * 24 * 3600 * 1000);
  }, msUntilMonday);
}

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

  // Planifier le pick quotidien automatique à 10h Paris
  scheduleDailyPick();
  // Planifier le rapport hebdomadaire automatique
  scheduleWeeklyStats();

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

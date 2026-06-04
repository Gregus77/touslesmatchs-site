// HERMÈS V2 — SYSTÈME OPTIMISÉ
const https = require("https");
const { execSync } = require("child_process");
const fs = require("fs");
const { buildInlineKeyboard } = require("./bookmakers.config");

const GROQ_KEY = process.env.GROQ_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;
const SPORTS_ALLOWED = ["Hockey", "Foot"];

function dateForOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const labels = ["AUJOURD'HUI", "DEMAIN", "APRÈS-DEMAIN"];
  return { offset, iso: d.toISOString().slice(0, 10), fr: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), label: labels[offset] || `J+${offset}` };
}
const TODAY = dateForOffset(0).fr;

function sendTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT) return Promise.resolve();
  return new Promise((resolve) => {
    const payload = { chat_id: TG_CHAT, text, parse_mode: "HTML", reply_markup: { inline_keyboard: buildInlineKeyboard([{ text: "📊 touslesmatchs.com", url: "https://touslesmatchs.com" }]) } };
    const body = JSON.stringify(payload);
    const req = https.request({ hostname: "api.telegram.org", path: `/bot${TG_TOKEN}/sendMessage`, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, res => { res.on("data", ()=>{}); res.on("end", resolve); });
    req.on("error", () => resolve());
    req.write(body); req.end();
  });
}

function post(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({ hostname, path, method:"POST", headers:{...headers,"Content-Length":Buffer.byteLength(data)} }, res => { let d=""; res.on("data",c=>d+=c); res.on("end",()=>{ try{resolve(JSON.parse(d));}catch{resolve({raw:d});} }); });
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("TIMEOUT")); });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function safeJSON(text) {
  try { const clean = String(text||"").replace(/```json|```/g,"").trim(); const m = clean.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; }
}

function rapidGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: "free-api-live-football-data.p.rapidapi.com", path, method: "GET", headers: { "x-rapidapi-host": "free-api-live-football-data.p.rapidapi.com", "x-rapidapi-key": RAPIDAPI_KEY } }, res => { let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } }); });
    req.on("error", reject);
    req.end();
  });
}

async function scanMatchesRealAPI(targetISO) {
  console.log("📅 RapidAPI...");
  const dateCompact = targetISO.replace(/-/g, "");
  const data = await rapidGet(`/football-get-matches-by-date?date=${dateCompact}`);
  const fixtures = data?.response?.matches || [];
  let matches = [];
  const MAJOR = new Set([914609, 344, 928683, 47, 87, 54, 55, 53, 42, 73, 188, 77]);
  for (const fx of fixtures) {
    if (fx.status?.finished || fx.status?.cancelled || !fx.home?.name || !fx.away?.name || !MAJOR.has(fx.leagueId)) continue;
    let heure = "20h00";
    if (fx.status?.utcTime) { const d = new Date(fx.status.utcTime); if (!isNaN(d)) heure = d.toLocaleTimeString("fr-FR", {hour:"2-digit",minute:"2-digit",timeZone:"Europe/Paris"}).replace(":","h"); }
    matches.push({ sport: "Foot", home: fx.home.name, away: fx.away.name, heure, home_elo: 1700, away_elo: 1700, cote_domicile: 1.6, cote_exterieur: 1.8 });
  }
  console.log(`✅ ${matches.length} matchs`);
  return matches;
}

async function enrichGroq(matches) {
  if (!matches.length) return matches;
  console.log("🟢 Groq...");
  try {
    const r = await post("api.groq.com", "/openai/v1/chat/completions", {"Authorization":`Bearer ${GROQ_KEY}`,"Content-Type":"application/json"}, { model:"llama-3.3-70b-versatile", max_tokens:1000, temperature:0.1, messages:[{role:"user",content:`Estime cotes pour: ${JSON.stringify(matches.map(m=>m.home+"-"+m.away))}`}] });
    const text = r.choices?.[0]?.message?.content || "";
    const picks = safeJSON(text) || [];
    if (Array.isArray(picks)) { for (let i=0; i<Math.min(matches.length, picks.length); i++) { matches[i].cote_domicile = picks[i].cote_h || 1.6; matches[i].cote_exterieur = picks[i].cote_a || 1.8; } }
  } catch(e) { console.error("Groq:", e.message); }
  return matches;
}

async function deepseekChef(matches) {
  console.log("👑 DeepSeek...");
  const valid = matches.filter(m => SPORTS_ALLOWED.includes(m.sport));
  if (!valid.length) return null;
  try {
    const r = await post("api.deepseek.com", "/v1/chat/completions", {"Authorization":`Bearer ${DEEPSEEK_KEY}`,"Content-Type":"application/json"}, { model:"deepseek-chat", max_tokens:1000, temperature:0.1, messages:[{role:"user",content:`Pick 8/10+ ou 7/10. Cote 1.40-2.20. JSON: {"pick":{"match":"X vs Y","cote":1.65,"note":8.5,"threshold":8}}\n${JSON.stringify(valid)}`}] });
    const text = r.choices?.[0]?.message?.content || "";
    const result = safeJSON(text);
    if (result?.pick) return result;
  } catch(e) { console.error("DeepSeek:", e.message); }
  const best = valid[0];
  return { pick: { match: `${best.home} vs ${best.away}`, cote: best.cote_domicile || 1.5, note: 7.0, threshold: 7 } };
}

async function generateForDay(day) {
  console.log(`\n──── ${day.label} (${day.fr}) ────`);
  let matches = await scanMatchesRealAPI(day.iso);
  if (!matches.length) return null;
  matches = await enrichGroq(matches);
  let pick = await deepseekChef(matches);
  if (!pick?.pick) return null;
  updateAppJs(pick.pick, day.fr);
  return pick.pick;
}

function updateAppJs(pick, dateStr) {
  const appPath = "./src/App.js";
  let content = fs.readFileSync(appPath, "utf8");
  const newPick = `  ["${dateStr}","${pick.match}","${pick.match.split(" vs ")[0]} Vainqueur","${pick.cote}","—","EN ATTENTE","Foot",${pick.note},${pick.threshold}],\n`;
  content = content.replace("var picks = [\n", `var picks = [\n${newPick}`);
  fs.writeFileSync(appPath, content);
  console.log(`✅ ${dateStr}: ${pick.match} @ ${pick.cote}`);
}

async function main() {
  console.log("\n🏛️ HERMÈS V2 — 3 JOURS\n");
  const picks = [];
  for (let offset = 0; offset < 3; offset++) {
    const day = dateForOffset(offset);
    const pick = await generateForDay(day);
    if (pick) picks.push(pick);
  }
  if (picks.length) {
    console.log(`\n✅ ${picks.length} picks générés`);
    await sendTelegram(`🤖 HERMÈS\n${picks.map(p => p.match + " @ " + p.cote).join("\n")}`);
    execSync("git add -A && git commit -m '🤖 Hermès: picks générés' && git push origin main", {stdio:"inherit"});
  }
}

main().catch(e => console.error("FATAL:", e.message));

// HERMÈS V2 — SYSTÈME OPTIMISÉ
const https = require("https");
const { execSync } = require("child_process");
const fs = require("fs");
const { buildInlineKeyboard } = require("./bookmakers.config");

const GROQ_KEY = process.env.GROQ_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MISTRAL_KEY = process.env.MISTRAL_API_KEY;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;          // Canal gratuit
const TG_PREMIUM = process.env.TELEGRAM_PREMIUM_CHAT_ID; // Canal premium privé
const SPORTS_ALLOWED = ["Hockey", "Foot"];

// ═══════════════════════════════════════════════════════
// MULTI-IA PROVIDER INTERFACE — Fallback routing
// ═══════════════════════════════════════════════════════
const AI_PROVIDERS = [
  {
    name: "DeepSeek",
    available: () => !!DEEPSEEK_KEY,
    call: (prompt) => callDeepSeek(prompt)
  },
  {
    name: "OpenRouter",
    available: () => !!OPENROUTER_KEY,
    call: (prompt) => callOpenRouter(prompt)
  },
  {
    name: "Gemini",
    available: () => !!GEMINI_KEY,
    call: (prompt) => callGemini(prompt)
  },
  {
    name: "Mistral",
    available: () => !!MISTRAL_KEY,
    call: (prompt) => callMistral(prompt)
  }
];

async function callWithFallback(prompt) {
  for (const provider of AI_PROVIDERS) {
    if (!provider.available()) {
      console.log(`   ⏭️  ${provider.name}: non configuré`);
      continue;
    }
    try {
      console.log(`   🔄 Essai ${provider.name}...`);
      const result = await provider.call(prompt);
      console.log(`   ✓ ${provider.name}: succès`);
      return { provider: provider.name, result };
    } catch (e) {
      console.error(`   ❌ ${provider.name}: ${e.message}`);
    }
  }
  return { provider: "FALLBACK", result: null };
}

function dateForOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const labels = ["AUJOURD'HUI", "DEMAIN", "APRÈS-DEMAIN"];
  return { offset, iso: d.toISOString().slice(0, 10), fr: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), label: labels[offset] || `J+${offset}` };
}
const TODAY = dateForOffset(0).fr;

// Canal gratuit — message enrichi
function sendTelegram(pick) {
  if (!TG_TOKEN || !TG_CHAT) return Promise.resolve();
  const text = pick
    ? `🏆 <b>PICK DU JOUR — ${TODAY}</b>\n\n⚽ ${pick.match}\n💡 Pari : <b>${pick.match.split(" vs ")[0]} Vainqueur</b>\n💰 Cote : <b>${pick.cote}</b>\n🔥 Note : <b>${pick.note}/10</b>\n\n<i>${pick.raison || "Sélectionné par le Conseil Hermès"}</i>\n\n⏩ Joue sur <a href="https://touslesmatchs.com">touslesmatchs.com</a>\n\n⚠️ 18+ — Jeu responsable — Max 2-5% bankroll`
    : `🔍 <b>ANALYSE DU ${TODAY}</b>\n\n❌ <b>PAS DE PICK AUJOURD'HUI</b>\n\nAucun match n'atteint le seuil de confiance.\nOn préfère ne pas publier plutôt que de forcer un pari incertain.\n\n📈 Winrate maintenu grâce à cette discipline.`;
  return new Promise((resolve) => {
    const payload = { chat_id: TG_CHAT, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: { inline_keyboard: buildInlineKeyboard([{ text: "📊 touslesmatchs.com", url: "https://touslesmatchs.com" }]) } };
    const body = JSON.stringify(payload);
    const req = https.request({ hostname: "api.telegram.org", path: `/bot${TG_TOKEN}/sendMessage`, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, res => { res.on("data", ()=>{}); res.on("end", resolve); });
    req.on("error", () => resolve());
    req.write(body); req.end();
  });
}

// Canal premium — picks note 7-7.9
function sendTelegramPremium(picks) {
  if (!TG_TOKEN || !TG_PREMIUM || !picks.length) return Promise.resolve();
  const lines = picks.map(p => `⚽ <b>${p.match}</b>\n💡 ${p.match.split(" vs ")[0]} Vainqueur @ <b>${p.cote}</b> (note ${p.note}/10)\n<i>${p.raison || ""}</i>`).join("\n\n");
  const text = `💎 <b>PICKS PREMIUM — ${TODAY}</b>\n\n${lines}\n\n⏩ <a href="https://touslesmatchs.com">touslesmatchs.com</a>\n⚠️ 18+ — Jeu responsable`;
  return new Promise((resolve) => {
    const payload = { chat_id: TG_PREMIUM, text, parse_mode: "HTML", disable_web_page_preview: true };
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

// ═══════════════════════════════════════════════════════
// LIGUES DISPONIBLES SUR BOOKMAKERS FRANÇAIS (ARJEL/ANJ)
// Winamax, Betclic, Unibet, PMU, ParionsSport
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// LIGUES ACCEPTÉES — CHAMPIONNAT RÉGULIER UNIQUEMENT
// PAS de finales, PAS de qualifications, PAS de U21/U20/U23
// On ne joue QUE là où les stats parlent (saison régulière)
// ═══════════════════════════════════════════════════════
const LIGUES_ARJEL = new Set([
  // Top 5 européens — SAISON RÉGULIÈRE
  47,    // Premier League
  87,    // La Liga
  54,    // Bundesliga
  55,    // Serie A
  53,    // Ligue 1
]);

// ═══════════════════════════════════════════════════════
// NATIONS DISPONIBLES SUR BOOKMAKERS FRANÇAIS
// (Pour les matchs internationaux dans la ligue 914609)
// ═══════════════════════════════════════════════════════
const NATIONS_ARJEL = new Set([
  // UEFA
  "France","England","Spain","Italy","Germany","Portugal","Netherlands","Belgium",
  "Croatia","Denmark","Switzerland","Sweden","Norway","Poland","Czech Republic","Austria",
  "Scotland","Wales","Northern Ireland","Republic of Ireland","Ukraine","Russia","Serbia","Turkey",
  "Greece","Hungary","Romania","Bulgaria","Slovakia","Slovenia","Iceland","Finland",
  // Amérique du Sud
  "Brazil","Argentina","Uruguay","Colombia","Chile","Peru","Ecuador","Paraguay","Bolivia","Venezuela",
  // CONCACAF
  "USA","Mexico","Canada","Costa Rica","Jamaica","Honduras","Panama",
  // Afrique top
  "Senegal","Morocco","Egypt","Algeria","Tunisia","Nigeria","Cameroon","Ghana",
  "Ivory Coast","South Africa","Mali","Burkina Faso","DR Congo",
  // Asie top
  "Japan","South Korea","Australia","Iran","Saudi Arabia","Iraq","Qatar","UAE",
  // Aliases (l'API peut envoyer différents formats)
  "Côte d'Ivoire","Cote d'Ivoire","Korea Republic","IR Iran","United States"
]);

// Mots-clés INTERDITS dans les noms d'équipes (haute variance, pas de stats fiables)
const BANNED_KEYWORDS = ["U21", "U20", "U23", "U19", "U18", "U17", "Olympic", "Olympique B",
  "Women", "Femmes", "Femenino", "W ", " W"];

function isMatchARJEL(fx) {
  const home = (fx.home?.name || "").trim();
  const away = (fx.away?.name || "").trim();
  // REJET : équipes jeunes / féminines
  for (const kw of BANNED_KEYWORDS) {
    if (home.includes(kw) || away.includes(kw)) return false;
  }
  // 1. Ligue Top 5 européen — SAISON RÉGULIÈRE → OK
  if (LIGUES_ARJEL.has(fx.leagueId)) return true;
  // 2. Match international A (pas U21) : vérifier nations ARJEL
  if (fx.leagueId === 914609) {
    return NATIONS_ARJEL.has(home) && NATIONS_ARJEL.has(away);
  }
  // 3. Sinon → REJET (Champions League, Europa League, qualifs = haute variance)
  return false;
}

async function scanMatchesRealAPI(targetISO) {
  console.log("📅 RapidAPI (FREEMIUM: ARJEL gratuit + HORS-ARJEL premium)...");
  const dateCompact = targetISO.replace(/-/g, "");
  const data = await rapidGet(`/football-get-matches-by-date?date=${dateCompact}`);
  const fixtures = data?.response?.matches || [];
  let matches = [];
  let arjelCount = 0, premiumCount = 0;
  // Ligues majeures internationales (toujours considérées même hors ARJEL pour premium)
  const LIGUES_INTERNATIONALES = new Set([914609, 344, 928683, ...LIGUES_ARJEL]);
  for (const fx of fixtures) {
    if (fx.status?.finished || fx.status?.cancelled || !fx.home?.name || !fx.away?.name) continue;
    // On garde tous les matchs des ligues internationales/majeures
    if (!LIGUES_INTERNATIONALES.has(fx.leagueId)) continue;
    const arjel = isMatchARJEL(fx);
    if (arjel) arjelCount++; else premiumCount++;
    let heure = "20h00";
    if (fx.status?.utcTime) { const d = new Date(fx.status.utcTime); if (!isNaN(d)) heure = d.toLocaleTimeString("fr-FR", {hour:"2-digit",minute:"2-digit",timeZone:"Europe/Paris"}).replace(":","h"); }
    matches.push({ sport: "Foot", home: fx.home.name, away: fx.away.name, heure, home_elo: 1700, away_elo: 1700, cote_domicile: 1.6, cote_exterieur: 1.8, arjel });
  }
  console.log(`✅ ${arjelCount} matchs ARJEL (gratuit) + ${premiumCount} matchs HORS-ARJEL (premium)`);
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

// ═══════════════════════════════════════════════════════
// PROVIDER-SPECIFIC IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════

async function callDeepSeek(prompt) {
  const r = await post("api.deepseek.com", "/v1/chat/completions", {
    "Authorization": `Bearer ${DEEPSEEK_KEY}`,
    "Content-Type": "application/json"
  }, {
    model: "deepseek-chat",
    max_tokens: 2500,
    temperature: 0.1,
    messages: [{ role: "user", content: prompt }]
  });
  const text = r.choices?.[0]?.message?.content || "";
  return safeJSON(text);
}

async function callOpenRouter(prompt) {
  const r = await post("openrouter.ai", "/api/v1/chat/completions", {
    "Authorization": `Bearer ${OPENROUTER_KEY}`,
    "Content-Type": "application/json"
  }, {
    model: "deepseek/deepseek-chat", // Compatible alias
    max_tokens: 2500,
    temperature: 0.1,
    messages: [{ role: "user", content: prompt }]
  });
  const text = r.choices?.[0]?.message?.content || "";
  return safeJSON(text);
}

async function callGemini(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 2500, temperature: 0.1 }
    });
    const req = https.request({
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try {
          const r = JSON.parse(d);
          const text = r.candidates?.[0]?.content?.parts?.[0]?.text || "";
          resolve(safeJSON(text));
        } catch { reject(new Error("Gemini parse error")); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function callMistral(prompt) {
  const r = await post("api.mistral.ai", "/v1/chat/completions", {
    "Authorization": `Bearer ${MISTRAL_KEY}`,
    "Content-Type": "application/json"
  }, {
    model: "mistral-large-latest",
    max_tokens: 2500,
    temperature: 0.1,
    messages: [{ role: "user", content: prompt }]
  });
  const text = r.choices?.[0]?.message?.content || "";
  return safeJSON(text);
}

// Chef retourne :
//   - pick (ARJEL ≥7) → site gratuit + Telegram public
//   - premium_arjel (ARJEL ≥7) → Telegram premium (clients abonnés)
//   - premium_hors_arjel (HORS-ARJEL ≥7) → Telegram premium UNIQUEMENT (Pinnacle/PS3838)
async function deepseekChef(matches) {
  console.log("👑 Sélection FREEMIUM (ARJEL gratuit + HORS-ARJEL premium)...");
  const valid = matches.filter(m => SPORTS_ALLOWED.includes(m.sport));
  const validArjel = valid.filter(m => m.arjel);
  const validHorsArjel = valid.filter(m => !m.arjel);
  console.log(`   Pool ARJEL: ${validArjel.length} | Pool HORS-ARJEL: ${validHorsArjel.length}`);
  if (!valid.length) return null;

  const prompt = `Système FREEMIUM TousLesMatchs. Analyse 2 catégories de matchs :

POOL ARJEL (jouables Winamax/Betclic/Unibet/PMU): ${JSON.stringify(validArjel)}

POOL HORS-ARJEL (Pinnacle/PS3838 uniquement - clients premium): ${JSON.stringify(validHorsArjel)}

Règles:
- Cote acceptable: 1.40-2.20
- Note 7.0-10 sur chaque match
- pick = MEILLEUR match ARJEL (publié gratuitement sur site + Telegram public)
- premium_arjel = 2e meilleur match ARJEL (canal Telegram premium, abonnés payants)
- premium_hors_arjel = MEILLEUR match HORS-ARJEL (canal premium UNIQUEMENT, gros bookmakers internationaux)

Réponds JSON:
{
  "pick": {"match":"X vs Y","cote":1.65,"note":8.5,"raison":"courte"},
  "premium_arjel": {"match":"A vs B","cote":1.55,"note":7.6,"raison":"courte"},
  "premium_hors_arjel": {"match":"C vs D","cote":1.70,"note":7.8,"raison":"courte"}
}

Si pool vide pour une catégorie, mets null.`;

  try {
    const { provider, result } = await callWithFallback(prompt);
    console.log(`   Utilisé: ${provider}`);
    if (result?.pick) {
      console.log(`   ✓ Pick GRATUIT (site): ${result.pick.match} (note ${result.pick.note})`);
      if (result.premium_arjel) console.log(`   💎 Premium ARJEL: ${result.premium_arjel.match} (note ${result.premium_arjel.note})`);
      if (result.premium_hors_arjel) console.log(`   💎 Premium HORS-ARJEL: ${result.premium_hors_arjel.match} (note ${result.premium_hors_arjel.note})`);
      return result;
    }
  } catch(e) { console.error("AI error:", e.message); }
  // Fallback : utilise UNIQUEMENT matchs ARJEL pour le pick gratuit
  const arjelCandidates = validArjel.filter(m => (m.cote_domicile || 99) >= 1.4 && (m.cote_domicile || 99) <= 2.2);
  const horsArjelCandidates = validHorsArjel.filter(m => (m.cote_domicile || 99) >= 1.4 && (m.cote_domicile || 99) <= 2.2);
  const bestArjel = arjelCandidates.length ? arjelCandidates.reduce((a,b) => (b.cote_domicile < a.cote_domicile ? b : a)) : null;
  const bestHorsArjel = horsArjelCandidates.length ? horsArjelCandidates.reduce((a,b) => (b.cote_domicile < a.cote_domicile ? b : a)) : null;
  if (!bestArjel && !bestHorsArjel) return null;
  return {
    pick: bestArjel ? { match: `${bestArjel.home} vs ${bestArjel.away}`, cote: bestArjel.cote_domicile, note: 7.0, raison: "Fallback ARJEL" } : null,
    premium_arjel: null,
    premium_hors_arjel: bestHorsArjel ? { match: `${bestHorsArjel.home} vs ${bestHorsArjel.away}`, cote: bestHorsArjel.cote_domicile, note: 7.0, raison: "Fallback HORS-ARJEL" } : null
  };
}

async function generateForDay(day) {
  console.log(`\n──── ${day.label} (${day.fr}) ────`);
  let matches = await scanMatchesRealAPI(day.iso);
  if (!matches.length) {
    console.log(`⚠️ ${day.fr}: aucun match disponible`);
    updateAppJsNoPick(day.fr, "Aucun match disponible");
    return null;
  }
  matches = await enrichGroq(matches);
  let result = await deepseekChef(matches);
  if (!result?.pick && !result?.premium_hors_arjel) {
    updateAppJsNoPick(day.fr, "Aucun pick fiable détecté");
    return null;
  }
  // Pick ARJEL → site public (gratuit)
  if (result?.pick) updateAppJs(result.pick, day.fr);
  else updateAppJsNoPick(day.fr, "Pas de pick ARJEL - voir Premium");
  return result;
}

function updateAppJsNoPick(dateStr, reason) {
  const appPath = "./src/App.js";
  let content = fs.readFileSync(appPath, "utf8");
  const newPick = `  ["${dateStr}","PAS DE PARI - ${reason}","---","---","---","NOPICK","",0,8],\n`;
  // Supprime tout pick existant pour cette date (EN ATTENTE)
  const dateRegex = new RegExp(`  \\["${dateStr.replace("/", "\\/")}"[^\\n]*\\n`, "g");
  if (content.match(dateRegex)) {
    content = content.replace(dateRegex, newPick);
    console.log(`📝 ${dateStr}: PAS DE PARI (${reason})`);
  } else {
    content = content.replace("var picks = [\n", `var picks = [\n${newPick}`);
    console.log(`📝 ${dateStr}: PAS DE PARI ajouté (${reason})`);
  }
  fs.writeFileSync(appPath, content);
}

function updateAppJs(pick, dateStr) {
  const appPath = "./src/App.js";
  let content = fs.readFileSync(appPath, "utf8");
  const newPick = `  ["${dateStr}","${pick.match}","${pick.match.split(" vs ")[0]} Vainqueur","${pick.cote}","—","EN ATTENTE","Foot",${pick.note},${pick.note >= 8 ? 8 : 7}],\n`;
  const dateRegex = new RegExp(`  \\["${dateStr.replace("/", "\\/")}",[^\\n]*\\n`, "g");
  const existing = content.match(dateRegex);
  if (existing) {
    const existingNote = parseFloat(existing[0].match(/,(\d+\.?\d*),\d+\],/)?.[1] || 0);
    if (pick.note > existingNote) {
      content = content.replace(dateRegex, newPick);
      console.log(`🔄 ${dateStr}: remplacement (${existingNote} → ${pick.note})`);
    } else {
      console.log(`⏭️ ${dateStr}: gardé existant (${existingNote} ≥ ${pick.note})`);
      return;
    }
  } else {
    content = content.replace("var picks = [\n", `var picks = [\n${newPick}`);
    console.log(`✅ ${dateStr}: ${pick.match} @ ${pick.cote} (note ${pick.note})`);
  }
  fs.writeFileSync(appPath, content);
}

async function main() {
  console.log("\n🏛️ HERMÈS V2 — 3 JOURS\n");
  const results = [];
  const allPremium = [];

  for (let offset = 0; offset < 3; offset++) {
    const day = dateForOffset(offset);
    const result = await generateForDay(day);
    if (result) {
      results.push(result.pick);
      if (result.premium?.length) allPremium.push(...result.premium);
    }
  }

  if (results.length) {
    console.log(`\n✅ ${results.length} picks générés`);

    // Canal gratuit : pick du jour (meilleure note)
    const bestPick = results.reduce((a, b) => b.note > a.note ? b : a);
    await sendTelegram(bestPick);
    console.log("📤 Telegram gratuit envoyé");

    // Canal premium : picks 7-7.9
    if (allPremium.length) {
      await sendTelegramPremium(allPremium);
      console.log(`💎 Telegram premium: ${allPremium.length} pick(s) envoyé(s)`);
    }

    // Git commit géré par le workflow GitHub Actions (évite le double commit)
  } else {
    console.log("Aucun pick généré aujourd'hui");
    await sendTelegram(null); // envoie message NOPICK
  }
}

main().catch(e => console.error("FATAL:", e.message));

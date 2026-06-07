// HERMÈS V2 — SYSTÈME OPTIMISÉ
const https = require("https");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
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

// Mots-clés INTERDITS dans le nom de la ligue — AMICAUX BANNIS définitivement
// Leçon apprise : Suisse 1-1 Australie (06/06/2026) — amical San Diego → PERDU
// Les amicaux ont zéro enjeu, équipes mixtes, stats non fiables → JAMAIS de pick
const BANNED_LEAGUE_KEYWORDS = [
  "friendly", "Friendly", "amical", "Amical", "FRIENDLY", "AMICAL",
  "test match", "Test Match", "exhibition", "Exhibition",
  "international friendly", "International Friendly",
  "tour ", " tour", "Tour "
];

function isMatchARJEL(fx) {
  const home = (fx.home?.name || "").trim();
  const away = (fx.away?.name || "").trim();
  const leagueName = (fx.leagueName || fx.league?.name || fx.competition?.name || "").toLowerCase();

  // REJET absolu : équipes jeunes / féminines
  for (const kw of BANNED_KEYWORDS) {
    if (home.includes(kw) || away.includes(kw)) return false;
  }

  // REJET absolu : amicaux et matchs sans enjeu — jamais de pick dessus
  for (const kw of BANNED_LEAGUE_KEYWORDS) {
    if (leagueName.includes(kw.toLowerCase())) {
      console.log(`  ❌ AMICAL REJETÉ: ${home} vs ${away} (${leagueName})`);
      return false;
    }
  }

  // 1. Ligue Top 5 européen — SAISON RÉGULIÈRE → OK
  if (LIGUES_ARJEL.has(fx.leagueId)) return true;
  // 2. Match international A officiel (Coupe du Monde, Nations League, qualifs FIFA/UEFA) : vérifier nations ARJEL
  if (fx.leagueId === 914609) {
    return NATIONS_ARJEL.has(home) && NATIONS_ARJEL.has(away);
  }
  // 3. Sinon → REJET
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
  console.log("👑 Hermès — Sélection FREEMIUM (ARJEL gratuit + HORS-ARJEL premium)...");
  const valid = matches.filter(m => SPORTS_ALLOWED.includes(m.sport));
  const validArjel = valid.filter(m => m.arjel);
  const validHorsArjel = valid.filter(m => !m.arjel);
  console.log(`   Pool ARJEL: ${validArjel.length} | Pool HORS-ARJEL: ${validHorsArjel.length}`);
  if (!valid.length) return null;

  const prompt = `Tu es HERMÈS, chef suprême du Conseil TousLesMatchs.

CONTEXTE ABSOLU : Ma réputation — et le bankroll de chaque abonné — repose sur chaque pick que je publie.
Je traite chaque décision comme si je jouais ma propre vie sur ce pari.
Quand je doute, je ne joue pas. Le NOPICK est MA valeur par défaut ce matin.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MATCHS À ANALYSER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

POOL ARJEL (bookmakers français agréés ANJ — pick public gratuit) :
${JSON.stringify(validArjel, null, 2)}

POOL HORS-ARJEL (Pinnacle / PS3838 — pick premium uniquement) :
${JSON.stringify(validHorsArjel, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ÉTAPE 1 — FILTRAGE AUTOMATIQUE : ÉLIMINE SANS HÉSITER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tout match contenant l'un de ces signaux est éliminé AVANT toute analyse.
Aucune note, aussi élevée soit-elle, ne peut sauver un match éliminé ici.

🔴 ELIMINE SI la ligue ou le match contient (insensible à la casse) :
   "friendly", "amical", "amistoso", "testspiel", "exhibition",
   "international friendly", "tour", "all-star", "showcase"
   → LEÇON GRAVÉE : Suisse 1-1 Australie (06/06/2026) — amical San Diego.
     Équipes mixées, capitaine absent, aucun enjeu. On a perdu. JAMAIS PLUS.

🔴 ELIMINE SI l'une des équipes est :
   U17 / U18 / U19 / U20 / U21 / U23 / Femmes / Futsal / Beach Soccer

🔴 ELIMINE SI la compétition est :
   - Un tournoi de préparation d'été (July Series, Summer Cup, Estadio…)
   - Un dernier match de saison où une équipe est déjà reléguée ET l'autre sans enjeu
   - Un 2ème tour de coupe avec retour à domicile où l'équipe mène 3+ buts
   - Un match de gala / cérémonie / hommage

🔴 ELIMINE SI la cote est :
   - Inférieure à 1.42 (pas de valeur réelle — le bookmaker mange tout)
   - Supérieure à 2.30 (trop incertain — on n'est pas là pour spéculer)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ÉTAPE 2 — CHECKLIST OBLIGATOIRE sur chaque match restant
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pour chaque match passé l'étape 1, tu DOIS répondre à ces 6 questions.
Si tu réponds NON ou "je ne sais pas" à UNE SEULE → le match est rejeté.

[ ] 1. ENJEU RÉEL : Les DEUX équipes ont-elles quelque chose à gagner ou perdre
       dans ce match précis ? (titre, qualification, maintien, ne pas tomber à la 3e place…)
       NON ou incertain → REJETE.

[ ] 2. FORME RÉCENTE VÉRIFIABLE : Chaque équipe a-t-elle au moins 3 matchs officiels
       dans les 21 derniers jours ? Si l'une joue après une trêve internationale de
       plus de 15 jours sans match de club → REJETE.

[ ] 3. AVANTAGE STATISTIQUE CONCRET : Existe-t-il un avantage mesurable
       (domicile/extérieur, H2H 5 derniers matchs, buts marqués/encaissés, xG, pressing…)
       qui dépasse le simple ressenti ? Un avantage flou ("ils jouent mieux") = REJET.

[ ] 4. CONTEXTE PROPRE : Y a-t-il des éléments perturbateurs ?
       - Blessure d'un joueur clé annoncée dans les 48h → note −2.0 (souvent éliminatoire)
       - Effectif en rotation connue (Ligue des Champions dans 3 jours…) → REJETE
       - Tension interne / changement d'entraîneur < 2 semaines → REJETE
       - Terrain neutre sans historique de domicile/extérieur → note −1.5

[ ] 5. TEST DU SOMMEIL : Si je publie ce pick et vais dormir, est-ce que je serais
       à l'aise ? Si je me pose cette question trop longtemps → NOPICK.

[ ] 6. COTE EN VALEUR : La cote proposée reflète-t-elle une probabilité SOUS-ESTIMÉE
       par le marché ? Si la cote est "normale" pour le favori évident, il n'y a pas
       de valeur — cherche un angle moins évident ou abandonne.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ÉTAPE 3 — AUTO-CONTRE-EXAMEN (obligatoire avant validation)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pour tout match envisagé comme pick, tu dois formuler :
  → Le MEILLEUR ARGUMENT CONTRE ce pari (en 1 phrase précise)
  → Pourquoi tu le rejettes malgré tout (ou pourquoi il t'oblige à NOPICK)

Si tu ne trouves pas d'argument contre solide, c'est suspect — les bons picks
ont toujours un risque identifiable et maîtrisable, pas une certitude aveugle.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BARÈME DE NOTATION — HERMÈS ACADEMY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commence à 5.0/10 (incertitude de base de tout match de sport).
Ajoute des points uniquement pour des preuves concrètes :

  +1.0 si domicile fort (70%+ winrate à domicile cette saison)
  +1.0 si H2H favorable (4 victoires sur 5 derniers matchs directs)
  +1.0 si adversaire en mauvaise forme (2+ défaites sur 3 derniers matchs)
  +1.0 si enjeu vital pour l'équipe favorite du pari (relégation / titre / qualif)
  +0.5 si xG supérieur sur les 5 derniers matchs
  +0.5 si gardien adverse en difficulté (5+ buts encaissés / 3 derniers)

  −1.0 si terrain neutre (pas d'avantage domicile)
  −1.0 si blessure d'un joueur clé révélée < 48h
  −1.5 si l'équipe joue un match important 72h après (rotation probable)
  −2.0 si les deux équipes ont une forme incertaine ou inégale sur la période

Seuil de publication :
  ≥ 8.0/10 → pick FORT, publié en priorité
  7.0–7.9  → pick ACCEPTABLE, publié seulement si aucun 8.0+ disponible
  < 7.0    → NOPICK absolu, quelle que soit la raison

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRATÉGIE DE MISE (Kelly modifié)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Note 7.0–7.9 → 1% du bankroll (pick prudent)
  Note 8.0–8.9 → 2% du bankroll
  Note 9.0–9.9 → 3% du bankroll
  Note 10/10   → 5% du bankroll (rarissime)
  JAMAIS plus de 5% sur un seul pari, quoi qu'il arrive.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMAT DE RÉPONSE — JSON STRICT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Si un match ARJEL passe TOUS les filtres avec note ≥ 7.0 :
{
  "pick": {
    "match": "Equipe A vs Equipe B",
    "cote": 1.65,
    "note": 8.5,
    "sport": "Foot",
    "mise_conseillée": "2% bankroll",
    "raison": "stat concrète en 1 phrase : ex. Bayern 8W/10 à domicile, Chelsea 0 victoire extérieure depuis 4 matchs",
    "argument_contre": "risque identifié",
    "pourquoi_validé": "pourquoi ce risque est maîtrisable"
  },
  "premium_arjel": { "match":"...","cote":1.55,"note":7.6,"raison":"..." },
  "premium_hors_arjel": { "match":"...","cote":1.70,"note":7.8,"raison":"..." }
}

Si AUCUN match ne passe tous les filtres (réponse correcte dans 60% des cas) :
{
  "pick": null,
  "premium_arjel": null,
  "premium_hors_arjel": null,
  "nopick_raison": "raison précise : ex. tous les matchs du jour sont des amicaux, ou aucun n'atteint 7.0 après calcul barème"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RAPPEL FINAL — LA RÈGLE D'OR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Notre winrate à 78% ne vient pas de nos bons picks.
Il vient des mauvais picks qu'on N'A PAS publiés.
Un NOPICK aujourd'hui protège dix bankrolls demain.
Je préfère un abonné déçu ce soir à un abonné ruiné cette semaine.`;

  try {
    const { provider, result } = await callWithFallback(prompt);
    console.log(`   Utilisé: ${provider}`);
    if (result?.pick) {
      console.log(`   ✓ Pick GRATUIT: ${result.pick.match} (note ${result.pick.note}/10)`);
      if (result.premium_arjel) console.log(`   💎 Premium ARJEL: ${result.premium_arjel.match} (note ${result.premium_arjel.note})`);
      if (result.premium_hors_arjel) console.log(`   💎 Premium HORS-ARJEL: ${result.premium_hors_arjel.match} (note ${result.premium_hors_arjel.note})`);
      // Vérification finale barème Hermès : note < 7.0 → rejet absolu
      if (result.pick.note < 7.0) {
        console.log(`   ⛔ Note ${result.pick.note} < 7.0 → Pick REFUSÉ par Hermès (barème insuffisant)`);
        result.pick = null;
      }
      // Log de l'auto-contre-examen si présent
      if (result.pick?.argument_contre) {
        console.log(`   ⚖️  Contre-argument : ${result.pick.argument_contre}`);
        console.log(`   ✅ Validé car : ${result.pick.pourquoi_validé || "—"}`);
      }
      return result;
    }
    if (result?.nopick_raison) {
      console.log(`   🛑 NOPICK décidé par Hermès : ${result.nopick_raison}`);
    }
    return result || null;
  } catch(e) { console.error("AI error:", e.message); }

  // Fallback conservateur : NOPICK plutôt que forcer un pari risqué
  console.log("   ⚠️ Fallback conservateur → NOPICK (aucun match validé automatiquement)");
  return { pick: null, premium_arjel: null, premium_hors_arjel: null, nopick_raison: "Fallback conservateur — aucune IA disponible pour valider" };
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

// ═══ PROTECTION ABSOLUE : JAMAIS écraser un pick GAGNE ou PERDU ═══
function isPickResolved(content, dateStr) {
  const escapedDate = dateStr.replace("/", "\\/");
  const match = content.match(new RegExp(`\\["${escapedDate}"[^\\]]*"(GAGNE|PERDU)"`, "g"));
  return match && match.length > 0;
}

function updateAppJsNoPick(dateStr, reason) {
  const appPath = "./src/App.js";
  let content = fs.readFileSync(appPath, "utf8");
  // PROTECTION : ne JAMAIS écraser un résultat terminé
  if (isPickResolved(content, dateStr)) {
    console.log(`🛡️ ${dateStr}: PROTÉGÉ (résultat déjà enregistré — pas d'écrasement)`);
    return;
  }
  const newPick = `  ["${dateStr}","PAS DE PARI - ${reason}","---","---","---","NOPICK","",0,8],\n`;
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
  // PROTECTION : ne JAMAIS écraser un résultat terminé
  if (isPickResolved(content, dateStr)) {
    console.log(`🛡️ ${dateStr}: PROTÉGÉ (résultat déjà enregistré — pas d'écrasement)`);
    return;
  }
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

    // Sauvegarde pour le bot Telegram
    const todayPickData = {
      date: new Date().toLocaleDateString("fr-FR", {day:"2-digit", month:"2-digit"}),
      match: bestPick.match,
      bet: bestPick.bet,
      odds: String(bestPick.cote),
      sport: bestPick.sport || "Foot",
      confidence: bestPick.note,
      nopick: false
    };
    fs.writeFileSync(path.join(__dirname, "today_pick.json"), JSON.stringify(todayPickData, null, 2));
    console.log("💾 today_pick.json mis à jour");

    // Canal premium : picks 7-7.9
    if (allPremium.length) {
      await sendTelegramPremium(allPremium);
      console.log(`💎 Telegram premium: ${allPremium.length} pick(s) envoyé(s)`);
    }

    // Git commit géré par le workflow GitHub Actions (évite le double commit)
  } else {
    console.log("Aucun pick généré aujourd'hui");
    await sendTelegram(null); // envoie message NOPICK
    // Bot : marquer nopick
    fs.writeFileSync(path.join(__dirname, "today_pick.json"), JSON.stringify({ nopick: true }, null, 2));
  }
}

main().catch(e => console.error("FATAL:", e.message));

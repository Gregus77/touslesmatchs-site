const https = require("https");
const { execSync } = require("child_process");
const fs = require("fs");
const { buildInlineKeyboard } = require("./bookmakers.config");

// ============================================================
// CLÉS API
// ============================================================
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const GROQ_KEY       = process.env.GROQ_API_KEY;
const GEMINI_KEY     = process.env.GEMINI_API_KEY;
const DEEPSEEK_KEY   = process.env.DEEPSEEK_API_KEY;
const OR_KEY         = process.env.OPENROUTER_API_KEY;
const RAPIDAPI_KEY   = process.env.RAPIDAPI_KEY;
const TG_TOKEN       = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT        = process.env.TELEGRAM_CHAT_ID;

// ── Dates : aujourd'hui (0), demain (1), après-demain (2) ──
function dateForOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return {
    offset,
    iso: d.toISOString().slice(0, 10),
    fr: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    label: ["AUJOURD'HUI", "DEMAIN", "APRÈS-DEMAIN"][offset] || `J+${offset}`
  };
}
const TODAY = dateForOffset(0).fr;

// ============================================================
// TELEGRAM NOTIFICATION
// ============================================================
function sendTelegram(text, withButtons = false) {
  if (!TG_TOKEN || !TG_CHAT) return Promise.resolve();
  return new Promise((resolve) => {
    const payload = {
      chat_id: TG_CHAT,
      text,
      parse_mode: "HTML",
      ...(withButtons && {
        reply_markup: {
          inline_keyboard: buildInlineKeyboard([
            { text: "📊 Stats & historique — touslesmatchs.com", url: "https://touslesmatchs.com" }
          ])
        }
      })
    };
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${TG_TOKEN}/sendMessage`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, res => { res.on("data", ()=>{}); res.on("end", resolve); });
    req.on("error", () => resolve());
    req.write(body); req.end();
  });
}

// ============================================================
// HTTP HELPER
// ============================================================
function post(hostname, path, headers, body, timeout=30000) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname, path, method:"POST", headers:{...headers,"Content-Length":Buffer.byteLength(data)} },
      res => { let d=""; res.on("data",c=>d+=c); res.on("end",()=>{ try{resolve(JSON.parse(d));}catch{resolve({raw:d});} }); }
    );
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error("TIMEOUT")); });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function safeJSON(text) {
  try {
    const clean = String(text||"").replace(/```json|```/g,"").trim();
    const m = clean.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch { return null; }
}

// ============================================================
// HELPER GET — pour appels API REST
// ============================================================
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    }).on("error", reject);
  });
}

function rapidGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "free-api-live-football-data.p.rapidapi.com",
      path,
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-host": "free-api-live-football-data.p.rapidapi.com",
        "x-rapidapi-key": RAPIDAPI_KEY
      }
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve(JSON.parse(d)); } catch { resolve({}); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// ============================================================
// ÉTAPE 1a — VRAIS MATCHS VIA RAPIDAPI (Free API Live Football)
// ============================================================
async function scanMatchesRealAPI(targetISO) {
  const today = targetISO || new Date().toISOString().slice(0,10);
  if (!RAPIDAPI_KEY) {
    console.log("⚠️ RAPIDAPI_KEY manquante — scan API réel désactivé");
    return [];
  }
  let matches = [];
  try {
    // Essai de plusieurs endpoints possibles selon la doc RapidAPI
    let data = null;
    // Format requis par l'API : YYYYMMDD (sans tirets)
    const dateCompact = today.replace(/-/g, "");
    data = await rapidGet(`/football-get-matches-by-date?date=${dateCompact}`);
    if (data?.message) {
      console.log(`   ❌ RapidAPI: ${data.message}`);
      return [];
    }
    // Structure réelle confirmée : data.response.matches[]
    const fixtures = data?.response?.matches || [];
    if (!Array.isArray(fixtures) || !fixtures.length) {
      console.log(`📅 RapidAPI: réponse vide pour ${today}`);
      return [];
    }

    // Ligues majeures filtrées par leagueId connu
    const MAJOR_LEAGUE_IDS = new Set([
      914609, // Internationaux A (qualifs, amicaux)
      344,    // UEFA U21
      928683, // U20 Coupe du monde
      47,     // Premier League
      87,     // La Liga
      54,     // Bundesliga
      55,     // Serie A
      53,     // Ligue 1
      42,     // Champions League
      73,     // Europa League
      188,    // Nations League
      77,     // Ligue des Nations
    ]);

    for (const fx of fixtures) {
      if (fx.status?.finished || fx.status?.cancelled) continue;
      const home = fx.home?.name || "";
      const away = fx.away?.name || "";
      if (!home || !away) continue;
      if (!MAJOR_LEAGUE_IDS.has(fx.leagueId)) continue;

      let heure = "20h00";
      if (fx.status?.utcTime) {
        const d = new Date(fx.status.utcTime);
        if (!isNaN(d)) heure = d.toLocaleTimeString("fr-FR", {hour:"2-digit",minute:"2-digit",timeZone:"Europe/Paris"}).replace(":","h");
      }
      matches.push({
        sport: "Foot",
        competition: `League ${fx.leagueId}`,
        home, away, heure,
        home_form: "UNKNOWN",
        away_form: "UNKNOWN",
        home_elo: 1700,
        away_elo: 1700,
        enjeu: "International",
        cote_domicile: 0,
        cote_exterieur: 0,
        favoris: "unknown",
        absents_exterieur: [],
        disponible_bookmakers_fr: true,
        source: "rapidapi_verified"
      });
    }
  } catch(e) {
    console.error("RapidAPI error:", e.message);
  }
  console.log(`📅 RapidAPI: ${matches.length} vrais matchs trouvés pour ${today}`);
  return matches;
}

// ============================================================
// ÉTAPE 1b — GROQ ESTIME COTES/FORME sur vrais matchs
// ============================================================
async function enrichMatchesGroq(realMatches, targetISO) {
  if (!realMatches.length) return realMatches;
  console.log(`🟢 Groq — Estimation cotes et forme pour ${realMatches.length} vrais matchs...`);
  const today = targetISO || new Date().toISOString().slice(0,10);
  const matchList = realMatches.map(m => `${m.home} vs ${m.away} (${m.competition}, ${m.heure})`).join("\n");
  try {
    const r = await post("api.groq.com", "/openai/v1/chat/completions",
      {"Authorization":`Bearer ${GROQ_KEY}`,"Content-Type":"application/json"},
      { model:"llama-3.3-70b-versatile", max_tokens:2000, temperature:0.1,
        messages:[{role:"user",content:`Date: ${today}. Ces matchs ont lieu aujourd'hui (source officielle). Estime les statistiques pour chacun.

MATCHS RÉELS À ANALYSER:
${matchList}

Pour chaque match, estime : forme récente des 5 derniers matchs, ELO approximatif, cotes bookmakers FR, favori, absents connus.
RÈGLE ABSOLUE : N'ajoute AUCUN match qui n'est pas dans la liste ci-dessus. Analyse UNIQUEMENT ceux listés.
Cote du favori entre 1.35 et 2.30. Disponible obligatoirement sur Winamax/Betclic/Unibet FR.

Réponds UNIQUEMENT en JSON: {"matches":[{"home":"nom_exact","away":"nom_exact","home_form":"VVVNV","away_form":"NVVDL","home_elo":1850,"away_elo":1780,"enjeu":"Playoffs","cote_domicile":1.65,"cote_exterieur":2.30,"favoris":"home","absents_exterieur":[],"disponible_bookmakers_fr":true}]}`}]
      }
    );
    const text = r.choices?.[0]?.message?.content || "";
    const parsed = safeJSON(text);
    if (parsed?.matches) {
      return realMatches.map(m => {
        const enriched = parsed.matches.find(e =>
          e.home && m.home && e.home.toLowerCase().includes(m.home.toLowerCase().split(" ")[0])
        );
        return enriched ? {...m, ...enriched, home: m.home, away: m.away} : m;
      });
    }
    return realMatches;
  } catch(e) {
    console.error("Groq enrichissement error:", e.message);
    return realMatches;
  }
}

// ============================================================
// ÉTAPE 1 — SCAN PRINCIPAL (API réelle + enrichissement IA)
// ============================================================
async function scanMatchesGroq(targetISO) {
  // PRIORITÉ 1 : vrais matchs via TheSportsDB
  let matches = await scanMatchesRealAPI(targetISO);
  if (matches.length > 0) {
    return await enrichMatchesGroq(matches, targetISO);
  }

  // PRIORITÉ 2 (fallback) : Groq invente — avec avertissement dans les logs
  console.log("⚠️ TheSportsDB sans résultat — fallback Groq (attention hallucinations possibles)");
  const today = targetISO || new Date().toISOString().slice(0,10);
  try {
    const r = await post("api.groq.com", "/openai/v1/chat/completions",
      {"Authorization":`Bearer ${GROQ_KEY}`,"Content-Type":"application/json"},
      { model:"llama-3.3-70b-versatile", max_tokens:2000, temperature:0.1,
        messages:[{role:"user",content:`Date: ${today}. MISSION OBLIGATOIRE : trouve entre 5 et 10 matchs qui ont lieu AUJOURD'HUI ou CETTE NUIT (jusqu'au lendemain 06h00 heure française).

RÈGLE ABSOLUE N°1 — DISPONIBILITÉ BOOKMAKERS FRANÇAIS :
Le match DOIT être disponible sur Winamax, Betclic ou Unibet France. Ne propose JAMAIS un match qui ne sera pas sur ces sites.

COMPÉTITIONS TOUJOURS DISPONIBLES (priorité maximale) :
- NHL Stanley Cup Playoffs
- NBA Playoffs / Finals
- Premier League, LaLiga, Bundesliga, Serie A, Ligue 1
- Champions League, Europa League
- MLS (Major League Soccer)
- Copa Libertadores, Copa America
- F1, MLB (séries importantes)
- Internationaux A (France, Angleterre, Espagne, Allemagne, Italie, Belgique, Pays-Bas, Portugal, Brésil, Argentine, USA, Canada)

COMPÉTITIONS GÉNÉRALEMENT DISPONIBLES (utiliser si rien d'autre) :
- Matchs amicaux entre équipes nationales reconnues (ex: Canada, Croatie, Belgique)
- Coupe de France, FA Cup, DFB Pokal
- Liga Portugal, Jupiler Pro League

COMPÉTITIONS À ÉVITER (rarement sur bookmakers français) :
- Championnats d'Équateur, Bolivie, Paraguay, Pérou isolés
- Ligues asiatiques obscures
- Matchs amicaux entre équipes de 2e rang

Sports bannis : Tennis, championnats corrompus (Chine, Vietnam, Nigeria, Biélorussie, Cambodge).
Cote du favori entre 1.35 et 2.30. L'important : AU MOINS UN MATCH PAR JOUR sur un bookmaker français.

Réponds UNIQUEMENT en JSON: {"matches":[{"sport":"Hockey","competition":"NHL Stanley Cup","home":"Carolina Hurricanes","away":"Vegas Golden Knights","heure":"19h00","home_form":"VVVNV","away_form":"NVVDL","home_elo":1850,"away_elo":1780,"enjeu":"Playoffs","cote_domicile":1.65,"cote_exterieur":2.30,"favoris":"home","absents_exterieur":["Titulaire clé"],"disponible_bookmakers_fr":true}]}`}]
      }
    );
    const text = r.choices?.[0]?.message?.content || "";
    const parsed = safeJSON(text);
    return parsed?.matches || [];
  } catch(e) {
    console.error("Groq error:", e.message);
    return [];
  }
}

// ============================================================
// ÉTAPE 2 — GEMINI VÉRIFIE LES H2H
// ============================================================
async function checkH2HGemini(matches) {
  console.log("🔵 Gemini — Vérification H2H...");
  if (!matches.length) return matches;
  try {
    const r = await post("generativelanguage.googleapis.com",
      `/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {"Content-Type":"application/json"},
      { contents:[{parts:[{text:`Pour ces matchs, donne les H2H et statistiques défensives. Réponds en JSON: {"matches":[{"home":"nom","away":"nom","h2h_home_wins":3,"h2h_draws":1,"h2h_away_wins":1,"home_clean_sheets_last5":2,"away_goals_conceded_avg":1.4}]}. Matchs: ${JSON.stringify(matches.map(m=>({home:m.home,away:m.away,competition:m.competition})))}`}]}],
        generationConfig:{maxOutputTokens:1000,temperature:0.1}
      }
    );
    const text = r.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = safeJSON(text);
    if (parsed?.matches) {
      return matches.map(m => {
        const h2h = parsed.matches.find(h => h.home===m.home || h.away===m.away);
        return h2h ? {...m, ...h2h} : m;
      });
    }
    return matches;
  } catch(e) {
    console.error("Gemini error:", e.message);
    return matches;
  }
}

// ============================================================
// ÉTAPE 3 — DEEPSEEK ANALYSE LA FORME RÉCENTE
// ============================================================
async function analyzeFormDeepSeek(matches) {
  console.log("🟠 DeepSeek — Analyse forme récente...");
  if (!matches.length) return matches;
  try {
    const r = await post("api.deepseek.com", "/v1/chat/completions",
      {"Authorization":`Bearer ${DEEPSEEK_KEY}`,"Content-Type":"application/json"},
      { model:"deepseek-chat", max_tokens:1000, temperature:0.1,
        messages:[{role:"user",content:`Analyse la forme récente et les blessés pour ces matchs. Réponds en JSON: {"matches":[{"home":"nom","away":"nom","home_form_score":8,"away_form_score":5,"key_absences":["joueur blessé"],"recommendation":"GO ou NO"}]}. Matchs: ${JSON.stringify(matches.map(m=>({home:m.home,away:m.away,sport:m.sport,competition:m.competition})))}`}]
      }
    );
    const text = r.choices?.[0]?.message?.content || "";
    const parsed = safeJSON(text);
    if (parsed?.matches) {
      return matches.map(m => {
        const form = parsed.matches.find(f => f.home===m.home || f.away===m.away);
        return form ? {...m, ...form} : m;
      });
    }
    return matches;
  } catch(e) {
    console.error("DeepSeek error:", e.message);
    return matches;
  }
}

// ============================================================
// ÉTAPE 4 — MISTRAL VÉRIFIE MÉTÉO ET MOTIVATION
// ============================================================
async function checkContextMistral(matches) {
  console.log("🟣 Mistral — Météo et motivation...");
  if (!matches.length) return matches;
  try {
    const r = await post("openrouter.ai", "/api/v1/chat/completions",
      {"Authorization":`Bearer ${OR_KEY}`,"Content-Type":"application/json","HTTP-Referer":"https://touslesmatchs.com","X-Title":"Concile V4.3"},
      { model:"mistralai/mistral-7b-instruct", max_tokens:800, temperature:0.1,
        messages:[{role:"user",content:`Vérifie météo et motivation pour ces matchs. Réponds en JSON: {"matches":[{"home":"nom","away":"nom","weather_ok":true,"enjeu_score":8,"recommendation":"GO ou NO","raison":"courte raison"}]}. Matchs: ${JSON.stringify(matches.map(m=>({home:m.home,away:m.away,competition:m.competition,enjeu:m.enjeu})))}`}]
      }
    );
    const text = r.choices?.[0]?.message?.content || "";
    const parsed = safeJSON(text);
    if (parsed?.matches) {
      return matches.map(m => {
        const ctx = parsed.matches.find(c => c.home===m.home || c.away===m.away);
        return ctx ? {...m, weather_ok:ctx.weather_ok, enjeu_score:ctx.enjeu_score, mistral_rec:ctx.recommendation} : m;
      });
    }
    return matches;
  } catch(e) {
    console.error("Mistral error:", e.message);
    return matches;
  }
}

// ============================================================
// ÉTAPE 4b — QWEN VÉRIFIE VALEUR DES COTES
// ============================================================
async function checkValueQwen(matches) {
  console.log("🔴 Qwen — Analyse value bet...");
  if (!matches.length) return matches;
  try {
    const r = await post("openrouter.ai", "/api/v1/chat/completions",
      {"Authorization":`Bearer ${OR_KEY}`,"Content-Type":"application/json","HTTP-Referer":"https://touslesmatchs.com","X-Title":"Concile V5"},
      { model:"qwen/qwen-2.5-72b-instruct", max_tokens:800, temperature:0.1,
        messages:[{role:"user",content:`Analyse la valeur des cotes pour ces matchs. Pour chaque match, estime la probabilite reelle du favori et compare avec la cote proposee. Reponds en JSON: {"matches":[{"home":"nom","away":"nom","prob_reelle":0.65,"cote_juste":1.54,"value_score":8,"qwen_rec":"GO ou NO","raison":"courte raison"}]}. Matchs: ${JSON.stringify(matches.map(m=>({home:m.home,away:m.away,competition:m.competition,cote_domicile:m.cote_domicile,cote_exterieur:m.cote_exterieur,favoris:m.favoris})))}`}]
      }
    );
    const text = r.choices?.[0]?.message?.content || "";
    const parsed = safeJSON(text);
    if (parsed?.matches) {
      return matches.map(m => {
        const qw = parsed.matches.find(q => q.home===m.home || q.away===m.away);
        return qw ? {...m, prob_reelle:qw.prob_reelle, value_score:qw.value_score, qwen_rec:qw.qwen_rec} : m;
      });
    }
    return matches;
  } catch(e) {
    console.error("Qwen error:", e.message);
    return matches;
  }
}

// ============================================================
// ÉTAPE 5 — CLAUDE CHEF DU CONCILE — DÉCISION FINALE
// ============================================================
async function claudeChefConcile(matches) {
  console.log("👑 Claude — Décision finale du Concile...");
  if (!matches.length) return null;

  // Réduire la taille du JSON pour économiser les tokens
  const minMatches = matches.map(m => ({
    home: m.home,
    away: m.away,
    heure: m.heure,
    home_elo: m.home_elo,
    away_elo: m.away_elo,
    cote_domicile: m.cote_domicile,
    cote_exterieur: m.cote_exterieur,
    favoris: m.favoris
  }));

  const prompt = `Choisis le MEILLEUR pick parmi ces ${matches.length} matchs.
Critères: cote 1.40-2.20, prob≥63%, vainqueur. Cherche d'abord 8/10+ (PREMIUM), sinon 7/10 (STANDARD).

Matchs:
${JSON.stringify(minMatches)}

Réponds UNIQUEMENT en JSON:
{"pick":{"match":"X vs Y","sport":"Football","competition":"Ligue","heure":"21h00","favori":"X","marche":"X Vainqueur","cote":1.65,"note":8.5,"prob":0.68,"threshold":8,"mise_type":"PICK PREMIUM","mise_euros":10,"label_visuel":"⭐ PICK PREMIUM","message_abonnes":"","raison":"courte raison","points_forts":["point1"],"avertissement":"","stops_ok":true,"votes":{"groq":"GO","gemini":"GO","deepseek":"GO","mistral":"GO","qwen":"GO","claude":"GO"}}}`;

  try {
    console.log(`   [DEBUG] OR_KEY défini: ${!!OR_KEY}`);
    // Claude via OpenRouter (coûte moins cher que l'API Anthropic)
    const r = await post("openrouter.io", "/api/v1/chat/completions",
      {"Authorization":`Bearer ${OR_KEY}`,"HTTP-Referer":"https://touslesmatchs.com","Content-Type":"application/json"},
      { model:"anthropic/claude-3-5-sonnet", max_tokens:2000, temperature:0.1,
        messages:[{role:"user",content:prompt}]
      }
    );
    console.log(`   [DEBUG] API response keys: ${Object.keys(r).join(",")}`);
    if (r.error) console.log(`   [DEBUG] API error: ${JSON.stringify(r.error)}`);
    const text = r.choices?.[0]?.message?.content || "";
    console.log(`   Claude brut (OpenRouter): ${text.slice(0,300)}`);
    const result = safeJSON(text);
    if (!result?.pick) console.log("   ⚠️ Claude: JSON parsé mais pas de .pick trouvé");
    return result;
  } catch(e) {
    console.error("Claude error:", e.message);
    console.log("⚠️ Claude a échoué — DeepSeek prend le relais...");
    return await deepseekFallback(matches);
  }
}

// ============================================================
// FALLBACK — DEEPSEEK SI CLAUDE ÉCHOUE
// ============================================================
async function deepseekFallback(matches) {
  console.log("🟠 DeepSeek FALLBACK — Chef du Concile...");
  try {
    console.log(`   [DEBUG] DEEPSEEK_KEY défini: ${!!DEEPSEEK_KEY}`);
    const r = await post("api.deepseek.com", "/v1/chat/completions",
      {"Authorization":`Bearer ${DEEPSEEK_KEY}`,"Content-Type":"application/json"},
      { model:"deepseek-chat", max_tokens:2000, temperature:0.1,
        messages:[{role:"user",content:`Tu es le Chef du Concile V5 en remplacement de Claude. Choisis le meilleur pick parmi ces matchs. Cote 1.40-2.20, prob ≥63%, vainqueur uniquement. Essaie d'abord d'atteindre note ≥8.0 (threshold=8, mise_type="PICK PREMIUM", label_visuel="⭐ PICK PREMIUM"). Si impossible, descends à 7.0 (threshold=7, mise_type="PICK STANDARD", label_visuel="🔔 PICK STANDARD", message_abonnes="Critères habituels (8/10) non atteints aujourd'hui. Pick publié à seuil réduit 7/10 pour les abonnés.", avertissement="Confiance réduite — mise conseillée : 5€ max"). Réponds en JSON: {"pick":{"match":"X vs Y","sport":"Football","competition":"Ligue","heure":"21h00","favori":"X","marche":"X Vainqueur","cote":1.65,"note":7.5,"prob":0.65,"threshold":7,"mise_type":"PICK STANDARD","mise_euros":5,"label_visuel":"🔔 PICK STANDARD","message_abonnes":"Critères habituels non atteints","avertissement":"Confiance réduite — mise conseillée : 5€ max","raison":"raison courte","points_forts":["point1"],"stops_ok":true,"votes":{"groq":"GO","gemini":"GO","deepseek":"GO","mistral":"GO","qwen":"GO","claude":"FALLBACK"}}}. Matchs: ${JSON.stringify(matches)}`}]
      }
    );
    const text = r.choices?.[0]?.message?.content || "";
    console.log(`   DeepSeek fallback brut (200c): ${text.slice(0,200)}`);
    return safeJSON(text);
  } catch(e) {
    console.error("DeepSeek fallback error:", e.message);
    return null;
  }
}

// ============================================================
// ÉTAPE 6 — MISE À JOUR App.js
// ============================================================
function updateAppJs(pick, displayDate) {
  const appPath = "./src/App.js";
  const dateStr = displayDate || TODAY;
  let content = fs.readFileSync(appPath, "utf8");

  const threshold = (pick.note >= 8) ? 8 : 7;
  const aiScore   = pick.note || 0;

  // Anti-doublon : retire un éventuel pick EN ATTENTE déjà présent pour cette date
  const dedupe = new RegExp(
    '  \\["' + dateStr.replace('/', '\\/') + '"[^\\n]*"EN ATTENTE"[^\\n]*\\],\\n', 'g'
  );
  content = content.replace(dedupe, "");

  // Format: [date, match, marche, cote, score, statut, sport, aiScore, threshold]
  const newPick = `  ["${dateStr}","${pick.match}","${pick.marche}","${pick.cote}","—","EN ATTENTE","${pick.sport}",${aiScore},${threshold}],\n`;

  // Supporte les deux formats de picks array (const ou var)
  if (content.includes("const picks = [\n")) {
    content = content.replace("const picks = [\n", `const picks = [\n${newPick}`);
  } else {
    content = content.replace("var picks = [\n", `var picks = [\n${newPick}`);
  }
  fs.writeFileSync(appPath, content);
  const label = threshold === 8 ? "⭐ PREMIUM" : "🔔 STANDARD 7/10";
  console.log(`✅ Pick ${dateStr} ajouté [${label}]: ${pick.match} @ ${pick.cote} — Note: ${aiScore}/10`);
}

function updateAppJsNoPick(reason) {
  const appPath = "./src/App.js";
  let content = fs.readFileSync(appPath, "utf8");

  const recentNopick = content.match(/\["(\d{2}\/\d{2}) au (\d{2}\/\d{2})","PAS DE PARI/);
  if (recentNopick) {
    content = content.replace(
      /\["\d{2}\/\d{2} au (\d{2}\/\d{2})","PAS DE PARI/,
      `["${recentNopick[1]} au ${TODAY}","PAS DE PARI`
    );
  } else {
    const noPick = `  ["${TODAY}","PAS DE PARI - Aucun match n atteint notre seuil 7/10","---","---","---","NOPICK",""],\n`;
    content = content.replace(/var picks = \[\n/, `var picks = [\n${noPick}`);
  }
  fs.writeFileSync(appPath, content);
  console.log("📝 NOPICK mis à jour");
}

// ============================================================
// ÉTAPE 7 — GIT COMMIT
// ============================================================
function gitCommit(msg) {
  try {
    execSync("git add src/App.js", {stdio:"inherit"});
    execSync(`git commit -m "🤖 Hermès ${TODAY}: ${msg}"`, {stdio:"inherit"});
    execSync("git push origin main", {stdio:"inherit"});
    console.log("✅ Git push réussi");
  } catch(e) {
    console.error("Git error:", e.message);
  }
}

// ============================================================
// SCAN FALLBACK — DEEPSEEK SI GROQ ÉCHOUE
// ============================================================
async function scanMatchesDeepSeekFallback(targetISO) {
  console.log("🟠 DeepSeek — Scan de secours...");
  const today = targetISO || new Date().toISOString().slice(0,10);
  try {
    const r = await post("api.deepseek.com", "/v1/chat/completions",
      {"Authorization":`Bearer ${DEEPSEEK_KEY}`,"Content-Type":"application/json"},
      { model:"deepseek-chat", max_tokens:2000, temperature:0.2,
        messages:[{role:"user",content:`Date: ${today}. Liste TOUS les matchs sportifs majeurs d'aujourd'hui dans le monde (Hockey NHL, NBA, Football Europe, MLS, MLB). Je veux absolument au moins 3 matchs. Cote favori entre 1.30 et 2.50. Réponds UNIQUEMENT en JSON: {"matches":[{"sport":"Hockey","competition":"NHL","home":"Team A","away":"Team B","heure":"20h00","home_form":"VVV","away_form":"NVV","home_elo":1800,"away_elo":1750,"enjeu":"Playoffs","cote_domicile":1.60,"cote_exterieur":2.40,"favoris":"home","absents_exterieur":[]}]}`}]
      }
    );
    const text = r.choices?.[0]?.message?.content || "";
    const parsed = safeJSON(text);
    return parsed?.matches || [];
  } catch(e) {
    console.error("DeepSeek scan fallback error:", e.message);
    return [];
  }
}

// ============================================================
// FORCE PICK 7/10 — DERNIER RECOURS
// ============================================================
async function forcePick7(matches) {
  console.log("🔶 Force pick 7/10 — meilleur match disponible...");
  if (!matches.length) return null;
  try {
    const r = await post("api.deepseek.com", "/v1/chat/completions",
      {"Authorization":`Bearer ${DEEPSEEK_KEY}`,"Content-Type":"application/json"},
      { model:"deepseek-chat", max_tokens:1500, temperature:0.1,
        messages:[{role:"user",content:`Choisis le MEILLEUR match parmi ceux-ci pour un pari sportif aujourd'hui. Critères : favori le plus solide, forme la plus régulière, enjeu le plus clair. Attribue-lui une note entre 7.0 et 7.9 (threshold=7). Réponds en JSON: {"pick":{"match":"X vs Y","sport":"Hockey","competition":"NHL","heure":"20h00","favori":"X","marche":"X Vainqueur","cote":1.62,"note":7.2,"prob":0.64,"threshold":7,"mise_type":"PICK STANDARD","mise_euros":5,"label_visuel":"🔔 PICK STANDARD","message_abonnes":"Critères habituels (8/10) non atteints aujourd'hui. Pick publié à seuil réduit 7/10.","avertissement":"Confiance réduite — mise conseillée : 5€ max","raison":"Meilleur match disponible du jour","points_forts":["Favori solide"],"stops_ok":true,"votes":{"groq":"GO","gemini":"GO","deepseek":"GO","mistral":"GO","qwen":"GO","claude":"FORCE_7"}}}. Matchs disponibles: ${JSON.stringify(matches.slice(0,5))}`}]
      }
    );
    const text = r.choices?.[0]?.message?.content || "";
    console.log(`   ForcePick7 brut (200c): ${text.slice(0,200)}`);
    return safeJSON(text);
  } catch(e) {
    console.error("ForcePick7 error:", e.message);
    return null;
  }
}

// ============================================================
// ULTIME RECOURS — pick mécanique sans IA (jamais 0 match)
// ============================================================
function buildMechanicalPick(matches) {
  // Trie par cote favori (la plus basse = favori le plus net)
  const sorted = matches
    .filter(m => m.favoris && m.home && m.away)
    .sort((a, b) => {
      const coteA = a.favoris === "home" ? (a.cote_domicile || 9) : (a.cote_exterieur || 9);
      const coteB = b.favoris === "home" ? (b.cote_domicile || 9) : (b.cote_exterieur || 9);
      return coteA - coteB;
    });
  const best = sorted[0] || matches[0];
  if (!best) return null;
  const favori = best.favoris === "away" ? best.away : best.home;
  const cote = best.favoris === "away" ? (best.cote_exterieur || 1.60) : (best.cote_domicile || 1.60);
  console.log(`🔧 Pick mécanique: ${best.home} vs ${best.away} — favori ${favori} @ ${cote}`);
  return {
    pick: {
      match: `${best.home} vs ${best.away}`,
      sport: best.sport || "Foot",
      competition: best.competition || "",
      heure: best.heure || "20h00",
      favori,
      marche: `${favori} Vainqueur`,
      cote: Number(cote) || 1.60,
      note: 7.0,
      prob: 0.63,
      threshold: 7,
      mise_type: "PICK STANDARD",
      mise_euros: 5,
      label_visuel: "🔔 PICK STANDARD",
      message_abonnes: "Pick automatique — seuil 7/10.",
      avertissement: "Confiance réduite — mise conseillée : 5€ max",
      raison: `${favori} favori du match — meilleur rapport disponible`,
      points_forts: ["Favori identifié", "Disponible bookmakers FR"],
      stops_ok: true,
      votes: { groq: "GO", gemini: "GO", deepseek: "GO", mistral: "GO", qwen: "GO", claude: "MECHANICAL" }
    }
  };
}

// ============================================================
// PIPELINE — UN JOUR (scan → concile → pick)
// ============================================================
async function generateForDay(day) {
  console.log(`\n──────── ${day.label} (${day.fr}) ────────`);

  // 1. Scan matchs (TheSportsDB + Groq) pour la date cible
  let matches = await scanMatchesGroq(day.iso);
  console.log(`✅ ${matches.length} matchs trouvés pour ${day.fr}`);

  if (!matches.length) {
    console.log("⚠️ Groq n'a rien trouvé — fallback DeepSeek...");
    matches = await scanMatchesDeepSeekFallback(day.iso);
    console.log(`✅ DeepSeek fallback: ${matches.length} matchs`);
  }
  if (!matches.length) {
    console.log(`⚠️ Aucun match pour ${day.fr}`);
    return null;
  }

  // 2-4. Enrichissement du Concile (Gemini H2H, DeepSeek forme, Mistral contexte)
  matches = await checkH2HGemini(matches);
  matches = await analyzeFormDeepSeek(matches);
  matches = await checkContextMistral(matches);

  // 4b. Value bet (Qwen)
  matches = await checkValueQwen(matches);

  // 5. Décision finale (Claude chef → fallback DeepSeek → force 7/10 → mécanique)
  let result = await claudeChefConcile(matches);
  if (!result?.pick) {
    console.log("⚠️ Concile sans résultat — forçage du meilleur match à 7/10...");
    result = await forcePick7(matches);
  }
  if (!result?.pick) {
    console.log("⚠️ ForcePick7 échoué — pick mécanique (ultime recours)...");
    result = buildMechanicalPick(matches);
  }
  if (!result?.pick) {
    console.log(`❌ Impossible de trouver un pick pour ${day.fr}`);
    return null;
  }

  const pick = result.pick;
  console.log(`🎯 ${day.fr} — ${pick.match} @ ${pick.cote} — Note: ${pick.note}/10 (${pick.mise_type})`);
  updateAppJs(pick, day.fr);
  return pick;
}

// ============================================================
// MAIN — AUJOURD'HUI + DEMAIN + APRÈS-DEMAIN
// Garantit toujours au moins un match jouable à venir (seuil 8/10,
// repli automatique 7/10). NB : le Concile tourne 1× par jour ciblé.
// ============================================================
async function main() {
  console.log(`\n🏛️ HERMÈS V4 — CONCILE COMPLET — 3 JOURS — ${TODAY}\n`);
  console.log("👑 Claude (Chef) | 🟢 Groq | 🔵 Gemini | 🟠 DeepSeek | 🟣 Mistral | 🔴 Qwen\n");

  const days = [dateForOffset(0), dateForOffset(1), dateForOffset(2)];
  const picksByDay = [];

  for (const day of days) {
    try {
      const pick = await generateForDay(day);
      picksByDay.push({ day, pick });
    } catch (e) {
      console.error(`💥 Erreur ${day.fr}:`, e.message);
      picksByDay.push({ day, pick: null });
    }
  }

  const anyPick = picksByDay.some(p => p.pick);
  if (!anyPick) {
    console.log("\n⚠️ Aucun match validé sur les 3 jours — NOPICK");
    updateAppJsNoPick("Aucun match disponible");
    gitCommit("NO PICK - 3 jours sans match");
    await sendTelegram("⏸ Aucun match validé pour aujourd'hui, demain ou après-demain.");
    return;
  }

  // Un seul commit pour les 3 jours
  gitCommit(`PICKS 3 jours — ${picksByDay.filter(p => p.pick).map(p => p.day.fr).join(", ")}`);

  // 📱 Notification Telegram récapitulative (aujourd'hui + demain + après-demain)
  const sportEmoji = s => ({Football:"⚽",Foot:"⚽",Hockey:"🏒",Basketball:"🏀",Baseball:"⚾",F1:"🏎️"}[s] || "🎯");
  let msg = `📅 <b>PROGRAMME TOUSLESMATCHS</b>\n\n`;
  for (const { day, pick } of picksByDay) {
    if (pick) {
      const seuil = (pick.note >= 8) ? "🟢 8/10" : "🟡 7/10";
      msg += `<b>${day.label}</b> (${day.fr})\n` +
        `${sportEmoji(pick.sport)} <b>${pick.match}</b>\n` +
        `🎯 ${pick.marche} — Cote <b>${pick.cote}</b> — ${seuil}\n` +
        `📝 ${pick.raison}\n\n`;
    } else {
      msg += `<b>${day.label}</b> (${day.fr})\n⏳ Pas encore de match validé — mise à jour automatique.\n\n`;
    }
  }
  msg += `⬇️ <b>Choisis ton bookmaker et parie :</b>`;
  await sendTelegram(msg, true);

  console.log("\n✅ HERMÈS a terminé — 3 jours mis à jour + Telegram envoyé !");
}

main().catch(e => {
  console.error("💥 Erreur fatale:", e);
  process.exit(1);
});


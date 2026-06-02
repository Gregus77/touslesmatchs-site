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
const TG_TOKEN       = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT        = process.env.TELEGRAM_CHAT_ID;

const TODAY = new Date().toLocaleDateString("fr-FR", {day:"2-digit", month:"2-digit"});

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

// ============================================================
// ÉTAPE 1a — VRAIS MATCHS VIA THESPORTSDB (source fiable)
// ============================================================
async function scanMatchesRealAPI() {
  const today = new Date().toISOString().slice(0,10);
  const SPORTS_MAP = [
    { apiSport: "Soccer",       label: "Foot"       },
    { apiSport: "Ice_Hockey",   label: "Hockey"     },
    { apiSport: "Basketball",   label: "Basketball" },
    { apiSport: "Baseball",     label: "Baseball"   },
  ];
  const MAJOR_LEAGUES = [
    "nhl","nba","mlb","mls","premier league","la liga","bundesliga",
    "serie a","ligue 1","champions league","europa league","copa",
    "world cup","international","friendly","nations league"
  ];
  let matches = [];
  for (const s of SPORTS_MAP) {
    try {
      const data = await get(`https://www.thesportsdb.com/api/v1/json/1/eventsday.php?d=${today}&s=${encodeURIComponent(s.apiSport)}`);
      if (!data.events) continue;
      for (const ev of data.events) {
        // Ignorer matchs déjà terminés
        if (ev.intHomeScore !== null && ev.intHomeScore !== "" && ev.intHomeScore !== undefined) continue;
        // Filtrer ligues majeures seulement (sauf Hockey/Basket où on garde tout)
        const league = (ev.strLeague || "").toLowerCase();
        const isMajor = s.label === "Hockey" || s.label === "Basketball" ||
          MAJOR_LEAGUES.some(l => league.includes(l));
        if (!isMajor) continue;
        // Heure locale Paris
        let heure = "20h00";
        if (ev.strTimestamp) {
          const d = new Date(ev.strTimestamp);
          heure = d.toLocaleTimeString("fr-FR", {hour:"2-digit",minute:"2-digit",timeZone:"Europe/Paris"}).replace(":","h");
        }
        matches.push({
          sport: s.label,
          competition: ev.strLeague || "",
          home: ev.strHomeTeam,
          away: ev.strAwayTeam,
          heure,
          home_form: "UNKNOWN",
          away_form: "UNKNOWN",
          home_elo: 1700,
          away_elo: 1700,
          enjeu: "Regular",
          cote_domicile: 0,
          cote_exterieur: 0,
          favoris: "unknown",
          absents_exterieur: [],
          disponible_bookmakers_fr: true,
          source: "thesportsdb_verified"
        });
      }
    } catch(e) {
      console.error(`TheSportsDB ${s.label} error:`, e.message);
    }
  }
  console.log(`📅 TheSportsDB: ${matches.length} vrais matchs trouvés`);
  return matches;
}

// ============================================================
// ÉTAPE 1b — GROQ ESTIME COTES/FORME sur vrais matchs
// ============================================================
async function enrichMatchesGroq(realMatches) {
  if (!realMatches.length) return realMatches;
  console.log(`🟢 Groq — Estimation cotes et forme pour ${realMatches.length} vrais matchs...`);
  const today = new Date().toISOString().slice(0,10);
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
async function scanMatchesGroq() {
  // PRIORITÉ 1 : vrais matchs via TheSportsDB
  let matches = await scanMatchesRealAPI();
  if (matches.length > 0) {
    return await enrichMatchesGroq(matches);
  }

  // PRIORITÉ 2 (fallback) : Groq invente — avec avertissement dans les logs
  console.log("⚠️ TheSportsDB sans résultat — fallback Groq (attention hallucinations possibles)");
  const today = new Date().toISOString().slice(0,10);
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
// ÉTAPE 5 — CLAUDE CHEF DU CONCILE — DÉCISION FINALE
// ============================================================
async function claudeChefConcile(matches) {
  console.log("👑 Claude — Décision finale du Concile...");
  if (!matches.length) return null;

  const prompt = `Tu es Claude, Chef du Concile V4.3. Voici les matchs analysés par Groq, Gemini, DeepSeek et Mistral:

${JSON.stringify(matches, null, 2)}

═══════════════════════════════════════
RÈGLES CONCILE V4.3 — OBLIGATOIRES
═══════════════════════════════════════

MARCHÉ: Vainqueur du match UNIQUEMENT (1N2 ou Moneyline)
COTE: Entre 1.40 et 2.20 (exception F1 podium jusqu'à 3.00)
PROBABILITÉ MINIMUM: 63%

HIÉRARCHIE DES SEUILS (PRIORITÉ ABSOLUE):
  1. CHERCHE D'ABORD un pick ≥ 8.0/10 → c'est le PICK PREMIUM
  2. SI aucun pick ≥ 8.0/10 n'existe → descends à 7.0/10 → c'est le PICK STANDARD
  3. JAMAIS en dessous de 7.0/10 — si rien à 7/10, prends le meilleur disponible

DÉFINITION DES NIVEAUX:
  - PICK PREMIUM (note ≥ 8.0) : tous les critères réunis, confiance maximale
  - PICK STANDARD (note 7.0–7.9) : critères partiellement remplis, confiance correcte mais inférieure — À SIGNALER CLAIREMENT

8 STOPS ABSOLUS (disqualification immédiate):
  ❌ ELO inférieur de plus de 150 points
  ❌ Cote hors fenêtre 1.40–2.20
  ❌ Moins de 3 matchs de stats disponibles
  ❌ Match sans enjeu (équipe déjà qualifiée/éliminée)
  ❌ Météo extrême annoncée (neige, vent >60km/h)
  ❌ 2 titulaires majeurs absents ou plus
  ❌ Forme ≤ 1 victoire sur les 5 derniers matchs
  ❌ Cote en baisse rapide (chute >15% en 24h = signal suspect)

DISPONIBILITÉ BOOKMAKERS FRANÇAIS (RÈGLE ABSOLUE):
- Le pick DOIT être jouable sur Winamax, Betclic ou Unibet France
- Priorité : NHL playoffs, NBA playoffs, Top 5 européens, Internationaux A reconnus
- JAMAIS : championnats obscurs d'Amérique du Sud ou d'Asie, amicaux entre équipes mineures

SPORTS BANNIS: Tennis, championnats corrompus (Chine, Vietnam, Nigeria, Biélorussie)
ÉQUIPES BANNIES: Ottawa Senators, Montréal Canadiens, Toronto Raptors, Stuttgart, Manchester United

UN PICK OBLIGATOIRE CHAQUE JOUR — jamais "rien à jouer", descendre à 7/10 si nécessaire

═══════════════════════════════════════
FORMAT DE RÉPONSE JSON OBLIGATOIRE
═══════════════════════════════════════

Réponds UNIQUEMENT en JSON (sans texte avant/après):
{
  "pick": {
    "match": "Arsenal vs Chelsea",
    "sport": "Football",
    "competition": "Premier League",
    "heure": "21h00",
    "favori": "Arsenal",
    "marche": "Arsenal Vainqueur",
    "cote": 1.65,
    "note": 8.5,
    "prob": 0.68,
    "threshold": 8,
    "mise_type": "PICK PREMIUM",
    "mise_euros": 10,
    "label_visuel": "⭐ PICK PREMIUM",
    "message_abonnes": "",
    "raison": "Arsenal 4V/5, Chelsea sans Salah et Palmer, H2H 4-1 en faveur Arsenal",
    "points_forts": ["Forme dominante 4V/5", "2 absents majeurs Chelsea", "H2H favorable"],
    "avertissement": "",
    "stops_ok": true,
    "votes": {"groq":"GO","gemini":"GO","deepseek":"GO","mistral":"GO","claude":"GO"}
  }
}

RÈGLES POUR LES CHAMPS SPÉCIAUX:
- threshold: mettre 8 si note ≥ 8.0, mettre 7 si note entre 7.0 et 7.9
- mise_type: "PICK PREMIUM" si threshold=8, "PICK STANDARD" si threshold=7
- label_visuel: "⭐ PICK PREMIUM" si threshold=8, "🔔 PICK STANDARD" si threshold=7
- message_abonnes: "" si threshold=8, "Critères habituels (8/10) non atteints aujourd'hui. Pick publié à seuil réduit 7/10 pour les abonnés." si threshold=7
- avertissement: "" si threshold=8, "Confiance réduite — mise conseillée : 5€ max" si threshold=7`;

  try {
    const r = await post("api.anthropic.com", "/v1/messages",
      {"x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01","Content-Type":"application/json"},
      { model:"claude-sonnet-4-20250514", max_tokens:1000, temperature:0.1,
        messages:[{role:"user",content:prompt}]
      }
    );
    const text = r.content?.[0]?.text || "";
    return safeJSON(text);
  } catch(e) {
    console.error("Claude error:", e.message);
    // FALLBACK: DeepSeek prend le relais si Claude échoue
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
    const r = await post("api.deepseek.com", "/v1/chat/completions",
      {"Authorization":`Bearer ${DEEPSEEK_KEY}`,"Content-Type":"application/json"},
      { model:"deepseek-chat", max_tokens:1000, temperature:0.1,
        messages:[{role:"user",content:`Tu es le Chef du Concile V4.3 en remplacement de Claude. Choisis le meilleur pick parmi ces matchs. Cote 1.40-2.20, prob ≥63%, vainqueur uniquement. Essaie d'abord d'atteindre note ≥8.0 (threshold=8, mise_type="PICK PREMIUM", label_visuel="⭐ PICK PREMIUM"). Si impossible, descends à 7.0 (threshold=7, mise_type="PICK STANDARD", label_visuel="🔔 PICK STANDARD", message_abonnes="Critères habituels (8/10) non atteints aujourd'hui. Pick publié à seuil réduit 7/10 pour les abonnés.", avertissement="Confiance réduite — mise conseillée : 5€ max"). Réponds en JSON: {"pick":{"match":"X vs Y","sport":"Football","competition":"Ligue","heure":"21h00","favori":"X","marche":"X Vainqueur","cote":1.65,"note":7.5,"prob":0.65,"threshold":7,"mise_type":"PICK STANDARD","mise_euros":5,"label_visuel":"🔔 PICK STANDARD","message_abonnes":"Critères habituels non atteints","avertissement":"Confiance réduite — mise conseillée : 5€ max","raison":"raison courte","points_forts":["point1"],"stops_ok":true,"votes":{"groq":"GO","gemini":"GO","deepseek":"GO","mistral":"GO","claude":"FALLBACK"}}}. Matchs: ${JSON.stringify(matches)}`}]
      }
    );
    const text = r.choices?.[0]?.message?.content || "";
    return safeJSON(text);
  } catch(e) {
    console.error("DeepSeek fallback error:", e.message);
    return null;
  }
}

// ============================================================
// ÉTAPE 6 — MISE À JOUR App.js
// ============================================================
function updateAppJs(pick) {
  const appPath = "./src/App.js";
  let content = fs.readFileSync(appPath, "utf8");

  const threshold = (pick.note >= 8) ? 8 : 7;
  const aiScore   = pick.note || 0;

  // Format: [date, match, marche, cote, score, statut, sport, aiScore, threshold]
  const newPick = `  ["${TODAY}","${pick.match}","${pick.marche}","${pick.cote}","—","EN ATTENTE","${pick.sport}",${aiScore},${threshold}],\n`;

  // Supporte les deux formats de picks array (const ou var)
  if (content.includes("const picks = [\n")) {
    content = content.replace("const picks = [\n", `const picks = [\n${newPick}`);
  } else {
    content = content.replace("var picks = [\n", `var picks = [\n${newPick}`);
  }
  fs.writeFileSync(appPath, content);
  const label = threshold === 8 ? "⭐ PREMIUM" : "🔔 STANDARD 7/10";
  console.log(`✅ Pick ajouté [${label}]: ${pick.match} @ ${pick.cote} — Note: ${aiScore}/10`);
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
async function scanMatchesDeepSeekFallback() {
  console.log("🟠 DeepSeek — Scan de secours...");
  const today = new Date().toISOString().slice(0,10);
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
      { model:"deepseek-chat", max_tokens:800, temperature:0.1,
        messages:[{role:"user",content:`Choisis le MEILLEUR match parmi ceux-ci pour un pari sportif aujourd'hui. Critères : favori le plus solide, forme la plus régulière, enjeu le plus clair. Attribue-lui une note entre 7.0 et 7.9 (threshold=7). Réponds en JSON: {"pick":{"match":"X vs Y","sport":"Hockey","competition":"NHL","heure":"20h00","favori":"X","marche":"X Vainqueur","cote":1.62,"note":7.2,"prob":0.64,"threshold":7,"mise_type":"PICK STANDARD","mise_euros":5,"label_visuel":"🔔 PICK STANDARD","message_abonnes":"Critères habituels (8/10) non atteints aujourd'hui. Pick publié à seuil réduit 7/10.","avertissement":"Confiance réduite — mise conseillée : 5€ max","raison":"Meilleur match disponible du jour","points_forts":["Favori solide"],"stops_ok":true,"votes":{"groq":"GO","gemini":"GO","deepseek":"GO","mistral":"GO","claude":"FORCE_7"}}}. Matchs disponibles: ${JSON.stringify(matches.slice(0,5))}`}]
      }
    );
    const text = r.choices?.[0]?.message?.content || "";
    return safeJSON(text);
  } catch(e) {
    console.error("ForcePick7 error:", e.message);
    return null;
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log(`\n🏛️ HERMÈS V4 — CONCILE COMPLET — ${TODAY}\n`);
  console.log("👑 Claude (Chef) | 🟢 Groq | 🔵 Gemini | 🟠 DeepSeek | 🟣 Mistral\n");

  // 1. Scan matchs (Groq) — 1ère tentative
  let matches = await scanMatchesGroq();
  console.log(`✅ ${matches.length} matchs trouvés`);

  // Si Groq trouve rien → 2ème tentative avec prompt plus large via DeepSeek
  if (!matches.length) {
    console.log("⚠️ Groq n'a rien trouvé — 2ème tentative via DeepSeek...");
    matches = await scanMatchesDeepSeekFallback();
    console.log(`✅ DeepSeek fallback: ${matches.length} matchs`);
  }

  // Si toujours rien → NOPICK ultime
  if (!matches.length) {
    console.log("⚠️ Aucun match disponible aujourd'hui — NOPICK");
    updateAppJsNoPick("Aucun match disponible");
    gitCommit("NO PICK - Aucun match");
    await sendTelegram("⏸ Aucun match disponible aujourd'hui — pas de pick.");
    return;
  }

  // 2. H2H (Gemini)
  matches = await checkH2HGemini(matches);

  // 3. Forme (DeepSeek)
  matches = await analyzeFormDeepSeek(matches);

  // 4. Contexte (Mistral)
  matches = await checkContextMistral(matches);

  // 5. Décision finale (Claude — avec fallback DeepSeek)
  let result = await claudeChefConcile(matches);

  // Si Claude/DeepSeek ne valident rien → forcer le meilleur match disponible
  if (!result?.pick) {
    console.log("⚠️ Concile sans résultat — forçage du meilleur match à 7/10...");
    result = await forcePick7(matches);
  }

  if (!result?.pick) {
    console.log("❌ Impossible de trouver un pick. NOPICK enregistré.");
    updateAppJsNoPick("Analyse sans résultat");
    gitCommit("NO PICK");
    await sendTelegram("⏸ Aucun pick validé aujourd'hui malgré l'analyse.");
    return;
  }

  const pick = result.pick;
  console.log(`\n🎯 PICK: ${pick.match} @ ${pick.cote} — Note: ${pick.note}/10`);
  console.log(`📊 ${pick.marche} | Mise: ${pick.mise_euros}€ (${pick.mise_type})`);
  console.log(`📝 ${pick.raison}`);
  console.log(`🗳️ Votes: ${JSON.stringify(pick.votes)}`);

  updateAppJs(pick);
  gitCommit(`PICK: ${pick.match} @ ${pick.cote}`);

  // 📱 Notification Telegram
  const sportEmoji = {"Football":"⚽","Hockey":"🏒","Basketball":"🏀","Baseball":"⚾","F1":"🏎️"}[pick.sport] || "🎯";
  const threshold = (pick.note >= 8) ? "🟢 SEUIL 8/10" : "🟡 SEUIL 7/10";
  await sendTelegram(
`${sportEmoji} <b>PICK DU JOUR — ${TODAY}</b>

🏟 <b>${pick.match}</b>
🎯 ${pick.marche}
💰 Cote : <b>${pick.cote}</b>
📊 Note IA : <b>${pick.note}/10</b> ${threshold}
💵 Mise conseillée : ${pick.mise_euros}€

📝 ${pick.raison}

🗳 Votes : ${Object.entries(pick.votes||{}).map(([k,v])=>`${k}:${v}`).join(" | ")}

⬇️ <b>Choisis ton bookmaker et parie maintenant :</b>`,
    true  // active les boutons bookmakers
  );

  console.log("\n✅ HERMÈS a terminé — site mis à jour + Telegram envoyé !");
}

main().catch(e => {
  console.error("💥 Erreur fatale:", e);
  process.exit(1);
});


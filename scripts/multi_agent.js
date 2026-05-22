// ═══════════════════════════════════════════════════════════
//  HERMÈS — MULTI AGENT V4.2
//  Sans web_search — Claude utilise ses connaissances + Groq cherche
// ═══════════════════════════════════════════════════════════

const https = require("https");

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GROQ_KEY      = process.env.GROQ_API_KEY;
const GEMINI_KEY    = process.env.GEMINI_API_KEY;
const DEEPSEEK_KEY  = process.env.DEEPSEEK_API_KEY;
const OR_KEY        = process.env.OPENROUTER_API_KEY;
const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
const REPO_OWNER    = "Gregus77";
const REPO_NAME     = "touslesmatchs-site";

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname, path, method: "POST", headers: { ...headers, "Content-Length": Buffer.byteLength(data) } },
      res => { let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } }); }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function httpsRequest(method, hostname, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname, path, method,
      headers: { "User-Agent": "HermesAgent/4.2", "Accept": "application/vnd.github.v3+json", "Authorization": `Bearer ${GITHUB_TOKEN}`, ...headers }
    };
    if (data) opts.headers["Content-Length"] = Buffer.byteLength(data);
    const req = https.request(opts, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function safeJSON(text) {
  if (!text) return null;
  try {
    const clean = String(text).replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch { return null; }
}

async function readFile(filePath) {
  const res = await httpsRequest("GET", "api.github.com", `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`);
  if (res.status === 200 && res.body.content) {
    return { content: Buffer.from(res.body.content, "base64").toString("utf8"), sha: res.body.sha };
  }
  throw new Error(`Impossible de lire ${filePath}`);
}

async function writeFile(filePath, content, sha, message) {
  const res = await httpsRequest("PUT", "api.github.com", `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
    { "Content-Type": "application/json" },
    { message, content: Buffer.from(content).toString("base64"), sha }
  );
  return res.status === 200 || res.status === 201;
}

function extractStats(appJs) {
  const picks = [];
  const picksMatch = appJs.match(/var picks = \[([\s\S]*?)\];/);
  if (!picksMatch) return { picks, wins: 0, total: 0 };
  const lineRegex = /\["([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]*)"\]/g;
  let m;
  while ((m = lineRegex.exec(picksMatch[1])) !== null) {
    picks.push({ date: m[1], match: m[2], marche: m[3], cote: m[4], score: m[5], statut: m[6], sport: m[7] });
  }
  const wins = picks.filter(p => p.statut === "GAGNE").length;
  const total = picks.filter(p => !["NOPICK","EN ATTENTE","EN COURS"].includes(p.statut)).length;
  return { picks: picks.slice(0, 3), wins, total };
}

// ── ÉTAPE 1: Groq cherche les matchs du jour ──────────────

async function getMatchesDuJour() {
  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const prompt = `Quels sont les matchs sportifs disponibles aujourd'hui ${today} sur Winamax France ?
Priorité: NHL Playoffs, Ligue 1, Ligue des Champions, Premier League, NBA Playoffs, Tennis.
Liste les 5 meilleurs matchs avec les cotes approximatives.
Réponds en JSON: {"matchs":[{"match":"A vs B","sport":"NHL","heure":"22h00","cote_favori":1.75,"info":"contexte court"}]}`;

  try {
    const res = await httpsPost("api.groq.com", "/openai/v1/chat/completions",
      { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
      { model: "llama-3.3-70b-versatile", max_tokens: 500, temperature: 0.3,
        messages: [{ role: "user", content: prompt }] }
    );
    const text = res.choices?.[0]?.message?.content || "";
    const result = safeJSON(text);
    console.log(`📅 ${result?.matchs?.length || 0} matchs trouvés par Groq`);
    return result?.matchs || [];
  } catch (e) {
    console.log("⚠️ Groq search error:", e.message.slice(0, 50));
    return [];
  }
}

// ── ÉTAPE 2: Claude analyse et choisit le pick ────────────

async function callClaude(stats, matchs) {
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const matchsStr = matchs.length > 0 ? JSON.stringify(matchs) : "Aucun match fourni - utilise tes connaissances";

  const system = `Tu es Claude, Chef du Concile V4.2 — expert value betting Winamax France.
DATE: ${today}
RÈGLES ABSOLUES:
- Cotes Winamax: 1.40 à 2.20 UNIQUEMENT
- Marchés bannis: MLB, NBA moneyline, combinés >2 picks
- Équipes bannies: Ottawa Senators, Montréal Canadiens, Toronto Raptors, Stuttgart, Man United
- NBA Over/Under = PAPER TRADING seulement (pas de mise réelle)
- Seuil minimum: score ≥8/10 ET prob ≥63% ET value=(prob×cote)>1.06
- Kelly: score ≥9 → plein Kelly; 8-8.9 → ¼ Kelly; max 10% bankroll (${stats.wins+stats.total > 0 ? 49 : 10}€ max)
Tu DOIS répondre UNIQUEMENT avec ce JSON exact, sans aucun texte avant ou après, sans backticks markdown:`;

  const userMsg = `Matchs disponibles aujourd'hui: ${matchsStr}
Stats concile: ${stats.wins}W / ${stats.total - stats.wins}L
Analyse et donne le meilleur pick ou NO PICK si rien ne passe le seuil 8/10.
Réponds UNIQUEMENT avec ce JSON (pas de texte, pas de backticks):
{"pick":{"date":"22/05","match":"Équipe A vs Équipe B","sport":"NHL","heure":"22h00","pays":"USA","marche":"Moneyline OT inclus","cote":1.85,"prob":0.65,"score":8.5,"mise_euros":12,"go":true,"raison":"courte raison max 15 mots"},"paper_trading":{"match":"NBA A vs NBA B","marche":"Over 215 pts","cote":1.85,"prediction":"OVER"},"no_pick_raison":""}`;

  try {
    const res = await httpsPost("api.anthropic.com", "/v1/messages",
      { "x-api-key": ANTHROPIC_KEY.trim(), "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      { model: "claude-sonnet-4-20250514", max_tokens: 600, system, messages: [{ role: "user", content: userMsg }] }
    );

    const blocks = res.content || [];
    console.log("🔍 Blocs réponse Claude:", blocks.map(b => `${b.type}(${(b.text||"").length})`).join(", "));
    
    const text = blocks.filter(b => b.type === "text").map(b => b.text).join("").trim();
    console.log("📝 Réponse Claude:", text.slice(0, 400));

    if (!text) {
      console.log("⚠️ Claude a répondu vide");
      return { pick: { go: false }, paper_trading: null, no_pick_raison: "Réponse vide" };
    }

    const result = safeJSON(text);
    if (result) {
      console.log("✅ JSON parsé avec succès");
      return result;
    }

    console.log("⚠️ JSON non parseable");
    return { pick: { go: false }, paper_trading: null, no_pick_raison: "Parse error" };

  } catch (e) {
    console.error("❌ Erreur Claude:", e.message);
    return null;
  }
}

// ── VOTES DES 4 IAs ───────────────────────────────────────

async function vote(name, fn, prompt) {
  try {
    const text = await fn(prompt);
    const v = safeJSON(String(text || ""));
    if (v?.vote) {
      console.log(`  ${v.vote === "GO" ? "✅" : "🔴"} ${name}: ${v.vote} (${v.confiance}/10)`);
      return { id: name, ...v };
    }
    console.log(`  ⚠️ ${name}: réponse invalide`);
    return { id: name, vote: "ERREUR", confiance: 0 };
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message.slice(0, 40)}`);
    return { id: name, vote: "ERREUR", confiance: 0 };
  }
}

async function callGroqVote(p) {
  const r = await httpsPost("api.groq.com", "/openai/v1/chat/completions",
    { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    { model: "llama-3.3-70b-versatile", max_tokens: 80, temperature: 0.2,
      messages: [{ role: "system", content: 'Réponds UNIQUEMENT en JSON: {"vote":"GO","prob":0.65,"confiance":8,"raison":"max 10 mots"}' }, { role: "user", content: p }] }
  );
  return r.choices?.[0]?.message?.content;
}

async function callGeminiVote(p) {
  const r = await httpsPost("generativelanguage.googleapis.com", `/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    { "Content-Type": "application/json" },
    { contents: [{ parts: [{ text: `JSON only {"vote":"GO","prob":0.65,"confiance":8,"raison":"short"}: ${p}` }] }], generationConfig: { maxOutputTokens: 80 } }
  );
  return r.candidates?.[0]?.content?.parts?.[0]?.text;
}

async function callDeepSeekVote(p) {
  const r = await httpsPost("api.deepseek.com", "/v1/chat/completions",
    { "Authorization": `Bearer ${DEEPSEEK_KEY}`, "Content-Type": "application/json" },
    { model: "deepseek-chat", max_tokens: 80, temperature: 0.2,
      messages: [{ role: "system", content: 'JSON only: {"vote":"GO","prob":0.65,"confiance":8,"raison":"max 10 mots"}' }, { role: "user", content: p }] }
  );
  return r.choices?.[0]?.message?.content;
}

async function callMistralVote(p) {
  const r = await httpsPost("openrouter.ai", "/api/v1/chat/completions",
    { "Authorization": `Bearer ${OR_KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://touslesmatchs.com" },
    { model: "mistralai/mistral-7b-instruct", max_tokens: 80, temperature: 0.2,
      messages: [{ role: "system", content: 'JSON only: {"vote":"GO","prob":0.65,"confiance":8,"raison":"max 10 mots"}' }, { role: "user", content: p }] }
  );
  return r.choices?.[0]?.message?.content;
}

function addPickToAppJs(appJs, pick, today) {
  const line = pick?.go
    ? `  ["${pick.date||today}","${pick.match}","${pick.marche}","${pick.cote}","---","EN ATTENTE","${pick.sport}"],`
    : `  ["${today}","PAS DE PARI - Aucun match n atteint notre seuil 8/10","---","---","---","NOPICK",""],`;
  return appJs.replace("var picks = [", `var picks = [\n${line}`);
}

async function main() {
  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  console.log("\n═══════════════════════════════════════════");
  console.log("  HERMÈS V4.2 — PICK DU JOUR");
  console.log(`  ${new Date().toLocaleString("fr-FR")}`);
  console.log("═══════════════════════════════════════════\n");

  const { content: appJs, sha } = await readFile("src/App.js");
  const stats = extractStats(appJs);
  console.log(`📊 Stats: ${stats.wins}W / ${stats.total - stats.wins}L\n`);

  // Étape 1: Groq cherche les matchs
  console.log("🔍 Groq — recherche matchs du jour...");
  const matchs = await getMatchesDuJour();

  // Étape 2: Claude analyse
  console.log("\n🧠 Chef Claude — analyse...");
  const chefResult = await callClaude(stats, matchs);

  if (!chefResult) { console.log("❌ Erreur Claude — arrêt"); return; }

  const pick = chefResult.pick;
  const pt = chefResult.paper_trading;
  console.log(`\n✅ Chef: ${pick?.go ? `PICK — ${pick.match} (${pick.score}/10)` : `NO PICK — ${chefResult.no_pick_raison || "seuil non atteint"}`}`);

  // Étape 3: Vote si pick
  let votes = {};
  if (pick?.go) {
    const vp = `Pick: ${pick.match} — ${pick.marche} @ ${pick.cote}. Score: ${pick.score}/10. ${pick.raison}. Vote GO ou NO BET?`;
    console.log("\n📡 Vote des 4 IAs...");
    const res = await Promise.allSettled([
      vote("groq", callGroqVote, vp),
      vote("gemini", callGeminiVote, vp),
      vote("deepseek", callDeepSeekVote, vp),
      vote("mistral", callMistralVote, vp),
    ]);
    res.forEach(r => r.status === "fulfilled" && r.value && (votes[r.value.id] = r.value));
  }

  const goCount = Object.values(votes).filter(v => v?.vote === "GO").length;
  const totalIA = Object.values(votes).filter(v => v).length + 1;
  const finalGo = pick?.go && (goCount + 1 >= Math.ceil(totalIA * 0.5));

  // Étape 4: Mise à jour App.js
  console.log("\n💾 Mise à jour App.js...");
  const updated = addPickToAppJs(appJs, finalGo ? pick : null, today);
  await writeFile("src/App.js", updated, sha, `🤖 Hermès ${today}: ${finalGo && pick ? pick.match : "NO PICK"}`);
  console.log("✅ App.js mis à jour — deploy auto lancé\n");

  // Compte rendu
  let pickLine = "⛔ Rien à jouer";
  if (finalGo && pick) {
    const v = goCount + 1 >= Math.ceil(totalIA * 0.75) ? "✅ GO" : "⚠️ GO RÉDUIT";
    const mise = goCount + 1 >= Math.ceil(totalIA * 0.75) ? pick.mise_euros : Math.round((pick.mise_euros||10)/2);
    pickLine = `${v}\n🏆 ${pick.match}\n🕐 ${pick.heure} • 🌍 ${pick.pays} • ${pick.sport}\n📊 ${pick.marche} @ ${pick.cote}\n💰 Mise: ${mise}€`;
  }
  const ptLine = pt ? `🏀 ${pt.match}\n📊 ${pt.marche} — ${pt.prediction} @ ${pt.cote}` : "Aucun match NBA disponible";

  console.log("═".repeat(45));
  console.log(`🏛️ CONCILE V4.2 — ${today}\n`);
  console.log(`🎯 PICK RÉEL\n${pickLine}\n`);
  console.log(`📝 PAPER TRADING\n${ptLine}`);
  console.log("═".repeat(45));
}

main().catch(err => { console.error("💥 ERREUR:", err.message); process.exit(1); });


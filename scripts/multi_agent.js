// ═══════════════════════════════════════════════════════════
//  HERMÈS — MULTI AGENT V4.2
//  Tourne chaque matin à 9h30 via GitHub Actions
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
    // Nettoyer le texte
    let clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    // Chercher le premier JSON valide
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return null;
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

async function callClaude(stats) {
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  
  const system = `Tu es Claude, Chef du Concile V4.2 — expert value betting Winamax France.
DATE: ${today} | STATS: ${stats.wins}W / ${stats.total - stats.wins}L

RÈGLES:
- Cotes: 1.40 à 2.20 UNIQUEMENT
- Marchés bannis: MLB, NBA moneyline, combinés >2
- Équipes bannies: Ottawa, Montréal Canadiens, Toronto Raptors, Stuttgart, Man United
- Sports: NHL Playoffs > Foot EU > Tennis > Volleyball > Baseball Japon
- NBA Over/Under = paper trading UNIQUEMENT (pas de mise réelle)
- Seuil: score ≥8/10 + prob ≥63%

IMPORTANT: Réponds UNIQUEMENT avec le JSON brut ci-dessous, sans aucun texte avant ou après, sans backticks:
{"pick":{"date":"JJ/MM","match":"Équipe A vs Équipe B","sport":"NHL","heure":"22h00","pays":"USA","marche":"Moneyline OT inclus","cote":1.85,"prob":0.65,"score":8.5,"mise_euros":12,"go":true,"raison":"courte raison"},"paper_trading":{"match":"NBA match","marche":"Over 215 pts","cote":1.85,"prediction":"OVER"},"no_pick_raison":""}`;

  try {
    const res = await httpsPost("api.anthropic.com", "/v1/messages",
      { "x-api-key": ANTHROPIC_KEY.trim(), "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        system,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: `Cherche les matchs disponibles aujourd'hui ${today} et donne le meilleur pick V4.2. Réponds UNIQUEMENT en JSON brut.` }]
      }
    );

    // Extraire tout le texte de la réponse
    const blocks = res.content || [];
    const text = blocks.filter(b => b.type === "text").map(b => b.text).join("");
    console.log("📝 Réponse Claude (brute):", text.slice(0, 300));
    
    const result = safeJSON(text);
    if (result) return result;
    
    // Si pas de JSON valide, créer un NO PICK par défaut
    console.log("⚠️ JSON non parseable, NO PICK par défaut");
    return { pick: { go: false }, paper_trading: null, no_pick_raison: "Analyse non disponible" };
    
  } catch (e) {
    console.error("❌ Erreur Claude:", e.message);
    return null;
  }
}

async function voteIA(name, promptFn, prompt) {
  try {
    const raw = await promptFn(prompt);
    const text = typeof raw === "string" ? raw : JSON.stringify(raw);
    const v = safeJSON(text) || safeJSON(raw?.choices?.[0]?.message?.content) || safeJSON(raw?.candidates?.[0]?.content?.parts?.[0]?.text);
    if (v) { console.log(`  ${v.vote === "GO" ? "✅" : "🔴"} ${name}: ${v.vote} (${v.confiance}/10) — ${v.raison}`); return { id: name, ...v }; }
    return { id: name, vote: "ERREUR", confiance: 0, raison: "parse error" };
  } catch (e) {
    console.log(`  ❌ ${name}: erreur — ${e.message.slice(0, 40)}`);
    return { id: name, vote: "ERREUR", confiance: 0, raison: e.message.slice(0, 30) };
  }
}

async function callGroq(p) {
  const r = await httpsPost("api.groq.com", "/openai/v1/chat/completions",
    { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    { model: "llama-3.3-70b-versatile", max_tokens: 100, temperature: 0.2, messages: [{ role: "system", content: 'JSON only: {"vote":"GO","prob":0.65,"confiance":8,"raison":"short"}' }, { role: "user", content: p }] }
  );
  return r.choices?.[0]?.message?.content;
}

async function callGemini(p) {
  const r = await httpsPost("generativelanguage.googleapis.com", `/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    { "Content-Type": "application/json" },
    { contents: [{ parts: [{ text: `JSON only: {"vote":"GO","prob":0.65,"confiance":8,"raison":"short"}\n${p}` }] }], generationConfig: { maxOutputTokens: 100 } }
  );
  return r.candidates?.[0]?.content?.parts?.[0]?.text;
}

async function callDeepSeek(p) {
  const r = await httpsPost("api.deepseek.com", "/v1/chat/completions",
    { "Authorization": `Bearer ${DEEPSEEK_KEY}`, "Content-Type": "application/json" },
    { model: "deepseek-chat", max_tokens: 100, temperature: 0.2, messages: [{ role: "system", content: 'JSON only: {"vote":"GO","prob":0.65,"confiance":8,"raison":"short"}' }, { role: "user", content: p }] }
  );
  return r.choices?.[0]?.message?.content;
}

async function callMistral(p) {
  const r = await httpsPost("openrouter.ai", "/api/v1/chat/completions",
    { "Authorization": `Bearer ${OR_KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://touslesmatchs.com" },
    { model: "mistralai/mistral-7b-instruct", max_tokens: 100, temperature: 0.2, messages: [{ role: "system", content: 'JSON only: {"vote":"GO","prob":0.65,"confiance":8,"raison":"short"}' }, { role: "user", content: p }] }
  );
  return r.choices?.[0]?.message?.content;
}

function addPickToAppJs(appJs, pick, today) {
  let newLine;
  if (pick && pick.go) {
    newLine = `  ["${pick.date || today}","${pick.match}","${pick.marche}","${pick.cote}","---","EN ATTENTE","${pick.sport}"],`;
  } else {
    newLine = `  ["${today}","PAS DE PARI - Aucun match n atteint notre seuil 8/10","---","---","---","NOPICK",""],`;
  }
  return appJs.replace("var picks = [", `var picks = [\n${newLine}`);
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

  console.log("🧠 Chef Claude — analyse + recherche web...");
  const chefResult = await callClaude(stats);
  
  if (!chefResult) {
    console.log("❌ Erreur Claude — arrêt");
    return;
  }

  const pick = chefResult.pick;
  const paperTrading = chefResult.paper_trading;
  
  console.log(`✅ Chef: ${pick?.go ? `PICK — ${pick.match} (${pick.score}/10)` : `NO PICK — ${chefResult.no_pick_raison || "seuil non atteint"}`}`);

  let votes = {};
  if (pick && pick.go) {
    const votePrompt = `Pick: ${pick.match} — ${pick.marche} @ ${pick.cote}. Score: ${pick.score}/10. Prob: ${Math.round((pick.prob||0.6)*100)}%. ${pick.raison}. Vote GO ou NO BET?`;
    console.log("\n📡 Vote des 4 IAs...");
    const results = await Promise.allSettled([
      voteIA("groq", callGroq, votePrompt),
      voteIA("gemini", callGemini, votePrompt),
      voteIA("deepseek", callDeepSeek, votePrompt),
      voteIA("mistral", callMistral, votePrompt),
    ]);
    results.forEach(r => r.status === "fulfilled" && r.value && (votes[r.value.id] = r.value));
  }

  const goCount = Object.values(votes).filter(v => v?.vote === "GO").length;
  const totalIA = Object.values(votes).filter(v => v).length + 1;
  const finalGo = pick?.go && (goCount + 1 >= Math.ceil(totalIA * 0.5));

  console.log("\n💾 Mise à jour App.js...");
  const updatedAppJs = addPickToAppJs(appJs, finalGo ? pick : null, today);
  await writeFile("src/App.js", updatedAppJs, sha, `🤖 Hermès pick ${today}: ${finalGo && pick ? pick.match : "NO PICK"}`);
  console.log("✅ App.js mis à jour\n");

  // Compte rendu format Concile
  const verdictLabel = !pick?.go ? "⛔ Rien à jouer" : 
    goCount + 1 >= Math.ceil(totalIA * 0.75) ? `✅ GO\n🏆 ${pick.match}\n🕐 ${pick.heure} • 🌍 ${pick.pays} • ${pick.sport}\n📊 ${pick.marche} @ ${pick.cote}\n💰 Mise: ${pick.mise_euros}€` :
    goCount + 1 >= Math.ceil(totalIA * 0.5) ? `⚠️ GO RÉDUIT\n🏆 ${pick.match}\n🕐 ${pick.heure} • 🌍 ${pick.pays} • ${pick.sport}\n📊 ${pick.marche} @ ${pick.cote}\n💰 Mise: ${Math.round((pick.mise_euros||10)/2)}€` :
    "⛔ NO BET — consensus insuffisant";

  const ptLine = paperTrading ? `🏀 ${paperTrading.match}\n📊 ${paperTrading.marche} — ${paperTrading.prediction} @ ${paperTrading.cote}` : "Aucun match NBA disponible";

  console.log("═".repeat(45));
  console.log(`🏛️ CONCILE V4.2 — ${today}`);
  console.log(`\n🎯 PICK RÉEL\n${verdictLabel}`);
  console.log(`\n📝 PAPER TRADING\n${ptLine}`);
  console.log("═".repeat(45));
}

main().catch(err => {
  console.error("💥 ERREUR CRITIQUE:", err.message);
  process.exit(1);
});

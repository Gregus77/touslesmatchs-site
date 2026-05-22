// ═══════════════════════════════════════════════════════════
//  HERMÈS — MULTI AGENT V4.2
//  Tourne chaque matin à 9h30 via GitHub Actions
//  1. Récupère les derniers résultats
//  2. Appelle Claude (Chef du Concile) pour analyse
//  3. Claude appelle les 4 autres IAs pour vote
//  4. Verdict final → met à jour App.js
//  5. Commit + push → site à jour automatiquement
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

// ── HELPERS ───────────────────────────────────────────────

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
  try {
    const clean = (text || "").replace(/```json|```/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch { return null; }
}

// ── GITHUB : lire/écrire App.js ───────────────────────────

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

// ── EXTRAIRE STATS depuis App.js ──────────────────────────

function extractStats(appJs) {
  const picks = [];
  const lineRegex = /\["([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]*)"\]/g;
  const picksMatch = appJs.match(/var picks = \[([\s\S]*?)\];/);
  if (!picksMatch) return { picks, wins: 0, total: 0, bankroll: 494 };

  let m;
  while ((m = lineRegex.exec(picksMatch[1])) !== null) {
    picks.push({ date: m[1], match: m[2], marche: m[3], cote: m[4], score: m[5], statut: m[6], sport: m[7] });
  }

  const wins = picks.filter(p => p.statut === "GAGNE").length;
  const total = picks.filter(p => !["NOPICK","EN ATTENTE","EN COURS"].includes(p.statut)).length;
  return { picks: picks.slice(0, 5), wins, total, bankroll: 494 };
}

// ── CLAUDE — CHEF DU CONCILE ──────────────────────────────

async function callClaude(stats) {
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  
  const system = `Tu es Claude, Chef du Concile V4.2 — expert value betting Winamax France.
DATE: ${today}
BANKROLL: ${stats.bankroll}€ | STATS: ${stats.wins}W / ${stats.total - stats.wins}L

RÈGLES ABSOLUES:
• Cotes: 1.40 à 2.20 UNIQUEMENT
• Marchés bannis: MLB, NBA moneyline, combinés >2
• Équipes bannies: Ottawa, Montréal Canadiens, Toronto Raptors, Stuttgart, Man United  
• Sports priorité: NHL Playoffs > NBA O/U (paper trading) > Foot EU > Tennis > Volleyball > Baseball Japon
• Seuil: score ≥8/10 + prob ≥63% + value=(prob×cote)>1.06
• Kelly: ≥9/10 → plein Kelly; 8-8.9 → ¼ Kelly; max 10% bankroll
• Cherche les matchs disponibles aujourd'hui via web search

Réponds UNIQUEMENT en JSON sans backticks:
{
  "pick": {
    "date": "JJ/MM",
    "match": "Équipe A vs Équipe B",
    "sport": "NHL/NBA/FOOT/etc",
    "heure": "22h00",
    "pays": "France/USA/etc",
    "marche": "Moneyline OT inclus / Over 2.5 / etc",
    "cote": 1.85,
    "prob": 0.65,
    "score": 8.5,
    "mise_euros": 12,
    "go": true,
    "raison": "max 15 mots"
  },
  "paper_trading": {
    "match": "match pour paper trading NBA O/U",
    "marche": "Over/Under XXX pts",
    "cote": 1.85,
    "prediction": "OVER ou UNDER"
  },
  "no_pick_raison": "si pas de pick, pourquoi en max 10 mots"
}`;

  const res = await httpsPost("api.anthropic.com", "/v1/messages",
    { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: `Analyse les matchs disponibles aujourd'hui ${today} et donne le meilleur pick Concile V4.2. Derniers picks: ${JSON.stringify(stats.picks.slice(0,3))}` }]
    }
  );

  const text = (res.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  return safeJSON(text);
}

// ── 4 IAs — VOTE ─────────────────────────────────────────

async function callGroq(prompt) {
  const res = await httpsPost("api.groq.com", "/openai/v1/chat/completions",
    { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    { model: "llama-3.3-70b-versatile", max_tokens: 100, temperature: 0.2,
      messages: [{ role: "system", content: 'Réponds UNIQUEMENT en JSON: {"vote":"GO","prob":0.65,"confiance":8,"raison":"max 10 mots"}' }, { role: "user", content: prompt }] }
  );
  return safeJSON(res.choices?.[0]?.message?.content);
}

async function callGemini(prompt) {
  const res = await httpsPost("generativelanguage.googleapis.com",
    `/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    { "Content-Type": "application/json" },
    { contents: [{ parts: [{ text: `Réponds UNIQUEMENT en JSON: {"vote":"GO","prob":0.65,"confiance":8,"raison":"max 10 mots"}\n\n${prompt}` }] }], generationConfig: { maxOutputTokens: 100, temperature: 0.2 } }
  );
  return safeJSON(res.candidates?.[0]?.content?.parts?.[0]?.text);
}

async function callDeepSeek(prompt) {
  const res = await httpsPost("api.deepseek.com", "/v1/chat/completions",
    { "Authorization": `Bearer ${DEEPSEEK_KEY}`, "Content-Type": "application/json" },
    { model: "deepseek-chat", max_tokens: 100, temperature: 0.2,
      messages: [{ role: "system", content: 'Réponds UNIQUEMENT en JSON: {"vote":"GO","prob":0.65,"confiance":8,"raison":"max 10 mots"}' }, { role: "user", content: prompt }] }
  );
  return safeJSON(res.choices?.[0]?.message?.content);
}

async function callMistral(prompt) {
  const res = await httpsPost("openrouter.ai", "/api/v1/chat/completions",
    { "Authorization": `Bearer ${OR_KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://touslesmatchs.com", "X-Title": "Concile V4.2" },
    { model: "mistralai/mistral-7b-instruct", max_tokens: 100, temperature: 0.2,
      messages: [{ role: "system", content: 'Réponds UNIQUEMENT en JSON: {"vote":"GO","prob":0.65,"confiance":8,"raison":"max 10 mots"}' }, { role: "user", content: prompt }] }
  );
  return safeJSON(res.choices?.[0]?.message?.content);
}

// ── METTRE À JOUR App.js avec nouveau pick ────────────────

function addPickToAppJs(appJs, pick, paperTrading) {
  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }).replace("/", "/");
  
  let newLine;
  if (pick && pick.go) {
    newLine = `  ["${pick.date}","${pick.match}","${pick.marche}","${pick.cote}","---","EN ATTENTE","${pick.sport}"],`;
  } else {
    newLine = `  ["${today}","PAS DE PARI - Aucun match n atteint notre seuil 8/10","---","---","---","NOPICK",""],`;
  }

  // Insérer après "var picks = ["
  return appJs.replace("var picks = [", `var picks = [\n${newLine}`);
}

// ── GÉNÉRER COMPTE RENDU FORMAT CONCILE ──────────────────

function genCompteRendu(pick, paperTrading, votes, date) {
  const goCount = Object.values(votes).filter(v => v && v.vote === "GO").length;
  const totalIA = Object.values(votes).filter(v => v).length + 1; // +1 pour Claude

  let pickSection = "⛔ Rien à jouer";
  if (pick && pick.go) {
    const verdict = goCount + 1 >= Math.ceil(totalIA * 0.75) ? "✅ GO" : goCount + 1 >= Math.ceil(totalIA * 0.5) ? "⚠️ GO RÉDUIT" : "⛔ NO BET";
    pickSection = `${verdict}\n🏆 ${pick.match}\n🕐 ${pick.heure} • 🌍 ${pick.pays} • ${pick.sport}\n📊 ${pick.marche} @ ${pick.cote}\n💰 Mise: ${pick.mise_euros}€`;
  }

  let ptSection = "Aucun match NBA disponible";
  if (paperTrading) {
    ptSection = `🏀 ${paperTrading.match}\n📊 ${paperTrading.marche} — ${paperTrading.prediction} @ ${paperTrading.cote}`;
  }

  return `🏛️ CONCILE V4.2 — ${date}\n\n🎯 PICK RÉEL\n${pickSection}\n\n📝 PAPER TRADING\n${ptSection}`;
}

// ── MAIN ──────────────────────────────────────────────────

async function main() {
  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  
  console.log("\n═══════════════════════════════════════════");
  console.log("  HERMÈS V4.2 — PICK DU JOUR");
  console.log(`  ${new Date().toLocaleString("fr-FR")}`);
  console.log("═══════════════════════════════════════════\n");

  // 1. Lire App.js
  console.log("📖 Lecture App.js...");
  const { content: appJs, sha } = await readFile("src/App.js");
  const stats = extractStats(appJs);
  console.log(`📊 Stats: ${stats.wins}W / ${stats.total - stats.wins}L — Bankroll: ${stats.bankroll}€\n`);

  // 2. Claude analyse et propose un pick
  console.log("🧠 Chef Claude — analyse en cours...");
  const chefResult = await callClaude(stats);
  
  if (!chefResult) {
    console.log("⚠️  Claude n'a pas retourné de JSON valide — NO PICK ce soir");
    return;
  }

  const pick = chefResult.pick;
  const paperTrading = chefResult.paper_trading;
  
  console.log(`✅ Chef: ${pick?.go ? `PICK — ${pick.match} (${pick.score}/10)` : `NO PICK — ${chefResult.no_pick_raison}`}`);

  // 3. Si pick → vote des 4 IAs
  let votes = {};
  if (pick && pick.go) {
    const votePrompt = `Concile V4.2. Pick proposé: ${pick.match} — ${pick.marche} @ ${pick.cote}. Score chef: ${pick.score}/10. Prob: ${Math.round(pick.prob * 100)}%. Raison: ${pick.raison}. Vote GO ou NO BET ?`;
    
    console.log("\n📡 Vote des 4 IAs en cours...");
    const results = await Promise.allSettled([
      callGroq(votePrompt).then(v => ({ id: "groq", ...v })).catch(e => ({ id: "groq", vote: "ERREUR", raison: e.message.slice(0, 30) })),
      callGemini(votePrompt).then(v => ({ id: "gemini", ...v })).catch(e => ({ id: "gemini", vote: "ERREUR", raison: e.message.slice(0, 30) })),
      callDeepSeek(votePrompt).then(v => ({ id: "deepseek", ...v })).catch(e => ({ id: "deepseek", vote: "ERREUR", raison: e.message.slice(0, 30) })),
      callMistral(votePrompt).then(v => ({ id: "mistral", ...v })).catch(e => ({ id: "mistral", vote: "ERREUR", raison: e.message.slice(0, 30) })),
    ]);

    results.forEach(r => {
      if (r.status === "fulfilled" && r.value) {
        votes[r.value.id] = r.value;
        console.log(`  ${r.value.vote === "GO" ? "✅" : "🔴"} ${r.value.id}: ${r.value.vote} (${r.value.confiance}/10)`);
      }
    });
  }

  // 4. Calcul verdict final
  const goCount = Object.values(votes).filter(v => v && v.vote === "GO").length;
  const totalIA = Object.values(votes).filter(v => v).length + 1;
  const finalGo = pick?.go && (goCount + 1 >= Math.ceil(totalIA * 0.5));

  // 5. Mettre à jour App.js
  console.log("\n💾 Mise à jour App.js...");
  const updatedAppJs = addPickToAppJs(appJs, finalGo ? pick : null, paperTrading);
  const compteRendu = genCompteRendu(finalGo ? pick : null, paperTrading, votes, today);
  
  const success = await writeFile("src/App.js", updatedAppJs, sha,
    `🤖 Hermès pick ${today}: ${finalGo && pick ? pick.match : "NO PICK"}`
  );

  if (success) {
    console.log("✅ App.js mis à jour — deploy automatique lancé\n");
  }

  // 6. Afficher compte rendu
  console.log("\n" + "═".repeat(45));
  console.log(compteRendu);
  console.log("═".repeat(45) + "\n");
}

main().catch(err => {
  console.error("💥 ERREUR CRITIQUE:", err.message);
  process.exit(1);
});


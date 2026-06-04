// ═══════════════════════════════════════════════════════════════
// HERMÈS SUPERVISOR — SYSTÈME AUTO-APPRENTISSANT
//
// Rôle : Superviser TOUS les modèles IA, comparer leurs prédictions,
//        analyser les résultats (pourquoi gagné/perdu), et améliorer
//        le moteur de prédiction en continu.
//
// Exécution : GitHub Actions (quotidien après résultats)
// ═══════════════════════════════════════════════════════════════

const https = require("https");
const fs = require("fs");

const GROQ_KEY = process.env.GROQ_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const DB_PATH = "./scripts/hermes_db.json";

// ── Charger ou créer la base de données ──
let db;
try {
  db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
} catch {
  db = {
    version: "2.0",
    created: new Date().toISOString(),
    picks: [],           // Historique complet de tous les picks
    shadow_bets: [],     // Paris à blanc des IAs en observation
    ia_stats: {},        // Stats par IA
    sport_stats: {},     // Stats par sport
    market_stats: {},    // Stats par type de pari
    analysis_log: [],    // Journal d'analyses post-match
    evolution_log: [],   // Journal des décisions Hermès
    config: {
      active_ias: ["groq", "deepseek"],
      shadow_ias: ["gemini", "mistral", "qwen", "claude"],
      review_every: 20,  // Analyser tous les 20 matchs
      min_picks_for_eval: 10
    }
  };
}

function saveDB() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function post(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({ hostname, path, method: "POST", headers: { ...headers, "Content-Length": Buffer.byteLength(data) } },
      res => { let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } }); });
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("TIMEOUT")); });
    req.on("error", reject);
    req.write(data); req.end();
  });
}

function safeJSON(text) {
  try { const clean = String(text || "").replace(/```json|```/g, "").trim(); const m = clean.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════
// ÉTAPE 1 — ANALYSE POST-MATCH (pourquoi gagné/perdu)
// ═══════════════════════════════════════════════════════════════
async function analyzeResult(pick) {
  console.log(`\n🔍 Analyse: ${pick.match} → ${pick.result}`);
  try {
    const r = await post("api.deepseek.com", "/v1/chat/completions",
      { "Authorization": `Bearer ${DEEPSEEK_KEY}`, "Content-Type": "application/json" },
      {
        model: "deepseek-chat", max_tokens: 800, temperature: 0.2,
        messages: [{
          role: "user", content: `Match: ${pick.match}
Résultat: ${pick.result} (score: ${pick.score || "?"})
Notre pari: ${pick.bet} @ ${pick.odds}
Note confiance: ${pick.note}/10

Analyse en JSON:
{
  "why": "explication courte de pourquoi le résultat",
  "our_analysis_correct": true/false,
  "key_factor": "le facteur décisif",
  "lesson": "leçon pour améliorer nos futures prédictions",
  "category": "VAR|ANA|MKT|INF"
}
VAR=variance normale, ANA=erreur d'analyse, MKT=mauvais timing cote, INF=info manquante`
        }]
      }
    );
    const text = r.choices?.[0]?.message?.content || "";
    return safeJSON(text);
  } catch (e) {
    console.error("Analyse error:", e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// ÉTAPE 2 — SHADOW BETTING (paris à blanc par toutes les IAs)
// ═══════════════════════════════════════════════════════════════
async function shadowBetGroq(matches) {
  console.log("🟢 [SHADOW] Groq...");
  try {
    const r = await post("api.groq.com", "/openai/v1/chat/completions",
      { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
      {
        model: "llama-3.3-70b-versatile", max_tokens: 1000, temperature: 0.1,
        messages: [{
          role: "user", content: `Parmi ces matchs, choisis le MEILLEUR pari. Cote 1.40-2.20. JSON: {"pick":{"match":"X vs Y","bet":"X Vainqueur","odds":1.65,"note":8.0,"confidence":0.72}}
Matchs: ${JSON.stringify(matches)}`
        }]
      }
    );
    const text = r.choices?.[0]?.message?.content || "";
    return safeJSON(text);
  } catch { return null; }
}

async function shadowBetDeepSeek(matches) {
  console.log("👑 [SHADOW] DeepSeek...");
  try {
    const r = await post("api.deepseek.com", "/v1/chat/completions",
      { "Authorization": `Bearer ${DEEPSEEK_KEY}`, "Content-Type": "application/json" },
      {
        model: "deepseek-chat", max_tokens: 1000, temperature: 0.1,
        messages: [{
          role: "user", content: `Parmi ces matchs, choisis le MEILLEUR pari. Cote 1.40-2.20. JSON: {"pick":{"match":"X vs Y","bet":"X Vainqueur","odds":1.65,"note":8.0,"confidence":0.72}}
Matchs: ${JSON.stringify(matches)}`
        }]
      }
    );
    const text = r.choices?.[0]?.message?.content || "";
    return safeJSON(text);
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════
// ÉTAPE 3 — MISE À JOUR STATS PAR IA
// ═══════════════════════════════════════════════════════════════
function updateIAStats(iaName, result, sport, market) {
  if (!db.ia_stats[iaName]) {
    db.ia_stats[iaName] = { total: 0, wins: 0, losses: 0, roi: 0, by_sport: {}, by_market: {}, status: "shadow" };
  }
  const stats = db.ia_stats[iaName];
  stats.total++;
  if (result === "WIN") stats.wins++;
  else stats.losses++;
  stats.winrate = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;

  // Par sport
  if (!stats.by_sport[sport]) stats.by_sport[sport] = { total: 0, wins: 0 };
  stats.by_sport[sport].total++;
  if (result === "WIN") stats.by_sport[sport].wins++;

  // Par marché
  if (!stats.by_market[market]) stats.by_market[market] = { total: 0, wins: 0 };
  stats.by_market[market].total++;
  if (result === "WIN") stats.by_market[market].wins++;
}

// ═══════════════════════════════════════════════════════════════
// ÉTAPE 4 — ÉVOLUTION AUTOMATIQUE (tous les 20 matchs)
// ═══════════════════════════════════════════════════════════════
function checkEvolution() {
  const totalPicks = db.picks.filter(p => p.result === "WIN" || p.result === "LOSS").length;
  if (totalPicks % db.config.review_every !== 0 || totalPicks < db.config.min_picks_for_eval) return;

  console.log(`\n🧠 HERMÈS ÉVOLUTION — Revue après ${totalPicks} picks`);

  const recommendations = [];
  for (const [ia, stats] of Object.entries(db.ia_stats)) {
    if (stats.total < 5) continue;
    const wr = stats.winrate;
    const isActive = db.config.active_ias.includes(ia);
    const isShadow = db.config.shadow_ias.includes(ia);

    if (isShadow && wr >= 70 && stats.total >= 10) {
      recommendations.push(`📈 ${ia} → PROMOTION (${wr}% sur ${stats.total} picks)`);
    }
    if (isActive && wr < 50 && stats.total >= 10) {
      recommendations.push(`📉 ${ia} → RÉTROGRADATION (${wr}% sur ${stats.total} picks)`);
    }
    console.log(`   ${isActive ? "🟢" : "👁️"} ${ia}: ${wr}% (${stats.wins}W/${stats.losses}L sur ${stats.total})`);
  }

  if (recommendations.length) {
    console.log("\n🔄 RECOMMANDATIONS HERMÈS:");
    recommendations.forEach(r => console.log("   " + r));
    db.evolution_log.push({
      date: new Date().toISOString(),
      total_picks: totalPicks,
      recommendations
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// ÉTAPE 5 — RAPPORT QUOTIDIEN
// ═══════════════════════════════════════════════════════════════
function generateReport() {
  const resolved = db.picks.filter(p => p.result === "WIN" || p.result === "LOSS");
  const wins = resolved.filter(p => p.result === "WIN").length;
  const total = resolved.length;
  const wr = total > 0 ? Math.round((wins / total) * 100) : 0;

  console.log("\n═══════════════ RAPPORT HERMÈS ═══════════════");
  console.log(`📊 Picks résolus: ${total} | ${wins}W/${total - wins}L | ${wr}%`);

  // Stats par IA
  console.log("\n🤖 PERFORMANCE PAR IA:");
  for (const [ia, stats] of Object.entries(db.ia_stats)) {
    const status = db.config.active_ias.includes(ia) ? "🟢 ACTIF" : "👁️ SHADOW";
    console.log(`   ${status} ${ia}: ${stats.winrate || 0}% (${stats.wins || 0}W/${stats.losses || 0}L)`);
    if (stats.by_sport) {
      for (const [sport, s] of Object.entries(stats.by_sport)) {
        const swr = s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0;
        console.log(`      └─ ${sport}: ${swr}% (${s.wins}W/${s.total - s.wins}L)`);
      }
    }
  }

  // Dernières analyses
  const recent = db.analysis_log.slice(-3);
  if (recent.length) {
    console.log("\n📝 DERNIÈRES ANALYSES:");
    recent.forEach(a => {
      console.log(`   ${a.result === "WIN" ? "✅" : "❌"} ${a.match}: ${a.analysis?.lesson || "?"}`);
    });
  }

  console.log("\n═══════════════════════════════════════════════\n");
}

// ═══════════════════════════════════════════════════════════════
// MAIN — Exécution quotidienne
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log("\n🏛️ HERMÈS SUPERVISOR — Analyse quotidienne\n");

  // 1. Lire les picks depuis App.js pour voir s'il y a des résultats
  const appJs = fs.readFileSync("./src/App.js", "utf8");
  const picksMatch = appJs.match(/var picks = \[([\s\S]*?)\];/);
  if (!picksMatch) { console.log("❌ Pas de tableau picks trouvé"); return; }

  const lines = picksMatch[1].split("\n").filter(l => l.trim().startsWith("["));
  let newResults = 0;

  for (const line of lines) {
    const parts = line.match(/\["([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]*)"/);
    if (!parts) continue;
    const [, date, match, bet, odds, score, result, sport] = parts;
    if (result === "NOPICK" || result === "EN ATTENTE" || result === "EN COURS") continue;

    // Vérifier si déjà dans la DB
    const exists = db.picks.find(p => p.date === date && p.match === match);
    if (exists) continue;

    // Nouveau résultat !
    const pickData = { date, match, bet, odds: parseFloat(odds), score, result: result === "GAGNE" ? "WIN" : "LOSS", sport, added: new Date().toISOString() };
    db.picks.push(pickData);
    newResults++;

    // Analyser pourquoi gagné/perdu
    const analysis = await analyzeResult(pickData);
    if (analysis) {
      db.analysis_log.push({ date, match, result: pickData.result, analysis });
      console.log(`   ${pickData.result === "WIN" ? "✅" : "❌"} ${match}: ${analysis.lesson || "?"}`);
      console.log(`   Catégorie: ${analysis.category || "?"} | Facteur: ${analysis.key_factor || "?"}`);
    }

    // Mettre à jour les stats de l'IA active (DeepSeek)
    updateIAStats("deepseek", pickData.result, sport, bet.includes("Over") ? "over" : "moneyline");
  }

  if (newResults === 0) {
    console.log("📭 Aucun nouveau résultat à analyser");
  } else {
    console.log(`\n📊 ${newResults} nouveau(x) résultat(s) analysé(s)`);
  }

  // 2. Vérifier évolution (tous les 20 matchs)
  checkEvolution();

  // 3. Rapport
  generateReport();

  // 4. Sauvegarder
  saveDB();
  console.log("💾 Base de données sauvegardée → hermes_db.json");
}

main().catch(e => console.error("FATAL:", e.message));

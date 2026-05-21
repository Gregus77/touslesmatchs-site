// ═══════════════════════════════════════════════════════════
//  CHECK RESULTS — Concile V4.2
//  Tourne chaque soir à 23h30 via GitHub Actions
//  Vérifie le résultat du pick du jour → met à jour bankroll
// ═══════════════════════════════════════════════════════════

const https = require("https");
const { execSync } = require("child_process");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER   = "Gregus77";
const REPO_NAME    = "touslesmatchs-site";
const DATA_FILE    = "src/picks-data.json";

const GROQ_KEY   = process.env.GROQ_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// ── HELPERS ───────────────────────────────────────────────

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname, path, method: "POST", headers: { ...headers, "Content-Length": Buffer.byteLength(data) } },
      res => { let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } }); }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function httpsGet(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: "GET", headers }, res => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on("error", reject);
    req.end();
  });
}

// ── GITHUB : lire/écrire picks-data.json ─────────────────

async function readPicksData() {
  const res = await httpsGet("api.github.com", `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE}`, {
    "Authorization": `Bearer ${GITHUB_TOKEN}`,
    "User-Agent": "HermesAgent/2.0",
    "Accept": "application/vnd.github.v3+json"
  });
  const content = Buffer.from(res.content, "base64").toString("utf8");
  return { data: JSON.parse(content), sha: res.sha };
}

async function writePicksData(data, sha, message) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");
  await httpsPost("api.github.com", `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE}`,
    { "Authorization": `Bearer ${GITHUB_TOKEN}`, "User-Agent": "HermesAgent/2.0", "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json" },
    { message, content, sha }
  );
}

// ── VÉRIFIER LE RÉSULTAT via Groq ─────────────────────────

async function checkResultWithAI(pick) {
  const today = new Date().toLocaleDateString("fr-FR");
  const prompt = `Tu es un vérificateur de résultats sportifs. 
Date: ${today}
Match à vérifier: "${pick.match}" — Marché: "${pick.marche}" — Cote: ${pick.cote}

Cherche le résultat final de ce match sur internet.
Réponds UNIQUEMENT en JSON sans backticks:
{"trouve": true/false, "score_final": "str ou null", "resultat": "GAGNÉ" ou "PERDU" ou "EN ATTENTE", "explication": "max 20 mots"}`;

  try {
    const res = await httpsPost("api.groq.com", "/openai/v1/chat/completions",
      { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
      { model: "llama-3.3-70b-versatile", max_tokens: 200, temperature: 0,
        messages: [{ role: "user", content: prompt }] }
    );
    const text = res.choices[0].message.content.replace(/```json|```/g, "").trim();
    return JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
  } catch (e) {
    console.error("Erreur Groq check:", e.message);
    return { trouve: false, score_final: null, resultat: "EN ATTENTE", explication: "Vérification manuelle requise" };
  }
}

// ── ANALYSE PERFORMANCE IAs (auto-amélioration) ───────────

function analyzeIAPerformance(picks) {
  const stats = {};
  picks.forEach(p => {
    if (!p.ia_votes || p.statut === "EN ATTENTE") return;
    Object.entries(p.ia_votes || {}).forEach(([ia, vote]) => {
      if (!stats[ia]) stats[ia] = { picks: 0, corrects: 0 };
      stats[ia].picks++;
      const correct = (vote === "GO" && p.statut === "GAGNÉ") || (vote === "NO BET" && p.statut === "PERDU");
      if (correct) stats[ia].corrects++;
    });
  });
  const result = {};
  Object.entries(stats).forEach(([ia, s]) => {
    result[ia] = { picks: s.picks, corrects: s.corrects, taux: s.picks ? Math.round((s.corrects / s.picks) * 100) : 0 };
  });
  return result;
}

function detectAlerts(perf) {
  const alerts = [];
  Object.entries(perf).forEach(([ia, s]) => {
    if (s.picks >= 10 && s.taux < 60) {
      alerts.push(`⚠️ ALERTE: ${ia} — taux ${s.taux}% sur ${s.picks} picks (seuil: 60%)`);
    }
  });
  return alerts;
}

// ── MAIN ──────────────────────────────────────────────────

async function main() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  HERMÈS — CHECK RESULTS V4.2");
  console.log(`  ${new Date().toLocaleString("fr-FR")}`);
  console.log("═══════════════════════════════════════════\n");

  // 1. Lire les données actuelles
  console.log("📖 Lecture picks-data.json...");
  const { data: picksData, sha } = await readPicksData();

  // 2. Trouver les picks EN ATTENTE
  const enAttente = (picksData.picks || []).filter(p => p.statut === "EN ATTENTE");
  console.log(`🔍 ${enAttente.length} pick(s) EN ATTENTE à vérifier\n`);

  if (enAttente.length === 0) {
    console.log("✅ Rien à vérifier ce soir.");
    return;
  }

  // 3. Vérifier chaque pick
  let changed = false;
  for (const pick of enAttente) {
    console.log(`\n▶ Vérification: ${pick.match} — ${pick.marche}`);
    const check = await checkResultWithAI(pick);
    console.log(`  Résultat: ${check.resultat} — ${check.explication}`);

    if (check.resultat !== "EN ATTENTE") {
      pick.statut = check.resultat;
      pick.score_final = check.score_final;
      pick.verifie_le = new Date().toLocaleDateString("fr-FR");
      pick.explication_resultat = check.explication;

      // Recalcul bankroll
      const mise = pick.mise_euros || 0;
      if (check.resultat === "GAGNÉ") {
        const gain = Math.round((mise * pick.cote - mise) * 100) / 100;
        picksData.bankroll = Math.round((picksData.bankroll + gain) * 100) / 100;
        pick.gain_perte = `+${gain}€`;
        console.log(`  💰 GAGNÉ ! +${gain}€ → Bankroll: ${picksData.bankroll}€`);
      } else if (check.resultat === "PERDU") {
        picksData.bankroll = Math.round((picksData.bankroll - mise) * 100) / 100;
        pick.gain_perte = `-${mise}€`;
        console.log(`  📉 PERDU — -${mise}€ → Bankroll: ${picksData.bankroll}€`);
      }
      changed = true;
    }

    // Délai entre appels
    await new Promise(r => setTimeout(r, 2000));
  }

  // 4. Recalcul stats globales
  if (changed) {
    const allPicks = picksData.picks || [];
    picksData.stats = {
      total: allPicks.length,
      gagnes: allPicks.filter(p => p.statut === "GAGNÉ").length,
      perdus: allPicks.filter(p => p.statut === "PERDU").length,
      en_attente: allPicks.filter(p => p.statut === "EN ATTENTE").length,
      taux: allPicks.filter(p => p.statut !== "EN ATTENTE").length > 0
        ? Math.round(allPicks.filter(p => p.statut === "GAGNÉ").length / allPicks.filter(p => p.statut !== "EN ATTENTE").length * 1000) / 10
        : 0,
      bankroll: picksData.bankroll,
      derniere_maj: new Date().toISOString()
    };

    // 5. Auto-amélioration : analyse performance IAs
    const perf = analyzeIAPerformance(allPicks);
    picksData.ia_performance = perf;
    const alerts = detectAlerts(perf);

    console.log("\n📊 PERFORMANCES IAs:");
    Object.entries(perf).forEach(([ia, s]) => {
      console.log(`  ${ia}: ${s.corrects}/${s.picks} → ${s.taux}% ${s.taux < 60 ? "⚠️ ALERTE" : "✅"}`);
    });

    if (alerts.length > 0) {
      console.log("\n🚨 ALERTES DÉTECTÉES:");
      alerts.forEach(a => console.log(" ", a));
      picksData.alerts = alerts;
      picksData.alert_date = new Date().toISOString();
    } else {
      picksData.alerts = [];
    }

    // 6. Sauvegarder sur GitHub
    console.log("\n💾 Mise à jour GitHub...");
    await writePicksData(
      picksData,
      sha,
      `🤖 Hermès: résultats ${new Date().toLocaleDateString("fr-FR")} — Bankroll: ${picksData.bankroll}€`
    );
    console.log("✅ picks-data.json mis à jour !");

    // 7. Résumé
    console.log("\n═══════════════════════════════════════════");
    console.log(`  BANKROLL ACTUELLE : ${picksData.bankroll}€`);
    console.log(`  TAUX DE SUCCÈS    : ${picksData.stats.taux}%`);
    console.log(`  PICKS TOTAL       : ${picksData.stats.total}`);
    console.log("═══════════════════════════════════════════\n");
  }
}

main().catch(err => {
  console.error("💥 ERREUR CRITIQUE:", err);
  process.exit(1);
});

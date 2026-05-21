// ═══════════════════════════════════════════════════════════
//  CHECK RESULTS — Concile V4.2
//  Tourne chaque soir à 23h30 via GitHub Actions
// ═══════════════════════════════════════════════════════════

const https = require("https");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER   = "Gregus77";
const REPO_NAME    = "touslesmatchs-site";
const GROQ_KEY     = process.env.GROQ_API_KEY;

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
    const opts = { hostname, path, method, headers: { "User-Agent": "HermesAgent/2.0", "Accept": "application/vnd.github.v3+json", "Authorization": `Bearer ${GITHUB_TOKEN}`, ...headers } };
    if (data) opts.headers["Content-Length"] = Buffer.byteLength(data);
    const req = https.request(opts, res => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── DEFAULT DATA ──────────────────────────────────────────

const DEFAULT_DATA = {
  bankroll: 499,
  picks: [
    {
      id: "pick-001",
      date: "22/05/2026",
      match: "NYK vs CLE Game 2",
      sport: "NBA",
      marche: "Over 215.5 pts",
      cote: 1.87,
      mise_euros: 12,
      statut: "EN ATTENTE",
      score: 8.5,
      ia_votes: { groq: "GO", gemini: "GO", deepseek: "GO", mistral: "GO" }
    }
  ],
  stats: { total: 1, gagnes: 0, perdus: 0, en_attente: 1, taux: 0, bankroll: 499 },
  ia_performance: {},
  alerts: [],
  derniere_maj: new Date().toISOString()
};

// ── GITHUB : lire picks-data.json ────────────────────────

async function readPicksData() {
  // Chercher le fichier dans src/ puis à la racine
  for (const filePath of ["src/picks-data.json", "picks-data.json", "public/picks-data.json"]) {
    const res = await httpsRequest("GET", "api.github.com", `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`);
    if (res.status === 200 && res.body.content) {
      console.log(`✅ Fichier trouvé : ${filePath}`);
      const content = Buffer.from(res.body.content, "base64").toString("utf8");
      return { data: JSON.parse(content), sha: res.body.sha, path: filePath };
    }
  }
  // Fichier inexistant → on le crée
  console.log("⚠️  picks-data.json introuvable → création automatique dans src/");
  return { data: DEFAULT_DATA, sha: null, path: "src/picks-data.json" };
}

// ── GITHUB : écrire picks-data.json ──────────────────────

async function writePicksData(data, sha, filePath, message) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");
  const body = { message, content };
  if (sha) body.sha = sha;
  const res = await httpsRequest("PUT", "api.github.com", `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
    { "Content-Type": "application/json" }, body
  );
  if (res.status === 200 || res.status === 201) {
    console.log(`✅ ${filePath} mis à jour sur GitHub`);
  } else {
    console.error(`❌ Erreur écriture GitHub (${res.status}):`, JSON.stringify(res.body).slice(0, 200));
  }
}

// ── VÉRIFIER RÉSULTAT via Groq ────────────────────────────

async function checkResultWithGroq(pick) {
  if (!GROQ_KEY) return { trouve: false, resultat: "EN ATTENTE", explication: "Clé Groq manquante" };
  const prompt = `Tu es un vérificateur de résultats sportifs. Date: ${new Date().toLocaleDateString("fr-FR")}.
Match: "${pick.match}" — Marché: "${pick.marche}" — Cote: ${pick.cote}
Le match a-t-il eu lieu ? Quel est le résultat final ?
Réponds UNIQUEMENT en JSON sans backticks: {"trouve":true,"score_final":"ex: 112-108","resultat":"GAGNÉ ou PERDU ou EN ATTENTE","explication":"max 15 mots"}`;

  try {
    const res = await httpsPost("api.groq.com", "/openai/v1/chat/completions",
      { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
      { model: "llama-3.3-70b-versatile", max_tokens: 150, temperature: 0, messages: [{ role: "user", content: prompt }] }
    );
    const text = (res.choices?.[0]?.message?.content || "").replace(/```json|```/g, "").trim();
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { trouve: false, resultat: "EN ATTENTE", explication: "Parse error" };
  } catch (e) {
    return { trouve: false, resultat: "EN ATTENTE", explication: e.message.slice(0, 40) };
  }
}

// ── ANALYSE PERFORMANCE IAs ───────────────────────────────

function analyzePerformance(picks) {
  const stats = {};
  picks.forEach(p => {
    if (!p.ia_votes || p.statut === "EN ATTENTE") return;
    Object.entries(p.ia_votes).forEach(([ia, vote]) => {
      if (!stats[ia]) stats[ia] = { picks: 0, corrects: 0 };
      stats[ia].picks++;
      const correct = (vote === "GO" && p.statut === "GAGNÉ") || (vote === "NO BET" && p.statut === "PERDU");
      if (correct) stats[ia].corrects++;
    });
  });
  const result = {};
  Object.entries(stats).forEach(([ia, s]) => {
    result[ia] = { picks: s.picks, corrects: s.corrects, taux: s.picks ? Math.round(s.corrects / s.picks * 100) : 0 };
  });
  return result;
}

// ── MAIN ──────────────────────────────────────────────────

async function main() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  HERMÈS — CHECK RESULTS V4.2");
  console.log(`  ${new Date().toLocaleString("fr-FR")}`);
  console.log("═══════════════════════════════════════════\n");

  const { data, sha, path: filePath } = await readPicksData();
  const enAttente = (data.picks || []).filter(p => p.statut === "EN ATTENTE");
  console.log(`🔍 ${enAttente.length} pick(s) EN ATTENTE\n`);

  let changed = false;

  for (const pick of enAttente) {
    console.log(`▶ Vérification: ${pick.match} — ${pick.marche}`);
    const check = await checkResultWithGroq(pick);
    console.log(`  → ${check.resultat} | ${check.explication}`);

    if (check.resultat !== "EN ATTENTE") {
      pick.statut = check.resultat;
      pick.score_final = check.score_final || null;
      pick.verifie_le = new Date().toLocaleDateString("fr-FR");
      pick.explication_resultat = check.explication;

      const mise = pick.mise_euros || 0;
      if (check.resultat === "GAGNÉ") {
        const gain = Math.round((mise * pick.cote - mise) * 100) / 100;
        data.bankroll = Math.round((data.bankroll + gain) * 100) / 100;
        pick.gain_perte = `+${gain}€`;
        console.log(`  💰 GAGNÉ +${gain}€ → Bankroll: ${data.bankroll}€`);
      } else if (check.resultat === "PERDU") {
        data.bankroll = Math.round((data.bankroll - mise) * 100) / 100;
        pick.gain_perte = `-${mise}€`;
        console.log(`  📉 PERDU -${mise}€ → Bankroll: ${data.bankroll}€`);
      }
      changed = true;
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  // Toujours recalculer stats et perf
  const all = data.picks || [];
  const termine = all.filter(p => p.statut !== "EN ATTENTE");
  data.stats = {
    total: all.length,
    gagnes: all.filter(p => p.statut === "GAGNÉ").length,
    perdus: all.filter(p => p.statut === "PERDU").length,
    en_attente: all.filter(p => p.statut === "EN ATTENTE").length,
    taux: termine.length ? Math.round(all.filter(p => p.statut === "GAGNÉ").length / termine.length * 1000) / 10 : 0,
    bankroll: data.bankroll,
    derniere_maj: new Date().toISOString()
  };

  data.ia_performance = analyzePerformance(all);

  // Alertes IAs sous 60%
  const alerts = [];
  Object.entries(data.ia_performance).forEach(([ia, s]) => {
    if (s.picks >= 10 && s.taux < 60) alerts.push(`⚠️ ALERTE: ${ia} — ${s.taux}% sur ${s.picks} picks`);
  });
  data.alerts = alerts;
  data.derniere_maj = new Date().toISOString();

  if (alerts.length > 0) {
    console.log("\n🚨 ALERTES IAs:");
    alerts.forEach(a => console.log(" ", a));
  }

  // Sauvegarder sur GitHub (même si pas de changement, pour la date de maj)
  await writePicksData(data, sha, filePath, `🤖 Hermès check ${new Date().toLocaleDateString("fr-FR")} — Bankroll: ${data.bankroll}€`);

  console.log("\n═══════════════════════════════════════════");
  console.log(`  BANKROLL : ${data.bankroll}€`);
  console.log(`  TAUX     : ${data.stats.taux}%`);
  console.log(`  PICKS    : ${data.stats.total} (${data.stats.gagnes}W / ${data.stats.perdus}L)`);
  console.log("═══════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("💥 ERREUR CRITIQUE:", err.message);
  process.exit(1);
});

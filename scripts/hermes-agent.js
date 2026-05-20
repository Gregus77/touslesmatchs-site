// ═══════════════════════════════════════════════════════════
//  HERMÈS AGENT V1.0 — Concile Autonome TousLesMatchs
//  Tourne chaque jour à 10h00 via GitHub Actions
//  Gregory / Winamax / V4.2
// ═══════════════════════════════════════════════════════════

const GROQ_KEY     = process.env.GROQ_API_KEY;
const GEMINI_KEY   = process.env.GEMINI_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const OR_KEY       = process.env.OPENROUTER_API_KEY;
const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER   = "Gregus77";
const REPO_NAME    = "touslesmatchs-site";
const DATA_FILE    = "src/picks-data.json";

// ── SYSTÈME V4.2 ──────────────────────────────────────────
const BETTING_SYSTEM = `Tu es un analyste expert en value betting. Système V4.2 — Winamax, Gregory.

CRITÈRES OBLIGATOIRES:
• Score ≥ 8/10 | Probabilité ≥ 63% | Value (Prob×Cote)/100 > 1.06
• Fenêtre cotes: 1.40–2.00 | Kelly% ≥ 2%

SPORTS PRIORITAIRES: NHL Playoffs > Bundesliga > Snooker > Volleyball > Tennis
AUSSI ACCEPTÉS: NBA Over/Under, NFL, Baseball (hors MLB), Ligue 1, PL, LaLiga, Copa Libertadores

LISTE NOIRE ÉQUIPES: Ottawa Senators, Montreal Canadiens, Toronto Raptors, Stuttgart, Manchester United
MARCHÉS BANNIS: MLB, combinés >2 picks, NBA moneyline, cotes <1.40 ou >2.20, Paris live

KELLY:
K% = [(Prob × Cote) – 1] / (Cote – 1)
NHL G1 Playoffs ≥9/10 → 100% Kelly | Autre ≥9/10 → 50% | 8–8.9/10 → 25%

Réponds UNIQUEMENT en JSON valide:
{
  "hasPick": true/false,
  "match": "Équipe A vs Équipe B",
  "competition": "Nom compétition",
  "sport": "Foot|Hockey|Basketball|Tennis|Baseball|Volleyball",
  "pick": "Description du pari",
  "cote": 1.XX,
  "score": X.X,
  "prob": XX,
  "value": X.XX,
  "kelly": "X.XX€",
  "raison": "Explication courte"
}
Si aucun pick valide: {"hasPick": false, "raison": "Aucun match n atteint notre seuil 8/10"}`;

// ── HELPERS ───────────────────────────────────────────────
function parseJSON(raw) {
  if (!raw) return null;
  try {
    const clean = raw.replace(/```[\w]*\n?/g, "").replace(/```/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch(e) {}
  return null;
}

function today() {
  const d = new Date();
  const day   = String(d.getDate()).padStart(2,"0");
  const month = String(d.getMonth()+1).padStart(2,"0");
  return `${day}/${month}`;
}

function sportEmoji(sport) {
  const map = { Foot:"⚽", Hockey:"🏒", Basketball:"🏀", Tennis:"🎾", Baseball:"⚾", Volleyball:"🏐" };
  return map[sport] || "🎯";
}

// ── API CALLERS ────────────────────────────────────────────
async function askClaude(query) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CLAUDE_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: BETTING_SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: query }]
    })
  });
  const d = await res.json();
  const text = (d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n");
  return parseJSON(text);
}

async function askGroq(query) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: BETTING_SYSTEM },
        { role: "user", content: query }
      ],
      max_tokens: 500, temperature: 0.1
    })
  });
  const d = await res.json();
  return parseJSON(d.choices?.[0]?.message?.content);
}

async function askGemini(query) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: BETTING_SYSTEM + "\n\n" + query }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.1 }
      })
    }
  );
  const d = await res.json();
  return parseJSON(d.candidates?.[0]?.content?.parts?.[0]?.text);
}

async function askDeepSeek(query) {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${DEEPSEEK_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: BETTING_SYSTEM },
        { role: "user", content: query }
      ],
      max_tokens: 500, temperature: 0.1
    })
  });
  const d = await res.json();
  return parseJSON(d.choices?.[0]?.message?.content);
}

async function askMistral(query) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OR_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://touslesmatchs.com",
      "X-Title": "Hermes Agent V1.0"
    },
    body: JSON.stringify({
      model: "mistralai/mistral-7b-instruct:free",
      messages: [
        { role: "system", content: BETTING_SYSTEM },
        { role: "user", content: query }
      ],
      max_tokens: 500, temperature: 0.1
    })
  });
  const d = await res.json();
  return parseJSON(d.choices?.[0]?.message?.content);
}

// ── GITHUB ────────────────────────────────────────────────
async function getFileFromGitHub() {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE}`,
    { headers: { "Authorization": `Bearer ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" } }
  );
  if (!res.ok) return { content: null, sha: null };
  const d = await res.json();
  const content = JSON.parse(Buffer.from(d.content, "base64").toString("utf-8"));
  return { content, sha: d.sha };
}

async function pushToGitHub(data, sha) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");
  const body = {
    message: `🤖 Hermès — Pick du ${today()}`,
    content,
    sha
  };
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE}`,
    {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.github.v3+json"
      },
      body: JSON.stringify(body)
    }
  );
  return res.ok;
}

// ── HERMÈS — LOGIQUE PRINCIPALE ───────────────────────────
async function hermesRun() {
  console.log(`\n🏛️ HERMÈS AGENT V1.0 — ${new Date().toISOString()}`);
  console.log("═".repeat(55));

  // ── ÉTAPE 1 : Claude scanne les matchs du jour ──
  console.log("\n📡 PHASE 1 — Claude scanne les matchs du jour...");
  const scanQuery = `Nous sommes le ${new Date().toLocaleDateString("fr-FR")}. 
  Analyse tous les matchs sportifs disponibles aujourd'hui (NHL, NBA, foot européen, tennis, etc.).
  Identifie LE meilleur pick selon nos critères V4.2.
  Cherche les stats, blessures, cotes Winamax et Pinnacle.
  Réponds en JSON.`;

  let claudeResult = null;
  try {
    claudeResult = await askClaude(scanQuery);
    console.log(`✅ Claude: ${claudeResult?.hasPick ? claudeResult.match : "Pas de pick"}`);
  } catch(e) {
    console.log(`⚠️ Claude error: ${e.message}`);
  }

  // ── ÉTAPE 2 : Vote des 4 autres IAs ──
  console.log("\n🗳️  PHASE 2 — Vote du Concile...");

  const voteQuery = claudeResult?.hasPick
    ? `Analyse ce pick proposé par Claude:\n${JSON.stringify(claudeResult)}\nValide ou rejette selon nos critères V4.2. Réponds en JSON.`
    : `Trouve LE meilleur pick sportif du jour selon nos critères V4.2. Réponds en JSON.`;

  const [groq, gemini, deepseek, mistral] = await Promise.allSettled([
    askGroq(voteQuery),
    askGemini(voteQuery),
    askDeepSeek(voteQuery),
    askMistral(voteQuery)
  ]);

  const results = {
    claude:   claudeResult,
    groq:     groq.status === "fulfilled" ? groq.value : null,
    gemini:   gemini.status === "fulfilled" ? gemini.value : null,
    deepseek: deepseek.status === "fulfilled" ? deepseek.value : null,
    mistral:  mistral.status === "fulfilled" ? mistral.value : null,
  };

  // ── ÉTAPE 3 : Comptage des votes ──
  console.log("\n📊 PHASE 3 — Comptage des votes...");
  const votes = Object.entries(results).map(([ia, r]) => ({
    ia,
    hasPick: r?.hasPick || false,
    score: r?.score || 0
  }));

  const goVotes   = votes.filter(v => v.hasPick).length;
  const avgScore  = votes.filter(v => v.score > 0).reduce((s,v) => s + v.score, 0) / (votes.filter(v => v.score > 0).length || 1);
  const bestResult = results.claude || results.groq || results.gemini || results.deepseek || results.mistral;

  console.log(`\n  Votes GO : ${goVotes}/5`);
  console.log(`  Score moyen : ${avgScore.toFixed(1)}/10`);

  // ── ÉTAPE 4 : Décision finale ──
  const isGO = goVotes >= 4 && avgScore >= 8.0 && bestResult?.hasPick;
  console.log(`\n  Verdict : ${isGO ? "✅ GO — Publication !" : "⛔ NO BET — Pas de pick aujourd'hui"}`);

  // ── ÉTAPE 5 : Mise à jour du fichier JSON ──
  console.log("\n📝 PHASE 4 — Mise à jour GitHub...");
  const { content: currentData, sha } = await getFileFromGitHub();

  if (!currentData || !sha) {
    console.log("⚠️ Impossible de récupérer le fichier picks-data.json");
    return;
  }

  // Nouveau pick à ajouter en tête
  let newPick;
  if (isGO && bestResult) {
    newPick = [
      today(),
      bestResult.match || "Match du jour",
      bestResult.pick || "Pick",
      String(bestResult.cote || "---"),
      "---",
      "EN ATTENTE",
      bestResult.sport || "Foot"
    ];
    console.log(`  ✅ Ajout : ${newPick[1]} — ${newPick[2]} @ ${newPick[3]}`);
  } else {
    newPick = [
      today(),
      "PAS DE PARI - Aucun match n atteint notre seuil 8/10",
      "---", "---", "---", "NOPICK", ""
    ];
    console.log("  ⛔ Ajout : PAS DE PARI");
  }

  // Mise à jour du tableau
  const updatedPicks = [newPick, ...(currentData.picks || [])];

  // Mise à jour des stats
  const wins  = updatedPicks.filter(p => p[5] === "GAGNE").length;
  const total = updatedPicks.filter(p => p[5] !== "NOPICK" && p[5] !== "EN ATTENTE").length;

  // Suivi performances IAs en tâche de fond
  const iaPerf = currentData.iaPerformance || {
    claude:   { picks: 0, corrects: 0 },
    groq:     { picks: 0, corrects: 0 },
    gemini:   { picks: 0, corrects: 0 },
    deepseek: { picks: 0, corrects: 0 },
    mistral:  { picks: 0, corrects: 0 },
  };

  // Enregistre les votes pour suivi
  if (isGO) {
    Object.entries(results).forEach(([ia, r]) => {
      if (iaPerf[ia]) iaPerf[ia].picks += 1;
    });
  }

  const updatedData = {
    ...currentData,
    stats: {
      totalPronos: total,
      gagnes: wins,
      perdus: total - wins,
      tauxReussite: total > 0 ? Math.round((wins/total)*100) + "%" : "0%",
      lastUpdate: new Date().toISOString()
    },
    picks: updatedPicks,
    iaPerformance: iaPerf,
    lastHermesRun: new Date().toISOString()
  };

  // Push vers GitHub
  const pushed = await pushToGitHub(updatedData, sha);
  if (pushed) {
    console.log("  ✅ GitHub mis à jour ! Vercel déploie dans 60 secondes.");
  } else {
    console.log("  ⚠️ Erreur push GitHub");
  }

  // ── RAPPORT FINAL ──
  console.log("\n" + "═".repeat(55));
  console.log("🏛️ HERMÈS RAPPORT FINAL");
  console.log("═".repeat(55));
  console.log(`  Date        : ${today()}`);
  console.log(`  Verdict     : ${isGO ? "✅ GO" : "⛔ NO BET"}`);
  if (isGO && bestResult) {
    console.log(`  Match       : ${bestResult.match}`);
    console.log(`  Pick        : ${bestResult.pick}`);
    console.log(`  Cote        : ${bestResult.cote}`);
    console.log(`  Score moyen : ${avgScore.toFixed(1)}/10`);
    console.log(`  Votes GO    : ${goVotes}/5`);
  }
  console.log("\n📊 PERFORMANCES IAs :");
  Object.entries(iaPerf).forEach(([ia, p]) => {
    const taux = p.picks > 0 ? Math.round((p.corrects/p.picks)*100) : "—";
    const alerte = p.picks >= 10 && p.corrects/p.picks < 0.6 ? " ⚠️ SOUS-PERFORMANCE" : "";
    console.log(`  ${ia.padEnd(10)} : ${p.corrects}/${p.picks} corrects (${taux}%)${alerte}`);
  });
  console.log("═".repeat(55));
}

// ── LANCEMENT ─────────────────────────────────────────────
hermesRun().catch(err => {
  console.error("💥 HERMÈS ERREUR CRITIQUE:", err);
  process.exit(1);
});


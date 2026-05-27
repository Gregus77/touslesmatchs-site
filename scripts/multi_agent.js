/**
 * HERMÈS — Agent Pick du Jour
 * Chef du Concile : Claude (Anthropic)
 * Tourne chaque matin à 9h30 via GitHub Actions
 */

const https = require("https");

// ── CONFIGURATION ─────────────────────────────────────────
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const GITHUB_TOKEN   = process.env.GITHUB_TOKEN;
const REPO_OWNER     = "Gregus77";
const REPO_NAME      = "touslesmatchs-site";
const APP_JS_PATH    = "src/App.js";

if (!ANTHROPIC_KEY) { console.error("❌ ANTHROPIC_API_KEY manquant"); process.exit(1); }
if (!GITHUB_TOKEN)  { console.error("❌ GITHUB_TOKEN manquant");    process.exit(1); }

// ── PROMPT CHEF DU CONCILE ────────────────────────────────
function buildPrompt() {
  const today = new Date().toLocaleDateString("fr-FR");
  return `
Tu es le Chef du Concile V4.3 — système de paris sportifs.
Date aujourd'hui : ${today}

MISSION : Trouver UN pick pour aujourd'hui. UN pick OBLIGATOIRE, toujours.

SPORTS AUTORISÉS (par priorité) :
- Football : Premier League, LaLiga, Bundesliga, Serie A, Ligue 1, Champions/Europa/Conference League, MLS, Brasileirão A, Liga Argentina grands clubs, J1, K League 1
- Hockey NHL : vainqueur OT inclus, Over/Under 5.5
- Basketball NBA : Over/Under, vainqueur si prob ≥65%
- Baseball MLB/NPB : vainqueur, Over/Under
- Formule 1 : podium top3 (cote jusqu'à 3.00)

BANNIS : Tennis (définitivement), championnats corrompus (Chine, Vietnam, Mongolie, Nigeria, Biélorussie, Brésil Série B/C/D), équipes : Ottawa Senators, Montréal Canadiens, Toronto Raptors

RÈGLES OBLIGATOIRES :
- Cote entre 1.40 et 2.20 (F1 podium jusqu'à 3.00)
- Score /10 minimum 7.5 pour publier (8+ = mise réelle, 7-7.9 = paper trading)
- Si aucun match idéal → prendre le meilleur disponible quand même
- Équipe au complet ou avec 1 absent maximum

BARÈME /10 :
- Supériorité ELO/forme : 0-2 pts
- Forme récente (5 derniers) : 0-2 pts
- Enjeu/motivation : 0-1 pt
- Domicile + H2H : 0-1 pt
- Cote sweet spot 1.50-1.90 : 0-1 pt
- Absent clé adverse : 0-1 pt
- Value positive : 0-1 pt
- Signaux bonus : 0-1 pt
- Malus météo/fatigue : -1 pt

Recherche les matchs du jour sur internet, analyse le meilleur candidat et réponds UNIQUEMENT avec ce JSON (rien d'autre) :
{
  "date": "${today}",
  "match": "Équipe A vs Équipe B",
  "sport": "Football",
  "competition": "Premier League",
  "marche": "Vainqueur Équipe A",
  "cote": 1.65,
  "note": 8.5,
  "mise": 10,
  "type": "PICK STANDARD",
  "statut": "EN ATTENTE",
  "paper_trading": false,
  "raison": "Courte justification en 1 phrase"
}
`.trim();
}

// ── APPEL CLAUDE API ──────────────────────────────────────
function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }]
    });

    const req = https.request({
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "interleaved-thinking-2025-05-14"
      }
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          // Extraire le texte de la réponse finale
          const textBlock = parsed.content?.find(b => b.type === "text");
          if (textBlock) resolve(textBlock.text);
          else reject(new Error("Pas de texte dans la réponse Claude"));
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── GITHUB : lire un fichier ──────────────────────────────
function githubGet(filePath) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.github.com",
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
      method: "GET",
      headers: {
        "User-Agent": "HermesAgent",
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json"
      }
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// ── GITHUB : écrire un fichier ────────────────────────────
function githubPut(filePath, content, sha, message) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      message,
      content: Buffer.from(content).toString("base64"),
      sha
    });
    const req = https.request({
      hostname: "api.github.com",
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
      method: "PUT",
      headers: {
        "User-Agent": "HermesAgent",
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => resolve(JSON.parse(data)));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── INJECTER LE PICK DANS APP.JS ─────────────────────────
function injectPick(appJs, pick) {
  const ligne = JSON.stringify([
    pick.date,
    pick.match,
    pick.marche,
    String(pick.cote),
    `${pick.note}/10`,
    pick.statut,
    pick.sport,
    pick.paper_trading ? "📋 PAPER" : `${pick.mise}€`
  ]);

  const lines = appJs.split("\n");
  let result = [];
  let inPicks = false;

  for (let line of lines) {
    if (line.trim().startsWith("var picks = [")) {
      inPicks = true;
      result.push("var picks = [");
      result.push(`  ${ligne},`);
      continue;
    }
    if (inPicks && line.trim() === "];") {
      inPicks = false;
      result.push("];");
      continue;
    }
    if (!inPicks) result.push(line);
  }
  return result.join("\n");
}

// ── MAIN ──────────────────────────────────────────────────
async function main() {
  console.log("🏛️  HERMÈS — Pick du Jour");
  console.log("═".repeat(45));

  // 1. Appel Claude
  console.log("🤖 Appel Chef du Concile (Claude)...");
  const rawResponse = await callClaude(buildPrompt());
  console.log("📨 Réponse brute :", rawResponse.slice(0, 200));

  // 2. Parser le JSON
  let pick;
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Pas de JSON trouvé");
    pick = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("❌ Parsing JSON échoué :", e.message);
    process.exit(1);
  }

  console.log(`\n✅ PICK : ${pick.match}`);
  console.log(`   Marché  : ${pick.marche} @ ${pick.cote}`);
  console.log(`   Note    : ${pick.note}/10`);
  console.log(`   Mise    : ${pick.paper_trading ? "PAPER TRADING" : pick.mise + "€"}`);
  console.log(`   Raison  : ${pick.raison}`);

  // 3. Lire App.js depuis GitHub
  console.log("\n📂 Lecture App.js sur GitHub...");
  const fileData = await githubGet(APP_JS_PATH);
  const appJs = Buffer.from(fileData.content, "base64").toString("utf8");
  const sha = fileData.sha;

  // 4. Injecter le pick
  const updatedAppJs = injectPick(appJs, pick);

  // 5. Commit sur GitHub
  const label = pick.paper_trading ? "📋 PAPER" : "✅ PICK";
  const commitMsg = `🤖 Hermès ${pick.date}: ${label} ${pick.match} @ ${pick.cote}`;
  await githubPut(APP_JS_PATH, updatedAppJs, sha, commitMsg);

  console.log("\n🚀 App.js mis à jour — deploy automatique lancé");
  console.log("═".repeat(45));
}

main().catch(err => {
  console.error("💥 ERREUR CRITIQUE :", err.message);
  process.exit(1);
});

// ═══════════════════════════════════════════════════════════
//  HERMÈS — CHECK RESULTS V4.2
//  Tourne chaque soir à 23h30 via GitHub Actions
//  1. Vérifie les résultats via Groq
//  2. Met à jour App.js directement
//  3. Commit + push sur GitHub
//  4. Le deploy.yml rebuild le site automatiquement
// ═══════════════════════════════════════════════════════════

const https = require("https");
const { execSync } = require("child_process");

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT  = process.env.TELEGRAM_CHAT_ID;

function sendTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT) return Promise.resolve();
  return new Promise((resolve) => {
    const body = JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: "HTML" });
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

const GITHUB_TOKEN      = process.env.GITHUB_TOKEN;
const GROQ_KEY          = process.env.GROQ_API_KEY;
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY || ""; // football-data.org — gratuit
const REPO_OWNER   = "Gregus77";
const REPO_NAME    = "touslesmatchs-site";

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

// ── GITHUB : lire un fichier ──────────────────────────────

async function readFile(filePath) {
  const res = await httpsRequest("GET", "api.github.com", `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`);
  if (res.status === 200 && res.body.content) {
    const content = Buffer.from(res.body.content, "base64").toString("utf8");
    return { content, sha: res.body.sha };
  }
  throw new Error(`Impossible de lire ${filePath} (status ${res.status})`);
}

// ── GITHUB : écrire un fichier ────────────────────────────

async function writeFile(filePath, content, sha, message) {
  const encoded = Buffer.from(content).toString("base64");
  const res = await httpsRequest("PUT", "api.github.com", `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
    { "Content-Type": "application/json" },
    { message, content: encoded, sha }
  );
  if (res.status === 200 || res.status === 201) {
    console.log(`✅ ${filePath} mis à jour`);
    return true;
  }
  console.error(`❌ Erreur écriture (${res.status}):`, JSON.stringify(res.body).slice(0, 200));
  return false;
}

// ── VÉRIFIER RÉSULTAT via API-Sports (réel) puis Groq (fallback) ──

function httpsGet(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = { hostname, path, method: "GET",
      headers: { "User-Agent": "HermesAgent/4.3", ...headers } };
    const req = require("https").request(opts, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on("error", reject); req.end();
  });
}

// ── API HOCKEY (NHL officielle — gratuite) ────────────────
async function checkResultNHL(pick) {
  if (pick.sport !== "Hockey") return null;
  try {
    const today = new Date();
    const dateStr = today.toISOString().slice(0,10);
    const yesterday = new Date(today - 86400000).toISOString().slice(0,10);

    for (const date of [yesterday, dateStr]) {
      const r = await new Promise((res,rej) => {
        require("https").get(`https://api-web.nhle.com/v1/score/${date}`, resp => {
          let d=""; resp.on("data",c=>d+=c); resp.on("end",()=>{ try{res(JSON.parse(d))}catch{res({})} });
        }).on("error",rej);
      });
      if (!r.games) continue;
      const [home, away] = pick.match.split(" vs ").map(s=>s.trim().toLowerCase());
      const game = r.games.find(g => {
        const h = (g.homeTeam?.commonName?.default||"").toLowerCase();
        const a = (g.awayTeam?.commonName?.default||"").toLowerCase();
        return (h.includes(home.split(" ")[0]) || h.includes(home.split(" ").pop()) ||
                a.includes(away.split(" ")[0]) || a.includes(away.split(" ").pop()));
      });
      if (!game) continue;
      if (game.gameState !== "OFF" && game.gameState !== "FINAL") return { resultat:"EN ATTENTE", score_final:null };
      const hs = game.homeTeam?.score ?? 0;
      const as = game.awayTeam?.score ?? 0;
      const scoreFinal = `${hs}-${as}`;
      const marche = pick.marche.toLowerCase();
      const homeTeamName = (game.homeTeam?.commonName?.default||"").toLowerCase();
      let resultat = "EN ATTENTE";
      if (marche.includes("vainqueur") || marche.includes("ml")) {
        const homeWins = hs > as;
        const pickHome = marche.includes(homeTeamName.split(" ")[0]) || marche.includes(home.split(" ")[0]);
        resultat = (homeWins && pickHome) || (!homeWins && !pickHome) ? "GAGNE" : "PERDU";
      }
      console.log(`  ✅ NHL API: ${scoreFinal} → ${resultat}`);
      return { resultat, score_final: scoreFinal, explication: "Score réel NHL API" };
    }
  } catch(e) { console.log("NHL API error:", e.message); }
  return null;
}

// ── API BASKETBALL (BallDontLie — gratuite) ───────────────
async function checkResultNBA(pick) {
  if (pick.sport !== "Basketball") return null;
  try {
    const parts = pick.date.split("/");
    const dateStr = `2026-${parts[1]}-${parts[0]}`;
    const r = await new Promise((res,rej) => {
      require("https").get(`https://api.balldontlie.io/v1/games?dates[]=${dateStr}&per_page=30`,
        { headers: { "Authorization": "0" } },
        resp => { let d=""; resp.on("data",c=>d+=c); resp.on("end",()=>{ try{res(JSON.parse(d))}catch{res({})} }); }
      ).on("error",rej);
    });
    if (!r.data) return null;
    const [home, away] = pick.match.split(" vs ").map(s=>s.trim().toLowerCase());
    const game = r.data.find(g => {
      const h=(g.home_team?.full_name||"").toLowerCase();
      const a=(g.visitor_team?.full_name||"").toLowerCase();
      return h.includes(home.split(" ")[0]) || a.includes(away.split(" ")[0]);
    });
    if (!game || game.status !== "Final") return null;
    const hs = game.home_team_score, as = game.visitor_team_score;
    const scoreFinal = `${hs}-${as}`;
    const marche = pick.marche.toLowerCase();
    let resultat = "EN ATTENTE";
    if (marche.includes("vainqueur") || marche.includes("ml")) {
      const homeWins = hs > as;
      const pickHome = marche.includes((game.home_team?.full_name||"").toLowerCase().split(" ")[0]);
      resultat = (homeWins && pickHome) || (!homeWins && !pickHome) ? "GAGNE" : "PERDU";
    } else if (marche.includes("plus de") || marche.includes("over")) {
      const line = parseFloat(marche.match(/(\d+\.?\d*)/)?.[1] || "215");
      resultat = (hs + as) > line ? "GAGNE" : "PERDU";
    } else if (marche.includes("moins de") || marche.includes("under")) {
      const line = parseFloat(marche.match(/(\d+\.?\d*)/)?.[1] || "215");
      resultat = (hs + as) < line ? "GAGNE" : "PERDU";
    }
    console.log(`  ✅ NBA API: ${hs}-${as} → ${resultat}`);
    return { resultat, score_final: scoreFinal, explication: "Score réel NBA API" };
  } catch(e) { console.log("NBA API error:", e.message); }
  return null;
}

// ── API FOOTBALL (football-data.org) ─────────────────────
async function checkResultFootball(pick) {
  if (pick.sport !== "Football" && pick.sport !== "Foot" && pick.sport !== "MLS") return null;
  if (!FOOTBALL_DATA_KEY) return null;
  try {
    const parts = pick.date.split("/");
    const dateStr = `2026-${parts[1]}-${parts[0]}`;
    const r = await new Promise((res,rej) => {
      require("https").get(
        `https://api.football-data.org/v4/matches?dateFrom=${dateStr}&dateTo=${dateStr}`,
        { headers: { "X-Auth-Token": FOOTBALL_DATA_KEY } },
        resp => { let d=""; resp.on("data",c=>d+=c); resp.on("end",()=>{ try{res(JSON.parse(d))}catch{res({})} }); }
      ).on("error",rej);
    });
    if (!r.matches) return null;
    const [home, away] = pick.match.split(" vs ").map(s=>s.trim().toLowerCase());
    const game = r.matches.find(g => {
      const h=(g.homeTeam?.name||"").toLowerCase();
      const a=(g.awayTeam?.name||"").toLowerCase();
      return h.includes(home.split(" ")[0]) || a.includes(away.split(" ")[0]);
    });
    if (!game || game.status !== "FINISHED") return null;
    const hs = game.score?.fullTime?.home ?? 0;
    const as = game.score?.fullTime?.away ?? 0;
    const scoreFinal = `${hs}-${as}`;
    const marche = pick.marche.toLowerCase();
    let resultat = "EN ATTENTE";
    if (marche.includes("vainqueur") || marche.includes("victoire") || marche.includes("ml")) {
      const homeWins = hs > as;
      const pickHome = marche.includes(home.split(" ")[0]);
      resultat = (homeWins && pickHome) || (!homeWins && !pickHome) ? "GAGNE" : "PERDU";
    } else if (marche.includes("plus de") || marche.includes("over")) {
      const line = parseFloat(marche.match(/(\d+\.?\d*)/)?.[1] || "2.5");
      resultat = (hs + as) > line ? "GAGNE" : "PERDU";
    } else if (marche.includes("moins de") || marche.includes("under")) {
      const line = parseFloat(marche.match(/(\d+\.?\d*)/)?.[1] || "2.5");
      resultat = (hs + as) < line ? "GAGNE" : "PERDU";
    }
    console.log(`  ✅ football-data.org: ${hs}-${as} → ${resultat}`);
    return { resultat, score_final: scoreFinal, explication: "Score réel football-data.org" };
  } catch(e) { console.log("Football API error:", e.message); }
  return null;
}

// Recherche le résultat réel via API-Sports (gratuit 100 req/jour)
async function checkResultAPISports(pick) {
  if (!APISPORTS_KEY) return null;

  const sportMap = {
    "Football": { api: "football", path: "/fixtures" },
    "Basketball": { api: "basketball", path: "/games" },
    "Hockey": { api: "hockey", path: "/games" },
    "Baseball": { api: "baseball", path: "/games" },
  };
  const sport = sportMap[pick.sport];
  if (!sport) return null;

  // Date du match (format YYYY-MM-DD)
  const parts = pick.date.split("/");
  const dateISO = `2026-${parts[1]}-${parts[0]}`;

  try {
    const res = await httpsGet(
      `v3.${sport.api}.api-sports.io`,
      `${sport.path}?date=${dateISO}&timezone=Europe/Paris`,
      { "x-apisports-key": APISPORTS_KEY }
    );

    if (!res.response || !res.response.length) return null;

    // Cherche le match par nom d'équipe
    const [homeTeam, awayTeam] = pick.match.split(" vs ").map(s => s.trim().toLowerCase());
    const found = res.response.find(g => {
      const h = (g.teams?.home?.name || g.home?.name || "").toLowerCase();
      const a = (g.teams?.away?.name || g.away?.name || "").toLowerCase();
      return (h.includes(homeTeam.split(" ")[0]) || a.includes(awayTeam.split(" ")[0]));
    });

    if (!found) return null;

    const status = found.fixture?.status?.short || found.status?.short || "";
    if (!["FT","AET","PEN","AOT","POST","FT_PEN"].includes(status)) {
      return { resultat: "EN ATTENTE", score_final: null, explication: `Match status: ${status}` };
    }

    // Score selon le sport
    let scoreHome, scoreAway;
    if (pick.sport === "Football") {
      scoreHome = found.goals?.home ?? found.score?.home;
      scoreAway = found.goals?.away ?? found.score?.away;
    } else {
      scoreHome = found.scores?.home?.total ?? found.home?.score;
      scoreAway = found.scores?.away?.total ?? found.away?.score;
    }

    const scoreFinal = `${scoreHome}-${scoreAway}`;
    const marche = pick.marche.toLowerCase();

    // Déterminer GAGNE/PERDU selon le marché
    let resultat = "EN ATTENTE";
    if (marche.includes("vainqueur") || marche.includes("ml") || marche.includes("winner")) {
      const homeWins = scoreHome > scoreAway;
      const favoriteIsHome = pick.match.split(" vs ")[0].toLowerCase().includes(
        pick.marche.toLowerCase().split(" ")[0]
      );
      resultat = homeWins === favoriteIsHome ? "GAGNE" : "PERDU";
    } else if (marche.includes("over") || marche.includes("plus de")) {
      const lineMatch = marche.match(/(\d+\.?\d*)/);
      const line = lineMatch ? parseFloat(lineMatch[1]) : 2.5;
      const total = parseInt(scoreHome) + parseInt(scoreAway);
      resultat = total > line ? "GAGNE" : "PERDU";
    } else if (marche.includes("under") || marche.includes("moins de")) {
      const lineMatch = marche.match(/(\d+\.?\d*)/);
      const line = lineMatch ? parseFloat(lineMatch[1]) : 2.5;
      const total = parseInt(scoreHome) + parseInt(scoreAway);
      resultat = total < line ? "GAGNE" : "PERDU";
    }

    console.log(`  ✅ API-Sports: ${scoreFinal} → ${resultat}`);
    return { resultat, score_final: scoreFinal, explication: `Score réel API-Sports` };

  } catch (e) {
    console.log(`  ⚠️ API-Sports error: ${e.message}`);
    return null;
  }
}

// Fallback Groq si API-Sports ne trouve pas
async function checkResultGroq(pick) {
  if (!GROQ_KEY) return { resultat: "EN ATTENTE", score_final: null, explication: "Clé Groq manquante" };

  const today = new Date().toLocaleDateString("fr-FR");
  const prompt = `Tu es un vérificateur de résultats sportifs. Date aujourd'hui: ${today}.
Match: "${pick.match}" — Sport: ${pick.sport} — Marché: "${pick.marche}" — Cote: ${pick.cote}
Ce match a-t-il eu lieu ? Quel est le résultat final ?
Réponds UNIQUEMENT en JSON sans backticks ni texte:
{"trouve":true,"score_final":"ex: 112-108","resultat":"GAGNE ou PERDU ou EN ATTENTE","explication":"max 15 mots"}`;

  try {
    const res = await httpsPost("api.groq.com", "/openai/v1/chat/completions",
      { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
      { model: "llama-3.3-70b-versatile", max_tokens: 150, temperature: 0,
        messages: [{ role: "user", content: prompt }] }
    );
    const text = (res.choices?.[0]?.message?.content || "").replace(/```json|```/g, "").trim();
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { resultat: "EN ATTENTE", score_final: null };
  } catch (e) {
    return { resultat: "EN ATTENTE", score_final: null, explication: e.message.slice(0, 40) };
  }
}

// Fonction principale : APIs officielles gratuites → Groq fallback
async function checkResult(pick) {
  // 1. NHL officielle (hockey)
  if (pick.sport === "Hockey") {
    console.log(`  🏒 NHL API officielle...`);
    const r = await checkResultNHL(pick);
    if (r && r.resultat !== "EN ATTENTE") return r;
  }
  // 2. NBA (basketball)
  if (pick.sport === "Basketball") {
    console.log(`  🏀 NBA API (BallDontLie)...`);
    const r = await checkResultNBA(pick);
    if (r && r.resultat !== "EN ATTENTE") return r;
  }
  // 3. Football-data.org (football)
  if (["Football","Foot","MLS"].includes(pick.sport)) {
    console.log(`  ⚽ football-data.org...`);
    const r = await checkResultFootball(pick);
    if (r && r.resultat !== "EN ATTENTE") return r;
  }
  // 4. Groq fallback pour tout
  console.log(`  🔄 Groq fallback...`);
  return checkResultGroq(pick);
}

// ── EXTRAIRE LES PICKS EN ATTENTE depuis App.js ───────────

function extractPicks(appJsContent) {
  const picksMatch = appJsContent.match(/var picks = \[([\s\S]*?)\];/);
  if (!picksMatch) return [];

  const picks = [];
  const lineRegex = /\["([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]*)"\]/g;
  let m;
  while ((m = lineRegex.exec(picksMatch[1])) !== null) {
    picks.push({ date: m[1], match: m[2], marche: m[3], cote: m[4], score: m[5], statut: m[6], sport: m[7], raw: m[0] });
  }
  return picks.filter(p => p.statut === "EN ATTENTE");
}

// ── CALCULER NOUVELLE BANKROLL ────────────────────────────

function extractBankroll(appJsContent) {
  // On lit la bankroll depuis picks-data.json si possible, sinon on retourne 494
  return 494;
}

// ── METTRE À JOUR App.js ──────────────────────────────────

function updateAppJs(content, pick, resultat, scoreFinal) {
  const oldLine = `["${pick.date}","${pick.match}","${pick.marche}","${pick.cote}","${pick.score}","EN ATTENTE","${pick.sport}"]`;
  const score = scoreFinal || "---";
  const newLine = `["${pick.date}","${pick.match}","${pick.marche}","${pick.cote}","${score}","${resultat}","${pick.sport}"]`;
  
  if (!content.includes(oldLine)) {
    console.log(`⚠️  Ligne introuvable pour ${pick.match} — tentative fuzzy match`);
    // Tentative avec EN ATTENTE générique
    const fuzzy = content.replace(
      new RegExp(`\\["${pick.date.replace(/\//g, "\\/")}","${pick.match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\]]*"EN ATTENTE"[^\\]]*\\]`),
      newLine
    );
    return fuzzy;
  }
  return content.replace(oldLine, newLine);
}

// ── METTRE À JOUR LES STATS dans App.js ──────────────────

function updateStats(content) {
  // Recalculer wins/total depuis les picks
  const picksMatch = content.match(/var picks = \[([\s\S]*?)\];/);
  if (!picksMatch) return content;

  let wins = 0, total = 0;
  const lineRegex = /\["[^"]+","[^"]+","[^"]+","[^"]+","[^"]+","([^"]+)","[^"]*"\]/g;
  let m;
  while ((m = lineRegex.exec(picksMatch[1])) !== null) {
    const statut = m[1];
    if (statut === "GAGNE") { wins++; total++; }
    else if (statut === "PERDU") { total++; }
  }

  const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;

  // Remplacer les stats dans le header
  content = content.replace(
    /\{label:"WIN RATE",value:winrate\+"%",sub:"sur "\+total\+" paris"\}/,
    `{label:"WIN RATE",value:winrate+"%",sub:"sur "+total+" paris"}`
  );

  console.log(`📊 Stats: ${wins}W / ${total-wins}L — ${winrate}%`);
  return content;
}

// ── MAIN ──────────────────────────────────────────────────

async function main() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  HERMÈS V4.2 — CHECK RESULTS");
  console.log(`  ${new Date().toLocaleString("fr-FR")}`);
  console.log("═══════════════════════════════════════════\n");

  // 1. Lire App.js
  console.log("📖 Lecture App.js...");
  const { content: appJs, sha: appJsSha } = await readFile("src/App.js");

  // 2. Extraire picks EN ATTENTE
  const enAttente = extractPicks(appJs);
  console.log(`🔍 ${enAttente.length} pick(s) EN ATTENTE\n`);

  if (enAttente.length === 0) {
    console.log("✅ Aucun pick à vérifier ce soir.");
    return;
  }

  let updatedAppJs = appJs;
  let changed = false;
  let bankroll = 494;

  // 3. Vérifier chaque pick
  for (const pick of enAttente) {
    console.log(`▶ Vérification: ${pick.match} — ${pick.marche}`);
    const check = await checkResult(pick);
    console.log(`  → ${check.resultat} | Score: ${check.score_final || "?"} | ${check.explication}`);

    if (check.resultat !== "EN ATTENTE") {
      // Mettre à jour la ligne dans App.js
      updatedAppJs = updateAppJs(updatedAppJs, pick, check.resultat, check.score_final);

      // Recalculer bankroll
      const mise = 10;
      let gainPerte = 0;
      if (check.resultat === "GAGNÉ" || check.resultat === "GAGNE") {
        gainPerte = Math.round((mise * parseFloat(pick.cote) - mise) * 100) / 100;
        bankroll = Math.round((bankroll + gainPerte) * 100) / 100;
        console.log(`  💰 GAGNÉ +${gainPerte}€ → Bankroll: ${bankroll}€`);
      } else if (check.resultat === "PERDU") {
        gainPerte = -mise;
        bankroll = Math.round((bankroll - mise) * 100) / 100;
        console.log(`  📉 PERDU -${mise}€ → Bankroll: ${bankroll}€`);
      }

      // 📱 Notification Telegram résultat
      const won = check.resultat === "GAGNE" || check.resultat === "GAGNÉ";
      const emoji = won ? "✅" : "❌";
      const gainStr = won ? `+${gainPerte}€` : `${gainPerte}€`;
      await sendTelegram(
`${emoji} <b>RÉSULTAT — ${pick.date}</b>

🏟 <b>${pick.match}</b>
🎯 ${pick.marche} @ ${pick.cote}
📊 Score : <b>${check.score_final || "—"}</b>
${emoji} <b>${check.resultat}</b> ${gainStr}

💼 Bankroll : <b>${bankroll}€</b>
📝 ${check.explication || ""}`
      );
      changed = true;
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!changed) {
    console.log("⏳ Aucun résultat disponible ce soir — on réessaie demain.");
    return;
  }

  // 4. Commit App.js mis à jour sur GitHub
  console.log("\n💾 Mise à jour App.js sur GitHub...");
  const date = new Date().toLocaleDateString("fr-FR");
  await writeFile("src/App.js", updatedAppJs, appJsSha, `🤖 Hermès: résultats ${date} — Bankroll: ${bankroll}€`);

  console.log("\n═══════════════════════════════════════════");
  console.log(`  BANKROLL : ${bankroll}€`);
  console.log(`  Commit pushé → deploy automatique lancé`);
  console.log("═══════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("💥 ERREUR CRITIQUE:", err.message);
  process.exit(1);
});


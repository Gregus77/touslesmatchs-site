const https = require("https");
const fs = require("fs");

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.HERMES_GITHUB_TOKEN;
const REPO_OWNER = "Gregus77";
const REPO_NAME = "touslesmatchs-site";
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ?? HELPERS ??????????????????????????????????????????????

function httpsRequest(method, hostname, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname, path, method,
      headers: {
        "User-Agent": "HermesLearn/1.0",
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        ...headers
      }
    };
    if (data) opts.headers["Content-Length"] = Buffer.byteLength(data);
    const req = https.request(opts, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function readFile(filePath) {
  const res = await httpsRequest("GET", "api.github.com", `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`);
  if (res.status === 200 && res.body.content) {
    return { content: Buffer.from(res.body.content, "base64").toString("utf8"), sha: res.body.sha };
  }
  throw new Error(`Impossible de lire ${filePath}`);
}

async function writeFile(filePath, content, sha, message) {
  const encoded = Buffer.from(content).toString("base64");
  const res = await httpsRequest("PUT", "api.github.com",
    `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
    { "Content-Type": "application/json" },
    { message, content: encoded, sha }
  );
  return res.status === 200 || res.status === 201;
}

async function createFile(filePath, content, message) {
  const encoded = Buffer.from(content).toString("base64");
  const res = await httpsRequest("PUT", "api.github.com",
    `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
    { "Content-Type": "application/json" },
    { message, content: encoded }
  );
  return res.status === 201;
}

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  const body = JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: "HTML" });
  const req = https.request({
    hostname: "api.telegram.org",
    path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
  });
  req.write(body); req.end();
}

// ?? ANALYSER LES PICKS ????????????????????????????????????

function extractAllPicks(appJsContent) {
  const picksMatch = appJsContent.match(/const picks = \[([\s\S]*?)\];/);
  if (!picksMatch) return [];
  const picks = [];
  const lineRegex = /\["([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]*)"/g;
  let m;
  while ((m = lineRegex.exec(picksMatch[1])) !== null) {
    picks.push({
      date: m[1], match: m[2], marche: m[3],
      cote: parseFloat(m[4]) || 0, score: m[5],
      statut: m[6], sport: m[7]
    });
  }
  return picks.filter(p => p.statut === "GAGNE" || p.statut === "PERDU");
}

function analyzeLocally(picks) {
  const stats = { total: picks.length, wins: 0, losses: 0, bySport: {}, byCoteRange: {}, winStreak: 0, lossStreak: 0, currentStreak: 0 };
  let streak = 0; let streakType = null;

  picks.forEach(p => {
    const won = p.statut === "GAGNE";
    if (won) { stats.wins++; } else { stats.losses++; }

    // Par sport
    if (!stats.bySport[p.sport]) stats.bySport[p.sport] = { wins: 0, losses: 0 };
    if (won) stats.bySport[p.sport].wins++; else stats.bySport[p.sport].losses++;

    // Par tranche de cote
    const range = p.cote < 1.5 ? "1.40-1.50" : p.cote < 1.7 ? "1.50-1.70" : p.cote < 2.0 ? "1.70-2.00" : "2.00+";
    if (!stats.byCoteRange[range]) stats.byCoteRange[range] = { wins: 0, losses: 0 };
    if (won) stats.byCoteRange[range].wins++; else stats.byCoteRange[range].losses++;

    // S?rie
    if (streakType === null) { streakType = won; streak = 1; }
    else if (won === streakType) { streak++; }
    else { streakType = won; streak = 1; }
    stats.currentStreak = streak;
  });

  stats.winrate = stats.total ? Math.round((stats.wins / stats.total) * 100) : 0;

  // Meilleur et pire sport
  let bestSport = null, worstSport = null;
  Object.entries(stats.bySport).forEach(([sport, s]) => {
    const wr = s.wins + s.losses > 0 ? s.wins / (s.wins + s.losses) : 0;
    if (!bestSport || wr > bestSport.wr) bestSport = { sport, wr };
    if (!worstSport || wr < worstSport.wr) worstSport = { sport, wr };
  });
  stats.bestSport = bestSport;
  stats.worstSport = worstSport;

  return stats;
}

// ?? CLAUDE ANALYSE ET G?N?RE DES SKILLS ??????????????????

async function claudeLearn(picks, stats) {
  console.log("?? Claude ? Analyse des patterns...");
  const prompt = `Tu es Herm?s, agent de paris sportifs. Analyse ces ${picks.length} picks des 30 derniers jours et g?n?re des skills (r?gles apprises).

STATISTIQUES:
- Win rate global: ${stats.winrate}%
- Wins: ${stats.wins} | Losses: ${stats.losses}
- Par sport: ${JSON.stringify(stats.bySport)}
- Par cote: ${JSON.stringify(stats.byCoteRange)}
- Meilleur sport: ${stats.bestSport?.sport} (${Math.round((stats.bestSport?.wr||0)*100)}% WR)
- Pire sport: ${stats.worstSport?.sport} (${Math.round((stats.worstSport?.wr||0)*100)}% WR)

PICKS R?CENTS (30 derniers jours):
${picks.slice(0,30).map(p => `${p.date} | ${p.sport} | ${p.match} | @${p.cote} | ${p.statut}`).join("\n")}

G?n?re 5 ? 8 r?gles/skills ? partir de ces donn?es. Format JSON:
{
  "date": "${new Date().toLocaleDateString("fr-FR")}",
  "winrate_global": ${stats.winrate},
  "skills": [
    {
      "id": "SKILL_001",
      "nom": "Nom de la r?gle",
      "r?gle": "Description de ce qu'il faut faire ou ?viter",
      "bas?_sur": "explication courte des donn?es",
      "confiance": 8,
      "type": "GO ou STOP"
    }
  ],
  "sports_prioritaires": ["sport1", "sport2"],
  "sports_?_?viter": ["sport3"],
  "fourchette_cote_optimale": "1.50-1.80",
  "le?ons_semaine": "R?sum? en 2-3 phrases des le?ons de cette semaine",
  "recommandations": "Ajustements pour la semaine prochaine"
}`;

  try {
    const data = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }]
    });
    const res = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: "api.anthropic.com", path: "/v1/messages", method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01",
          "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data)
        }
      }, r => { let d = ""; r.on("data", c => d += c); r.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } }); });
      req.on("error", reject); req.write(data); req.end();
    });
    const text = res.content?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const m = clean.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch(e) {
    console.error("Claude error:", e.message);
    return null;
  }
}

// ?? MAIN ?????????????????????????????????????????????????

async function main() {
  console.log("\n???????????????????????????????????????????");
  console.log("  HERM?S LEARN V1.0 ? APPRENTISSAGE HEBDO");
  console.log(`  ${new Date().toLocaleString("fr-FR")}`);
  console.log("???????????????????????????????????????????\n");

  // 1. Lire App.js
  console.log("?? Lecture App.js depuis GitHub...");
  const { content: appJs, sha } = await readFile("src/App.js");

  // 2. Extraire et analyser les picks
  const picks = extractAllPicks(appJs);
  console.log(`?? ${picks.length} picks analys?s`);
  const stats = analyzeLocally(picks);
  console.log(`?? Win rate: ${stats.winrate}% | Meilleur: ${stats.bestSport?.sport} | Pire: ${stats.worstSport?.sport}`);

  // 3. Claude analyse et g?n?re des skills
  const skills = await claudeLearn(picks, stats);
  if (!skills) { console.log("?? Pas de skills g?n?r?s"); return; }

  console.log(`? ${skills.skills?.length || 0} skills g?n?r?s`);
  skills.skills?.forEach(s => console.log(`  ${s.type === "GO" ? "??" : "??"} [${s.id}] ${s.nom}`));

  // 4. Sauvegarder les skills sur GitHub
  const skillsContent = JSON.stringify(skills, null, 2);
  const dateStr = new Date().toISOString().slice(0, 10);
  const skillsPath = `skills/hermes_skills_${dateStr}.json`;
  const latestPath = `skills/hermes_skills_latest.json`;

  // Sauvegarder la version dat?e
  try {
    await createFile(skillsPath, skillsContent, `?? Herm?s Learn: skills ${dateStr}`);
    console.log(`? Skills sauvegard?s: ${skillsPath}`);
  } catch(e) {
    console.log("?? Skills dat?s d?j? existants");
  }

  // Mettre ? jour la version latest
  try {
    const existing = await readFile(latestPath);
    await writeFile(latestPath, skillsContent, existing.sha, `?? Herm?s Learn: update latest ${dateStr}`);
  } catch(e) {
    await createFile(latestPath, skillsContent, `?? Herm?s Learn: cr?ation latest`);
  }
  console.log("? hermes_skills_latest.json mis ? jour");

  // 5. Rapport Telegram
  const report = `?? <b>HERM?S LEARN ? Rapport Hebdo</b>

?? <b>Performance</b>
? ${stats.wins}W / ${stats.losses}L ? <b>${stats.winrate}%</b> win rate

?? Meilleur sport: <b>${stats.bestSport?.sport}</b> (${Math.round((stats.bestSport?.wr||0)*100)}%)
?? ? ?viter: <b>${stats.worstSport?.sport}</b> (${Math.round((stats.worstSport?.wr||0)*100)}%)

?? Fourchette cote optimale: <b>${skills.fourchette_cote_optimale}</b>

?? <b>Le?on de la semaine</b>
${skills.le?ons_semaine}

?? <b>Ajustements</b>
${skills.recommandations}

? <b>${skills.skills?.length || 0} skills mis ? jour</b>`;

  await sendTelegram(report);
  console.log("?? Rapport Telegram envoy?");

  console.log("\n???????????????????????????????????????????");
  console.log("  APPRENTISSAGE TERMIN? ?");
  console.log("???????????????????????????????????????????\n");
}

main().catch(e => {
  console.error("?? ERREUR:", e);
  process.exit(1);
});

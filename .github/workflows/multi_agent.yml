// ═══════════════════════════════════════════════════════════
//  CONCILE V4.2 — Multi-Agents Script
//  TousLesMatchs.com — Gregory / Winamax
// ═══════════════════════════════════════════════════════════

const fs   = require("fs");
const path = require("path");

const GROQ_KEY     = process.env.GROQ_API_KEY;
const GEMINI_KEY   = process.env.GEMINI_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const OR_KEY       = process.env.OPENROUTER_API_KEY;

const SYSTEM = `Tu es un analyste expert en value betting. Système V4.2 — Winamax, Gregory.

CRITÈRES OBLIGATOIRES:
• Score ≥ 8/10 | Probabilité ≥ 63% | Value (Prob×Cote)/100 > 1.06
• Fenêtre cotes: 1.40–2.00 | Kelly% ≥ 2%

SPORTS PRIORITAIRES: NHL Playoffs > Bundesliga > Tennis > Volleyball
AUSSI ACCEPTÉS: NBA Over/Under, NFL, Ligue 1, PL, LaLiga, Copa Libertadores

LISTE NOIRE: Ottawa Senators, Montreal Canadiens, Toronto Raptors, Stuttgart, Manchester United
MARCHÉS BANNIS: MLB, combinés >2 picks, NBA moneyline, cotes <1.40 ou >2.20

Réponds UNIQUEMENT en JSON:
{"hasPick":true/false,"match":"A vs B","competition":"Nom","sport":"Foot|Hockey|Basketball|Tennis","pick":"Description","cote":1.XX,"score":X.X,"prob":XX,"kelly":"X€","raison":"courte"}
Si pas de pick: {"hasPick":false}`;

function today() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
}

function parseJSON(raw) {
  if (!raw) return null;
  try {
    const clean = raw.replace(/```[\w]*\n?/g,"").replace(/```/g,"").trim();
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch(e) {}
  return null;
}

function sportEmoji(sport) {
  const map = {Foot:"⚽",Hockey:"🏒",Basketball:"🏀",Tennis:"🎾",Baseball:"⚾",Volleyball:"🏐"};
  return map[sport] || "🎯";
}

async function askGroq(prompt) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions",{
    method:"POST",
    headers:{"Authorization":`Bearer ${GROQ_KEY}`,"Content-Type":"application/json"},
    body:JSON.stringify({model:"llama-3.3-70b-versatile",messages:[{role:"system",content:SYSTEM},{role:"user",content:prompt}],max_tokens:400,temperature:0.1})
  });
  const d = await r.json();
  return parseJSON(d.choices?.[0]?.message?.content);
}

async function askGemini(prompt) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({contents:[{parts:[{text:SYSTEM+"\n\n"+prompt}]}],generationConfig:{maxOutputTokens:400,temperature:0.1}})
  });
  const d = await r.json();
  return parseJSON(d.candidates?.[0]?.content?.parts?.[0]?.text);
}

async function askDeepSeek(prompt) {
  const r = await fetch("https://api.deepseek.com/chat/completions",{
    method:"POST",
    headers:{"Authorization":`Bearer ${DEEPSEEK_KEY}`,"Content-Type":"application/json"},
    body:JSON.stringify({model:"deepseek-chat",messages:[{role:"system",content:SYSTEM},{role:"user",content:prompt}],max_tokens:400,temperature:0.1})
  });
  const d = await r.json();
  return parseJSON(d.choices?.[0]?.message?.content);
}

async function askMistral(prompt) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions",{
    method:"POST",
    headers:{"Authorization":`Bearer ${OR_KEY}`,"Content-Type":"application/json","HTTP-Referer":"https://touslesmatchs.com","X-Title":"Concile V4.2"},
    body:JSON.stringify({model:"mistralai/mistral-7b-instruct:free",messages:[{role:"system",content:SYSTEM},{role:"user",content:prompt}],max_tokens:400,temperature:0.1})
  });
  const d = await r.json();
  return parseJSON(d.choices?.[0]?.message?.content);
}

async function main() {
  console.log(`\n🏛️ CONCILE V4.2 — ${new Date().toISOString()}`);
  console.log("═".repeat(50));

  const prompt = `Nous sommes le ${new Date().toLocaleDateString("fr-FR")}.
Identifie LE meilleur pick sportif disponible aujourd'hui selon nos critères V4.2.
Analyse NHL Playoffs, NBA Over/Under, foot européen, tennis.
Réponds en JSON uniquement.`;

  console.log("\n📡 Consultation du Concile...");

  const [groq, gemini, deepseek, mistral] = await Promise.allSettled([
    askGroq(prompt),
    askGemini(prompt),
    askDeepSeek(prompt),
    askMistral(prompt)
  ]);

  const results = {
    groq:     groq.status==="fulfilled" ? groq.value : null,
    gemini:   gemini.status==="fulfilled" ? gemini.value : null,
    deepseek: deepseek.status==="fulfilled" ? deepseek.value : null,
    mistral:  mistral.status==="fulfilled" ? mistral.value : null,
  };

  Object.entries(results).forEach(([ia,r]) => {
    console.log(`  ${ia.padEnd(10)}: ${r?.hasPick ? `✅ GO — ${r.match} @ ${r.cote} (${r.score}/10)` : "⛔ NO BET"}`);
  });

  const goVotes = Object.values(results).filter(r => r?.hasPick).length;
  const avgScore = Object.values(results).filter(r => r?.score > 0).reduce((s,r) => s+r.score, 0) / (Object.values(results).filter(r => r?.score > 0).length || 1);
  const best = results.groq || results.gemini || results.deepseek || results.mistral;

  console.log(`\n  Votes GO : ${goVotes}/4 | Score moyen : ${avgScore.toFixed(1)}/10`);

  const isGO = goVotes >= 3 && avgScore >= 8.0 && best?.hasPick;
  console.log(`  Verdict  : ${isGO ? "✅ GO" : "⛔ NO BET"}`);

  // ── Mise à jour de App.js ──────────────────────────────
  const appPath = path.join(process.cwd(), "src", "App.js");
  let appContent = fs.readFileSync(appPath, "utf-8");

  let newPick;
  if (isGO && best) {
    newPick = `  ["${today()}","${best.match}","${best.pick}","${best.cote}","---","EN ATTENTE","${best.sport}"],`;
    console.log(`\n✅ Pick ajouté : ${best.match} — ${best.pick} @ ${best.cote}`);
  } else {
    newPick = `  ["${today()}","PAS DE PARI - Aucun match n atteint notre seuil 8/10","---","---","---","NOPICK",""],`;
    console.log("\n⛔ Pas de pick aujourd'hui");
  }

  // Insère en tête du tableau picks
  appContent = appContent.replace(
    /var picks = \[/,
    `var picks = [\n${newPick}`
  );

  fs.writeFileSync(appPath, appContent, "utf-8");
  console.log("📝 App.js mis à jour !");
  console.log("═".repeat(50));
}

main().catch(err => {
  console.error("💥 ERREUR:", err);
  process.exit(1);
});

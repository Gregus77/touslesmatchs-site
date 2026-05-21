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
- Score ≥ 8/10 | Probabilité ≥ 63% | Value (Prob×Cote)/100 > 1.06
- Fenêtre cotes: 1.40–2.00 | Kelly% ≥ 2%

SPORTS PRIORITAIRES (ordre de priorité):
1. 🏒 NHL Playoffs — Meilleure valeur, résultats fiables
2. 🏈 NFL / CFL — Sport anti-triche par excellence, enjeux trop élevés
3. 🏎️ F1 — Impossible de tricher, trop d'argent et de réputation en jeu. Parier sur podium, victoire constructeur, pole position
4. ⚽ Bundesliga / Ligue 1 / PL / LaLiga — Grands championnats fiables
5. 🎾 Tennis Grand Chelem / Masters — Joueurs top 50 uniquement
6. 🏀 NBA Over/Under — Jamais moneyline
7. 🏐 Volleyball — Très peu de matchs truqués
8. 🥊 MMA UFC — Combats principaux uniquement, pas les undercard
9. 🏉 Rugby Top 14 / Pro14 — Très fiable
10. ⚾ Baseball NPB (Japon) — Jamais MLB

MARCHÉS F1 AUTORISÉS:
- Vainqueur de la course (pole sitter favori)
- Podium constructeur (Mercedes/Ferrari/Red Bull)
- Pole position
- Fastest lap
JAMAIS: paris sur accidents, safety car

MARCHÉS NFL AUTORISÉS:
- Over/Under total points
- Vainqueur match (spread inclus)
- Premier touchdown scorer
JAMAIS: props individuels obscurs

LISTE NOIRE ÉQUIPES: Ottawa Senators, Montreal Canadiens, Toronto Raptors, Stuttgart, Manchester United, tout club de 3ème division européenne

MARCHÉS BANNIS: MLB, combinés >2 picks, NBA moneyline, cotes <1.40 ou >2.20, Paris live, matchs de pré-saison

KELLY:
NHL G1 Playoffs ≥9/10 → 100% Kelly
Autre ≥9/10 → 50% Kelly
8–8.9/10 → 25% Kelly

Réponds UNIQUEMENT en JSON:
{"hasPick":true/false,"match":"A vs B ou GP de X","competition":"Nom","sport":"Foot|Hockey|Basketball|Tennis|F1|NFL|Rugby|MMA|Volleyball","pick":"Description précise","cote":1.XX,"score":X.X,"prob":XX,"kelly":"X€","raison":"courte explication 1 phrase"}
Si pas de pick valide: {"hasPick":false,"raison":"Explication courte"}`;

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

async function askGroq(prompt) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions",{
    method:"POST",
    headers:{"Authorization":`Bearer ${GROQ_KEY}`,"Content-Type":"application/json"},
    body:JSON.stringify({model:"llama-3.3-70b-versatile",messages:[{role:"system",content:SYSTEM},{role:"user",content:prompt}],max_tokens:500,temperature:0.1})
  });
  const d = await r.json();
  return parseJSON(d.choices?.[0]?.message?.content);
}

async function askGemini(prompt) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({contents:[{parts:[{text:SYSTEM+"\n\n"+prompt}]}],generationConfig:{maxOutputTokens:500,temperature:0.1}})
  });
  const d = await r.json();
  return parseJSON(d.candidates?.[0]?.content?.parts?.[0]?.text);
}

async function askDeepSeek(prompt) {
  const r = await fetch("https://api.deepseek.com/chat/completions",{
    method:"POST",
    headers:{"Authorization":`Bearer ${DEEPSEEK_KEY}`,"Content-Type":"application/json"},
    body:JSON.stringify({model:"deepseek-chat",messages:[{role:"system",content:SYSTEM},{role:"user",content:prompt}],max_tokens:500,temperature:0.1})
  });
  const d = await r.json();
  return parseJSON(d.choices?.[0]?.message?.content);
}

async function askMistral(prompt) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions",{
    method:"POST",
    headers:{"Authorization":`Bearer ${OR_KEY}`,"Content-Type":"application/json","HTTP-Referer":"https://touslesmatchs.com","X-Title":"Concile V4.2"},
    body:JSON.stringify({model:"mistralai/mistral-7b-instruct:free",messages:[{role:"system",content:SYSTEM},{role:"user",content:prompt}],max_tokens:500,temperature:0.1})
  });
  const d = await r.json();
  return parseJSON(d.choices?.[0]?.message?.content);
}

async function main() {
  console.log(`\n🏛️ CONCILE V4.2 — ${new Date().toISOString()}`);
  console.log("═".repeat(55));

  const prompt = `Nous sommes le ${new Date().toLocaleDateString("fr-FR")}.

Scanne TOUS les événements sportifs disponibles aujourd'hui et ce soir:
- NHL Playoffs (priorité absolue si match ce soir)
- NFL (saison régulière ou playoffs si disponible)
- F1 (qualifications ou course ce week-end ?)
- NBA Over/Under (Conference Finals en cours)
- Football européen (Bundesliga, Ligue 1, PL, LaLiga, Coupe d'Europe)
- Tennis (Roland Garros commence bientôt ?)
- Rugby, MMA UFC, Volleyball

Identifie LE MEILLEUR pick unique selon nos critères V4.2.
Score minimum 8/10. Value minimum 1.06.
Si aucun ne passe le seuil, hasPick: false.
Réponds en JSON uniquement.`;

  console.log("\n📡 Consultation du Concile — 10 sports analysés...");

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

  console.log("\n📊 VOTES DU CONCILE:");
  Object.entries(results).forEach(([ia,r]) => {
    if (r?.hasPick) {
      console.log(`  ✅ ${ia.padEnd(10)}: GO — ${r.match} @ ${r.cote} (${r.score}/10) [${r.sport}]`);
    } else {
      console.log(`  ⛔ ${ia.padEnd(10)}: NO BET — ${r?.raison || "Pas de pick valide"}`);
    }
  });

  const goVotes  = Object.values(results).filter(r => r?.hasPick).length;
  const scores   = Object.values(results).filter(r => r?.score > 0).map(r => r.score);
  const avgScore = scores.length > 0 ? scores.reduce((a,b) => a+b, 0) / scores.length : 0;

  const goPicks = Object.values(results).filter(r => r?.hasPick && r?.score > 0);
  const best = goPicks.sort((a,b) => b.score - a.score)[0] || null;

  console.log(`\n  Votes GO : ${goVotes}/4 | Score moyen : ${avgScore.toFixed(1)}/10`);

  const isGO = goVotes >= 3 && avgScore >= 8.0 && best;
  console.log(`  Verdict  : ${isGO ? "✅ GO — " + best?.sport : "⛔ NO BET"}`);

  const appPath = path.join(process.cwd(), "src", "App.js");
  let appContent = fs.readFileSync(appPath, "utf-8");

  let newPick;
  if (isGO && best) {
    newPick = `  ["${today()}","${best.match}","${best.pick}","${best.cote}","---","EN ATTENTE","${best.sport}"],`;
    console.log(`\n✅ Pick publié : ${best.match} — ${best.pick} @ ${best.cote} [${best.sport}]`);
    console.log(`   Raison : ${best.raison}`);
  } else {
    newPick = `  ["${today()}","PAS DE PARI - Aucun match n atteint notre seuil 8/10","---","---","---","NOPICK",""],`;
    console.log("\n⛔ Pas de pick aujourd'hui — critères non atteints");
  }

  appContent = appContent.replace(
    /var picks = \[/,
    `var picks = [\n${newPick}`
  );

  fs.writeFileSync(appPath, appContent, "utf-8");
  console.log("📝 App.js mis à jour !");
  console.log("═".repeat(55));
}

main().catch(err => {
  console.error("💥 ERREUR CRITIQUE:", err);
  process.exit(1);
});

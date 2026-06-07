/**
 * check_results.js — Vérificateur automatique des résultats
 *
 * S'exécute toutes les heures via cron sur le VPS.
 * Lit les picks "EN ATTENTE" dans App.js, interroge RapidAPI pour les scores
 * réels, met à jour App.js (GAGNE/PERDU + score), rebuild le site et push.
 *
 * Cron recommandé (VPS) :
 *   0 19-23,0,1 * * * cd /opt/touslesmatchs && node scripts/check_results.js >> /var/log/check_results.log 2>&1
 */

"use strict";
const https  = require("https");
const fs     = require("fs");
const path   = require("path");
const { execSync } = require("child_process");

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const APP_JS       = path.join(__dirname, "../src/App.js");
const PICK_JSON    = path.join(__dirname, "today_pick.json");

// ─── HTTP helper ─────────────────────────────────────────────────────────────
function rapidGet(endpoint) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "free-api-live-football-data.p.rapidapi.com",
      path: endpoint,
      method: "GET",
      headers: {
        "x-rapidapi-host": "free-api-live-football-data.p.rapidapi.com",
        "x-rapidapi-key":  RAPIDAPI_KEY
      }
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.setTimeout(20000, () => { req.destroy(); resolve({}); });
    req.on("error", () => resolve({}));
    req.end();
  });
}

// ─── Parse les picks EN ATTENTE depuis App.js ─────────────────────────────────
function getPendingPicks(content) {
  // Cherche les lignes de type : ["08/06","Team A vs Team B","Bet","1.6","—","EN ATTENTE","Foot",7,7]
  const regex = /\["(\d{2}\/\d{2})","([^"]+)","([^"]+)","([^"]+)","[^"]*","EN ATTENTE","([^"]*)"[^\]]*\]/g;
  const picks = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    picks.push({
      date:    m[1],   // "08/06"
      match:   m[2],   // "Greece vs Italy"
      bet:     m[3],   // "Greece Vainqueur"
      odds:    m[4],   // "1.6"
      sport:   m[5],   // "Foot"
      raw:     m[0]
    });
  }
  return picks;
}

// ─── Normalise un nom d'équipe pour comparaison ───────────────────────────────
function normalize(name) {
  return (name || "")
    .toLowerCase()
    .replace(/\bfc\b|\bsc\b|\bac\b|\baf\b|\bcf\b|\bca\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Vrai si une des deux strings contient l'autre (après normalisation)
function teamsMatch(apiName, appName) {
  const a = normalize(apiName);
  const b = normalize(appName);
  if (!a || !b) return false;
  // Match exact ou l'un contient l'autre (longueur ≥ 3 pour éviter faux positifs)
  if (a === b) return true;
  if (a.length >= 3 && b.includes(a)) return true;
  if (b.length >= 3 && a.includes(b)) return true;
  // Premiers mots (prénom ou ville)
  const aWords = a.split(" ");
  const bWords = b.split(" ");
  if (aWords[0].length >= 4 && bWords[0].length >= 4 && aWords[0] === bWords[0]) return true;
  return false;
}

// ─── Détermine si le pari est GAGNE ou PERDU ─────────────────────────────────
function evaluateBet(bet, homeTeam, awayTeam, homeGoals, awayGoals) {
  const betL = bet.toLowerCase();
  const total = homeGoals + awayGoals;

  // Victoire d'une équipe : "X Vainqueur", "X ML", "Victoire X"
  const vainqueurMatch = bet.match(/^(.+?)\s+(vainqueur|ml|win|gagne)$/i)
    || bet.match(/^(victoire|win)\s+(.+)$/i);
  if (vainqueurMatch) {
    const teamName = (vainqueurMatch[1].toLowerCase() === "victoire" || vainqueurMatch[1].toLowerCase() === "win")
      ? vainqueurMatch[2]
      : vainqueurMatch[1];
    const teamWins = homeGoals > awayGoals
      ? teamsMatch(homeTeam, teamName)
      : homeGoals < awayGoals
        ? teamsMatch(awayTeam, teamName)
        : false;
    return teamWins ? "GAGNE" : homeGoals === awayGoals ? "PERDU" : "PERDU";
  }

  // Domicile gagne (1X2 type)
  if (betL === "1" || betL === "home win") {
    return homeGoals > awayGoals ? "GAGNE" : "PERDU";
  }
  if (betL === "x" || betL === "draw" || betL === "nul") {
    return homeGoals === awayGoals ? "GAGNE" : "PERDU";
  }
  if (betL === "2" || betL === "away win") {
    return awayGoals > homeGoals ? "GAGNE" : "PERDU";
  }

  // Over / Under
  const overMatch = bet.match(/over\s*(\d+\.?\d*)/i) || bet.match(/plus de\s*(\d+\.?\d*)/i);
  if (overMatch) return total > parseFloat(overMatch[1]) ? "GAGNE" : "PERDU";

  const underMatch = bet.match(/under\s*(\d+\.?\d*)/i) || bet.match(/moins de\s*(\d+\.?\d*)/i);
  if (underMatch) return total < parseFloat(underMatch[1]) ? "GAGNE" : "PERDU";

  // Les deux équipes marquent (BTTS)
  if (betL.includes("deux") || betL.includes("btts") || betL.includes("both")) {
    return homeGoals > 0 && awayGoals > 0 ? "GAGNE" : "PERDU";
  }

  // Inconnu → ne pas toucher
  return null;
}

// ─── Récupère les matchs terminés d'une date (format "DD/MM") ────────────────
async function fetchFinishedMatches(dateFR) {
  // Convertir DD/MM → YYYYMMDD (on suppose l'année courante)
  const [dd, mm] = dateFR.split("/");
  const year = new Date().getFullYear();
  const dateCompact = `${year}${mm}${dd}`;
  const data = await rapidGet(`/football-get-matches-by-date?date=${dateCompact}`);
  const fixtures = data?.response?.matches || [];
  // Filtrer ceux qui sont terminés
  return fixtures.filter(fx => fx.status?.finished === true);
}

// ─── Mise à jour de App.js ────────────────────────────────────────────────────
function updateAppJs(content, rawLine, score, verdict) {
  // Remplace "—","EN ATTENTE" par score,verdict dans la ligne exacte
  const updated = rawLine.replace('"—","EN ATTENTE"', `"${score}","${verdict}"`);
  return content.replace(rawLine, updated);
}

// ─── Met à jour today_pick.json si le pick du jour est résolu ────────────────
function updateTodayPick(match, verdict) {
  try {
    if (!fs.existsSync(PICK_JSON)) return;
    const pick = JSON.parse(fs.readFileSync(PICK_JSON, "utf8"));
    if (pick.match && pick.match.toLowerCase().includes(match.split(" vs ")[0].toLowerCase())) {
      pick.result = verdict;
      pick.nopick = false;
      fs.writeFileSync(PICK_JSON, JSON.stringify(pick, null, 2));
      console.log(`   💾 today_pick.json mis à jour : ${verdict}`);
    }
  } catch (e) { /* silencieux */ }
}

// ─── Git commit + push ────────────────────────────────────────────────────────
function gitPush(message) {
  try {
    execSync(`cd ${path.join(__dirname, "..")} && git add src/App.js scripts/today_pick.json && git commit -m "${message}" && git push origin main`, { stdio: "pipe" });
    console.log("   📤 Git push OK");
  } catch (e) {
    console.error("   ⚠️  Git push échoué :", e.message.slice(0, 200));
  }
}

// ─── Rebuild le site ──────────────────────────────────────────────────────────
// Le Dockerfile compile React dans l'image (COPY --from=builder /app/build /srv).
// On doit rebuilder l'image entière pour que les nouveaux fichiers soient servis.
function rebuildSite() {
  const root = path.join(__dirname, "..");
  try {
    console.log("   🔨 Rebuild images Docker (site + bot) en cours (2-4 min)...");
    execSync(`cd ${root} && docker compose up -d --build site bot`, { stdio: "pipe", timeout: 360000 });
    console.log("   ✅ Site + bot Telegram mis à jour");
  } catch (e) {
    console.error("   ⚠️  Docker build échoué :", e.message.slice(0, 200));
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const now = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
  console.log(`\n🔍 check_results.js — ${now}`);

  if (!RAPIDAPI_KEY) {
    console.error("❌ RAPIDAPI_KEY manquant — arrêt");
    return;
  }

  let content = fs.readFileSync(APP_JS, "utf8");
  const pending = getPendingPicks(content);

  if (!pending.length) {
    console.log("✅ Aucun pick EN ATTENTE — rien à faire");
    return;
  }

  console.log(`📋 ${pending.length} pick(s) EN ATTENTE :`);
  pending.forEach(p => console.log(`   • ${p.date} — ${p.match} (${p.bet})`));

  let changed = false;

  for (const pick of pending) {
    console.log(`\n⚽ Vérification : ${pick.match} (${pick.date})`);
    const finished = await fetchFinishedMatches(pick.date);

    if (!finished.length) {
      console.log("   ⏳ Aucun match terminé sur cette date pour l'instant");
      continue;
    }

    // Trouver le match dans les résultats API
    const [homeApp, awayApp] = pick.match.split(" vs ").map(s => s.trim());
    const found = finished.find(fx =>
      (teamsMatch(fx.home?.name || "", homeApp) && teamsMatch(fx.away?.name || "", awayApp)) ||
      (teamsMatch(fx.home?.name || "", awayApp) && teamsMatch(fx.away?.name || "", homeApp))
    );

    if (!found) {
      console.log(`   ❓ Match introuvable dans l'API (peut-être pas encore fini)`);
      continue;
    }

    const homeGoals =
      found.home?.score         ??  // RapidAPI free-football: home.score
      found.home?.goals         ??
      found.score?.home         ??
      found.homeScore           ??
      found.score?.fullTime?.home ??
      found.result?.home        ??
      found.goals?.home         ??
      found.ft?.home            ??
      null;
    const awayGoals =
      found.away?.score         ??  // RapidAPI free-football: away.score
      found.away?.goals         ??
      found.score?.away         ??
      found.awayScore           ??
      found.score?.fullTime?.away ??
      found.result?.away        ??
      found.goals?.away         ??
      found.ft?.away            ??
      null;

    if (homeGoals === null || awayGoals === null) {
      console.log("   ❓ Score non disponible dans la réponse API — vérifier le debug ci-dessus");
      continue;
    }

    const score = `${homeGoals}-${awayGoals}`;

    // Si les équipes étaient inversées dans l'API vs App.js, inverser le score affiché
    const homeIsHome = teamsMatch(found.home?.name || "", homeApp);
    const displayScore = homeIsHome ? score : `${awayGoals}-${homeGoals}`;

    // Évaluer le pari
    const apiHome   = found.home?.name || "";
    const apiAway   = found.away?.name || "";
    const verdict = evaluateBet(
      pick.bet,
      homeIsHome ? apiHome : apiAway,
      homeIsHome ? apiAway : apiHome,
      homeIsHome ? homeGoals : awayGoals,
      homeIsHome ? awayGoals : homeGoals
    );

    if (!verdict) {
      console.log(`   ⚠️  Type de pari non reconnu : "${pick.bet}" — mise à jour manuelle requise`);
      continue;
    }

    console.log(`   🏁 Terminé : ${apiHome} ${homeGoals}-${awayGoals} ${apiAway}`);
    console.log(`   ${verdict === "GAGNE" ? "✅" : "❌"} Pari "${pick.bet}" → ${verdict} (${displayScore})`);

    content = updateAppJs(content, pick.raw, displayScore, verdict);
    updateTodayPick(pick.match, verdict);
    changed = true;
  }

  if (!changed) {
    console.log("\n⏳ Aucun résultat disponible pour l'instant — réessai à la prochaine heure");
    return;
  }

  // Écriture + déploiement
  fs.writeFileSync(APP_JS, content);
  console.log("\n📝 App.js mis à jour");

  const updatedPicks = getPendingPicks(fs.readFileSync(APP_JS, "utf8"));
  const resolvedCount = pending.length - updatedPicks.filter(p =>
    pending.some(pp => pp.match === p.match && pp.date === p.date)
  ).length;
  console.log(`   ${resolvedCount} pick(s) résolu(s)`);

  gitPush("auto: résultats mis à jour par check_results.js");
  rebuildSite();

  console.log("\n✅ Mise à jour terminée");
}

main().catch(e => console.error("FATAL:", e.message));

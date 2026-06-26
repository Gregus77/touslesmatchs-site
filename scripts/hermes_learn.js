// HERMÈS LEARN — Analyse l'historique des picks et génère un profil d'apprentissage
// Écrit dans hermes_memory.json — injecté dans les prochains prompts IA
"use strict";
const fs = require("fs");
const path = require("path");

const PICKS_FILE   = process.env.PICKS_FILE   || "/repo/public/data/picks.json";
const MEMORY_FILE  = process.env.MEMORY_FILE  || "/repo/data/hermes_memory.json";
const IMPROVEMENT_LOG_FILE = process.env.IMPROVEMENT_LOG_FILE || "/repo/data/hermes_improvement_log.json";

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeStatus(value) {
  const s = cleanText(value).toUpperCase();
  if (["GAGNE", "WIN", "WON"].includes(s)) return "GAGNE";
  if (["PERDU", "LOSS", "LOST"].includes(s)) return "PERDU";
  return "";
}

function isUsefulKey(value) {
  const v = cleanText(value);
  return v && !["inconnu", "unknown", "n/a", "na", "null", "undefined"].includes(v.toLowerCase());
}

function isResolvedPick(h) {
  return (
    (h.status === "GAGNE" || h.status === "PERDU") &&
    isUsefulKey(h.home) &&
    isUsefulKey(h.away) &&
    isUsefulKey(h.prono)
  );
}

// ── Charger l'historique ──────────────────────────────────────────────────────
function loadHistory() {
  try {
    const raw = JSON.parse(fs.readFileSync(PICKS_FILE, "utf8"));
    const hist = raw.history || [];

    // Normaliser les deux formats possibles :
    // Format tableau : ["date","match","prono","cote","score","status","sport"]
    // Format objet  : { date, home, away, prono, cote, score, status, league }
    return hist.map(h => {
      if (Array.isArray(h)) {
        const [date, match, prono, cote, score, status, sport] = h;
        const parts = (match || "").split(" vs ");
        return {
          date: cleanText(date), sport: cleanText(sport) || "Football",
          home: cleanText(parts[0]), away: cleanText(parts[1]),
          league: "", prono: prono || "",
          cote: parseFloat(cote) || 0,
          score: cleanText(score), status: normalizeStatus(status)
        };
      }
      return {
        date: cleanText(h.date), sport: cleanText(h.sport) || "Football",
        home: cleanText(h.home), away: cleanText(h.away),
        league: cleanText(h.league || h.competition),
        prono: cleanText(h.prono || h.bet),
        cote: parseFloat(h.cote) || 0,
        score: cleanText(h.score), status: normalizeStatus(h.status)
      };
    }).filter(isResolvedPick);
  } catch (e) {
    console.error("Impossible de lire picks.json:", e.message);
    return [];
  }
}

function loadImprovementHistory() {
  try {
    const rows = JSON.parse(fs.readFileSync(IMPROVEMENT_LOG_FILE, "utf8"));
    if (!Array.isArray(rows)) return [];
    return rows.map(r => ({
      date: cleanText(r.date || cleanText(r.resolvedAt).slice(0, 10)),
      sport: cleanText(r.sport) || "Football",
      home: cleanText(r.home),
      away: cleanText(r.away),
      league: cleanText(r.competition || r.league),
      prono: cleanText(r.bet || r.prono),
      cote: parseFloat(r.cote) || 0,
      score: cleanText(r.score),
      status: normalizeStatus(r.status)
    })).filter(isResolvedPick);
  } catch {
    return [];
  }
}

function loadAllResolvedHistory() {
  const merged = [...loadHistory(), ...loadImprovementHistory()];
  const seen = new Set();
  return merged.filter(h => {
    const key = [
      h.date,
      h.home.toLowerCase(),
      h.away.toLowerCase(),
      h.prono.toLowerCase(),
      h.score,
      h.status
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Statistiques générales ────────────────────────────────────────────────────
function computeStats(history) {
  const total   = history.length;
  const gagnes  = history.filter(h => h.status === "GAGNE").length;
  const perdus  = total - gagnes;
  const winrate = total ? Math.round((gagnes / total) * 100) : 0;

  // ROI : uniquement sur les picks avec une cote renseignée
  let roi = 0; let roiCount = 0;
  history.forEach(h => {
    if (!h.cote || h.cote < 1.01) return;
    roiCount++;
    if (h.status === "GAGNE") roi += (h.cote - 1);
    else roi -= 1;
  });
  const roiPct = roiCount ? Math.round((roi / roiCount) * 100) : null;

  return { total, gagnes, perdus, winrate, roiPct, roiCount };
}

// ── Analyse par catégorie ─────────────────────────────────────────────────────
function analyzeByField(history, getKey) {
  const groups = {};
  history.forEach(h => {
    const key = cleanText(getKey(h));
    if (!isUsefulKey(key)) return;
    if (!groups[key]) groups[key] = { gagnes: 0, perdus: 0, picks: [] };
    groups[key].picks.push(h);
    if (h.status === "GAGNE") groups[key].gagnes++;
    else groups[key].perdus++;
  });

  return Object.entries(groups)
    .map(([key, g]) => {
      const total = g.gagnes + g.perdus;
      const winrate = Math.round((g.gagnes / total) * 100);
      let roi = 0; let roiC = 0;
      g.picks.forEach(p => { if (!p.cote || p.cote < 1.01) return; roiC++; roi += p.status === "GAGNE" ? (p.cote - 1) : -1; });
      const roiPct = roiC ? Math.round((roi / roiC) * 100) : null;
      return { key, total, gagnes: g.gagnes, perdus: g.perdus, winrate, roiPct };
    })
    .filter(g => g.total >= 2)
    .sort((a, b) => b.winrate - a.winrate || b.roiPct - a.roiPct);
}

function getCoteRange(h) {
  const c = h.cote;
  if (!c) return null;
  if (c < 1.30) return "< 1.30 (très court)";
  if (c < 1.50) return "1.30–1.49";
  if (c < 1.70) return "1.50–1.69";
  if (c < 2.00) return "1.70–1.99";
  return "≥ 2.00 (long)";
}

function getPronoType(h) {
  const p = (h.prono || "").toLowerCase();
  if (p.includes("1x") || p.includes("double chance") || p.includes("dc")) return "Double chance (1X/X2)";
  if (p.includes("victoire") || p.includes("vainqueur") || p.includes(" 1") || p.includes(" 2")) return "Victoire directe (1/2)";
  if (p.includes("nul") || p.includes("draw") || p.includes(" x")) return "Match nul (X)";
  if (p.includes("plus de") || p.includes("over") || p.includes("buts")) return "Total buts (Over/Under)";
  if (p.includes("les deux") || p.includes("btts")) return "Les deux équipes marquent";
  if (p.includes("mi-temps") || p.includes("première")) return "Mi-temps";
  return "Autre";
}

// ── Erreurs récentes (perdus des 30 derniers jours) ──────────────────────────
function recentErrors(history) {
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  return history
    .filter(h => h.status === "PERDU" && h.date >= cutoff)
    .slice(0, 10)
    .map(h => ({
      date: h.date,
      match: `${h.home} vs ${h.away}`,
      prono: h.prono,
      cote: h.cote,
      score: h.score,
      league: h.league
    }));
}

// ── Meilleurs et pires patterns ───────────────────────────────────────────────
function topPatterns(byField, n = 3) {
  const best  = byField.slice(0, n).filter(g => g.winrate >= 60);
  const worst = [...byField].sort((a, b) => a.winrate - b.winrate).slice(0, n).filter(g => g.winrate <= 40);
  return { best, worst };
}

// ── Générer le profil mémoire ─────────────────────────────────────────────────
function generateMemory() {
  const history = loadAllResolvedHistory();

  if (history.length < 3) {
    console.log(`⚠️ Pas assez de données (${history.length} picks résolus). Minimum 3 requis.`);
    return null;
  }

  const general     = computeStats(history);
  const byCote      = analyzeByField(history, getCoteRange);
  const byProno     = analyzeByField(history, getPronoType);
  const byLeague    = analyzeByField(history, h => h.league);
  const errors      = recentErrors(history);
  const coterPat    = topPatterns(byCote);
  const pronoPat    = topPatterns(byProno);

  // Règles déduites automatiquement
  const rules = [];

  if (coterPat.best.length > 0) {
    rules.push(`✅ PRIVILÉGIER cotes ${coterPat.best.map(g => g.key).join(", ")} — winrate ${coterPat.best[0].winrate}%`);
  }
  if (coterPat.worst.length > 0) {
    rules.push(`⛔ ÉVITER cotes ${coterPat.worst.map(g => g.key).join(", ")} — winrate ${coterPat.worst[0].winrate}%`);
  }
  if (pronoPat.best.length > 0) {
    rules.push(`✅ MEILLEUR type de pari : ${pronoPat.best[0].key} (${pronoPat.best[0].winrate}% winrate sur ${pronoPat.best[0].total} picks)`);
  }
  if (pronoPat.worst.length > 0) {
    rules.push(`⛔ ÉVITER type de pari : ${pronoPat.worst[0].key} (${pronoPat.worst[0].winrate}% winrate — trop risqué)`);
  }

  const bestLeague = byLeague[0];
  if (bestLeague && bestLeague.winrate >= 65) {
    rules.push(`✅ LIGUE FORTE : ${bestLeague.key} — ${bestLeague.winrate}% winrate (${bestLeague.total} picks)`);
  }

  if (errors.length >= 3) {
    const errorTypes = errors.map(e => getPronoType(e));
    const mostCommonError = [...new Set(errorTypes)].map(t => ({
      type: t, count: errorTypes.filter(x => x === t).length
    })).sort((a, b) => b.count - a.count)[0];
    if (mostCommonError && mostCommonError.count >= 2) {
      rules.push(`⚠️ ERREUR FRÉQUENTE RÉCENTE : "${mostCommonError.type}" (${mostCommonError.count} pertes récentes)`);
    }
  }

  const memory = {
    generated_at: new Date().toISOString(),
    picks_analysed: history.length,
    general,
    data_quality: {
      with_league: history.filter(h => isUsefulKey(h.league)).length,
      with_cote: history.filter(h => h.cote && h.cote >= 1.01).length,
      sources: {
        picks_history: loadHistory().length,
        improvement_log: loadImprovementHistory().length
      }
    },
    rules_derived: rules,
    by_cote_range: byCote,
    by_prono_type: byProno,
    by_league: byLeague.slice(0, 10),
    recent_errors: errors,
  };

  // Sauvegarder
  try {
    fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), "utf8");
    console.log(`✅ Mémoire Hermès sauvegardée → ${MEMORY_FILE}`);
  } catch (e) {
    console.error("Erreur sauvegarde mémoire:", e.message);
  }

  return memory;
}

// ── Formatter pour affichage Telegram ────────────────────────────────────────
function formatForTelegram(memory) {
  if (!memory) return "❌ Pas assez de données pour analyser.";

  const g = memory.general;
  let msg = `🧠 <b>MÉMOIRE HERMÈS — Analyse ${memory.picks_analysed} picks</b>\n\n`;
  msg += `📊 <b>Stats générales :</b>\n`;
  msg += `  Winrate : <b>${g.winrate}%</b> (${g.gagnes}G / ${g.perdus}P)\n`;
  msg += `  ROI : <b>${g.roiPct !== null ? (g.roiPct >= 0 ? '+' : '') + g.roiPct + '%' : 'N/A (cotes manquantes)'}</b>\n\n`;

  if (memory.rules_derived.length > 0) {
    msg += `📋 <b>Règles apprises :</b>\n`;
    memory.rules_derived.forEach(r => { msg += `${r}\n`; });
    msg += "\n";
  }

  if (memory.by_prono_type.length > 0) {
    msg += `🎯 <b>Par type de pari :</b>\n`;
    memory.by_prono_type.slice(0, 5).forEach(p => {
      msg += `  ${p.key} : ${p.winrate}% (${p.total} picks)\n`;
    });
    msg += "\n";
  }

  if (memory.recent_errors.length > 0) {
    msg += `❌ <b>Dernières erreurs :</b>\n`;
    memory.recent_errors.slice(0, 3).forEach(e => {
      msg += `  ${e.date} · ${e.match} · ${e.prono} @ ${e.cote} → ${e.score}\n`;
    });
  }

  return msg;
}

// ── Main ──────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const memory = generateMemory();
  if (memory) {
    console.log("\n" + formatForTelegram(memory));
  }
}

module.exports = { generateMemory, formatForTelegram, loadHistory, loadImprovementHistory, loadAllResolvedHistory };

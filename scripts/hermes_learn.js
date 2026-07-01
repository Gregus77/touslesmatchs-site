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

function inferLeague(h) {
  const home = cleanText(h.home).toLowerCase();
  const away = cleanText(h.away).toLowerCase();
  const match = `${home} ${away}`;
  const prono = cleanText(h.prono).toLowerCase();

  if (match.includes("shamrock") || match.includes("derry city")) return "Ireland Premier";
  if (match.includes("france") && match.includes("irak")) return "FIFA - Coupe du monde";
  if (match.includes("turquie") && match.includes("paraguay")) return "Coupe du Monde 2026";
  if (match.includes("maroc") && (match.includes("ecosse") || match.includes("écosse"))) return "Coupe du Monde 2026";
  if (match.includes("canada") && match.includes("ouzbekistan")) return "Coupe du Monde 2026";
  if (match.includes("argentina") || match.includes("argentine")) return "FIFA - Coupe du monde";
  if (match.includes("ny knicks") || match.includes("san antonio") || prono.includes("pts")) return "NBA";
  return "";
}

function normalizePick(raw) {
  const h = { ...raw };
  h.date = cleanText(h.date);
  h.sport = cleanText(h.sport) || "Football";
  h.home = cleanText(h.home);
  h.away = cleanText(h.away);
  h.league = cleanText(h.league || h.competition);
  h.prono = cleanText(h.prono || h.bet);
  h.cote = parseFloat(h.cote) || 0;
  h.score = cleanText(h.score);
  h.status = normalizeStatus(h.status);
  h.provider = cleanText(h.provider);
  if (!isUsefulKey(h.league)) h.league = inferLeague(h);
  return h;
}

// ── Charger l'historique ──────────────────────────────────────────────────────
function loadHistory() {
  try {
    const raw = JSON.parse(fs.readFileSync(PICKS_FILE, "utf8"));
    const hist = raw.history || [];

    // Normaliser les deux formats possibles :
    // Format tableau : ["date","match","prono","cote","score","status","sport","league","provider"]
    // Format objet  : { date, home, away, prono, cote, score, status, league, provider }
    return hist.map(h => {
      if (Array.isArray(h)) {
        const [date, match, prono, cote, score, status, sport, league, provider] = h;
        const parts = (match || "").split(" vs ");
        return normalizePick({ date, sport, home: parts[0], away: parts[1], league, prono, cote, score, status, provider });
      }
      return normalizePick(h);
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
    return rows.map(r => normalizePick({
      date: r.date || cleanText(r.resolvedAt).slice(0, 10),
      sport: r.sport,
      home: r.home,
      away: r.away,
      league: r.competition || r.league,
      prono: r.bet || r.prono,
      cote: r.cote,
      score: r.score,
      status: r.status
    })).filter(isResolvedPick);
  } catch {
    return [];
  }
}

function loadAllResolvedHistory() {
  const merged = [...loadHistory(), ...loadImprovementHistory()];
  const byKey = new Map();
  for (const h of merged) {
    const key = [
      h.date,
      h.home.toLowerCase(),
      h.away.toLowerCase(),
      h.prono.toLowerCase(),
      h.score,
      h.status
    ].join("|");
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, h);
      continue;
    }
    byKey.set(key, {
      ...current,
      ...h,
      league: isUsefulKey(h.league) ? h.league : current.league,
      cote: h.cote || current.cote,
      sport: h.sport || current.sport
    });
  }
  return [...byKey.values()];
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
  // IMPORTANT : Over et Under DOIVENT être des catégories séparées — un marché
  // peut être excellent (Under 2.5) pendant que l'autre est médiocre (Over 2.5).
  // Les fusionner sous "Total buts" rendait impossible de détecter ce genre
  // d'écart, qui est pourtant l'insight clé de la stratégie data-driven.
  if (/under|moins de/.test(p) && /but/.test(p)) return "Under (moins de X buts)";
  if (/over|plus de/.test(p) && /but/.test(p)) return "Over (plus de X buts)";
  if (p.includes("1x") || p.includes("double chance") || p.includes("dc")) return "Double chance (1X/X2)";
  if (p.includes("victoire") || p.includes("vainqueur") || p.includes(" 1") || p.includes(" 2")) return "Victoire directe (1/2)";
  if (p.includes("nul") || p.includes("draw") || p.includes(" x")) return "Match nul (X)";
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

// ── Stratégie data-driven : marché le plus rentable en ROI réel ──────────────
// L'objectif n'est pas "le plus beau pronostic" mais l'argent gagné sur la
// durée : on classe par ROI (pas juste winrate), avec un échantillon minimum
// pour éviter de sur-réagir à 3-4 picks chanceux.
const STRATEGY_MIN_SAMPLE = 10;
function computeMarketStrategy(byProno, minSample = STRATEGY_MIN_SAMPLE) {
  const qualified = byProno.filter(g => g.total >= minSample && g.roiPct !== null);
  if (!qualified.length) return null;
  const ranked = [...qualified].sort((a, b) => b.roiPct - a.roiPct);
  const best = ranked[0];
  const toDisable = ranked.filter(g => g.roiPct < 0);
  return { ranked, best, toDisable };
}

// Texte injecté dans le prompt Hermès : priorise le marché n°1 en ROI réel,
// évite ceux qui perdent de l'argent, et s'auto-adapte si les stats changent
// (pas besoin de coder "Under 2.5" en dur — le marché prioritaire change tout
// seul dès que les données montrent qu'un autre marché rapporte plus).
// Marché forcé par défaut tant que les données ne prouvent pas mieux.
// Configurable via HERMES_FORCED_MARKET (mettre "" pour désactiver le forçage
// et laisser 100% la stratégie data-driven décider dès qu'il y a des données).
const FORCED_MARKET = process.env.HERMES_FORCED_MARKET !== undefined
  ? process.env.HERMES_FORCED_MARKET
  : "Under 2.5 buts (moins de 2.5 buts)";

function strategyDirective(memory) {
  if (!memory) {
    if (!FORCED_MARKET) return "";
    return forcedMarketDirective();
  }
  const strat = computeMarketStrategy(memory.by_prono_type);
  if (!strat) {
    // Pas encore assez de données : on force le marché par défaut (Under 2.5)
    // au lieu de laisser Hermès choisir librement. Dès qu'un marché atteint
    // l'échantillon minimum avec un meilleur ROI, la stratégie data-driven
    // prend automatiquement le relais (bloc "best" ci-dessous).
    if (FORCED_MARKET) return forcedMarketDirective(memory);
    return `\n━━━ STRATÉGIE DATA-DRIVEN ━━━\nPas encore assez de données par marché (minimum ${STRATEGY_MIN_SAMPLE} picks résolus par catégorie) pour prioriser un marché. Suis les règles générales ci-dessus.\n`;
  }
  const { best, toDisable } = strat;
  let txt = `\n━━━ STRATÉGIE DATA-DRIVEN (ROI réel sur données vérifiées — objectif : l'argent, pas le plus beau pronostic) ━━━\n`;
  txt += `🏆 MARCHÉ PRIORITAIRE ACTUEL : "${best.key}" — ROI ${best.roiPct >= 0 ? "+" : ""}${best.roiPct}%, winrate ${best.winrate}% sur ${best.total} picks résolus.\n`;
  txt += `→ RÈGLE : si un match éligible aujourd'hui remplit les critères de qualité (probabilité ≥58%, edge positif) pour "${best.key}", CHOISIS-LE en priorité absolue, même si un autre marché semble "plus évident" sur ce match précis.\n`;
  if (toDisable.length) {
    txt += `⛔ MARCHÉS À ÉVITER (ROI négatif sur échantillon suffisant) : ${toDisable.map(w => `${w.key} (ROI ${w.roiPct}%, ${w.total} picks)`).join(", ")}.\n`;
    txt += `→ Ne propose un marché de cette liste QUE si aucun match n'est éligible pour "${best.key}" aujourd'hui, ET seulement si ses statistiques réelles sont redevenues meilleures que celles ci-dessus.\n`;
  }
  return txt;
}

function forcedMarketDirective(memory) {
  let stat = "";
  if (memory && Array.isArray(memory.by_prono_type)) {
    const u = memory.by_prono_type.find(g => /under|moins de/i.test(g.key));
    if (u) stat = ` (données actuelles : ${u.winrate}% winrate${u.roiPct !== null ? `, ROI ${u.roiPct >= 0 ? "+" : ""}${u.roiPct}%` : ""} sur ${u.total} picks)`;
  }
  return `\n━━━ STRATÉGIE ACTUELLE — MARCHÉ FORCÉ ━━━\n` +
    `🏆 MARCHÉ PRIORITAIRE IMPOSÉ : "${FORCED_MARKET}"${stat}.\n` +
    `→ RÈGLE ABSOLUE pour l'instant : ne propose QUE des paris "moins de 2.5 buts" (Under 2.5), et uniquement sur un match qui remplit les critères de qualité (2 équipes à faible moyenne de buts, éliminatoire/enjeu défensif, forme, edge positif).\n` +
    `→ Si AUCUN match du jour ne convient pour un Under 2.5 solide, réponds NO BET plutôt que de basculer sur un autre marché.\n` +
    `→ C'est temporaire : ce forçage sera levé automatiquement dès qu'un autre marché prouvera statistiquement un meilleur ROI sur un échantillon suffisant.\n`;
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
  const byProvider  = analyzeByField(history, h => h.provider);
  const errors      = recentErrors(history);
  const coterPat    = topPatterns(byCote);
  const pronoPat    = topPatterns(byProno);
  const marketStrategy = computeMarketStrategy(byProno);

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
    by_provider: byProvider,
    recent_errors: errors,
    market_strategy: marketStrategy ? {
      best: marketStrategy.best,
      to_disable: marketStrategy.toDisable,
      min_sample: STRATEGY_MIN_SAMPLE,
    } : null,
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

  if (memory.market_strategy?.best) {
    const b = memory.market_strategy.best;
    msg += `🏆 <b>Marché prioritaire actuel (ROI réel) :</b>\n`;
    msg += `  <b>${b.key}</b> — ROI ${b.roiPct >= 0 ? '+' : ''}${b.roiPct}%, winrate ${b.winrate}% sur ${b.total} picks\n`;
    if (memory.market_strategy.to_disable.length) {
      msg += `  ⛔ À désactiver (ROI négatif) : ${memory.market_strategy.to_disable.map(w => `${w.key} (${w.roiPct}%)`).join(", ")}\n`;
    }
    msg += "\n";
  }

  if (memory.by_prono_type.length > 0) {
    msg += `🎯 <b>Classement par type de pari (ROI) :</b>\n`;
    [...memory.by_prono_type].sort((a, b) => (b.roiPct ?? -999) - (a.roiPct ?? -999)).slice(0, 8).forEach(p => {
      const roi = p.roiPct !== null ? `${p.roiPct >= 0 ? '+' : ''}${p.roiPct}%` : 'N/A';
      msg += `  ${p.key} : ROI ${roi} · ${p.winrate}% (${p.total} picks)\n`;
    });
    msg += "\n";
  }

  if (memory.by_league.length > 0) {
    msg += `🏆 <b>Compétitions les plus rentables :</b>\n`;
    [...memory.by_league].sort((a, b) => (b.roiPct ?? -999) - (a.roiPct ?? -999)).slice(0, 5).forEach(l => {
      const roi = l.roiPct !== null ? `${l.roiPct >= 0 ? '+' : ''}${l.roiPct}%` : 'N/A';
      msg += `  ${l.key} : ROI ${roi} · ${l.winrate}% (${l.total} picks)\n`;
    });
    msg += "\n";
  }

  if (memory.by_cote_range.length > 0) {
    msg += `💰 <b>Plages de cotes les plus rentables :</b>\n`;
    [...memory.by_cote_range].sort((a, b) => (b.roiPct ?? -999) - (a.roiPct ?? -999)).forEach(c => {
      const roi = c.roiPct !== null ? `${c.roiPct >= 0 ? '+' : ''}${c.roiPct}%` : 'N/A';
      msg += `  ${c.key} : ROI ${roi} · ${c.winrate}% (${c.total} picks)\n`;
    });
    msg += "\n";
  }

  if (memory.by_provider.length > 0) {
    msg += `🤖 <b>IA les plus performantes (pick officiel) :</b>\n`;
    [...memory.by_provider].sort((a, b) => (b.roiPct ?? -999) - (a.roiPct ?? -999)).forEach(pr => {
      const roi = pr.roiPct !== null ? `${pr.roiPct >= 0 ? '+' : ''}${pr.roiPct}%` : 'N/A';
      msg += `  ${pr.key} : ROI ${roi} · ${pr.winrate}% (${pr.total} picks)\n`;
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

module.exports = {
  generateMemory, formatForTelegram, loadHistory, loadImprovementHistory, loadAllResolvedHistory,
  computeMarketStrategy, strategyDirective, STRATEGY_MIN_SAMPLE,
};

// Limite honnête : les bookmakers ne sont pas trackés car Hermès estime une
// cote générique par marché, sans choisir un bookmaker précis pour chaque
// pick — impossible de calculer un ROI par bookmaker sans cette donnée.

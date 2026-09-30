'use strict';
/**
 * Strategie "+0,5 but equipe favorite" (decision proprietaire du 30/09/2026).
 * Module pur (aucune I/O) : toutes les donnees sont injectees, donc testable.
 *
 * Preselection : favori dans le top 5 du championnat, adversaire dans les 5
 * dernieres places. Forme = 5 derniers matchs de CHAMPIONNAT, plus recent d'abord :
 * INDICATEUR (pastille de risque) et non filtre depuis le 30/09/2026 (simulation 60 jours).
 * Declenchement live : le favori n'a pas encore marque, cote +0,5 >= 1,60,
 * marche non suspendu, cote fraiche, quorum Concile >= 4/5.
 */

const CFG = {
  topN: 5,
  bottomN: 5,
  formWindow: 5,
  minOdd: 1.6,
  minVotes: 4, // sur 5 IA du Concile
  minMinute: 30, // fenetre live (ajustable)
  maxMinute: 85,
  maxOddAgeMs: 120000, // cote live plus vieille que 2 min = ignoree
  greenMinGoals: 8, // pastille verte : 5/5 et >= 8 buts
  orangeMinGoals4of5: 6, // pastille orange : 4/5 avec >= 6 buts
};

function normalizeForm(matches) {
  // matches : [{gf, ga}] du plus recent au plus ancien ; entrees invalides ignorees
  return (Array.isArray(matches) ? matches : [])
    .filter((m) => Number.isFinite(Number(m?.gf)) && Number.isFinite(Number(m?.ga)))
    .slice(0, CFG.formWindow)
    .map((m) => ({ gf: Number(m.gf), ga: Number(m.ga) }));
}

function favoriteFormStats(matches) {
  const f = normalizeForm(matches);
  return {
    played: f.length,
    scoredIn: f.filter((m) => m.gf > 0).length,
    totalGoals: f.reduce((n, m) => n + m.gf, 0),
    scoredLast: f.length > 0 && f[0].gf > 0,
  };
}

function opponentFormStats(matches) {
  const f = normalizeForm(matches);
  return {
    played: f.length,
    concededIn: f.filter((m) => m.ga > 0).length,
    concededLast: f.length > 0 && f[0].ga > 0,
  };
}

/**
 * Pastille de risque (INDICATEUR, plus un filtre — decision du 30/09/2026 apres simulation sur 60 jours).
 * Retourne null seulement si la forme est incomplete (moins de 5 matchs connus).
 */
function riskLevel(favStats) {
  if (!favStats || favStats.played < CFG.formWindow) return null;
  const { scoredIn, totalGoals } = favStats;
  if (scoredIn === 5 && totalGoals >= CFG.greenMinGoals) return { color: 'vert', emoji: '🟢', label: 'Sûr' };
  if (scoredIn === 5) return { color: 'orange', emoji: '🟠', label: 'Moyen' };
  if (scoredIn === 4 && totalGoals >= CFG.orangeMinGoals4of5) return { color: 'orange', emoji: '🟠', label: 'Moyen' };
  return { color: 'rouge', emoji: '🔴', label: 'Risqué' };
}

/**
 * Preselection d'un match. Le favori est l'equipe du top 5 si l'autre est dans
 * les 5 dernieres places ; sinon le match n'est pas eligible.
 * input : { home:{rank, form}, away:{rank, form}, totalTeams }
 */
function evaluatePreselection({ home, away, totalTeams }) {
  const reject = (reason) => ({ eligible: false, reason });
  const total = Number(totalTeams);
  if (!Number.isFinite(total) || total < CFG.topN + CFG.bottomN) return reject('classement_insuffisant');
  const hr = Number(home?.rank);
  const ar = Number(away?.rank);
  if (!Number.isFinite(hr) || !Number.isFinite(ar)) return reject('rang_inconnu');

  const isTop = (r) => r >= 1 && r <= CFG.topN;
  const isBottom = (r) => r > total - CFG.bottomN && r <= total;

  let side;
  if (isTop(hr) && isBottom(ar)) side = 'home';
  else if (isTop(ar) && isBottom(hr)) side = 'away';
  else return reject('pas_top5_contre_5_derniers');

  const fav = side === 'home' ? home : away;
  const opp = side === 'home' ? away : home;
  const favStats = favoriteFormStats(fav.form);
  const oppStats = opponentFormStats(opp.form);

  if (favStats.played < CFG.formWindow) return reject('forme_favori_incomplete');
  if (oppStats.played < CFG.formWindow) return reject('forme_adversaire_incomplete');
  // La forme (4/5, dernier match...) n'est plus un filtre : la simulation sur 60 jours montrait que ces
  // filtres retiraient ~9 cas sur 10 sans ameliorer la reussite. Elle alimente la pastille de risque.

  return {
    eligible: true,
    side,
    favRank: side === 'home' ? hr : ar,
    oppRank: side === 'home' ? ar : hr,
    favStats,
    oppStats,
    risk: riskLevel(favStats),
  };
}

/**
 * Extrait la cote "Over 0,5" de l'equipe ciblee depuis une entree de /odds/live.
 * Marches api-sports : 58 = Home Team Goals, 39 = Away Team Goals.
 * Retourne { odd, suspended, updatedAt } ou null si la ligne 0,5 est absente.
 */
function extractTeamOver05(liveOddsEntry, side) {
  const marketId = side === 'home' ? 58 : 39;
  const market = (liveOddsEntry?.odds || []).find((o) => Number(o.id) === marketId);
  if (!market) return null;
  const v = (market.values || []).find(
    (x) => String(x.value).toLowerCase() === 'over' && Number(x.handicap) === 0.5
  );
  if (!v) return null;
  const odd = Number(v.odd);
  if (!Number.isFinite(odd) || odd <= 1) return null;
  const blocked = liveOddsEntry?.status?.blocked === true || liveOddsEntry?.status?.stopped === true;
  return {
    odd,
    suspended: v.suspended === true || blocked,
    updatedAt: liveOddsEntry?.update ? Date.parse(liveOddsEntry.update) : null,
  };
}

/** Declencheur live. Toutes les conditions doivent etre vraies. */
function evaluateLiveTrigger({ favGoals, minute, quote, votes, now = Date.now() }) {
  const no = (reason) => ({ go: false, reason });
  if (Number(favGoals) > 0) return no('favori_a_deja_marque');
  const m = Number(minute);
  if (!Number.isFinite(m) || m < CFG.minMinute || m > CFG.maxMinute) return no('minute_hors_fenetre');
  if (!quote) return no('cote_absente');
  if (quote.suspended) return no('marche_suspendu');
  if (!quote.updatedAt || now - quote.updatedAt > CFG.maxOddAgeMs) return no('cote_perimee');
  if (quote.odd < CFG.minOdd) return no('cote_sous_1_60');
  if (Number(votes) < CFG.minVotes) return no('quorum_concile_insuffisant');
  return { go: true, reason: 'signal_valide' };
}

/** Resultat final : gagne si le favori a marque au moins un but avant la fin. */
function settle({ favFinalGoals }) {
  if (favFinalGoals === null || favFinalGoals === undefined || favFinalGoals === '') return 'EN_ATTENTE';
  const g = Number(favFinalGoals);
  if (!Number.isFinite(g)) return 'EN_ATTENTE';
  return g > 0 ? 'GAGNE' : 'PERDU';
}

module.exports = {
  CFG,
  normalizeForm,
  favoriteFormStats,
  opponentFormStats,
  riskLevel,
  evaluatePreselection,
  extractTeamOver05,
  evaluateLiveTrigger,
  settle,
};

'use strict';
/**
 * Moteur "+0,5 but equipe favorite" — orchestrateur isole (decision du 30/09/2026).
 * Toutes les dependances sont injectees (createPlus05Engine) : testable sans reseau.
 *
 * Cycle : presélection quotidienne (watchlist) -> boucle live -> controles
 * approfondis (attaquants, historique 4 saisons) -> vote du Concile (>= 4/5)
 * -> envoi Telegram -> resultat final -> journal admin.
 * Le circuit plus/moins 2,5 n'est pas modifie par ce module.
 */

const P = require('./plus05_favorite');

const ENG = {
  historySeasons: 4,
  historyMinSeasons: 3,
  historyMargin: 3, // moyenne des rangs du favori + 3 <= moyenne adversaire
  maxCouncilAttempts: 3,
  councilRetryMs: 8 * 60 * 1000,
  maxCandidatesPerTick: 3,
  tableTtlMs: 6 * 3600 * 1000,
  maxWatchAgeMs: 4 * 3600 * 1000,
};

function createPlus05Engine(deps) {
  const {
    db, apiGet, fetchLiveMatches, callSeat, publisher, onSignal = null,
    leagueIds = [], log = console, now = () => Date.now(),
    seats = ['Perplexity-Web', 'DeepSeek-V3', 'Mistral-Large', 'OpenRouter-Luna', 'OpenRouter-Qwen'],
    flags = () => ({ enabled: false, dryRun: true, requireHistory: true, sendResults: true }),
  } = deps;

  const tableCache = new Map();
  const targets = () => (publisher && Array.isArray(publisher.targets) ? publisher.targets : []);

  function ensureSchema() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS plus05_watchlist (
        fixture_id TEXT PRIMARY KEY, day TEXT NOT NULL, league_id INTEGER, season INTEGER,
        competition TEXT, country TEXT, home_id INTEGER, away_id INTEGER, home TEXT, away TEXT,
        kickoff_ts INTEGER, side TEXT, fav_id INTEGER, fav_name TEXT, opp_id INTEGER, opp_name TEXT,
        fav_rank INTEGER, opp_rank INTEGER, total_teams INTEGER, fav_scored_in INTEGER,
        fav_goals5 INTEGER, opp_conceded_in INTEGER, risk_color TEXT, deep_json TEXT,
        attempts INTEGER NOT NULL DEFAULT 0, last_attempt_ts INTEGER, last_reason TEXT, created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_plus05_watch_day ON plus05_watchlist(day);
      CREATE TABLE IF NOT EXISTS plus05_signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT, fixture_id TEXT NOT NULL UNIQUE, sent_at INTEGER NOT NULL,
        minute INTEGER, score_home INTEGER, score_away INTEGER, home TEXT, away TEXT, competition TEXT,
        fav_name TEXT, opp_name TEXT, fav_side TEXT, fav_id INTEGER, odd REAL, odd_source TEXT,
        risk_color TEXT, votes_yes INTEGER, votes_total INTEGER, votes_json TEXT,
        outcome TEXT NOT NULL DEFAULT 'pending', final_home INTEGER, final_away INTEGER,
        final_fav_goals INTEGER, resolved_at INTEGER, delivered_channels TEXT, dry_run INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX IF NOT EXISTS idx_plus05_sig_outcome ON plus05_signals(outcome);
    `);
  }

  // ── Donnees API-Football ────────────────────────────────────────────────
  async function loadTable(leagueId, season) {
    const key = `${leagueId}_${season}`;
    const hit = tableCache.get(key);
    if (hit && now() - hit.ts < ENG.tableTtlMs) return hit.data;
    let data = null;
    try {
      const res = await apiGet(`/standings?league=${leagueId}&season=${season}`);
      const groups = res?.response?.[0]?.league?.standings;
      if (Array.isArray(groups) && groups.length) {
        const normalized = groups.map((group) => {
          const rows = (Array.isArray(group) ? group : [])
            .map((t) => ({ teamId: Number(t.team?.id), rank: Number(t.rank), group: t.group || null }))
            .filter((r) => r.teamId && r.rank);
          return rows.length ? { rows, total: rows.length, name: rows[0]?.group || null } : null;
        }).filter(Boolean);
        if (normalized.length === 1) data = normalized[0];
        else if (normalized.length > 1) data = { multiGroup: true, groups: normalized };
      }
    } catch (e) { log.error('[plus05] classement', leagueId, season, e.message); }
    tableCache.set(key, { data, ts: now() });
    return data;
  }

  async function loadForm(teamId, leagueId, season) {
    const res = await apiGet(`/fixtures?team=${teamId}&league=${leagueId}&season=${season}&last=5&status=FT`);
    const items = Array.isArray(res?.response) ? res.response : [];
    return items
      .map((f) => {
        const isHome = Number(f.teams?.home?.id) === Number(teamId);
        const gf = isHome ? f.goals?.home : f.goals?.away;
        const ga = isHome ? f.goals?.away : f.goals?.home;
        return { ts: Number(f.fixture?.timestamp || 0), gf, ga };
      })
      .filter((m) => m.gf !== null && m.gf !== undefined && m.ga !== null && m.ga !== undefined)
      .sort((a, b) => b.ts - a.ts) // plus recent d'abord
      .map(({ gf, ga }) => ({ gf: Number(gf), ga: Number(ga) }));
  }

  // ── Presélection quotidienne ─────────────────────────────────────────────
  async function buildWatchlist(day) {
    ensureSchema();
    const res = await apiGet(`/fixtures?date=${day}&status=NS&timezone=Europe/Paris`);
    const all = Array.isArray(res?.response) ? res.response : [];
    const wanted = new Set(leagueIds.map(Number));
    const fixtures = all.filter((f) => wanted.has(Number(f.league?.id)));
    const stats = { fixtures: fixtures.length, eligible: 0, skipped: {} };
    const skip = (r) => { stats.skipped[r] = (stats.skipped[r] || 0) + 1; };
    const formCache = new Map();
    const getForm = async (teamId, leagueId, season) => {
      const k = `${teamId}_${leagueId}_${season}`;
      if (!formCache.has(k)) formCache.set(k, loadForm(teamId, leagueId, season));
      return formCache.get(k);
    };

    for (const f of fixtures) {
      try {
        const leagueId = Number(f.league.id), season = Number(f.league.season);
        const rawTable = await loadTable(leagueId, season);
        if (!rawTable) { skip('classement_indisponible'); continue; }
        const hid = Number(f.teams.home.id), aid = Number(f.teams.away.id);
        let table = rawTable;
        if (rawTable.multiGroup) {
          const matching = (rawTable.groups || []).filter((group) =>
            group.rows.some((r) => r.teamId === hid) && group.rows.some((r) => r.teamId === aid)
          );
          if (matching.length !== 1) { skip('championnat_a_groupes'); continue; }
          table = matching[0];
        }
        const hr = table.rows.find((r) => r.teamId === hid)?.rank;
        const ar = table.rows.find((r) => r.teamId === aid)?.rank;
        // Pre-filtre rang AVANT tout appel de forme : economise le quota.
        const pre = P.evaluatePreselection({ home: { rank: hr, form: [] }, away: { rank: ar, form: [] }, totalTeams: table.total });
        if (!pre.eligible && !/forme_/.test(pre.reason)) { skip(pre.reason); continue; }
        const [hf, af] = await Promise.all([getForm(hid, leagueId, season), getForm(aid, leagueId, season)]);
        const r = P.evaluatePreselection({ home: { rank: hr, form: hf }, away: { rank: ar, form: af }, totalTeams: table.total });
        if (!r.eligible) { skip(r.reason); continue; }
        const fav = r.side === 'home' ? f.teams.home : f.teams.away;
        const opp = r.side === 'home' ? f.teams.away : f.teams.home;
        db.prepare(`INSERT OR IGNORE INTO plus05_watchlist
          (fixture_id,day,league_id,season,competition,country,home_id,away_id,home,away,kickoff_ts,side,fav_id,fav_name,
           opp_id,opp_name,fav_rank,opp_rank,total_teams,fav_scored_in,fav_goals5,opp_conceded_in,risk_color,created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
          String(f.fixture.id), day, leagueId, season, f.league.name, f.league.country,
          hid, aid, f.teams.home.name, f.teams.away.name, Number(f.fixture.timestamp) * 1000, r.side,
          Number(fav.id), fav.name, Number(opp.id), opp.name, r.favRank, r.oppRank, table.total,
          r.favStats.scoredIn, r.favStats.totalGoals, r.oppStats.concededIn, r.risk.color, now());
        stats.eligible++;
      } catch (e) { log.error('[plus05] watchlist', f?.fixture?.id, e.message); skip('erreur'); }
    }
    log.log(`[plus05] watchlist ${day}: ${stats.eligible}/${stats.fixtures} eligibles`, JSON.stringify(stats.skipped));
    return stats;
  }

  // ── Controles approfondis (seulement pour un candidat pret a partir) ──────
  async function historyCheck(w) {
    const pairs = [];
    for (let i = 1; i <= ENG.historySeasons; i++) {
      const t = await loadTable(w.league_id, w.season - i);
      if (!t || t.multiGroup) continue;
      const a = t.rows.find((r) => r.teamId === w.fav_id)?.rank;
      const b = t.rows.find((r) => r.teamId === w.opp_id)?.rank;
      if (a && b) pairs.push({ a, b });
    }
    if (pairs.length < ENG.historyMinSeasons) return { verified: false, seasons: pairs.length };
    const favAvg = pairs.reduce((n, p) => n + p.a, 0) / pairs.length;
    const oppAvg = pairs.reduce((n, p) => n + p.b, 0) / pairs.length;
    return { verified: favAvg + ENG.historyMargin <= oppAvg, seasons: pairs.length,
      favAvg: Math.round(favAvg * 10) / 10, oppAvg: Math.round(oppAvg * 10) / 10 };
  }

  async function attackersCheck(w) {
    const [squadRes, injRes, lineRes] = await Promise.all([
      apiGet(`/players/squads?team=${w.fav_id}`),
      apiGet(`/injuries?fixture=${w.fixture_id}`),
      apiGet(`/fixtures/lineups?fixture=${w.fixture_id}`),
    ]);
    const squad = squadRes?.response?.[0]?.players || [];
    const attackers = new Set(squad.filter((p) => /attacker/i.test(p.position || '')).map((p) => Number(p.id)));
    const missing = (injRes?.response || [])
      .filter((i) => Number(i.team?.id) === w.fav_id && attackers.has(Number(i.player?.id)))
      .map((i) => i.player?.name).filter(Boolean);
    const lineup = (lineRes?.response || []).find((l) => Number(l.team?.id) === w.fav_id);
    const forwards = (lineup?.startXI || []).filter((p) => String(p.player?.pos || '').toUpperCase() === 'F');
    const lineupKnown = !!lineup;
    return { verified: lineupKnown && forwards.length >= 1 && missing.length === 0,
      lineupKnown, forwards: forwards.length, missingAttackers: missing };
  }

  // ── Vote du Concile ─────────────────────────────────────────────────────
  function buildPrompt(w, live, quote, deep) {
    const fav = w.fav_name, opp = w.opp_name;
    return [
      `Match de football en direct : ${w.home} - ${w.away} (${w.competition}), minute ${live.minute}, score ${live.score_home}-${live.score_away}.`,
      `Question : l'equipe "${fav}" marquera-t-elle AU MOINS UN but avant la fin du match (temps reglementaire) ? Elle n'a pas encore marque.`,
      `Faits : ${fav} est ${w.fav_rank}e sur ${w.total_teams}, ${opp} est ${w.opp_rank}e. ${fav} a marque dans ${w.fav_scored_in}/5 derniers matchs de championnat (${w.fav_goals5} buts). ${opp} a encaisse dans ${w.opp_conceded_in}/5 derniers matchs.`,
      deep?.history ? `Historique ${deep.history.seasons} saisons : rang moyen ${fav} ${deep.history.favAvg}, ${opp} ${deep.history.oppAvg}.` : '',
      `Attaquants de ${fav} : ${deep?.attackers?.forwards || 0} titulaire(s) offensif(s), attaquants absents : ${(deep?.attackers?.missingAttackers || []).join(', ') || 'aucun'}.`,
      `Cote indicative du marche : ${quote.odd}.`,
      `Reponds UNIQUEMENT par ce JSON, sans autre texte : {"vote":"OUI" ou "NON","confiance":0-100,"raison":"12 mots maximum"}`,
    ].filter(Boolean).join('\n');
  }

  function parseVote(text) {
    const m = String(text || '').match(/"vote"\s*:\s*"?\s*(OUI|NON|YES|NO)/i);
    if (!m) return null;
    const conf = String(text).match(/"confiance"\s*:\s*(\d{1,3})/i);
    const raison = String(text).match(/"raison"\s*:\s*"([^"]{0,160})/i);
    return { yes: /^(OUI|YES)$/i.test(m[1]), confidence: conf ? Number(conf[1]) : null, raison: raison ? raison[1] : '' };
  }

  async function councilVote(w, live, quote, deep) {
    const prompt = buildPrompt(w, live, quote, deep);
    const results = await Promise.all(seats.map(async (seat) => {
      try {
        const r = await callSeat(seat, prompt, { fixtureId: w.fixture_id, competition: w.competition });
        if (!r?.ok) return { seat, failed: true, error: r?.error || 'echec' };
        const v = parseVote(r.text);
        return v ? { seat, ...v } : { seat, failed: true, error: 'illisible' };
      } catch (e) { return { seat, failed: true, error: e.message }; }
    }));
    const yes = results.filter((r) => !r.failed && r.yes).length;
    const answered = results.filter((r) => !r.failed).length;
    return { yes, answered, total: seats.length, results };
  }

  // ── Envoi : file durable du projet (le texte FR/RU est rendu par telegram_client.render) ──
  async function publish(w, live, quote, votes) {
    const f = flags();
    const risk = P.riskLevel({ played: 5, scoredIn: w.fav_scored_in, totalGoals: w.fav_goals5 }) || { emoji: '⚪', label: 'Non classé', color: 'na' };
    const data = {
      matchKey: `plus05:${w.fixture_id}`, market: 'plus05', votes: votes.yes, votesTotal: votes.total,
      home: w.home, away: w.away, competition: w.competition, minute: live.minute,
      scoreHome: live.score_home, scoreAway: live.score_away, favName: w.fav_name,
      odd: Number(quote.odd).toFixed(2), riskColor: risk.color, riskEmoji: risk.emoji, riskLabel: risk.label,
      favScoredIn: w.fav_scored_in, favGoals5: w.fav_goals5, oppConcededIn: w.opp_conceded_in,
      favRank: w.fav_rank, oppRank: w.opp_rank, totalTeams: w.total_teams,
    };
    const ins = db.prepare(`INSERT OR IGNORE INTO plus05_signals
      (fixture_id,sent_at,minute,score_home,score_away,home,away,competition,fav_name,opp_name,fav_side,fav_id,odd,odd_source,
       risk_color,votes_yes,votes_total,votes_json,dry_run)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      w.fixture_id, now(), live.minute, live.score_home, live.score_away, w.home, w.away, w.competition,
      w.fav_name, w.opp_name, w.side, w.fav_id, quote.odd, 'api-sports live (indicative)', risk.color,
      votes.yes, votes.total, JSON.stringify(votes.results), f.dryRun ? 1 : 0);
    if (ins.changes === 0) return { sent: false, reason: 'deja_envoye' }; // anti-doublon
    const delivered = [];
    if (!f.dryRun) {
      for (const dest of targets()) {
        try { if (publisher.enqueue('plus05', data, dest, w.fixture_id, now() + 10 * 60 * 1000)) delivered.push(dest.channel); }
        catch (e) { log.error('[plus05] mise en file', dest.channel, e.message); }
      }
      try { await publisher.flush(); } catch (e) { log.error('[plus05] flush', e.message); }
    }
    db.prepare('UPDATE plus05_signals SET delivered_channels=? WHERE fixture_id=?').run(JSON.stringify(delivered), w.fixture_id);
    // Carte « dernier signal » de l'application (fichier lu par /goal05/latest) : jamais pour un essai a blanc.
    if (!f.dryRun && typeof onSignal === 'function') {
      try {
        onSignal({
          ok: true, id: `${w.fixture_id}_plus05`, type: 'plus05_favorite_team_over_0_5', status: 'active',
          sentAt: new Date(now()).toISOString(), fixtureId: w.fixture_id, match: `${w.home} - ${w.away}`,
          home: w.home, away: w.away, team: w.fav_name, opponent: w.opp_name, competition: w.competition,
          minute: live.minute, score_home: live.score_home, score_away: live.score_away, odd: Number(quote.odd),
          bet: `${w.fav_name} +0,5 but`, risk: risk.color,
          meta: `${w.competition} · ${live.minute}' · niveau ${risk.label}`,
          reason: 'Tous les critères sont validés',
          checks: [
            { ok: true, text: `Top 5 (${w.fav_rank}e) face aux 5 derniers (${w.opp_rank}e)` },
            { ok: w.fav_scored_in >= 4, text: `${w.fav_name} a marqué dans ${w.fav_scored_in}/5 derniers matchs` },
            { ok: w.opp_conceded_in >= 4, text: `Adversaire : but encaissé dans ${w.opp_conceded_in}/5 derniers matchs` },
            { ok: true, text: 'Attaquants disponibles · historique 4 saisons favorable' },
            { ok: true, text: `Cote indicative ${Number(quote.odd).toFixed(2)} · ${votes.yes}/${votes.total} IA` },
          ],
        });
      } catch (e) { log.error('[plus05] carte application', e.message); }
    }
    log.log(`[plus05] SIGNAL ${f.dryRun ? '(essai a blanc) ' : ''}${w.fav_name} (${w.home}-${w.away}) cote ${quote.odd} votes ${votes.yes}/${votes.total}`);
    return { sent: true, dryRun: !!f.dryRun, delivered, data };
  }

  // ── Boucle live ─────────────────────────────────────────────────────────
  async function tick() {
    const f = flags();
    if (!f.enabled) return { skipped: 'desactive' };
    ensureSchema();
    const t = now();
    const watch = db.prepare(`SELECT * FROM plus05_watchlist WHERE kickoff_ts BETWEEN ? AND ?
      AND fixture_id NOT IN (SELECT fixture_id FROM plus05_signals)`).all(t - ENG.maxWatchAgeMs, t + 10 * 60 * 1000);
    if (!watch.length) return { watch: 0 };

    const live = await fetchLiveMatches();
    const byFix = new Map((Array.isArray(live) ? live : []).map((m) => [String(m.fixtureId || m.id), m]));
    const candidates = [];
    for (const w of watch) {
      const m = byFix.get(w.fixture_id);
      if (!m) continue;
      const hs = Number(m.score_home || 0), as = Number(m.score_away || 0);
      const favGoals = w.side === 'home' ? hs : as;
      const minute = Number(m.minute || 0);
      if (favGoals > 0 || minute < P.CFG.minMinute || minute > P.CFG.maxMinute) continue;
      candidates.push({ w, m: { minute, score_home: hs, score_away: as }, favGoals });
    }
    if (!candidates.length) return { watch: watch.length, candidates: 0 };

    // UN seul appel pour les cotes live de tous les matchs.
    let oddsByFix = new Map();
    try {
      const res = await apiGet('/odds/live');
      oddsByFix = new Map((res?.response || []).map((e) => [String(e.fixture?.id), e]));
    } catch (e) { log.error('[plus05] odds/live', e.message); return { error: 'odds_live' }; }

    const out = { watch: watch.length, candidates: candidates.length, sent: 0, reasons: {} };
    let handled = 0;
    for (const c of candidates) {
      if (handled >= ENG.maxCandidatesPerTick) break;
      const { w } = c;
      const quote = P.extractTeamOver05(oddsByFix.get(w.fixture_id), w.side);
      const pre = P.evaluateLiveTrigger({ favGoals: c.favGoals, minute: c.m.minute, quote, votes: seats.length, now: t });
      if (!pre.go) { out.reasons[pre.reason] = (out.reasons[pre.reason] || 0) + 1; continue; }
      if (w.attempts >= ENG.maxCouncilAttempts) { out.reasons.tentatives_epuisees = (out.reasons.tentatives_epuisees || 0) + 1; continue; }
      if (w.last_attempt_ts && t - w.last_attempt_ts < ENG.councilRetryMs) { out.reasons.attente_nouvelle_tentative = (out.reasons.attente_nouvelle_tentative || 0) + 1; continue; }
      handled++;
      db.prepare('UPDATE plus05_watchlist SET attempts=attempts+1,last_attempt_ts=? WHERE fixture_id=?').run(t, w.fixture_id);
      try {
        // Controles approfondis, mis en cache dans la watchlist.
        let deep = w.deep_json ? JSON.parse(w.deep_json) : null;
        if (!deep) {
          const [history, attackers] = await Promise.all([historyCheck(w), attackersCheck(w)]);
          deep = { history, attackers };
          if (attackers.lineupKnown) db.prepare('UPDATE plus05_watchlist SET deep_json=? WHERE fixture_id=?').run(JSON.stringify(deep), w.fixture_id);
        }
        if (f.requireHistory && !deep.history.verified) { db.prepare('UPDATE plus05_watchlist SET last_reason=? WHERE fixture_id=?').run('historique_non_verifie', w.fixture_id); out.reasons.historique_non_verifie = (out.reasons.historique_non_verifie || 0) + 1; continue; }
        if (!deep.attackers.verified) { db.prepare('UPDATE plus05_watchlist SET last_reason=? WHERE fixture_id=?').run('attaquants_non_verifies', w.fixture_id); out.reasons.attaquants_non_verifies = (out.reasons.attaquants_non_verifies || 0) + 1; continue; }

        const votes = await councilVote(w, c.m, quote, deep);
        if (votes.yes < P.CFG.minVotes) { db.prepare('UPDATE plus05_watchlist SET last_reason=? WHERE fixture_id=?').run(`quorum_${votes.yes}_sur_5`, w.fixture_id); out.reasons.quorum_insuffisant = (out.reasons.quorum_insuffisant || 0) + 1; continue; }

        // Re-verification APRES le vote (il dure jusqu'a 45 s) : score et cote frais.
        const fresh = await apiGet(`/odds/live?fixture=${w.fixture_id}`);
        const entry = fresh?.response?.[0];
        const quote2 = P.extractTeamOver05(entry, w.side);
        const goalsNow = entry?.teams ? Number(w.side === 'home' ? entry.teams.home?.goals : entry.teams.away?.goals) : NaN;
        const final = P.evaluateLiveTrigger({ favGoals: Number.isFinite(goalsNow) ? goalsNow : 0, minute: c.m.minute, quote: quote2, votes: votes.yes, now: now() });
        if (!final.go) { out.reasons[`revalidation_${final.reason}`] = 1; continue; }
        const pub = await publish(w, { ...c.m, minute: Number(entry?.fixture?.status?.elapsed ?? c.m.minute) }, quote2, votes);
        if (pub.sent) out.sent++;
      } catch (e) { log.error('[plus05] candidat', w.fixture_id, e.message); out.reasons.erreur = (out.reasons.erreur || 0) + 1; }
    }
    return out;
  }

  // ── Resultats ───────────────────────────────────────────────────────────
  async function settlePending() {
    ensureSchema();
    const rows = db.prepare(`SELECT * FROM plus05_signals WHERE outcome='pending' AND sent_at < ?`).all(now() - 20 * 60 * 1000);
    let resolved = 0;
    for (const s of rows) {
      try {
        const res = await apiGet(`/fixtures?id=${s.fixture_id}`);
        const fx = res?.response?.[0];
        const status = fx?.fixture?.status?.short;
        if (!['FT', 'AET', 'PEN'].includes(status)) {
          if (['PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(status)) db.prepare("UPDATE plus05_signals SET outcome='void',resolved_at=? WHERE id=?").run(now(), s.id);
          continue;
        }
        // Temps reglementaire : score.fulltime si disponible.
        const ft = fx.score?.fulltime;
        const h = Number(ft?.home ?? fx.goals?.home), a = Number(ft?.away ?? fx.goals?.away);
        if (!Number.isFinite(h) || !Number.isFinite(a)) continue;
        const favGoals = s.fav_side === 'home' ? h : a;
        const outcome = P.settle({ favFinalGoals: favGoals }) === 'GAGNE' ? 'win' : 'loss';
        db.prepare('UPDATE plus05_signals SET outcome=?,final_home=?,final_away=?,final_fav_goals=?,resolved_at=? WHERE id=?').run(outcome, h, a, favGoals, now(), s.id);
        resolved++;
        const f = flags();
        if (f.sendResults && !f.dryRun && !s.dry_run) {
          const data = { matchKey: `plus05:${s.fixture_id}`, market: 'plus05', outcome, home: s.home, away: s.away,
            scoreHome: h, scoreAway: a, favName: s.fav_name, favGoals: favGoals };
          for (const dest of targets()) { try { publisher.enqueue('plus05_result', data, dest, s.fixture_id, now() + 6 * 3600 * 1000); } catch (e) { log.error('[plus05] resultat', e.message); } }
          try { await publisher.flush(); } catch (e) { log.error('[plus05] flush resultat', e.message); }
        }
      } catch (e) { log.error('[plus05] settle', s.fixture_id, e.message); }
    }
    return { pending: rows.length, resolved };
  }

  // ── Journal admin ───────────────────────────────────────────────────────
  function adminReport({ limit = 100, includeDry = false } = {}) {
    ensureSchema();
    const where = includeDry ? '' : 'WHERE dry_run=0';
    const rows = db.prepare(`SELECT * FROM plus05_signals ${where} ORDER BY sent_at DESC LIMIT ?`).all(limit);
    const agg = db.prepare(`SELECT COUNT(*) total, SUM(outcome='win') wins, SUM(outcome='loss') losses, SUM(outcome='pending') pending,
      SUM(outcome='void') voids FROM plus05_signals ${where}`).get();
    const byColor = db.prepare(`SELECT risk_color, COUNT(*) n, SUM(outcome='win') wins, SUM(outcome='loss') losses FROM plus05_signals ${where} GROUP BY risk_color`).all();
    const settled = (agg.wins || 0) + (agg.losses || 0);
    const odds = rows.filter((r) => r.outcome === 'win' || r.outcome === 'loss');
    const profit = odds.reduce((n, r) => n + (r.outcome === 'win' ? r.odd - 1 : -1), 0);
    return {
      total: agg.total || 0, wins: agg.wins || 0, losses: agg.losses || 0, pending: agg.pending || 0, voids: agg.voids || 0,
      winRatePct: settled ? Math.round((1000 * (agg.wins || 0)) / settled) / 10 : null,
      flatStakeProfitUnits: Math.round(profit * 100) / 100, byColor,
      signals: rows.map((r) => ({ id: r.id, fixtureId: r.fixture_id, sentAt: new Date(r.sent_at).toISOString(), minute: r.minute,
        match: `${r.home} - ${r.away}`, competition: r.competition, team: r.fav_name, odd: r.odd, oddSource: r.odd_source,
        risk: r.risk_color, votes: `${r.votes_yes}/${r.votes_total}`, outcome: r.outcome,
        finalScore: r.final_home === null ? null : `${r.final_home}-${r.final_away}`, favGoals: r.final_fav_goals, dryRun: !!r.dry_run })),
    };
  }

  return { ensureSchema, buildWatchlist, tick, settlePending, adminReport, councilVote, parseVote,
    _internals: { loadTable, historyCheck, attackersCheck, publish } };
}

module.exports = { createPlus05Engine, ENG };

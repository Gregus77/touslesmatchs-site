'use strict';
/**
 * Radar +0,5 but (decision du fondateur, 01/10/2026).
 *
 * Principe : toute la journee, le radar parcourt les matchs de football. Quand
 * une equipe du TOP 5 affronte une equipe des 5 DERNIERES de son championnat
 * (1re/2e division, tous pays), le match est mis sous surveillance. Des que la
 * cote en direct du marche « l'equipe du haut marque au moins 1 but » atteint
 * 1,60 alors qu'elle n'a pas encore marque, le radar emet UNE alerte (par
 * match et par canal Telegram).
 *
 * Etats d'un match : candidate -> watching (cote >= 1,30) -> go (cote >= 1,60)
 *                    -> resultat (win des que l'equipe marque, loss au coup de
 *                    sifflet final sinon). 'done' / 'void' = jamais diffuse.
 *
 * Aucun appel IA : le radar ne consomme que du quota API-Sports (plafond
 * journalier propre, RADAR05_DAILY_BUDGET).
 *
 * Module volontairement isole de api_server.js : tout ce dont il depend est
 * injecte par createRadar05(deps), ce qui le rend testable sans reseau.
 */

const norm = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

const FINISHED = new Set(['FT', 'AET', 'PEN']);
const VOID_STATUS = new Set(['PST', 'CANC', 'ABD', 'AWD', 'WO']);
const LIVE_POLL = new Set(['1H', '2H']);
const DISCOVERABLE = new Set(['NS', 'TBD', '1H', 'HT', '2H']);

// Perimetre : championnats « normaux ». Ni coupes, ni competitions
// continentales ou entre pays, ni amicaux. Femmes / U17-U23 / reserves sont
// filtres en amont par isExcluded() (isWomenMatch + isCategoryBanned).
const EXCLUDED_COMPETITION_RE = new RegExp([
  'champions league', 'europa league', 'europa conference', 'conference league', 'uefa', 'conmebol',
  'libertadores', 'sudamericana', 'copa\\b', '\\bcup\\b', 'coupe', 'pokal', 'coppa', 'taca\\b',
  'trophy', 'trophee', 'supercup', 'super cup', 'supercopa', 'supercoppa', 'shield',
  'nations league', 'world cup', 'euro 20', 'euro championship', 'qualif', 'friendl', 'amical',
  'play-?offs?\\b', 'barrage', 'afc ', 'caf ', 'concacaf', 'olympic', 'asian cup', 'africa cup',
  'gold cup', 'international',
].join('|'), 'i');

// Heuristique « 1re ou 2e division » : ecarte les divisions 3 et en dessous
// quand leur nom les trahit. Desactivable (RADAR05_ONLY_TOP2=0).
const LOWER_TIER_RE = /\b(3|iii|third|4|iv|fourth|regional|regionalliga|oberliga|amateur|national\s*[123]|league\s*(one|two|1|2)|serie\s*[cd]|liga\s*[34]|division\s*[34]|tercera|rfef|segunda\s*b|d3|d4|reserves?)\b/i;

function defaultConfig(env = {}) {
  const n = (k, d) => { const v = Number(env[k]); return Number.isFinite(v) && env[k] !== '' && env[k] != null ? v : d; };
  return {
    enabled: env.RADAR05_ENABLED !== '0',
    intervalSec: Math.max(60, n('RADAR05_INTERVAL_SEC', 180)),
    watchOdd: n('RADAR05_WATCH_ODD', 1.30),
    goOdd: n('RADAR05_GO_ODD', 1.60),
    maxMinute: n('RADAR05_MAX_MINUTE', 85),
    topN: n('RADAR05_TOP_N', 5),
    minTeams: n('RADAR05_MIN_TEAMS', 12),
    minPlayed: n('RADAR05_MIN_PLAYED', 6),
    minTargetGf: n('RADAR05_MIN_TARGET_GF', 1.3),
    minOppGa: n('RADAR05_MIN_OPP_GA', 1.2),
    onlyTop2: env.RADAR05_ONLY_TOP2 !== '0',
    dailyBudget: n('RADAR05_DAILY_BUDGET', 2500),
    maxStandingsPerCycle: n('RADAR05_MAX_STANDINGS_PER_CYCLE', 12),
    maxOddsPerCycle: n('RADAR05_MAX_ODDS_PER_CYCLE', 15),
    coldEvery: Math.max(1, n('RADAR05_COLD_EVERY', 3)),
    alertTtlMs: n('RADAR05_ALERT_TTL_MIN', 10) * 60 * 1000,
    announceBeforeMin: n('RADAR05_ANNOUNCE_BEFORE_MIN', 120),
    maxAnnouncePerCycle: n('RADAR05_MAX_ANNOUNCE_PER_CYCLE', 3),
    greenFrom: n('RADAR05_GREEN_FROM', 6),
    yellowFrom: n('RADAR05_YELLOW_FROM', 4),
  };
}

// ── Filtres statiques (sans appel reseau) ────────────────────────────────────
function staticExclusion(match, cfg, extraExclude) {
  if (!match.homeId || !match.awayId || !match.leagueId || !match.season) return 'identifiants_manquants';
  if (norm(match.country) === 'world') return 'competition_internationale';
  const label = `${match.leagueName} ${match.round || ''}`;
  if (EXCLUDED_COMPETITION_RE.test(norm(label))) return 'competition_hors_championnat';
  if (cfg.onlyTop2 && LOWER_TIER_RE.test(norm(match.leagueName))) return 'division_inferieure';
  if (typeof extraExclude === 'function') {
    const reason = extraExclude(match);
    if (reason) return reason;
  }
  return null;
}

// ── Classement : top N contre bas de tableau + filtre de stats ───────────────
function evaluateStandings(match, groups, cfg) {
  const group = (groups || []).find(g =>
    g.some(r => Number(r.teamId) === Number(match.homeId)) && g.some(r => Number(r.teamId) === Number(match.awayId)));
  if (!group) return { ok: false, reason: 'classement_indisponible' };
  const total = group.length;
  if (total < cfg.minTeams) return { ok: false, reason: 'classement_trop_court' };
  const home = group.find(r => Number(r.teamId) === Number(match.homeId));
  const away = group.find(r => Number(r.teamId) === Number(match.awayId));
  const bottomFrom = total - cfg.topN + 1;
  let side = null;
  if (home.rank <= cfg.topN && away.rank >= bottomFrom) side = 'home';
  else if (away.rank <= cfg.topN && home.rank >= bottomFrom) side = 'away';
  if (!side) return { ok: false, reason: 'pas_top_contre_bas' };
  const target = side === 'home' ? home : away;
  const opponent = side === 'home' ? away : home;
  if (target.played < cfg.minPlayed || opponent.played < cfg.minPlayed) return { ok: false, reason: 'debut_de_saison' };
  const tGf = target.gf / target.played, oGa = opponent.ga / opponent.played, oGf = opponent.gf / opponent.played;
  if (tGf < cfg.minTargetGf) return { ok: false, reason: 'attaque_peu_prolifique' };
  if (oGa < cfg.minOppGa) return { ok: false, reason: 'defense_adverse_solide' };
  if (tGf <= oGf) return { ok: false, reason: 'attaque_pas_superieure' };
  return { ok: true, side, total, target, opponent };
}

// ── Cotes : marche « total de buts de l'equipe, plus de 0,5 » ───────────────
// Les formats API-Sports different entre le direct (odds[]) et l'avant-match
// (bookmakers[].bets[]) ; les noms de marches aussi. On accepte donc plusieurs
// libelles et on laisse /admin/radar05/odds-probe permettre de verifier le
// libelle reel en production.
function collectMarkets(data) {
  const out = [];
  for (const r of data?.response || []) {
    for (const m of r.odds || []) out.push({ name: m.name, values: m.values || [] });
    for (const bm of r.bookmakers || []) for (const b of bm.bets || []) out.push({ name: b.name, values: b.values || [], bookmaker: bm.name });
  }
  return out;
}

const NOT_TEAM_TOTAL_RE = /half|1st|2nd|first|second|corner|card|shot|offside|booking|foul|minus|both|exact|handicap|asian|player|scorer|clean|win to nil|odd\/even|to score first|last/;

function extractTeamOver05(data, match, side) {
  const teamName = norm(side === 'home' ? match.home : match.away);
  const otherName = norm(side === 'home' ? match.away : match.home);
  const odds = [];
  const names = new Set();
  let suspended = false;
  for (const mk of collectMarkets(data)) {
    const name = norm(mk.name);
    if (!name || NOT_TEAM_TOTAL_RE.test(name)) continue;
    const mentionsTeam = teamName.length > 2 && name.includes(teamName);
    const mentionsOther = otherName.length > 2 && name.includes(otherName);
    const isHome = /\bhome\b/.test(name), isAway = /\baway\b/.test(name);
    const sideOk = mentionsTeam ? !mentionsOther : side === 'home' ? (isHome && !isAway) : (isAway && !isHome);
    if (!sideOk) continue;
    const isTotal = /total|goals|over\/under|over under/.test(name);
    const isScoreAGoal = /score a goal|to score\b/.test(name);
    if (!isTotal && !isScoreAGoal) continue;
    for (const v of mk.values) {
      const label = norm(v.value);
      const line = norm(v.handicap ?? v.line ?? '');
      let match05 = false;
      if (isScoreAGoal && !isTotal) match05 = label === 'yes';
      else match05 = /^over\s*0[.,]5$/.test(label) || (label === 'over' && /^0[.,]5$/.test(line)) || /^\+?0[.,]5$/.test(label) && /over/.test(name);
      if (!match05) continue;
      if (v.suspended === true || v.suspended === 'true') { suspended = true; continue; }
      const odd = num(v.odd);
      if (odd && odd > 1) { odds.push(odd); names.add(mk.name); }
    }
  }
  if (!odds.length) return { odd: null, suspended, markets: [] };
  odds.sort((a, b) => a - b);
  return { odd: Math.round(odds[Math.floor(odds.length / 2)] * 100) / 100, suspended: false, markets: [...names], count: odds.length };
}

// ── Normalisation d'un fixture API-Sports ────────────────────────────────────
function normalizeFixture(f) {
  return {
    fixtureId: String(f.fixture?.id),
    home: f.teams?.home?.name, away: f.teams?.away?.name,
    homeId: f.teams?.home?.id ?? null, awayId: f.teams?.away?.id ?? null,
    leagueId: f.league?.id ?? null, season: f.league?.season ?? null,
    leagueName: f.league?.name || '', country: f.league?.country || '', round: f.league?.round || '',
    competition: (f.league?.name || '') + (f.league?.country && f.league.country !== 'World' ? ' · ' + f.league.country : ''),
    status: String(f.fixture?.status?.short || '').toUpperCase(),
    minute: f.fixture?.status?.elapsed ?? null,
    goalsHome: f.goals?.home ?? null, goalsAway: f.goals?.away ?? null,
    kickoff: f.fixture?.date || null,
  };
}

function parseStandings(data) {
  const groups = data?.response?.[0]?.league?.standings;
  if (!Array.isArray(groups)) return null;
  const out = groups.map(g => (Array.isArray(g) ? g : []).map(t => ({
    teamId: t.team?.id, rank: Number(t.rank), points: t.points,
    played: Number(t.all?.played) || 0, gf: Number(t.all?.goals?.for) || 0, ga: Number(t.all?.goals?.against) || 0,
  })).filter(r => r.teamId && Number.isFinite(r.rank))).filter(g => g.length);
  return out.length ? out : null;
}

// ── Confiance : pastille verte / jaune / rouge ───────────────────────────────
// Quatre controles notes de 0 a 2. Un controle impossible a verifier vaut 1
// (neutre) et reste affiche comme « non verifie » : on ne fabrique jamais de
// certitude. La pastille n'empeche pas l'alerte, elle dit si le radar est
// confiant ou non.
const ratio = (a, b) => (b > 0 ? a / b : null);

function scoreH2h(fixtures, targetId) {
  const done = (fixtures || []).filter(f => FINISHED.has(String(f.fixture?.status?.short || '').toUpperCase()));
  const played = done.length;
  if (played < 3) return { points: null, played };
  const scored = done.filter(f => ((Number(f.teams?.home?.id) === Number(targetId) ? f.goals?.home : f.goals?.away) || 0) > 0).length;
  const r = scored / played;
  return { points: r >= 0.8 ? 2 : r >= 0.6 ? 1 : 0, scored, played };
}
function scoreScoring(stats) {
  const played = Number(stats?.played) || 0;
  if (played < 1) return { points: null };
  const failed = Number(stats.failed) || 0;
  const r = failed / played;
  return { points: r <= 0.15 ? 2 : r <= 0.30 ? 1 : 0, failed, played };
}
function scoreHistory(pairs) {
  if (!pairs || !pairs.length) return { points: null, total: 0 };
  const confirmed = pairs.filter(p => p.target < p.opponent).length;
  const total = pairs.length;
  return { points: confirmed === total && total >= 2 ? 2 : confirmed * 2 >= total ? 1 : 0, confirmed, total };
}
function scoreAttackers({ forwards = null, missing = null }) {
  if (forwards == null && missing == null) return { points: null };
  let points;
  if (forwards != null) { points = forwards >= 2 ? 2 : forwards === 1 ? 1 : 0; if (missing != null && missing >= 2) points = Math.min(points, 1); }
  else points = missing === 0 ? 2 : missing === 1 ? 1 : 0;
  return { points, forwards, missing };
}
function summarizeConfidence(parts, cfg) {
  const total = Object.values(parts).reduce((n, p) => n + (p?.points ?? 1), 0);
  const level = total >= cfg.greenFrom ? 'green' : total >= cfg.yellowFrom ? 'yellow' : 'red';
  return { level, score: total, max: 8 };
}

const kickoffLabel = iso => {
  try { return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); }
  catch { return ''; }
};

// ── Fabrique ─────────────────────────────────────────────────────────────────
function createRadar05(deps) {
  const {
    db, httpGet, apiKey, publisher, extraExclude,
    shouldSkip = () => false, handleErrors = () => false,
    env = {}, now = Date.now, log = console, onGo = null,
  } = deps;
  const cfg = { ...defaultConfig(env), ...(deps.config || {}) };
  const HOST = 'https://v3.football.api-sports.io';

  db.exec(`
    CREATE TABLE IF NOT EXISTS radar05_signals (
      fixture_id TEXT PRIMARY KEY, day TEXT NOT NULL,
      home TEXT, away TEXT, home_id INTEGER, away_id INTEGER, league_id INTEGER, season INTEGER,
      competition TEXT, kickoff TEXT,
      target_side TEXT, target_name TEXT, opponent_name TEXT,
      target_rank INTEGER, opponent_rank INTEGER, table_size INTEGER,
      target_played INTEGER, target_gf INTEGER, target_ga INTEGER,
      opponent_played INTEGER, opponent_gf INTEGER, opponent_ga INTEGER,
      state TEXT NOT NULL DEFAULT 'candidate', state_reason TEXT,
      last_odd REAL, last_odd_at INTEGER, last_minute INTEGER, odd_polls INTEGER DEFAULT 0, odd_misses INTEGER DEFAULT 0,
      watch_at INTEGER, watch_odd REAL,
      go_at INTEGER, go_odd REAL, go_minute INTEGER, go_score_home INTEGER, go_score_away INTEGER, queued INTEGER DEFAULT 0,
      outcome TEXT, final_score_home INTEGER, final_score_away INTEGER, finished INTEGER DEFAULT 0,
      announced INTEGER DEFAULT 0, conf_level TEXT, conf_score INTEGER, conf_detail TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS radar05_state ON radar05_signals(state, day);
    CREATE TABLE IF NOT EXISTS radar05_usage (day TEXT PRIMARY KEY, count INTEGER DEFAULT 0);
  `);
  for (const col of ['announced INTEGER DEFAULT 0', 'conf_level TEXT', 'conf_score INTEGER', 'conf_detail TEXT']) {
    if (!db.prepare('PRAGMA table_info(radar05_signals)').all().some(r => r.name === col.split(' ')[0])) db.exec(`ALTER TABLE radar05_signals ADD COLUMN ${col}`);
  }

  const tables = new Map();        // league_season -> {ts, groups}
  const rejected = new Map();      // fixtureId -> reason (memoire du jour)
  let rejectedDay = '';
  let running = false;
  let cycleNo = 0;
  let lastCycle = { at: null, ok: null, error: null, fixtures: 0 };

  const parisDay = (t = now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(t));

  function spend(day) {
    const row = db.prepare('SELECT count FROM radar05_usage WHERE day=?').get(day);
    if ((row?.count || 0) >= cfg.dailyBudget) return false;
    db.prepare('INSERT INTO radar05_usage(day,count) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET count=count+1').run(day);
    return true;
  }
  function usedToday() { return db.prepare('SELECT count FROM radar05_usage WHERE day=?').get(parisDay())?.count || 0; }

  async function call(path) {
    if (!apiKey) return null;
    if (shouldSkip('football')) return null;
    if (!spend(parisDay())) { log.warn('[radar05] plafond journalier atteint'); return null; }
    const data = await httpGet(HOST + path, { 'x-apisports-key': apiKey });
    if (handleErrors('football', data)) return null;
    return data;
  }

  async function fetchDay(date) {
    const data = await call(`/fixtures?date=${encodeURIComponent(date)}&timezone=Europe%2FParis`);
    if (!data) return null;
    return (data.response || []).map(normalizeFixture).filter(m => m.home && m.away);
  }

  async function getTable(leagueId, season, { allowFetch }) {
    const key = `${leagueId}_${season}`;
    const hit = tables.get(key);
    const ttl = hit && hit.groups ? 12 * 3600e3 : 6 * 3600e3;
    if (hit && now() - hit.ts < ttl) return { groups: hit.groups, cached: true };
    if (!allowFetch) return { groups: null, cached: false, deferred: true };
    const data = await call(`/standings?league=${leagueId}&season=${season}`);
    if (!data) return { groups: null, cached: false, deferred: true };
    const groups = parseStandings(data);
    tables.set(key, { ts: now(), groups });
    return { groups, cached: false };
  }

  async function liveOdds(row, fx) {
    const data = await call(`/odds/live?fixture=${row.fixture_id}`);
    if (!data) return { error: true };
    return extractTeamOver05(data, { home: row.home, away: row.away }, row.target_side);
  }

  // ── Detection ──────────────────────────────────────────────────────────────
  async function discover(fixtures, day) {
    const known = new Set(db.prepare('SELECT fixture_id FROM radar05_signals').all().map(r => r.fixture_id));
    let standingsFetched = 0, inserted = 0;
    const pool = fixtures
      .filter(f => DISCOVERABLE.has(f.status) && !known.has(f.fixtureId) && !rejected.has(f.fixtureId))
      .sort((a, b) => String(a.kickoff).localeCompare(String(b.kickoff)));
    for (const f of pool) {
      const why = staticExclusion(f, cfg, extraExclude);
      if (why) { rejected.set(f.fixtureId, why); continue; }
      if (f.minute != null && f.minute > cfg.maxMinute) { rejected.set(f.fixtureId, 'minute_depassee'); continue; }
      const { groups, cached, deferred } = await getTable(f.leagueId, f.season, { allowFetch: standingsFetched < cfg.maxStandingsPerCycle });
      if (deferred) continue; // quota de classements de ce cycle epuise : repris au suivant
      if (!cached) standingsFetched++;
      if (!groups) { rejected.set(f.fixtureId, 'classement_indisponible'); continue; }
      const ev = evaluateStandings(f, groups, cfg);
      if (!ev.ok) { rejected.set(f.fixtureId, ev.reason); continue; }
      const targetGoals = ev.side === 'home' ? f.goalsHome : f.goalsAway;
      if ((targetGoals || 0) > 0) { rejected.set(f.fixtureId, 'equipe_visee_deja_buteuse'); continue; }
      const t = ev.target, o = ev.opponent, t0 = now();
      db.prepare(`INSERT OR IGNORE INTO radar05_signals(fixture_id,day,home,away,home_id,away_id,league_id,season,competition,kickoff,
        target_side,target_name,opponent_name,target_rank,opponent_rank,table_size,target_played,target_gf,target_ga,
        opponent_played,opponent_gf,opponent_ga,state,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'candidate',?,?)`).run(
        f.fixtureId, day, f.home, f.away, f.homeId, f.awayId, f.leagueId, f.season, f.competition, f.kickoff,
        ev.side, ev.side === 'home' ? f.home : f.away, ev.side === 'home' ? f.away : f.home,
        t.rank, o.rank, ev.total, t.played, t.gf, t.ga, o.played, o.gf, o.ga, t0, t0);
      inserted++;
      log.log(`[radar05] candidat: ${f.home} - ${f.away} (${f.competition}) cible=${ev.side === 'home' ? f.home : f.away} n°${t.rank} vs n°${o.rank}`);
    }
    return { inserted, standingsFetched };
  }

  // ── Suivi ──────────────────────────────────────────────────────────────────
  function setState(id, state, reason) {
    const finished = state === 'done' || state === 'void' ? 1 : 0;
    db.prepare('UPDATE radar05_signals SET state=?, state_reason=?, finished=?, updated_at=? WHERE fixture_id=?').run(state, reason || null, finished, now(), id);
  }

  function finalize(row, fx) {
    const tGoals = (row.target_side === 'home' ? fx.goalsHome : fx.goalsAway) || 0;
    if (row.state === 'go') {
      db.prepare('UPDATE radar05_signals SET outcome=?, final_score_home=?, final_score_away=?, finished=1, updated_at=? WHERE fixture_id=?')
        .run(row.outcome === 'win' || tGoals > 0 ? 'win' : 'loss', fx.goalsHome, fx.goalsAway, now(), row.fixture_id);
    } else {
      db.prepare("UPDATE radar05_signals SET state='done', state_reason=?, final_score_home=?, final_score_away=?, finished=1, updated_at=? WHERE fixture_id=?")
        .run('termine_sans_signal', fx.goalsHome, fx.goalsAway, now(), row.fixture_id);
    }
  }

  const squads = new Map(); // teamId -> {ts, byName}

  async function fetchPartsFull(row) {
    const targetId = row.target_side === 'home' ? row.home_id : row.away_id;
    const oppId = row.target_side === 'home' ? row.away_id : row.home_id;
    const safe = async fn => { try { return await fn(); } catch (e) { log.error('[radar05] confiance:', e.message); return null; } };
    const [h2h, stats, history] = await Promise.all([
      safe(async () => { const d = await call(`/fixtures/headtohead?h2h=${row.home_id}-${row.away_id}&last=10`); return d ? scoreH2h(d.response, targetId) : { points: null }; }),
      safe(async () => {
        const d = await call(`/teams/statistics?league=${row.league_id}&season=${row.season}&team=${targetId}`);
        const r = d?.response;
        return r?.fixtures ? scoreScoring({ played: r.fixtures.played?.total, failed: r.failed_to_score?.total }) : { points: null };
      }),
      safe(async () => {
        const pairs = [];
        for (const back of [1, 2]) {
          const { groups } = await getTable(row.league_id, row.season - back, { allowFetch: true });
          const g = (groups || []).find(x => x.some(t => Number(t.teamId) === Number(targetId)) && x.some(t => Number(t.teamId) === Number(oppId)));
          if (!g) continue;
          pairs.push({ target: g.find(t => Number(t.teamId) === Number(targetId)).rank, opponent: g.find(t => Number(t.teamId) === Number(oppId)).rank });
        }
        return scoreHistory(pairs);
      }),
    ]);
    return { h2h: h2h || { points: null }, scoring: stats || { points: null }, history: history || { points: null } };
  }

  // Attaquants : composition officielle si elle est publiee (en general ~1 h
  // avant le coup d'envoi), sinon croisement blesses x effectif (poste Attacker).
  async function fetchAttackers(row) {
    const targetId = row.target_side === 'home' ? row.home_id : row.away_id;
    let forwards = null, missing = null;
    try {
      const lu = await call(`/fixtures/lineups?fixture=${row.fixture_id}`);
      const mine = (lu?.response || []).find(l => Number(l.team?.id) === Number(targetId));
      if (mine?.startXI?.length) forwards = mine.startXI.filter(p => String(p.player?.pos || '').toUpperCase() === 'F').length;
    } catch (e) { log.error('[radar05] compo:', e.message); }
    try {
      const inj = await call(`/injuries?fixture=${row.fixture_id}`);
      if (inj) {
        let sq = squads.get(targetId);
        if (!sq || now() - sq.ts > 24 * 3600e3) {
          const d = await call(`/players/squads?team=${targetId}`);
          sq = { ts: now(), byId: new Map((d?.response?.[0]?.players || []).map(p => [Number(p.id), String(p.position || '')])) };
          squads.set(targetId, sq);
        }
        const mineInj = (inj.response || []).filter(i => Number(i.team?.id) === Number(targetId));
        missing = sq.byId.size ? mineInj.filter(i => /attacker|forward/i.test(sq.byId.get(Number(i.player?.id)) || '')).length : null;
      }
    } catch (e) { log.error('[radar05] blesses:', e.message); }
    return scoreAttackers({ forwards, missing });
  }

  // full=true : calcul complet (annonce) ; sinon seuls les attaquants sont
  // relus (juste avant un GO) car blesses et composition evoluent.
  async function computeConfidence(row, full) {
    let parts = row.conf_detail ? JSON.parse(row.conf_detail) : null;
    if (!parts || full) parts = { ...(await fetchPartsFull(row)), attackers: parts?.attackers || { points: null } };
    parts.attackers = await fetchAttackers(row);
    const sum = summarizeConfidence(parts, cfg);
    db.prepare('UPDATE radar05_signals SET conf_level=?, conf_score=?, conf_detail=?, updated_at=? WHERE fixture_id=?')
      .run(sum.level, sum.score, JSON.stringify(parts), now(), row.fixture_id);
    return { ...sum, parts };
  }

  async function announce(row, fx) {
    const conf = await computeConfidence(row, true);
    const data = buildAlertData({ ...row, conf_level: conf.level, conf_score: conf.score, conf_detail: JSON.stringify(conf.parts) }, fx, null);
    let queued = 0;
    if (publisher) {
      const expiresAt = now() + cfg.alertTtlMs * 3;
      for (const dest of publisher.targets) {
        try { if (publisher.enqueue('radar05watch', data, dest, row.fixture_id, expiresAt)) queued++; }
        catch (e) { log.error('[radar05] enqueue annonce:', e.message); }
      }
    }
    db.prepare('UPDATE radar05_signals SET announced=1, updated_at=? WHERE fixture_id=?').run(now(), row.fixture_id);
    log.log(`[radar05] annonce ${row.home} - ${row.away}: pastille ${conf.level} (${conf.score}/8) -> ${queued} envoi(s)`);
    if (publisher) publisher.flush().catch(e => log.error('[radar05] flush:', e.message));
  }

  function buildAlertData(row, fx, odd) {
    return {
      home: row.home, away: row.away, competition: row.competition,
      minute: fx.minute ?? '?', scoreHome: fx.goalsHome ?? 0, scoreAway: fx.goalsAway ?? 0,
      team: row.target_name, opponent: row.opponent_name, odd: odd == null ? null : Number(odd).toFixed(2),
      teamRank: row.target_rank, opponentRank: row.opponent_rank,
      teamPlayed: row.target_played, teamGf: row.target_gf, teamGa: row.target_ga,
      opponentPlayed: row.opponent_played, opponentGf: row.opponent_gf, opponentGa: row.opponent_ga,
      kickoff: kickoffLabel(row.kickoff),
      confidence: row.conf_level ? { level: row.conf_level, score: row.conf_score, max: 8, parts: row.conf_detail ? JSON.parse(row.conf_detail) : {} } : null,
    };
  }

  async function fireGo(row, fx, odd) {
    // Relecture des attaquants juste avant d'envoyer (composition / blesses).
    let fresh = row;
    try {
      const conf = await computeConfidence(row, !row.conf_detail);
      fresh = { ...row, conf_level: conf.level, conf_score: conf.score, conf_detail: JSON.stringify(conf.parts) };
    } catch (e) { log.error('[radar05] confiance GO:', e.message); }
    const data = buildAlertData(fresh, fx, odd);
    let queued = 0;
    if (publisher) {
      const expiresAt = now() + cfg.alertTtlMs; // une alerte perimee ne part jamais
      for (const dest of publisher.targets) {
        try { if (publisher.enqueue('radar05', data, dest, row.fixture_id, expiresAt)) queued++; }
        catch (e) { log.error('[radar05] enqueue:', e.message); }
      }
    }
    db.prepare(`UPDATE radar05_signals SET state='go', state_reason='cote_atteinte', go_at=?, go_odd=?, go_minute=?,
      go_score_home=?, go_score_away=?, queued=?, updated_at=? WHERE fixture_id=? AND state!='go'`)
      .run(now(), odd, fx.minute ?? null, fx.goalsHome ?? 0, fx.goalsAway ?? 0, queued, now(), row.fixture_id);
    log.log(`[radar05] GO ${row.home} - ${row.away}: ${row.target_name} +0,5 but a ${odd} (min ${fx.minute}) -> ${queued} envoi(s) en file`);
    if (publisher) publisher.flush().catch(e => log.error('[radar05] flush:', e.message));
    // Canaux annexes (notification de l'application) : un echec ne bloque jamais le radar.
    if (onGo) { try { await onGo(row, fx, data); } catch (e) { log.error('[radar05] onGo:', e.message); } }
  }

  async function pollOdds(row, fx) {
    const res = await liveOdds(row, fx);
    if (res.error) return;
    const t = now();
    if (res.odd == null) {
      db.prepare('UPDATE radar05_signals SET odd_polls=odd_polls+1, odd_misses=odd_misses+1, last_minute=?, updated_at=? WHERE fixture_id=?').run(fx.minute ?? null, t, row.fixture_id);
      return;
    }
    db.prepare('UPDATE radar05_signals SET last_odd=?, last_odd_at=?, last_minute=?, odd_polls=odd_polls+1, updated_at=? WHERE fixture_id=?')
      .run(res.odd, t, fx.minute ?? null, t, row.fixture_id);
    if (res.odd >= cfg.watchOdd && row.state === 'candidate') {
      db.prepare("UPDATE radar05_signals SET state='watching', state_reason='cote_a_surveiller', watch_at=?, watch_odd=? WHERE fixture_id=? AND state='candidate'").run(t, res.odd, row.fixture_id);
      log.log(`[radar05] surveillance: ${row.home} - ${row.away} cote ${res.odd}`);
    }
    if (res.odd >= cfg.goOdd && (fx.minute ?? 0) <= cfg.maxMinute) {
      // Double lecture : une cote qui saute puis retombe (suspension, erreur de
      // flux) ne doit jamais declencher une alerte client.
      const confirm = await liveOdds(row, fx);
      if (!confirm.error && confirm.odd != null && confirm.odd >= cfg.goOdd) await fireGo(row, fx, confirm.odd);
    }
  }

  async function track(fixtureById) {
    const open = db.prepare("SELECT * FROM radar05_signals WHERE state IN ('candidate','watching','go') AND finished=0").all();
    const toPoll = [];
    let announced = 0;
    for (const row of open) {
      const fx = fixtureById.get(row.fixture_id);
      if (!fx) {
        if (now() - row.created_at > 48 * 3600e3) {
          if (row.state === 'go') db.prepare("UPDATE radar05_signals SET outcome=COALESCE(outcome,'void'), finished=1, updated_at=? WHERE fixture_id=?").run(now(), row.fixture_id);
          else setState(row.fixture_id, 'void', 'introuvable');
        }
        continue;
      }
      if (FINISHED.has(fx.status)) { finalize(row, fx); continue; }
      if (VOID_STATUS.has(fx.status)) { if (row.state === 'go') db.prepare("UPDATE radar05_signals SET outcome='void', finished=1, updated_at=? WHERE fixture_id=?").run(now(), row.fixture_id); else setState(row.fixture_id, 'void', fx.status); continue; }
      const tGoals = (row.target_side === 'home' ? fx.goalsHome : fx.goalsAway) || 0;
      if (row.state === 'go') {
        if (tGoals > 0) db.prepare("UPDATE radar05_signals SET outcome='win', final_score_home=?, final_score_away=?, updated_at=? WHERE fixture_id=?").run(fx.goalsHome, fx.goalsAway, now(), row.fixture_id);
        continue;
      }
      if (tGoals > 0) { setState(row.fixture_id, 'done', 'equipe_visee_a_marque'); continue; }
      if (!row.announced && announced < cfg.maxAnnouncePerCycle && Date.parse(row.kickoff) - now() <= cfg.announceBeforeMin * 60000) {
        announced++;
        try { await announce(row, fx); } catch (e) { log.error('[radar05] annonce:', e.message); }
      }
      if ((fx.minute ?? 0) > cfg.maxMinute) { setState(row.fixture_id, 'done', 'minute_depassee'); continue; }
      if (LIVE_POLL.has(fx.status)) toPoll.push({ row, fx });
    }
    // Les matchs sous surveillance (cote >= 1,30) sont interroges a chaque
    // cycle ; les simples candidats un cycle sur `coldEvery` pour economiser le quota.
    const hot = toPoll.filter(p => p.row.state === 'watching');
    const cold = toPoll.filter(p => p.row.state === 'candidate' && cycleNo % cfg.coldEvery === 0);
    cold.sort((a, b) => (b.fx.minute ?? 0) - (a.fx.minute ?? 0));
    const queue = [...hot, ...cold].slice(0, cfg.maxOddsPerCycle);
    for (const { row, fx } of queue) {
      try { await pollOdds(row, fx); } catch (e) { log.error('[radar05] cote:', e.message); }
    }
    return { polled: queue.length, open: open.length };
  }

  async function runCycle() {
    if (running) return { skipped: 'running' };
    running = true; cycleNo++;
    try {
      const day = parisDay();
      if (rejectedDay !== day) { rejected.clear(); rejectedDay = day; }
      const open = db.prepare("SELECT DISTINCT day FROM radar05_signals WHERE state IN ('candidate','watching','go') AND finished=0").all().map(r => r.day);
      const fixtureById = new Map();
      let todayList = null;
      for (const d of new Set([day, ...open])) {
        const list = await fetchDay(d);
        if (d === day) todayList = list;
        for (const f of list || []) fixtureById.set(f.fixtureId, f);
      }
      if (!todayList) { lastCycle = { at: now(), ok: false, error: 'liste_du_jour_indisponible', fixtures: 0 }; return lastCycle; }
      const found = await discover(todayList, day);
      const tracked = await track(fixtureById);
      lastCycle = { at: now(), ok: true, error: null, fixtures: todayList.length, ...found, ...tracked };
      return lastCycle;
    } catch (e) {
      log.error('[radar05] cycle:', e.message);
      lastCycle = { at: now(), ok: false, error: e.message, fixtures: 0 };
      return lastCycle;
    } finally { running = false; }
  }

  // ── Lecture ────────────────────────────────────────────────────────────────
  function stats() {
    const rows = db.prepare("SELECT * FROM radar05_signals WHERE go_at IS NOT NULL").all();
    const wins = rows.filter(r => r.outcome === 'win').length;
    const losses = rows.filter(r => r.outcome === 'loss').length;
    const resolved = wins + losses;
    const odds = rows.map(r => r.go_odd).filter(Boolean);
    return {
      signals: rows.length, wins, losses, pending: rows.filter(r => !r.outcome).length,
      hit_rate: resolved ? Math.round(wins / resolved * 1000) / 10 : null,
      avg_odd: odds.length ? Math.round(odds.reduce((a, b) => a + b, 0) / odds.length * 100) / 100 : null,
    };
  }

  // Vue publique : sans abonnement Premium, ni l'equipe visee ni la cote.
  function view(paid) {
    const day = parisDay();
    const rows = db.prepare("SELECT * FROM radar05_signals WHERE day=? AND state IN ('candidate','watching','go') ORDER BY kickoff").all(day);
    return {
      ok: true, locked: !paid, day, generated_at: new Date(now()).toISOString(),
      matches: rows.map(r => ({
        match: `${r.home} - ${r.away}`, competition: r.competition, kickoff: r.kickoff,
        state: r.state, minute: r.last_minute, confidence: r.conf_level || null,
        ...(paid ? { team: r.target_name, rank: r.target_rank, opponent_rank: r.opponent_rank, odd: r.last_odd, go_odd: r.go_odd, outcome: r.outcome, confidence_detail: r.conf_detail ? JSON.parse(r.conf_detail) : null } : {}),
      })),
      stats: stats(),
    };
  }

  function adminState() {
    const day = parisDay();
    const reasons = {};
    for (const r of rejected.values()) reasons[r] = (reasons[r] || 0) + 1;
    const byState = db.prepare('SELECT state, COUNT(*) n FROM radar05_signals WHERE day=? GROUP BY state').all(day);
    return {
      ok: true, config: cfg, day, budget_used: usedToday(), last_cycle: lastCycle,
      standings_cached: tables.size, rejected_today: reasons, by_state: byState, stats: stats(),
      rows: db.prepare("SELECT * FROM radar05_signals WHERE day=? ORDER BY kickoff").all(day),
    };
  }

  // Diagnostic : liste les marches « equipe » reellement renvoyes par l'API
  // pour un match en direct, afin de confirmer les libelles en production.
  async function probeOdds(fixtureId) {
    const data = await call(`/odds/live?fixture=${encodeURIComponent(fixtureId)}`);
    if (!data) return { ok: false, error: 'appel_impossible' };
    const markets = collectMarkets(data).map(m => ({ name: m.name, sample: (m.values || []).slice(0, 4) }));
    return { ok: true, markets_total: markets.length, team_related: markets.filter(m => /home|away|team/i.test(String(m.name))) };
  }

  let timer = null;
  function start() {
    if (!cfg.enabled) { log.log('[radar05] desactive (RADAR05_ENABLED=0)'); return; }
    if (!apiKey) { log.log('[radar05] inactif: cle API-Sports absente'); return; }
    log.log(`[radar05] actif: cycle ${cfg.intervalSec}s, surveillance >= ${cfg.watchOdd}, GO >= ${cfg.goOdd}, plafond ${cfg.dailyBudget} appels/jour`);
    setTimeout(() => runCycle(), 45000);
    timer = setInterval(() => runCycle(), cfg.intervalSec * 1000);
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }

  return { start, stop, runCycle, view, stats, adminState, probeOdds, cfg, _tables: tables, _rejected: rejected };
}

module.exports = {
  createRadar05, defaultConfig, staticExclusion, evaluateStandings, extractTeamOver05,
  normalizeFixture, parseStandings, EXCLUDED_COMPETITION_RE, LOWER_TIER_RE,
  scoreH2h, scoreScoring, scoreHistory, scoreAttackers, summarizeConfidence,
};

'use strict';

function score(value) {
  const pair = typeof value === 'string' ? value.split('-') : [value?.home, value?.away];
  if (pair.length !== 2 || pair.some(x => x === null || x === undefined || x === '' || !Number.isInteger(Number(x)) || Number(x) < 0)) return null;
  return pair.map(Number).join('-');
}

function liveMinute(value) {
  const hit=String(value ?? '').trim().match(/^(\d+)(?:\+(\d+))?(?:['′’])?$/);
  return hit ? Number(hit[1])+Number(hit[2]||0) : null;
}

function analysisWindow(match) {
  const minute=liveMinute(match?.minute);
  const statuses=[match?.status,match?.period,match?.status_short,match?.fixture?.status]
    .map(s=>String(s&&typeof s==='object'?s.short||s.long||'':s||'').trim().toUpperCase());
  if(statuses.some(s=>/^(HT|HALFTIME|HALF TIME|HALF_TIME|2H|SECOND HALF|FT|FINISHED|FULL TIME|FULL_TIME|AET|PEN|ET|BT|P|SUSP|INT|ABD|CANC|PST|NS|SCHEDULED)$/.test(s)))
    return {open:false,status:'closed',minute,reason:'Analyse indisponible : première mi-temps terminée ou match interrompu.'};
  if(minute===null)return {open:false,status:'unknown',minute,reason:'Analyse indisponible : minute inconnue ou non numérique.'};
  if(minute<35)return {open:false,status:'waiting',minute,reason:'Analyse indisponible avant la 35e minute.'};
  const first=statuses.some(s=>/^(1H|FIRST HALF|FIRST_HALF)$/.test(s));
  const live=statuses.some(s=>/^(IN_PLAY|LIVE)$/.test(s));
  if(first || (live && minute<=45))return {open:true,status:'open',minute,reason:null};
  return {open:false,status:'closed',minute,reason:'Analyse indisponible : première mi-temps non confirmée.'};
}

function firstHalfClosed(match) {
  const statuses = [match?.status, match?.period, match?.status_short, match?.fixture?.status]
    .map(s => String(s && typeof s === 'object' ? s.short || s.long || '' : s || '').trim().toUpperCase());
  if (statuses.some(s => /^(HT|HALFTIME|HALF TIME|HALF_TIME|2H|SECOND HALF|FT|FINISHED|FULL TIME|FULL_TIME|AET|PEN|ET|BT|P)$/.test(s))) return true;
  if (statuses.some(s => /^(1H|FIRST HALF|FIRST_HALF)$/.test(s))) return false;
  const hit = String(match?.minute ?? '').match(/^(\d+)(?:\+(\d+))?(?:['′’])?$/);
  return !!hit && Number(hit[1]) + Number(hit[2] || 0) > 45;
}

function publicState(match, state) {
  if (state.official === true) return state; // An issued prediction is immutable.
  const snapshotMinute = Number(state.snapshot_minute);
  // Display evidence of the old decision, never a new actionable prediction.
  if (firstHalfClosed(match) && state.snapshot_minute != null && snapshotMinute >= 35 && (snapshotMinute <= 45 || state.first_half_verified === true)) {
    return {...state, window_status: 'closed', analysis_state: 'archived',
      recommendation_status: `Analyse conservée à ${snapshotMinute}′, score ${score(state.snapshot_score) || 'indisponible'} — aucun signal officiel`,
      consensus_direction: null};
  }
  const current = score({home: match.score_home, away: match.score_away});
  const previous = score(state.snapshot_score);
  const hasVotes = Number(state.vote_count || 0) > 0 || (state.votes || []).some(v => v.direction);
  if (!hasVotes || (current && previous === current)) return state;
  const reason = current && previous
    ? `Score modifié (${previous} → ${current}) : ancienne analyse invalidée. Nouvelle analyse requise dans la fenêtre autorisée.`
    : 'Synchronisation du score non confirmée : avis précédents non utilisables.';
  return {...state, analysis_state: 'stale', synchronization_reason: reason,
    recommendation_status: reason, consensus_direction: null, consensus_count: 0,
    vote_count: 0, over_count: 0, under_count: 0, consensus_at: null,
    votes: (state.votes || []).map(v => ({...v, direction: null, label: null,
      confidence: null, status: 'stale', reason}))};
}

function failure(reason, category = 'other') {
  const error = new Error(reason);
  error.code = 'LIVE_STATE_UNVERIFIED';
  error.diagnostic_category = category;
  return error;
}

function fixtureState(fixture, match, id) {
  if (!fixture?.fixture) throw statsFailure('fixture_unknown');
  if (String(fixture.fixture.id) !== String(id)) throw statsFailure('mapping');
  const actual = score(fixture?.goals);
  const expected = score({home: match.score_home, away: match.score_away});
  const phase = fixture?.fixture?.status?.short;
  const minute = fixture?.fixture?.status?.elapsed;
  if (String(fixture?.fixture?.id) !== String(id) || !actual || !expected || actual !== expected)
    throw statsFailure('score_changed');
  if (phase !== '1H' || !Number.isInteger(minute) || minute < 15)
    throw statsFailure('phase');
  const observed = liveMinute(match.minute);
  if (observed === null || minute < observed || minute - observed > 2)
    throw statsFailure('minute');
  const home = fixture?.teams?.home?.id, away = fixture?.teams?.away?.id;
  if (!Number.isInteger(home) || !Number.isInteger(away) || home === away)
    throw statsFailure('teams_missing');
  return {fixtureId: String(id), score: actual, phase, minute, home, away};
}

function createCollector({fetchFixture, fetchStats, clock = Date.now}) {
  async function verify(match, id) { return fixtureState(await fetchFixture(id), match, id); }
  async function collect(match, id) {
    const started = clock();
    const before = await verify(match, id);
    const stats = await fetchStats(id, before);
    if (!stats) throw statsFailure('incomplete_data');
    const after = await verify(match, id);
    if (before.score !== after.score || before.phase !== after.phase || before.home !== after.home || before.away !== after.away || after.minute < before.minute || clock() - started > 30000)
      throw statsFailure('collection_changed');
    return {stats, observation: {...after, started_at: new Date(started).toISOString(), verified_at: new Date(clock()).toISOString()}};
  }
  async function revalidate(match, observation) {
    if (!observation || clock() - Date.parse(observation.verified_at) > 120000)
      throw statsFailure('stale');
    const state = await verify(match, observation.fixtureId);
    if (state.score !== observation.score || state.phase !== observation.phase || state.home !== observation.home || state.away !== observation.away || state.minute < observation.minute)
      throw statsFailure('collection_changed');
    return state;
  }
  return {collect, revalidate};
}

function statsKey(id, state) {
  return state ? `stats_${id}_${state.phase}_${state.minute}_${state.score}_${state.home}_${state.away}` : `stats_${id}`;
}

// Fixed vocabulary only: never persist an upstream body, URL, key or error text.
const DIAGNOSTICS = Object.freeze({
  empty_response: 'Réponse statistique vide.',
  fixture_unknown: 'Fixture inconnue dans la réponse sportive.',
  teams_missing: 'Équipes absentes ou non identifiées dans la réponse sportive.',
  incomplete_data: 'Données statistiques incomplètes ou sans mesure exploitable pour chaque équipe.',
  mapping: 'Correspondance fixture/équipes incohérente dans la réponse sportive.',
  timeout: 'Délai dépassé pendant la collecte sportive.',
  provider_error: 'Erreur du fournisseur de données sportives.',
  quota: 'Quota interne de collecte sportive atteint.',
  configuration: 'Source sportive non configurée.',
  score_changed: 'Score modifié ou non confirmé.',
  phase: 'Première mi-temps non confirmée.',
  minute: 'Minute du match désynchronisée.',
  collection_changed: 'État du match modifié pendant la collecte ou les votes.',
  stale: 'Statistiques trop anciennes : nouvelle analyse requise.',
  process_interrupted: 'Tentative interrompue par un arrêt du processus.',
  other: 'Autre erreur pendant l’analyse ; aucune réponse brute exposée.',
});
function diagnosticCategory(error) {
  if (Object.prototype.hasOwnProperty.call(DIAGNOSTICS, error?.diagnostic_category)) return error.diagnostic_category;
  if (/timeout|timed?\s*out|ETIMEDOUT|AbortError/i.test(String(error?.code || '') + ' ' + String(error?.name || '') + ' ' + String(error?.message || ''))) return 'timeout';
  return 'other';
}
function statsFailure(category) {
  const safe = Object.prototype.hasOwnProperty.call(DIAGNOSTICS, category) ? category : 'other';
  return failure('Analyse suspendue : ' + DIAGNOSTICS[safe], safe);
}
function verifiedStatsRows(data, state) {
  if (data?.errors && Object.keys(data.errors).length) throw statsFailure('provider_error');
  if (!Array.isArray(data?.response)) throw statsFailure('incomplete_data');
  const rows = data.response;
  if (!rows.length) throw statsFailure('empty_response');
  if (rows.length < 2 || rows.some(row => !Number.isInteger(row?.team?.id))) throw statsFailure('teams_missing');
  const home = rows.filter(row => row.team.id === state.home);
  const away = rows.filter(row => row.team.id === state.away);
  if (rows.length !== 2 || home.length !== 1 || away.length !== 1) throw statsFailure('mapping');
  const measures = ['Ball Possession', 'Shots on Goal', 'Total Shots', 'Dangerous Attacks', 'expected_goals', 'Corner Kicks'];
  const usable = row => Array.isArray(row.statistics) && row.statistics.some(item => {
    if (!measures.includes(item?.type) || item.value == null || String(item.value).trim() === '') return false;
    const n = Number(String(item.value).replace(/%$/, ''));
    return Number.isFinite(n) && n >= 0;
  });
  if (!usable(home[0]) || !usable(away[0])) throw statsFailure('incomplete_data');
  return [home[0], away[0]];
}

// Append-only attempts; no dependency on the vote snapshot/budget/dedup gates.
// A failed collection is evidence, never a completed vote or a retry ban.
function attemptFixtureKey(match) {
  const id = match?.fixtureId ?? match?.fixture_id ?? match?.sourceId ?? match?.id;
  if (id != null) return String(id);
  return [match?.home, match?.away, String(match?.utcDate || '').slice(0, 10)]
    .map(x => String(x || '').trim().toLowerCase()).join('|');
}
function createAttemptStore(db, clock = Date.now) {
  db.exec(`CREATE TABLE IF NOT EXISTS football_analysis_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, fixture_key TEXT NOT NULL,
    started_at TEXT NOT NULL, minute INTEGER, match_status TEXT NOT NULL,
    period TEXT NOT NULL, score_home INTEGER, score_away INTEGER,
    stage TEXT NOT NULL DEFAULT 'collecting', outcome TEXT NOT NULL DEFAULT 'running',
    reason_category TEXT, reason TEXT, finished_at TEXT
  );
  CREATE INDEX IF NOT EXISTS football_attempts_fixture_id ON football_analysis_attempts(fixture_key,id);`);
  // Only startup recovery; never infer that interrupted work supplied votes.
  db.prepare(`UPDATE football_analysis_attempts SET outcome='failed',reason_category='process_interrupted',reason=?,finished_at=?
    WHERE outcome='running'`).run(DIAGNOSTICS.process_interrupted, new Date(clock()).toISOString());
  return {
    start(match) {
      return Number(db.prepare(`INSERT INTO football_analysis_attempts
        (fixture_key,started_at,minute,match_status,period,score_home,score_away) VALUES(?,?,?,?,?,?,?)`)
        .run(attemptFixtureKey(match),new Date(clock()).toISOString(),liveMinute(match.minute),
          String(match.status || ''),String(match.period || ''),match.score_home ?? null,match.score_away ?? null).lastInsertRowid);
    },
    providers(id) { db.prepare("UPDATE football_analysis_attempts SET stage='providers' WHERE id=?").run(id); },
    finish(id) { db.prepare("UPDATE football_analysis_attempts SET outcome='completed',finished_at=? WHERE id=?")
      .run(new Date(clock()).toISOString(),id); },
    fail(id,error) {
      const category = diagnosticCategory(error);
      db.prepare("UPDATE football_analysis_attempts SET outcome='failed',reason_category=?,reason=?,finished_at=? WHERE id=?")
        .run(category,DIAGNOSTICS[category],new Date(clock()).toISOString(),id);
    },
    latest(match) {
      return db.prepare('SELECT * FROM football_analysis_attempts WHERE fixture_key=? AND started_at>=? ORDER BY id DESC LIMIT 1')
        .get(attemptFixtureKey(match),new Date(clock()-36*3600000).toISOString()) || null;
    },
  };
}
function attemptState(match, state, attempt, exclusion) {
  if (state.official === true) return state;
  // A newer real snapshot always wins over earlier attempts (including failures).
  const snapshotTime = Date.parse(state.consensus_at || '');
  const newerAttempt = attempt && (!Number.isFinite(snapshotTime) || Date.parse(attempt.started_at) > snapshotTime);
  if (newerAttempt && attempt.outcome !== 'completed') {
    const failed = attempt.outcome === 'failed';
    const before = attempt.stage === 'collecting';
    const reason = failed
      ? `Tentative à ${attempt.minute}′ (${attempt.started_at}) : ${attempt.reason} ${before ? 'Les cinq IA n’ont pas été appelées.' : ''}`.trim()
      : `Tentative commencée à ${attempt.minute}′ : ${before ? 'vérification des statistiques avant les cinq IA' : 'votes en cours'}.`;
    return {...state, analysis_state: failed ? (before ? 'failed_before_providers' : 'failed') : 'running',
      attempt: {started_at:attempt.started_at,minute:attempt.minute,status:attempt.match_status,period:attempt.period,
        stage:attempt.stage,outcome:attempt.outcome,reason_category:attempt.reason_category,reason:attempt.reason,
        finished_at:attempt.finished_at,score_home:attempt.score_home,score_away:attempt.score_away},
      attempt_reason:reason,recommendation_status:reason,
      votes:(state.votes || []).map(v => v.status === 'pending'
        ? {...v,status:failed ? (before ? 'not_called' : 'unavailable') : before ? 'collecting' : 'pending',reason,updated_at:attempt.started_at} : v)};
  }
  if (exclusion && !Number(state.vote_count || 0)) {
    const reason = 'Exclu avant Concile : ' + exclusion;
    return {...state,analysis_state:'excluded',attempt_reason:reason,recommendation_status:reason,
      votes:(state.votes || []).map(v => v.status === 'pending' ? {...v,status:'excluded',reason} : v)};
  }
  return state;
}

module.exports = {score, publicState, firstHalfClosed, fixtureState, createCollector, statsKey, liveMinute, analysisWindow,
  statsFailure, diagnosticCategory, verifiedStatsRows, createAttemptStore, attemptState};

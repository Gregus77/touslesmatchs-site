'use strict';

function score(value) {
  const pair = typeof value === 'string' ? value.split('-') : [value?.home, value?.away];
  if (pair.length !== 2 || pair.some(x => x === null || x === undefined || x === '' || !Number.isInteger(Number(x)) || Number(x) < 0)) return null;
  return pair.map(Number).join('-');
}

function publicState(match, state) {
  if (state.official === true) return state; // An issued prediction is immutable.
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

function failure(reason) {
  const error = new Error(reason);
  error.code = 'LIVE_STATE_UNVERIFIED';
  return error;
}

function fixtureState(fixture, match, id) {
  const actual = score(fixture?.goals);
  const expected = score({home: match.score_home, away: match.score_away});
  const phase = fixture?.fixture?.status?.short;
  const minute = fixture?.fixture?.status?.elapsed;
  if (String(fixture?.fixture?.id) !== String(id) || !actual || !expected || actual !== expected)
    throw failure('Score modifié ou non confirmé : analyse suspendue.');
  if (phase !== '1H' || !Number.isInteger(minute) || minute < 15)
    throw failure('Première mi-temps non confirmée : analyse suspendue.');
  const observed = Number(match.minute);
  if (!Number.isFinite(observed) || minute < observed || minute - observed > 2)
    throw failure('Minute du match désynchronisée : analyse suspendue.');
  const home = fixture?.teams?.home?.id, away = fixture?.teams?.away?.id;
  if (!Number.isInteger(home) || !Number.isInteger(away) || home === away)
    throw failure('Équipes du match non confirmées : analyse suspendue.');
  return {fixtureId: String(id), score: actual, phase, minute, home, away};
}

function createCollector({fetchFixture, fetchStats, clock = Date.now}) {
  async function verify(match, id) { return fixtureState(await fetchFixture(id), match, id); }
  async function collect(match, id) {
    const started = clock();
    const before = await verify(match, id);
    const stats = await fetchStats(id, before);
    if (!stats) throw failure('Statistiques synchronisées indisponibles : analyse suspendue.');
    const after = await verify(match, id);
    if (before.score !== after.score || before.phase !== after.phase || before.home !== after.home || before.away !== after.away || after.minute < before.minute || clock() - started > 30000)
      throw failure('État du match modifié pendant la collecte : analyse suspendue.');
    return {stats, observation: {...after, started_at: new Date(started).toISOString(), verified_at: new Date(clock()).toISOString()}};
  }
  async function revalidate(match, observation) {
    if (!observation || clock() - Date.parse(observation.verified_at) > 120000)
      throw failure('Statistiques trop anciennes : nouvelle analyse requise.');
    const state = await verify(match, observation.fixtureId);
    if (state.score !== observation.score || state.phase !== observation.phase || state.home !== observation.home || state.away !== observation.away || state.minute < observation.minute)
      throw failure('État du match modifié pendant les votes : analyse invalidée.');
    return state;
  }
  return {collect, revalidate};
}

function statsKey(id, state) {
  return state ? `stats_${id}_${state.phase}_${state.minute}_${state.score}_${state.home}_${state.away}` : `stats_${id}`;
}

module.exports = {score, publicState, fixtureState, createCollector, statsKey};

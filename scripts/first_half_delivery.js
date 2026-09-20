'use strict';
// Owner decision: deliveries from 35', including verified first-half stoppage.
function evaluateFirstHalf(fixture, snapshot) {
  const phase=String(fixture?.fixture?.status?.short||'').toUpperCase();
  const elapsed=fixture?.fixture?.status?.elapsed;
  if(phase!=='1H')return {ok:false,reason:'not_first_half',terminal:true};
  if(!Number.isInteger(elapsed)||elapsed<35)return {ok:false,reason:'before_35_or_unknown',terminal:true};
  if(String(fixture?.fixture?.id)!==String(snapshot.fixture_id))return {ok:false,reason:'fixture_mismatch',terminal:true};
  if(!Number.isInteger(fixture?.goals?.home)||!Number.isInteger(fixture?.goals?.away))return {ok:false,reason:'score_unavailable'};
  if(fixture.goals.home!==snapshot.score_home||fixture.goals.away!==snapshot.score_away)return {ok:false,reason:'score_changed',terminal:true};
  return {ok:true,reason:'first_half_from_35'};
}
function createValidator({db,fetchFixture,now=Date.now}) {
  return async function validate(row) {
    const snapshot=db.prepare('SELECT * FROM official_vote_snapshots WHERE id=?').get(row.official_signal_snapshot_id);
    if(!snapshot||!snapshot.fixture_id||!Number.isInteger(snapshot.minute)||snapshot.minute<35)return {ok:false,reason:'snapshot_outside_window',terminal:true};
    if(snapshot.minute>45 && !db.prepare("SELECT 1 FROM vote_snapshot_events WHERE snapshot_id=? AND event_type='first_half_verified'").get(snapshot.id))
      return {ok:false,reason:'first_half_unproven',terminal:true};
    // A delayed queue cannot replay an old selection.
    const stamp=String(snapshot.created_at).replace(' ','T');
    const at=Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(stamp)?stamp:stamp+'Z');
    if(!Number.isFinite(at)||now()-at<0||now()-at>120000)return {ok:false,reason:'stale_snapshot',terminal:true};
    try {
      const fixture=await fetchFixture(snapshot.fixture_id);
      return evaluateFirstHalf(fixture,snapshot);
    } catch {return {ok:false,reason:'period_unavailable'};}
  };
}
module.exports={evaluateFirstHalf,createValidator};

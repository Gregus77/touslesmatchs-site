'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
function once(text,before,after){
  if(text.includes(after))return text;
  assert.equal(text.split(before).length,2,`Expected one anchor: ${before.slice(0,70)}`);
  return text.replace(before,after);
}
function patch(root,desired){
  const changes=[];
  function update(file,fn){const p=path.join(root,file),before=fs.readFileSync(p,'utf8');changes.push([p,fn(before)]);}
  const helper=fs.readFileSync(path.join(desired,'scripts/live_state_coherence.js'),'utf8');
  const phase=helper.slice(helper.indexOf('function firstHalfClosed('),helper.indexOf('function publicState('));
  const added=helper.slice(helper.indexOf('  const snapshotMinute = Number(state.snapshot_minute);'),helper.indexOf('  const current = score('));
  update('scripts/live_state_coherence.js',s=>{
    s=once(s,'function publicState(match, state) {',phase+'function publicState(match, state) {');
    s=once(s,'  const current = score(',added+'  const current = score(');
    return once(s,'score, publicState, fixtureState','score, publicState, firstHalfClosed, fixtureState');
  });
  update('scripts/api_server.js',s=>{
    s=once(s,'      votes: voteRows,','      votes: voteRows,\n      observation: statsStatus.observation,');
    s=once(s,'    const immutableState = officialSnapshots.stateForMatch(db, match);',
      '    const immutableState = liveStateCoherence.firstHalfClosed(match)\n      ? officialSnapshots.archivedStateForMatch(db, match)\n      : officialSnapshots.stateForMatch(db, match);');
    s=once(s,'        snapshot_id: snapshot.id,','        snapshot_id: snapshot.id,\n        first_half_verified: snapshot.first_half_verified === true,');
    s=once(s,'&& snapshotMinute >= 15 && snapshotMinute <= CLIENT_OU25_CLIENT_MAX_MINUTE','&& snapshotMinute >= 15 && (snapshotMinute <= CLIENT_OU25_CLIENT_MAX_MINUTE || ou25?.first_half_verified === true)');
    s=once(s,'minute: snapshotMinute, minute_at_analysis: snapshotMinute','minute: Math.min(snapshotMinute,45), minute_at_analysis: Math.min(snapshotMinute,45)');
    const after="if (snapshot && (immutableState.kind === 'official' || snapshot.id === currentSnapshotKey\n      || (liveStateCoherence.firstHalfClosed(match) && Number(snapshot.minute) >= 35 && (Number(snapshot.minute) <= 45 || snapshot.first_half_verified === true)))) {";
    if(s.includes(after))return s;
    const hits=s.match(/if \(snapshot && \(immutableState\.kind === 'official' \|\| snapshot\.id === currentSnapshotKey(?: \|\| windowStatus === 'closed')?\)\) \{/g)||[];
    assert.equal(hits.length,1,'Ambiguous API snapshot selector');
    return s.replace(hits[0],after);
  });
  update('scripts/official_signal_snapshots.js',s=>{
    const wanted=fs.readFileSync(path.join(desired,'scripts/official_signal_snapshots.js'),'utf8');
    if(s.replace(/\r\n/g,'\n')===wanted.replace(/\r\n/g,'\n'))return s;
    const sha=require('crypto').createHash('sha256').update(s).digest('hex');
    assert.equal(sha,'ceb4a543a9ef0ab2a9408444f222e6b64f5cfd75433b709045025b0b63e2aac1','Snapshot module differs from audited runtime; preserve and abort');
    return wanted;
  });
  update('public/index.html',s=>once(s,
    "  if(score&&Number.isFinite(Number(score.home))&&Number.isFinite(Number(score.away)))text+=' · score '+Number(score.home)+'-'+Number(score.away);",
    "  if(typeof score==='string'&&/^\\d+-\\d+$/.test(score))text+=' · score '+score;\n  else if(score&&Number.isFinite(Number(score.home))&&Number.isFinite(Number(score.away)))text+=' · score '+Number(score.home)+'-'+Number(score.away);"));
  update('public/app.html',s=>once(s,"preserved='Anciennes tendances — aucun signal officiel · ';","preserved=esc(state.recommendationStatus||'Anciennes tendances — aucun signal officiel')+' · ';"));
  update('public/live-ia.html',s=>once(s,'? "Anciennes tendances — aucun signal officiel"','? (state.statusText || "Anciennes tendances — aucun signal officiel")'));
  // Validate every anchor before touching any file.
  for(const [p,s] of changes)fs.writeFileSync(p,s);
  console.log('PRESERVED_VOTES_PATCH_OK');
}
if(require.main===module)patch(process.argv[2],process.argv[3]);
module.exports={patch};

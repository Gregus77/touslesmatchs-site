// TLM_SOCIAL_SOURCE_BEGIN — included inline in api_server.js; no new scheduler/API calls.
function tlmSocialExport(rows = [], resolved = null) {
  if (!fs.existsSync('/data/social-publication.enabled')) return;
  try {
    const file='/data/social-source.json';
    let state={schema:1,matches:{}};
    if(fs.existsSync(file))state=JSON.parse(fs.readFileSync(file,'utf8'));
    for(const row of rows) {
      if(row.sport!=='Football'||row.socialWhitelist!==true||!row.targetTeam)continue;
      const tr=String(row.targetRank||'').match(/^(\d+)e\/(\d+)$/);
      const op=String(row.opponentRank||'').match(/^(\d+)e\/(\d+)$/);
      if(!tr||!op||tr[2]!==op[2]||!/^\d+$/.test(String(row.sourceId)))continue;
      const id=String(row.sourceId),old=state.matches[id]||{};
      state.matches[id]={...old,fixtureId:id,home:row.home,away:row.away,targetTeam:row.targetTeam,
        targetSide:row.targetSide,targetRank:Number(tr[1]),opponentRank:Number(op[1]),total:Number(tr[2]),
        country:row.country,competition:row.competition,kickoff:row.kickoff,
        verifiedAt:row.socialVerifiedAt?new Date(row.socialVerifiedAt).toISOString():null,whitelist:true,source:'canonical_scanner'};
    }
    if(resolved) {
      const id=String(resolved.fixture?.id||'');
      const prior=state.matches[id];
      if(prior&&['FT','AET','PEN'].includes(resolved.fixture?.status?.short)&&
        resolved.teams?.home?.name===prior.home&&resolved.teams?.away?.name===prior.away&&
        Number.isInteger(resolved.goals?.home)&&Number.isInteger(resolved.goals?.away)) {
        prior.result={fixtureId:id,status:resolved.fixture.status.short,home:resolved.goals.home,
          away:resolved.goals.away,source:'api-sports',verifiedAt:new Date().toISOString()};
      }
    }
    state.updatedAt=new Date().toISOString();
    const temp=file+'.'+process.pid+'.tmp';fs.writeFileSync(temp,JSON.stringify(state),{mode:0o644});fs.renameSync(temp,file);
  } catch (_) {console.error('[social-source] export_failed');}
}
// TLM_SOCIAL_SOURCE_END

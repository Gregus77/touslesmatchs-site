// TLM_SOCIAL_SOURCE_BEGIN — included inline in api_server.js; no new scheduler/API calls.
function tlmSocialCompetitionAllowed(country,competition){
  const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const c=norm(country),l=norm(competition);
  if(!l||/\b(women|feminin|feminine|femenin|youth|u1[789]|u2[013]|cup|copa|pokal|playoff|friendly|reserve|amateur)\b/.test(l))return false;
  const allowed=[
    [/^(spain|espagne|espana)$/,/\b(la liga|laliga|primera division|segunda division|la liga 2)\b/],
    [/^(italy|italie|italia)$/,/\b(serie a|serie b)\b/],
    [/^(netherlands|pays-bas|holland|hollande)$/,/\b(eredivisie|eerste divisie)\b/],
    [/^(belgium|belgique|belgie)$/,/\b(pro league|jupiler|challenger pro league|first division a|first division b)\b/],
    [/^(england|angleterre)$/,/\b(premier league|championship)\b/],
    [/^(scotland|ecosse)$/,/\b(premiership|championship)\b/],
    [/^(ireland|irlande|republic of ireland)$/,/\b(premier division|first division)\b/],
    [/^(denmark|danemark|danmark)$/,/\b(superliga|super league|1st division|1\. division|first division)\b/],
    [/^(brazil|bresil|brasil)$/,/\b(serie a|serie b)\b/],
    [/^(argentina|argentine)$/,/\b(primera division|liga profesional|primera nacional)\b/],
    [/^(japan|japon)$/,/\b(j1 league|j2 league|j-league 1|j-league 2|j1|j2)\b/],
    [/^(norway|norvege|norge)$/,/\b(eliteserien)\b/],
    [/^(chile|chili)$/,/\b(primera division|primera a)\b/],
    [/^(uruguay)$/,/\b(primera division|primera)\b/],
    [/^(paraguay)$/,/\b(primera division|primera)\b/],
    [/^(colombia|colombie)$/,/\b(primera a|categoria primera a|liga betplay)\b/],
    [/^(south korea|korea republic|coree du sud)$/,/\b(k league 1|k-league 1)\b/],
    [/^(usa|united states|united states of america|canada|etats-unis|international)$/,/\b(major league soccer|mls)\b/]
  ];
  return allowed.some(([p,league])=>p.test(c)&&league.test(l));
}
function tlmSocialExport(rows = [], resolved = null) {
  if (!fs.existsSync('/data/social-publication.enabled')) return;
  try {
    const file='/data/social-source.json';
    let state={schema:1,matches:{}};
    if(fs.existsSync(file))state=JSON.parse(fs.readFileSync(file,'utf8'));
    for(const row of rows) {
      if(row.sport!=='Football'||row.socialWhitelist!==true||!row.targetTeam||!tlmSocialCompetitionAllowed(row.country,row.competition))continue;
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

// TLM_SOCIAL_TRAFFIC_BEGIN — analytics only; source data is the existing page_views table.
// One measured event is an existing page-view beacon; an approximate visitor is a distinct
// historical IP hash. Neither represents a verified person nor social media impressions.
const TLM_SOCIAL_NETWORKS = ['facebook','instagram','youtube','tiktok','telegram'];
function tlmSocialNetwork(source,referrer) {
  const raw=String(source||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/[^a-z0-9_-]/g,'').slice(0,45);
  if(/^(facebook|fb|fbads|fb_ads|facebookads|facebook_ads)$/.test(raw))return 'facebook';
  if(/^(instagram|ig|insta|igads|ig_ads)$/.test(raw))return 'instagram';
  if(/^(youtube|yt|youtube_shorts|youtubeshorts)$/.test(raw))return 'youtube';
  if(/^(tiktok|tik_tok|tt)$/.test(raw))return 'tiktok';
  if(/^(telegram|tme|tg)$/.test(raw))return 'telegram';
  let host='';
  try {
    const url=new URL(String(referrer||''));
    if(!['http:','https:'].includes(url.protocol))return null;
    host=url.hostname.toLowerCase().replace(/^www\./,'');
  } catch (_) { return null; }
  const matches=domain=>host===domain||host.endsWith('.'+domain);
  if(matches('facebook.com')||matches('fb.com')||matches('fb.me')||matches('facebook.net'))return 'facebook';
  if(matches('instagram.com'))return 'instagram';
  if(matches('youtube.com')||matches('youtu.be'))return 'youtube';
  if(matches('tiktok.com'))return 'tiktok';
  if(matches('t.me')||matches('telegram.me')||matches('telegram.org'))return 'telegram';
  return null;
}
function tlmTrafficParisDate(timestamp) {
  let parsed;
  if(typeof timestamp==='number') parsed=new Date(timestamp);
  else {
    const t=String(timestamp||'').trim().replace(' ','T');
    parsed=new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(t)?t:t+'Z');
  }
  if(!Number.isFinite(parsed.getTime()))return null;
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'})
    .formatToParts(parsed);
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return p.year+'-'+p.month+'-'+p.day;
}
function tlmSocialTrafficSummary(rows,now=Date.now()){
  const today=tlmTrafficParisDate(now);
  const civilAgo=n=>new Date(Date.parse(today+'T12:00:00Z')-n*86400000).toISOString().slice(0,10);
  const first7=civilAgo(6),first30=civilAgo(29);
  const series=new Map();
  const totals=new Map(TLM_SOCIAL_NETWORKS.map(network=>[network,{network,eventsToday:0,events7d:0,events30d:0,visitorsToday:new Set(),visitors7d:new Set(),visitors30d:new Set()}]));
  const campaigns=new Map();
  const recentVisit=new Map();
  const valid=(Array.isArray(rows)?rows:[]).map(r=>{
    const date=tlmTrafficParisDate(r.created_at);
    const network=tlmSocialNetwork(r.utm_source,r.referrer);
    const parsed=Date.parse(String(r.created_at||'').trim().replace(' ','T').replace(/(?<![zZ]|[+-]\d\d:\d\d)$/,'Z'));
    return {r,date,network,when:parsed};
  }).filter(x=>x.network&&x.date&&x.date>=first30&&x.date<=today&&Number.isFinite(x.when)).sort((a,b)=>a.when-b.when);
  for(const {r,date,network,when} of valid){
    const b=totals.get(network),id=String(r.ip_hash||'').trim();
    const lastKey=id?network+'|'+id:null;
    const previous=lastKey?recentVisit.get(lastKey):null;
    const isNewVisit=!lastKey||previous===undefined||when-previous>30*60*1000;
    if(lastKey)recentVisit.set(lastKey,when);
    // Multiple navigation beacons within 30 minutes count as one estimated arrival.
    if(!isNewVisit)continue;
    const day=series.get(date)||Object.fromEntries(TLM_SOCIAL_NETWORKS.map(n=>[n,0]));
    day[network]++;series.set(date,day);
    b.events30d++;
    if(id)b.visitors30d.add(id);
    if(date>=first7){b.events7d++;if(id)b.visitors7d.add(id);}
    if(date===today){b.eventsToday++;if(id)b.visitorsToday.add(id);}
    const name=String(r.utm_campaign||'').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,48);
    if(name){const key=network+'|'+name;campaigns.set(key,(campaigns.get(key)||0)+1);}
  }
  const results=Array.from(totals.values()).map(({visitorsToday,visitors7d,visitors30d,...x})=>({
    ...x,visitorsTodayEstimated:visitorsToday.size,visitors7dEstimated:visitors7d.size,visitors30dEstimated:visitors30d.size
  }));
  const sum=field=>results.reduce((total,x)=>total+x[field],0);
  const trend=[];
  for(let i=6;i>=0;i--){const day=civilAgo(i);trend.push({date:day,...(series.get(day)||Object.fromEntries(TLM_SOCIAL_NETWORKS.map(n=>[n,0])))});}
  return {
    today,timezone:'Europe/Paris',windowDays:30,
    total:{arrivalsToday:sum('eventsToday'),arrivals7d:sum('events7d'),arrivals30d:sum('events30d')},
    networks:results,trend,
    campaigns:Array.from(campaigns.entries()).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([key,arrivals])=>({network:key.split('|')[0],campaign:key.split('|')[1],arrivals})),
    note:'Visites estimées par réseau : balises du site, sessions approximatives de 30 min. Visiteurs estimés par empreinte réseau existante, pas personnes identifiées. Les applications sociales peuvent masquer la provenance ; résultat potentiellement sous-estimé.'
  };
}
// TLM_SOCIAL_TRAFFIC_END

'use strict';
// Social acquisition report uses only existing page_views; no new personal data or cookies.
const SOURCES=['facebook','instagram','youtube','tiktok','telegram'];
function classify(utm,referrer) {
  const direct=String(utm||'').toLowerCase().trim();
  const normalized=direct.replace(/[^a-z0-9]/g,'');
  const aliases={facebook:'facebook',fb:'facebook',meta:'facebook',instagram:'instagram',ig:'instagram',
    youtube:'youtube',yt:'youtube',tiktok:'tiktok',telegram:'telegram',tg:'telegram'};
  if(aliases[normalized]) return aliases[normalized];
  // An explicit unknown UTM source is not silently reattributed using the referrer.
  if(direct)return null;
  try {
    const host=new URL(String(referrer||'')).hostname.toLowerCase().replace(/^www\./,'');
    if(/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)fb\.me$/.test(host))return 'facebook';
    if(/(^|\.)instagram\.com$/.test(host))return 'instagram';
    if(/(^|\.)youtube\.com$|^youtu\.be$/.test(host))return 'youtube';
    if(/(^|\.)tiktok\.com$/.test(host))return 'tiktok';
    if(/(^|\.)t\.me$|(^|\.)telegram\.org$/.test(host))return 'telegram';
  }catch (_) {}
  return null;
}
function parisDate(value) {
  const d=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(d.getTime()))return null;
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
}
function dateFromSqlite(value) {
  const raw=String(value||'').trim().replace(' ','T');
  return new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(raw)?raw:raw+'Z');
}
function summarise(rows,now=new Date()) {
  const today=parisDate(now);
  if(!today)return {error:'clock_unavailable'};
  const days=Array.from({length:30},(_,i)=>parisDate(new Date(Date.parse(today+'T12:00:00Z')-i*86400000)));
  const bounds={today:new Set(days.slice(0,1)),week:new Set(days.slice(0,7)),month:new Set(days)};
  const totals=Object.fromEntries(SOURCES.map(s=>[s,Object.fromEntries(Object.keys(bounds).map(b=>[b,{views:0,visitorsEstimated:0,premiumClicks:0,_ids:new Set()}]))]));
  const campaigns={};
  const byDay=Object.fromEntries(days.slice(0,7).map(day=>[day,Object.fromEntries(SOURCES.map(s=>[s,0]))]));
  for(const row of rows){
    const src=classify(row.utm_source,row.referrer);if(!src)continue;
    const date=parisDate(dateFromSqlite(row.created_at));if(!date)continue;
    const event=String(row.page||'')==='/event/premium-click';
    for(const [range,set] of Object.entries(bounds)){
      if(!set.has(date))continue;
      const x=totals[src][range];
      if(event)x.premiumClicks++;
      else {
        x.views++;
        if(row.ip_hash)x._ids.add(row.ip_hash);
      }
    }
    if(!event&&byDay[date])byDay[date][src]++;
    if(bounds.month.has(date)&&!event){
      const tag=String(row.utm_campaign||'').toLowerCase().trim().slice(0,80)||'(sans campagne)';
      const key=src+':'+tag;campaigns[key]=(campaigns[key]||0)+1;
    }
  }
  const compact=Object.fromEntries(SOURCES.map(s=>[s,Object.fromEntries(Object.keys(bounds).map(b=>{
    const d=totals[s][b];return [b,{views:d.views,visitorsEstimated:d._ids.size,premiumClicks:d.premiumClicks}];
  }))]));
  return {updatedAt:now.toISOString(),timezone:'Europe/Paris',method:'IP hash estimates, not individuals; counts available tracked visits only',
    sources:compact,days:days.slice(0,7).reverse().map(day=>({day,...byDay[day]})),
    campaigns:Object.entries(campaigns).map(([key,views])=>({source:key.split(':')[0],campaign:key.slice(key.indexOf(':')+1),views})).sort((a,b)=>b.views-a.views).slice(0,10)};
}
function report(db,now=new Date()) {
  // Existing page_views table; bounded scan, only hashed proxy and sanitized campaign dimensions.
  const cutoff=new Date(now.getTime()-32*86400000).toISOString().slice(0,19).replace('T',' ');
  const rows=db.prepare(`SELECT created_at, page, utm_source, referrer, utm_campaign, ip_hash
    FROM page_views WHERE created_at >= ? ORDER BY created_at DESC`).iterate(cutoff);
  return summarise(rows,now);
}
module.exports={SOURCES,classify,parisDate,summarise,report};

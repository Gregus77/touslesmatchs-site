'use strict';
// Read-only, aggregate reporting of existing first-party page_views.
// No new cookies, personal identifiers or untrusted raw referrer fields are exposed.
const CHANNELS=['facebook','instagram','youtube','tiktok'];
const NAMES={facebook:'Facebook',instagram:'Instagram',youtube:'YouTube',tiktok:'TikTok'};
const parisDay=(date)=>{
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',year:'numeric'
  }).formatToParts(date).map(x=>[x.type,x.value]));
  return p.year+'-'+p.month+'-'+p.day;
};
const dayOffset=(day,offset)=>new Date(Date.parse(day+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);
function channelOf(row) {
  const tagged=String(row.utm_source||'').trim().toLowerCase();
  const aliases={fb:'facebook',facebook:'facebook',instagram:'instagram',ig:'instagram',
    yt:'youtube',youtube:'youtube',tiktok:'tiktok',tik_tok:'tiktok'};
  if(aliases[tagged])return aliases[tagged];
  let host='';
  try {host=new URL(String(row.referrer||'')).hostname.toLowerCase().replace(/^www\./,'');} catch {}
  // These providers' referral domains are evidence of where a browser came from.
  if(host==='facebook.com'||host.endsWith('.facebook.com')||host==='fb.com'||host.endsWith('.fb.com'))return 'facebook';
  if(host==='instagram.com'||host.endsWith('.instagram.com'))return 'instagram';
  if(host==='youtube.com'||host.endsWith('.youtube.com')||host==='youtu.be')return 'youtube';
  if(host==='tiktok.com'||host.endsWith('.tiktok.com'))return 'tiktok';
  return null;
}
function empty(){return {estimatedVisitors:0,pageViews:0};}
function accumulate(rows,now=Date.now()){
  const currentDay=parisDay(new Date(now));
  const first7=dayOffset(currentDay,-6), first30=dayOffset(currentDay,-29);
  const result={asOf:new Date(now).toISOString(),timezone:'Europe/Paris',
    periods:{today:empty(),last7:empty(),last30:empty()},channels:{},campaigns:[],
    trackingMethod:'estimatedVisitors = distinct existing daily-IP pseudonyms within the period; pageViews = tracked page loads. Not exact people or guaranteed referrals.'};
  const all=new Map(), byCampaign=new Map();
  for(const channel of CHANNELS) {
    const stats={today:empty(),last7:empty(),last30:empty()};
    result.channels[channel]={label:NAMES[channel],...stats};
  }
  const idSets={today:new Set(),last7:new Set(),last30:new Set()};
  const channelSets={};
  CHANNELS.forEach(c=>{channelSets[c]={today:new Set(),last7:new Set(),last30:new Set()};});
  for(const row of rows||[]){
    if(!row)continue;
    const page=String(row.page||'');
    // /go/tiktok is a redirect to Telegram, NOT a visit to this website.
    if(page.startsWith('/go/')||page.startsWith('/admin/')||page==='/t')continue;
    const source=channelOf(row);
    if(!source)continue;
    const raw=String(row.created_at||'').trim();
    const parsed=new Date(raw.includes('T')?raw.replace(/Z?$/,'Z'):raw.replace(' ','T')+'Z');
    if(!Number.isFinite(parsed.getTime()))continue;
    const day=parisDay(parsed);
    if(day<first30||day>currentDay)continue;
    const periods=['last30'];
    if(day>=first7)periods.push('last7');
    if(day===currentDay)periods.push('today');
    const pseudonym=String(row.ip_hash||'').trim();
    for(const period of periods) {
      result.periods[period].pageViews++;
      result.channels[source][period].pageViews++;
      if(pseudonym) {
        idSets[period].add(pseudonym);
        channelSets[source][period].add(pseudonym);
      }
    }
    const campaign=String(row.utm_campaign||'').trim().toLowerCase().slice(0,80);
    if(campaign) {
      const key=source+'\u0000'+campaign;
      if(!byCampaign.has(key))byCampaign.set(key,{source,campaign,pageViews:0,ids:new Set()});
      const c=byCampaign.get(key);c.pageViews++;
      if(pseudonym)c.ids.add(pseudonym);
    }
  }
  for(const period of ['today','last7','last30']) {
    result.periods[period].estimatedVisitors=idSets[period].size;
    for(const channel of CHANNELS)result.channels[channel][period].estimatedVisitors=channelSets[channel][period].size;
  }
  result.campaigns=[...byCampaign.values()].map(c=>({
    source:c.source,campaign:c.campaign,estimatedVisitors:c.ids.size,pageViews:c.pageViews
  })).sort((a,b)=>b.estimatedVisitors-a.estimatedVisitors||b.pageViews-a.pageViews).slice(0,12);
  return result;
}
module.exports={CHANNELS,NAMES,parisDay,channelOf,accumulate};

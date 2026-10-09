'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(__dirname,'social_traffic.inc.js'),'utf8');
const api=fs.readFileSync(path.join(__dirname,'api_server.js'),'utf8');
const dash=fs.readFileSync(path.join(root,'public/admin-dashboard.html'),'utf8');
assert(api.includes(source),'API must embed the exact tested attribution source');
assert(api.includes('analytics.socialTraffic = tlmSocialTrafficSummary(socialViews)'));
assert(api.includes("if (!isAdmin(email, code)) return res.status(403)"),'owner auth required');
assert(dash.includes('renderSocialTraffic(a.socialTraffic)'));
assert(dash.includes('data-social-copy'),'tagged social URLs must be available to the owner');
for(const page of ['app.html','performances.html'])
  assert(fs.readFileSync(path.join(root,'public',page),'utf8').includes('social-visit.js?v=20261009'),page+' missing beacon');
for(const page of ['index.html','live-ia.html'])
  assert(!fs.readFileSync(path.join(root,'public',page),'utf8').includes('social-visit.js?v=20261009'),page+' must not duplicate beacon');

const context=vm.createContext({URL,Intl,Date,Map,Set,Object,Array,String,Number});
vm.runInContext(source,context);
const call=code=>vm.runInContext(code,context);
for(const [src,ref,expected] of [
  ['facebook','','facebook'],['ig','','instagram'],['youtube','','youtube'],
  ['tiktok','','tiktok'],['telegram','','telegram'],
  ['', 'https://l.facebook.com/path?x=1','facebook'],
  ['', 'https://www.instagram.com/reel/a','instagram'],
  ['', 'https://m.youtube.com/watch?v=1','youtube'],
  ['', 'https://vm.tiktok.com/','tiktok'],
  ['', 'https://t.me/touslesmatchs','telegram'],
  ['', 'https://facebook.com.phishing.example','none'],
  ['', 'https://badfacebook.com','none'],['random','','none']
]) assert.equal(call('tlmSocialNetwork('+JSON.stringify(src)+','+JSON.stringify(ref)+')')||'none',expected,src+' / '+ref);

const NOW=Date.parse('2026-10-09T12:00:00Z');
const rows=[
 {created_at:'2026-10-09 10:00:00',utm_source:'facebook',utm_campaign:'promo1',ip_hash:'one'},
 {created_at:'2026-10-09 10:01:00',utm_source:'facebook',utm_campaign:'promo1',ip_hash:'one'},
 {created_at:'2026-10-09 10:45:00',utm_source:'facebook',utm_campaign:'promo1',ip_hash:'one'},
 {created_at:'2026-10-09 11:00:00',referrer:'https://instagram.com/',ip_hash:'two'},
 {created_at:'2026-10-09 11:10:00',utm_source:'youtube',ip_hash:'three'},
 {created_at:'2026-10-09 11:15:00',referrer:'https://www.tiktok.com/',ip_hash:'four'},
 {created_at:'2026-10-09 11:17:00',referrer:'https://t.me/',ip_hash:'five'},
 {created_at:'2026-10-09 11:19:00',referrer:'https://facebook.com.evil.com/',ip_hash:'attacker'},
 {created_at:'2026-10-08 17:00:00',utm_source:'facebook',ip_hash:'six'},
 {created_at:'2026-09-01 10:00:00',utm_source:'instagram',ip_hash:'old'}
];
context.rows=rows;context.now=NOW;
const result=call('tlmSocialTrafficSummary(rows,now)');
const fb=result.networks.find(x=>x.network==='facebook');
assert.equal(result.today,'2026-10-09');
assert.equal(fb.eventsToday,2,'same visitor 45 minutes later starts another visit');
assert.equal(fb.visitorsTodayEstimated,1);
assert.equal(fb.events7d,3);
assert.equal(result.total.arrivalsToday,6);
assert.equal(result.total.arrivals30d,7);
assert.equal(result.trend.length,7);
assert(result.campaigns.some(x=>x.network==='facebook'&&x.campaign==='promo1'&&x.arrivals===2));
assert(!JSON.stringify(result).includes('one'),'raw identifiers cannot be returned');
assert(!JSON.stringify(result).includes('attacker'));
console.log('SOCIAL_TRAFFIC_ATTRIBUTION_OK');

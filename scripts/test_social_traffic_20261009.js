'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const traffic=require('./social_traffic_analytics');
const now=Date.parse('2026-10-09T17:30:00Z');
const row=(src,id,when,extra={})=>({
  page:'/',utm_source:src,ip_hash:id,created_at:when,referrer:'',utm_campaign:'',...extra
});
const rows=[
 row('instagram','person-a','2026-10-09 15:10:00',{utm_campaign:'goal05_oct09'}),
 row('instagram','person-a','2026-10-09 15:12:00',{page:'/app'}),
 row('facebook','person-b','2026-10-09 15:12:00',{utm_campaign:'goal05_oct09'}),
 row('','person-c','2026-10-09 12:30:00',{referrer:'https://l.facebook.com/l.php?redirect=1'}),
 row('','person-d','2026-10-08 23:30:00',{referrer:'https://youtube.com/watch?v=abc'}),
 row('tiktok','person-e','2026-10-01 12:00:00'),
 row('facebook','person-f','2026-09-01 12:00:00'),
 row('facebook','person-g','2026-10-09 16:00:00',{page:'/go/tiktok'}),
 row('','person-h','2026-10-09 12:00:00',{referrer:'https://fakefacebook.com/test'}),
 row('unknown','person-i','2026-10-09 12:00:00'),
 row('Instagram','person-j','2026-10-09 16:05:00',{page:'/performances'}),
];
assert.equal(traffic.channelOf({utm_source:'YT'}),'youtube');
assert.equal(traffic.channelOf({referrer:'https://m.tiktok.com/t/xyz'}),'tiktok');
assert.equal(traffic.channelOf({referrer:'https://fakefacebook.com'}),null);
const result=traffic.accumulate(rows,now);
assert.equal(result.periods.today.estimatedVisitors,5);
assert.equal(result.periods.today.pageViews,6);
assert.equal(result.channels.instagram.today.estimatedVisitors,2);
assert.equal(result.channels.instagram.today.pageViews,3);
assert.equal(result.channels.facebook.today.estimatedVisitors,2);
assert.equal(result.channels.youtube.today.estimatedVisitors,1);
assert.equal(result.channels.tiktok.last7.estimatedVisitors,0);
assert.equal(result.channels.tiktok.last30.estimatedVisitors,1);
assert.equal(result.periods.last30.estimatedVisitors,6);
assert(result.campaigns.some(c=>c.source==='instagram'&&c.campaign==='goal05_oct09'));
assert(!JSON.stringify(result).includes('person-a'),'never expose pseudonyms from aggregate');
const api=fs.readFileSync(path.join(__dirname,'api_server.js'),'utf8');
const docker=fs.readFileSync(path.join(__dirname,'..','Dockerfile.api'),'utf8');
const admin=fs.readFileSync(path.join(__dirname,'..','public','admin-dashboard.html'),'utf8');
for(const marker of ['require("./social_traffic_analytics")','socialTrafficAnalytics.accumulate(visits)','analytics, socialTraffic, pronostics'])
  assert(api.includes(marker),'missing API integration '+marker);
assert(docker.includes('COPY scripts/social_traffic_analytics.js ./social_traffic_analytics.js'));
assert(admin.includes('Réseaux sociaux → Visites du site'));
assert(admin.includes('socialTrafficContent'));
for(const page of ['app.html','performances.html'])
  assert(fs.readFileSync(path.join(__dirname,'..','public',page),'utf8').includes('/js/social-traffic-tracker.js'));
console.log('SOCIAL_TRAFFIC_COUNTS_AND_DASHBOARD_OK');

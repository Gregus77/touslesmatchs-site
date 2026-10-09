'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const traffic=require('./social_attribution');
const root=path.resolve(__dirname,'..');
assert.equal(traffic.classify('instagram',''),'instagram');
assert.equal(traffic.classify('youtube',''),'youtube');
assert.equal(traffic.classify('', 'https://l.instagram.com/?u=anything'),'instagram');
assert.equal(traffic.classify('', 'https://m.facebook.com/post'),'facebook');
assert.equal(traffic.classify('', 'https://youtube.com/watch?v=1'),'youtube');
assert.equal(traffic.classify('partner','https://instagram.com'),null);
assert.equal(traffic.classify('','https://untrusted.com'),null);
const now=new Date('2026-10-09T15:00:00.000Z');
const row=(created_at,source,ip_hash,page='/',referrer='',utm_campaign='goal05')=>({
  created_at,utm_source:source,ip_hash,page,referrer,utm_campaign
});
const rows=[
  row('2026-10-09 14:00:00','instagram','a'),
  row('2026-10-09 14:10:00','instagram','a','/app'),
  row('2026-10-09 14:15:00','instagram','a','/event/premium-click'),
  row('2026-10-09 15:00:00','facebook','b'),
  row('2026-10-08 22:10:00','youtube','c'),
  row('2026-09-01 12:00:00','facebook','old'),
  row('2026-10-09 14:03:00','','d','/', 'https://l.instagram.com/post'),
  row('2026-10-09 14:03:00','not-social','z','/','https://l.instagram.com/post'),
];
const result=traffic.summarise(rows,now);
assert.equal(result.sources.instagram.today.views,3);
assert.equal(result.sources.instagram.today.visitorsEstimated,2);
assert.equal(result.sources.instagram.today.premiumClicks,1);
assert.equal(result.sources.facebook.today.views,1);
assert.equal(result.sources.youtube.today.views,0);
assert.equal(result.sources.youtube.week.views,1);
assert.equal(result.sources.facebook.month.views,1);
assert.equal(result.sources.tiktok.today.views,0);
assert.equal(result.days.length,7);
assert.equal(result.campaigns[0].source,'instagram');
const fakeDB={prepare(sql){assert.match(sql,/page_views/);return {iterate(date){assert.match(date,/2026-09/);return rows;}}}};
assert.equal(traffic.report(fakeDB,now).sources.instagram.today.views,3);
const web=fs.readFileSync(path.join(root,'public/js/social-attribution.js'),'utf8');
new Function(web);
assert.match(web,/sessionStorage/);
assert.match(web,/utm_source/);
assert.match(web,/premium-click/);
for(const file of ['public/index.html','public/live-ia.html','public/app.html']){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  assert.match(html,/<script src="\/js\/social-attribution\.js\?v=20261009-1"><\/script>/);
  assert.doesNotMatch(html,/new Image\(\)\.src='\/api\/t\?p='/);
}
const api=fs.readFileSync(path.join(root,'scripts/api_server.js'),'utf8');
const docker=fs.readFileSync(path.join(root,'Dockerfile.api'),'utf8');
const dashboard=fs.readFileSync(path.join(root,'public/admin-dashboard.html'),'utf8');
assert.match(api,/const socialAttribution = require\("\.\/social_attribution"\)/);
assert.match(api,/socialAcquisition=socialAttribution\.report\(db\)/);
assert.match(docker,/COPY scripts\/social_attribution\.js/);
assert.match(dashboard,/socialAcquisitionContent/);
console.log('SOCIAL_ATTRIBUTION_VISITOR_COUNTER_OK');

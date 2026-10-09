'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const script=fs.readFileSync(path.join(root,'public/js/social-source-session.js'),'utf8');
new Function(script);
const store=new Map();
const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
function run(search,referrer=''){
  const window={location:{search},tlmSourceAttribution:null};
  const context=vm.createContext({window,document:{referrer},sessionStorage:storage,URLSearchParams,URL,Date,JSON});
  vm.runInContext(script,context);
  return window.tlmSourceAttribution;
}
let current=run('?utm_source=instagram&utm_medium=organic_social&utm_campaign=match_fr');
assert.equal(current.source,'instagram');
assert.equal(current.campaign,'match_fr');
current=run('', 'https://www.touslesmatchs.com/');
assert.equal(current.source,'instagram','Internal navigation must keep the first social origin');
current=run('?utm_source=facebook&utm_campaign=other');
assert.equal(current.source,'facebook','New explicit campaign must replace previous');
current=run('?utm_source=unknown', 'https://instagram.com/');
assert.equal(current.source,'','Explicit unknown campaign cannot inherit previous source');
current=run('','https://youtu.be/abc');
assert.equal(current.source,'youtube');
assert.equal(run('','https://youtube.com.evil.site/').source,'','Reject forged referrer host');

for(const htmlPath of ['public/index.html','public/live-ia.html','public/app.html','public/performances.html']){
  const html=fs.readFileSync(path.join(root,htmlPath),'utf8');
  assert(html.includes('social-source-session.js?v=20261009-1'),htmlPath+' is not instrumented');
  assert(html.indexOf('social-source-session.js?v=20261009-1')<html.indexOf('</head>'),htmlPath+' must load source before URL cleanup');
}
for(const htmlPath of ['public/index.html','public/live-ia.html']){
  const html=fs.readFileSync(path.join(root,htmlPath),'utf8');
  const i=html.indexOf("new Image().src='/api/t?p=");
  assert(i>=0,'must keep existing beacon '+htmlPath);
  assert(html.slice(i,i+500).includes('social.source'),'Beacon must use first-touch source '+htmlPath);
}
const visit=fs.readFileSync(path.join(root,'public/js/social-visit.js'),'utf8');
assert(visit.includes('window.tlmSourceAttribution'));
assert(visit.includes('social.source'));
console.log('SOCIAL_SOURCE_SESSION_RETENTION_OK');

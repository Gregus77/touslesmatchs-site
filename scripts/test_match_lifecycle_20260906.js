'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const life=require('../public/js/match-lifecycle.js');
for(const minute of [15,25,45,"45'"]){assert(life.canFeature({minute,status:'IN_PLAY'}));}
for(const minute of [46,90,'90+4','45+1',null,undefined,'unknown']){assert(!life.canFeature({minute,status:'IN_PLAY'}),String(minute));}
for(const status of ['FT','AET','PEN','HT','2H','PST','CANC','ABD',{short:'FT',elapsed:25}])assert(!life.canFeature({minute:25,status}));
assert.equal(life.phase({minute:90,status:'IN_PLAY'}),'closed');
assert(life.canTrack({minute:90,status:'IN_PLAY'}));
assert(!life.canTrack({minute:90,status:'FT'}));
assert.equal(life.phase({minute:90,status:'FT'}),'finished');
assert(!life.canFeature({minute:25,stale:true}));
assert(!life.canFeature({minute:25,ou25:{window_status:'closed'}}));
assert(life.canFeature({minute:12}));
// The same lifecycle contract is loaded before either page's application code.
for(const name of ['index','app']){
 const html=fs.readFileSync(__dirname+'/../public/'+name+'.html','utf8');
 assert(html.indexOf('/js/match-lifecycle.js')<html.indexOf('TLMMatchLifecycle.canFeature'));
 assert(html.includes('TLMMatchLifecycle.canFeature'));
 assert(html.includes('.filter(TLMMatchLifecycle.canTrack)'));
 // Parse each executable inline script to catch integration errors.
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
   if(/src=|application\/ld\+json|x-disabled/i.test(match[1]))continue;
   new vm.Script(match[2],{filename:name+'.html'});
 }
}
const html=fs.readFileSync(__dirname+'/../public/index.html','utf8');
function part(a,b){return html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));}
const ctx=vm.createContext({TLMMatchLifecycle:life});
vm.runInContext(part('function heroOu25(','function heroWasSent('),ctx);
vm.runInContext(part('function tlmHeroMinuteOf(','function tlmHomepageAnalyzedMatch('),ctx);
const old={id:'Fluminense',minute:90,status:'IN_PLAY',ou25:{vote_count:4,consensus_count:4,window_status:'closed'}};
const live={id:'eligible',minute:25,status:'IN_PLAY',ou25:{vote_count:0,consensus_count:0,window_status:'open'}};
const rows=[old,live];
assert.equal(rows.slice().sort(ctx.compareHeroMatches)[0].id,'Fluminense');
assert.deepEqual(rows.filter(life.canFeature).map(m=>m.id),['eligible']);
assert.equal([old].filter(life.canFeature).length,0);
assert.equal(old.ou25.vote_count,4); // No deletion of historical votes or results.
console.log('OK: site/app lifecycle, 15–45 inclusive, votes antérieurs suivis après 45, terminal statuses, stale data and no false final result');

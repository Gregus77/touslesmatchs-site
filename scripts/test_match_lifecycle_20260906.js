'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const life=require('../public/js/match-lifecycle.js');

for(const minute of [1,15,25,29])assert.equal(life.phase({minute,status:'IN_PLAY'}),'waiting',String(minute));
for(const minute of [30,45,46,60,85,"85'"])assert.equal(life.phase({minute,status:'IN_PLAY'}),'open',String(minute));
for(const minute of [86,90,'90+4'])assert.equal(life.phase({minute,status:'IN_PLAY'}),'closed',String(minute));
for(const minute of [1,15,25,29,30,45,46,60,85])assert(life.canFeature({minute,status:'IN_PLAY'}),String(minute));
for(const minute of [86,90,'90+4',null,undefined,'unknown'])assert(!life.canFeature({minute,status:'IN_PLAY'}),String(minute));
for(const status of ['FT','AET','PEN','PST','CANC','ABD',{short:'FT',elapsed:60}])assert(!life.canFeature({minute:60,status}));
assert(life.canFeature({minute:45,status:'HT'}));
assert(life.canFeature({minute:60,status:'2H'}));
assert.equal(life.phase({minute:90,status:'IN_PLAY'}),'closed');
assert(life.canTrack({minute:90,status:'IN_PLAY'}));
assert(!life.canTrack({minute:90,status:'FT'}));
assert.equal(life.phase({minute:90,status:'FT'}),'finished');
assert(!life.canFeature({minute:60,stale:true}));
assert(life.canFeature({minute:60,status:'2H',ou25:{window_status:'closed'}}));
assert.equal(life.statusText({minute:25,status:'IN_PLAY',ou25:{}}),'Analyse en cours — décision à partir de la 30e minute');
assert(!/Over|Under|2,5/.test(life.marketText({minute:60,status:'2H',ou25:{votes:[{status:'voted'}],consensus_count:4,official:true,official_confidence:82}})));

// The same lifecycle contract is loaded before either page's application code.
for(const name of ['index','app']){
 const html=fs.readFileSync(__dirname+'/../public/'+name+'.html','utf8');
 assert(html.indexOf('/js/match-lifecycle.js')<html.indexOf('TLMMatchLifecycle.canFeature'));
 assert(html.includes('TLMMatchLifecycle.canFeature'));
 assert(html.includes('TLMMatchLifecycle.phase') || html.includes('TLMMatchLifecycle.canTrack') || html.includes('appMatchTrackable'));
 // Parse each executable inline script to catch integration errors.
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
   if(/src=|application\/ld\+json|x-disabled/i.test(match[1]))continue;
   new vm.Script(match[2],{filename:name+'.html'});
 }
}
const old={id:'Fluminense',minute:90,status:'IN_PLAY',ou25:{vote_count:4,consensus_count:4,window_status:'closed'}};
const waiting={id:'waiting',minute:25,status:'IN_PLAY',ou25:{vote_count:0,consensus_count:0,window_status:'open'}};
const active={id:'active',minute:60,status:'2H',ou25:{vote_count:0,consensus_count:0,window_status:'closed'}};
assert.deepEqual([old,waiting,active].filter(life.canFeature).map(m=>m.id),['waiting','active']);
assert.equal([old].filter(life.canFeature).length,0);
assert.equal(old.ou25.vote_count,4); // No deletion of historical votes or results.
console.log('OK: site/app lifecycle, Goal05 30–85 active, pre-30 waiting, second half supported, legacy votes preserved without legacy labels');

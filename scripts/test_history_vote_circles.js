'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.join(__dirname,'..');
const api=fs.readFileSync(path.join(root,'scripts/api_server.js'),'utf8');
function extract(s,name){const start=s.indexOf('function '+name+'(');assert(start>=0,name);const tail=s.slice(start); const first=tail.split('\n')[0];if(first.endsWith('}'))return first; const indent=s.slice(s.lastIndexOf('\n',start)+1,start);const closing=new RegExp('\\n'+indent+'\\}').exec(tail);assert(closing,name);return tail.slice(0,closing.index+closing[0].length);}
const snapshot={id:'historical',minute:33,score_home:0,score_away:1,created_at:'2026-09-12T20:35:00Z',votes_json:JSON.stringify(['over','under','over',null,'over'].map(direction=>({status:direction?'voted':'pending',direction}))),seat_statuses_json:JSON.stringify(['voted','voted','voted','pending','voted'])};
const ctx={db:{prepare:()=>({get:()=>null})}};vm.createContext(ctx);vm.runInContext(extract(api,'historyOu25Votes'),ctx);
const paid=ctx.historyOu25Votes({},snapshot,true),free=ctx.historyOu25Votes({},snapshot,false);
assert.deepEqual(Array.from(paid.votes,v=>v.direction),['over','under','over',null,'over']);assert(free.votes.every(v=>v.direction===null));assert.equal(free.vote_count,4);
assert(ctx.historyOu25Votes({},null,true).votes.every(v=>v.status==='pending'));
for(const [file,names,render] of [['index.html',['heroOu25','tlmVotesAreOld','tlmVoteCirclesHtml'],'tlmVoteCirclesHtml'],['app.html',['appOu25','appVoteTime','appMiniVotes'],'appMiniVotes']]){
 const s=fs.readFileSync(path.join(root,'public',file),'utf8');
 const c={esc:String,TLMMatchLifecycle:{phase:()=> 'finished'}};vm.createContext(c);
 for(const name of names){let src;if(name==='appOu25'){src=s.split('\n').find(l=>l.includes('function appOu25(')).trim();}else src=extract(s,name);vm.runInContext(src,c);}
 for(const [state,expected] of [[paid,['O','U','O','4','O']],[free,['?','?','?','4','?']]]){
  const html=c[render]({ou25:state,status:'FINISHED'});const marks=Array.from(html.matchAll(/<span class="(?:tlm-row-vote(?: |")|tlm-app-live-mini-vote )[^>]*>([^<]*)<\/span>/g),m=>m[1]);assert.deepEqual(marks,expected,file);}
 // Parse every inline script: no browser, network, or analysis side effect.
 for(const m of s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/src=|application\/ld\+json|application\/json/.test(m[1]))continue;new vm.Script(m[2],{filename:file});}
}
assert(api.includes('if (paidGoal05Account(req)) isPaidViewer = true;'));
console.log('PASS history: exact snapshot, Premium O/U, free masking, missing seats, both renderers and inline syntax');

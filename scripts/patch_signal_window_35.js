'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('node:assert/strict');
const files=['scripts/api_server.js','scripts/live_state_coherence.js','scripts/official_signal_snapshots.js','scripts/first_half_delivery.js','public/js/match-lifecycle.js','public/index.html','public/live-ia.html'];
function patch(root,desired,baseline){
 const staged=[];
 for(const file of files){
  const read=dir=>fs.readFileSync(path.join(dir,file),'utf8').replace(/\r\n/g,'\n');
  const old=read(baseline),next=read(desired);let live=read(root);
  if(file==='public/index.html'){
   // The served homepage has a newer decisionText verdict. Preserve it; only
   // change these independently inspected window literals, never its verdict.
   for(const [a,b] of [
    ['Aucun match dans la fenêtre 15–45 min','Aucun match entre la 35e minute et la fin de première mi-temps'],
    ["var analysisClosed=!TLMMatchLifecycle.canFeature(m)||voteState.windowStatus==='closed'||(isFinite(minute)&&minute>(tlmSignalWindowEnd||45));","var analysisClosed=!TLMMatchLifecycle.canFeature(m)||voteState.windowStatus==='closed';"],
    ["var analysisWaiting=voteState.windowStatus==='waiting'||(isFinite(minute)&&minute>0&&minute<15);","var analysisWaiting=voteState.windowStatus==='waiting'||(isFinite(minute)&&minute>0&&minute<35);"],
    ['À partir de la 15e minute','À partir de la 35e minute']
   ]){if(live.includes(b)&&!live.includes(a))continue;assert.equal(live.split(a).length,2,'Ambiguous homepage window literal');live=live.replace(a,b);}
   staged.push([path.join(root,file),live]);continue;
  }
  if(old===next){continue;}
  let diff;
  try{diff=cp.execFileSync('git',['diff','--no-index','--no-ext-diff','--unified=3',path.join(baseline,file),path.join(desired,file)],{encoding:'utf8'});}
  catch(e){if(e.status!==1)throw e;diff=e.stdout;}
  let before=[],after=[],inside=false;
  const apply=()=>{if(!inside)return;const a=before.join('\n')+'\n',b=after.join('\n')+'\n';
   if(live.includes(b)&&!live.includes(a))return;
   assert.equal(live.split(a).length,2,`Production changed or ambiguous patch: ${file}`);live=live.replace(a,b);};
  for(const line of diff.replace(/\r\n/g,'\n').split('\n')){
   if(line.startsWith('@@ ')){apply();before=[];after=[];inside=true;continue;}
   if(!inside)continue;
   if(line.startsWith(' ')){before.push(line.slice(1));after.push(line.slice(1));}
   else if(line.startsWith('-'))before.push(line.slice(1));
   else if(line.startsWith('+'))after.push(line.slice(1));
  }
  apply();staged.push([path.join(root,file),live]);
 }
 for(const [file,data] of staged)fs.writeFileSync(file,data);
 console.log('SIGNAL_WINDOW_PATCH_OK');
}
if(require.main===module)patch(process.argv[2],process.argv[3],process.argv[4]);
module.exports={patch,files};

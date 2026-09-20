'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('node:assert/strict');
const files=['public/js/match-lifecycle.js','public/index.html','public/app.html','public/live-ia.html'];
function patch(root,desired,baseline){
 const staged=[];
 for(const file of files){
  let live=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'),diff;
  const next=fs.readFileSync(path.join(desired,file),'utf8').replace(/\r\n/g,'\n');
  const replace=(a,b)=>{if(live.includes(b))return;assert.equal(live.split(a).length,2,`Missing inspected token: ${file}: ${a.slice(0,70)}`);live=live.replace(a,b);};
  // Production contains newer provider-status and delivery-proof presentation.
  // Preserve those variants; only replace independently inspected entry tokens.
  if(file==='public/app.html'){
   replace('/js/match-lifecycle.js?v=20260907-integral6','/js/match-lifecycle.js?v=20260920-entry-closed');
   replace("(state.official?'':' old')","(state.official&&!TLMMatchLifecycle.entryClosed(m)?'':' old')");
   replace("return '<span class=\"tlm-app-live-vote-summary\">'","return TLMMatchLifecycle.entryNoticeHtml(m)+'<span class=\"tlm-app-live-vote-summary\">'");
   replace('var analysisClosed=!TLMMatchLifecycle.canFeature(m);','var analysisClosed=TLMMatchLifecycle.entryClosed(m)||!TLMMatchLifecycle.canFeature(m);');
   const marker='  function applyAppEntryClosure(m){';
   if(!live.includes(marker)){
    const start=live.indexOf('  function renderAppHero(m){'),end=live.indexOf('  function loadLive()',start),close=live.lastIndexOf('  }',end);
    assert(start>=0&&end>start&&close>start);live=live.slice(0,close)+'    applyAppEntryClosure(m);\n'+live.slice(close);
    const helper=next.slice(next.indexOf(marker),next.indexOf('  function loadLive()',next.indexOf(marker)));
    replace('  function loadLive()',helper+'  function loadLive()');
   }
   const anchor="if(preservedClock)preservedAt+=' à '+preservedClock;";
   replace(anchor,anchor+"\n    if(TLMMatchLifecycle.entryClosed(m))$(\"app-ai-label\").textContent='Analyse historique — entrée fermée';");
   staged.push([path.join(root,file),live]);continue;
  }
  if(file==='public/live-ia.html'){
   const script='<script src="/js/match-lifecycle.js?v=20260920-entry-closed"></script>';
   if(!live.includes(script))replace('</head>',script+'\n</head>');
   replace('  var state = liveOu25State(m);','  var state = liveOu25State(m);\n  var entryClosed=TLMMatchLifecycle.entryClosed(m);');
   replace("(state.official?'':' old')","(state.official&&!entryClosed?'':' old')");
   replace("return '<details class=\"mc-vote-details\"","return TLMMatchLifecycle.entryNoticeHtml(m)+'<details class=\"mc-vote-details\"");
   replace('<span>Conseil IA · Over/Under 2,5</span>',"<span>'+(entryClosed?'Analyse historique':'Conseil IA')+' · Over/Under 2,5</span>");
   if(live.includes("(state.official ? ' valid' : '')"))replace("(state.official ? ' valid' : '')","(state.official&&!entryClosed ? ' valid' : '')");
   else if(live.includes('var consensusClass ='))replace('var consensusClass = state.official','var consensusClass = entryClosed?\'\':state.official');
   replace('if (m.analysable === false) {','if (m.analysable === false || TLMMatchLifecycle.entryClosed(m)) {');
   replace('escHtml(m.analysis_exclusion_reason || m.block_reason || "Pas encore de signal exploitable sur ce match.")','escHtml(TLMMatchLifecycle.entryClosed(m)?"Entrée fermée — analyse conservée pour le bilan, aucune nouvelle entrée.":m.analysis_exclusion_reason || m.block_reason || "Pas encore de signal exploitable sur ce match.")');
   staged.push([path.join(root,file),live]);continue;
  }
  try{diff=cp.execFileSync('git',['diff','--no-index','--no-ext-diff','--unified=1',path.join(baseline,file),path.join(desired,file)],{encoding:'utf8'});}
  catch(e){if(e.status!==1)throw e;diff=e.stdout;}
  let before=[],after=[],inside=false;
  const apply=()=>{if(!inside)return;const a=before.join('\n')+'\n',b=after.join('\n')+'\n';
   if(live.includes(b)&&!live.includes(a))return;
   if(file==='public/index.html'&&a.includes("voteEls[i].classList.toggle('old',voted&&!voteState.official);")){
    replace("voteEls[i].classList.toggle('old',voted&&!voteState.official);","voteEls[i].classList.toggle('old',voted&&(!voteState.official||TLMMatchLifecycle.entryClosed(m)));");return;
   }
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
 console.log('CLOSED_DISPLAY_PATCH_OK');
}
if(require.main===module)patch(process.argv[2],process.argv[3],process.argv[4]);
module.exports={patch,files};

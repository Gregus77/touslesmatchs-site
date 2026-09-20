'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('node:assert/strict');
const files=['public/js/match-lifecycle.js','public/index.html','public/app.html','public/live-ia.html'];
function patch(root,desired,baseline){
 const staged=[];
 for(const file of files){
  let live=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'),diff;
  try{diff=cp.execFileSync('git',['diff','--no-index','--no-ext-diff','--unified=1',path.join(baseline,file),path.join(desired,file)],{encoding:'utf8'});}
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
 console.log('CLOSED_DISPLAY_PATCH_OK');
}
if(require.main===module)patch(process.argv[2],process.argv[3],process.argv[4]);
module.exports={patch,files};

'use strict';
function patch(source){
 const old='<a href="#tlm-panel-live" class="btn btn-prim">Voir les analyses</a>';
 const next='<a href="/live-ia" class="btn btn-prim">Voir les analyses</a>';
 const oldCount=source.split(old).length-1,newCount=source.split(next).length-1;
 if(oldCount===0&&newCount===1)return source;
 if(oldCount!==1||newCount!==0)throw Error('HOME_LINK_ANCHOR_AMBIGUOUS');
 return source.replace(old,next);
}
module.exports=patch;
if(require.main===module){const fs=require('fs'),file=process.argv[2];fs.writeFileSync(file,patch(fs.readFileSync(file,'utf8')));}

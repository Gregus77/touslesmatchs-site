const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
// Offline regression for the complete operator smoke script; no secrets/network.
async function check(source,expectedPosts){
 const files=new Map([['/opt/touslesmatchs/.env',"TYPESAFE_API_KEY='mock-secret'"],['/opt/touslesmatchs/data/audits/2026-09-24-jev-production/authenticated-check.json','{"ok":false}']]);
 const mockfs={readFileSync:p=>files.get(p),existsSync:p=>files.has(p),writeFileSync:(p,v,o)=>{if(o?.flag==='wx'&&files.has(p))throw Error('exists');files.set(p,v);}};
 let gets=0,posts=0;
 const req=p=>p==='node:fs'?mockfs:p==='node:path'?path:p==='./jev_decision_engine'?require('./jev_decision_engine'):null;
 const context={require:req,module:{exports:{}},__dirname:'/opt/touslesmatchs/scripts',process:{argv:['node','verify','--authorized-second-attempt']},console:{log(){}},Date,AbortSignal,
 fetch:async(url,options)=>{if(options?.method==='POST'){posts++;return{ok:true,status:200,json:async()=>({model:'jev-resolved-test',answers:{production_decision:{type:'choice',choice:'REJECT',confidence:0.9,probabilities:{SEND:0.03,WAIT:0.03,REANALYZE:0.04,REJECT:0.9}}},usage:{input_tokens:20,output_tokens:5}})};}gets++;return{ok:true,status:200,json:async()=>({models:[{name:'jev-latest',release_date:'2026-09-10'}]})};}};
 await vm.runInNewContext(source+'\nmain()',context);
 assert.equal(posts,expectedPosts);const receipt=JSON.parse(files.get('/opt/touslesmatchs/data/audits/2026-09-24-jev-production/authenticated-check-attempt-2.json'));
 if(expectedPosts)assert.equal(receipt.ok,true);else assert.equal(receipt.http_status,null);
 const beforePosts=posts;await vm.runInNewContext('main()',context);assert.equal(posts,beforePosts);
 console.log(JSON.stringify({gets,posts,validated:receipt.ok,repeated_execution_blocked:true,real_network:false}));
}
check(fs.readFileSync(require.resolve('./verify_jev_api'),'utf8'),1).catch(e=>{console.error(e);process.exitCode=1});

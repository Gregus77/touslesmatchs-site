'use strict';
// Explicit operator-only smoke check. Never imported by the production server.
// One POST maximum, guarded by a durable exclusive receipt before network I/O.
const fs = require('node:fs');
const path = require('node:path');
const {validateResponse} = require('./jev_decision_engine');
const root = path.resolve(__dirname,'..');
const evidence = path.join(root,'data/audits/2026-09-24-jev-production');
function readKey() {
  const line = fs.readFileSync(path.join(root,'.env'),'utf8').split(/\r?\n/).find(x=>x.startsWith('TYPESAFE_API_KEY='));
  let value = line?.slice('TYPESAFE_API_KEY='.length).trim() || '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value=value.slice(1,-1);
  return value;
}
function save(name,data) {fs.writeFileSync(path.join(evidence,name),JSON.stringify(data,null,2)+'\n',{mode:0o600});}
async function main() {
  const key=readKey();
  if (!key) {console.log('TYPESAFE_API_KEY absente : aucun appel réseau.');process.exitCode=2;return;}
  const receiptPath=path.join(evidence,'authenticated-check.json');
  if(fs.existsSync(receiptPath)) {
    console.log('Contrôle déjà tenté : reçu conservé, aucun nouvel appel payant.');
    process.exitCode=JSON.parse(fs.readFileSync(receiptPath,'utf8')).ok ? 0 : 3;return;
  }
  const headers={Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  const response=await fetch('https://api.typesafe.ai/v1/models',{headers,redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok) {save('models-check.json',{ok:false,http_status:response.status});console.log(`Modèles : HTTP ${response.status}; aucun POST.`);process.exitCode=3;return;}
  const result=await response.json();
  if(!Array.isArray(result.models) || result.models.some(x=>typeof x.name!=='string' || !/^[a-zA-Z0-9._:/-]{1,160}$/.test(x.name))) throw new Error('invalid_models_schema');
  const models=result.models.map(x=>({name:x.name,release_date:x.release_date}));
  save('models-check.json',{ok:true,http_status:response.status,models,checked_at:new Date().toISOString()});
  const available=models.filter(x=>/jev/i.test(x.name));
  available.sort((a,b)=>Number(/latest|alias/i.test(a.name))-Number(/latest|alias/i.test(b.name)) || String(b.release_date).localeCompare(String(a.release_date)) || a.name.localeCompare(b.name));
  const model=available[0]?.name;
  if(!model) {console.log('Aucun modèle Jev retourné par le compte : aucun POST.');process.exitCode=3;return;}
  console.log(JSON.stringify({models:models.map(x=>x.name),selected_model:model}));
  const body={model,state:{integration_check:true,live_match:false,publish_allowed:false},questions:{production_decision:{type:'choice',
    instructions:'Connectivity and schema check only. There is no match and no publication is permitted. Select REJECT.',
    criteria:{SEND:'An actual match has converging evidence.',WAIT:'An actual live match needs observation.',REANALYZE:'An actual live match needs another analysis.',REJECT:'No match is provided or publication is not permitted.'}}}};
  // Never remove this claim to retry after a timeout: the first request may have been billed.
  fs.writeFileSync(receiptPath,JSON.stringify({ok:false,status:'post_started',model,started_at:new Date().toISOString()}),{flag:'wx',mode:0o600});
  const started=Date.now();let status=null;
  try {
    const r=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers,redirect:'error',body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    status=r.status;
    if(!r.ok) throw new Error(`http_${status}`);
    const answer=validateResponse(await r.json(),models.map(x=>x.name));
    const latency=Date.now()-started;
    const receipt={ok:true,http_status:status,requested_model:model,returned_model:answer.model,
      choice:answer.choice,confidence:answer.confidence,probabilities:answer.probabilities,
      input_tokens:answer.input_tokens,output_tokens:answer.output_tokens,latency_ms:latency,
      recommended_timeout_ms:Math.min(20000,Math.max(8000,Math.ceil(latency*3/1000)*1000)),
      completed_at:new Date().toISOString(),purpose:'network_schema_check_only',production_decision_persisted:false};
    save('authenticated-check.json',receipt);console.log(JSON.stringify(receipt));
  } catch(e) {
    const category=e.category || (/^http_\d+$/.test(e.message)?e.message:e.name==='TimeoutError'?'timeout':'network_or_schema_error');
    save('authenticated-check.json',{ok:false,http_status:status,model,error_category:category,latency_ms:Date.now()-started});
    console.log(`Échec expurgé : ${category}. Aucun second POST.`);process.exitCode=3;
  }
}
main().catch(()=>{console.log('Contrôle interrompu : erreur réseau ou schéma. Aucun détail sensible affiché.');process.exitCode=3;});

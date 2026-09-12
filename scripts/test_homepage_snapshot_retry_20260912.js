'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const api=fs.readFileSync(__dirname+'/api_server.js','utf8');
function part(a,b){const start=api.indexOf(a),end=api.indexOf(b,start+a.length);assert(start>=0&&end>start);return api.slice(start,end);}

const seats=['Perplexity-Web','DeepSeek-V3','Mistral-Large','Cohere-Command','OpenRouter-Qwen'];
let valid=[],attempts=[];
const db={prepare(sql){return {all(){return sql.includes('SELECT agent_name FROM agent_predictions')?valid:attempts;}}}};
const retryCtx=vm.createContext({db,CONCILE_AGENT_NAMES:seats,getPredictionSnapshotKey:()=> 'fixture_day_30_0-0',console});
vm.runInContext(part('const AUTO_CONCILE_MAX_ATTEMPTS_PER_SEAT', '// ── Filtre ARJEL AVANT analyse'),retryCtx);

// Un intrus ou un marché différent n'apparaît pas dans la requête filtrée :
// le Concile doit refaire une tentative au lieu de considérer le snapshot fini.
valid=[];attempts=[];
assert.equal(retryCtx.hasPredictionSnapshot({}),false);
valid=seats.slice(0,4).map(agent_name=>({agent_name}));
attempts=[{agent_name:seats[4],attempts:1}];
assert.equal(retryCtx.hasPredictionSnapshot({}),false);
valid=seats.map(agent_name=>({agent_name}));
assert.equal(retryCtx.hasPredictionSnapshot({}),true);
valid=seats.slice(0,4).map(agent_name=>({agent_name}));
attempts=[{agent_name:seats[4],attempts:2}];
assert.equal(retryCtx.hasPredictionSnapshot({}),true);

const visibilityCtx=vm.createContext({
  CLIENT_OU25_CLIENT_MAX_MINUTE:45,
  isClientOu25MatchEligible:m=>Number(m.minute_at_analysis??m.minute)>=15&&Number(m.minute_at_analysis??m.minute)<=45,
});
vm.runInContext(part('function clientOu25VisibilityEligibility(', '// ── Live matches'),visibilityCtx);
assert.deepEqual(
  JSON.parse(JSON.stringify(visibilityCtx.clientOu25VisibilityEligibility({minute:68},{snapshot_minute:31}))),
  {accepting:false,product:true,preserved:true}
);
assert.deepEqual(
  JSON.parse(JSON.stringify(visibilityCtx.clientOu25VisibilityEligibility({minute:68},{snapshot_minute:null}))),
  {accepting:false,product:false,preserved:false}
);
console.log('OK: snapshot incomplet relancé au plus deux fois et votes vérifiés conservés après 45 minutes');

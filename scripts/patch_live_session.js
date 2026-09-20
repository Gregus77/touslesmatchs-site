'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
function part(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert(i>=0&&j>i,`Missing section ${a}`);return s.slice(i,j);}
function once(s,a,b){if(s.includes(b))return s;assert.equal(s.split(a).length,2,`Ambiguous anchor ${a.slice(0,80)}`);return s.replace(a,b);}
function patch(root,desired,baseline){
  const read=(base,f)=>fs.readFileSync(path.join(base,f),'utf8').replace(/\r\n/g,'\n');
  const apiPath='scripts/api_server.js',htmlPath='public/live-ia.html';
  const oldApi=read(baseline,apiPath),newApi=read(desired,apiPath),oldHtml=read(baseline,htmlPath),newHtml=read(desired,htmlPath);
  let api=read(root,apiPath),html=read(root,htmlPath);
  const start='app.post("/concile-analysis",',end='// ── Pre-match analysis';
  const oldRoute=part(oldApi,start,end),newRoute=part(newApi,start,end),liveRoute=part(api,start,end);
  // Fail closed on unknown route changes instead of overwriting VPS work.
  assert(liveRoute===oldRoute||liveRoute===newRoute,'Production analysis route changed; inspect before deployment');
  api=api.replace(liveRoute,newRoute);
  const helper=part(newApi,'function concileSessionAccess(',start);
  api=once(api,start,helper+start);
  const accessStart="app.get('/auth/access',",accessEnd='function sendGoal05Latest(';
  api=once(api,part(oldApi,accessStart,accessEnd),part(newApi,accessStart,accessEnd));
  api=once(api,part(oldApi,'function paidGoal05Account(', '// Contrôle des droits'),part(newApi,'function paidGoal05Account(', '// Contrôle des droits'));
  const frontHelper=part(newHtml,'function liveAuthHeaders(','// ── Init');
  html=once(html,'// ── Init',frontHelper+'// ── Init');
  const oldInit=part(oldHtml,'  const email = localStorage.getItem("tlm_email");','  loadMatches();');
  const newInit=part(newHtml,'  liveAuthReady=restoreLiveAuth()', '  loadMatches();');
  html=once(html,oldInit,newInit);
  html=once(html,part(oldHtml,'function refreshCredits()', 'function updateAuthBar()'),part(newHtml,'function refreshCredits()', 'function updateAuthBar()'));
  const oldHeaders=oldHtml.split('\n').find(s=>s.startsWith('  var headers={};try{var otp='));
  html=once(html,oldHeaders,'  var headers=liveAuthHeaders();');
  html=once(html,'function requestAnalysis(btn, matchId, home, away) {','async function requestAnalysis(btn, matchId, home, away) {\n  await liveAuthReady;');
  for(const spaces of [2,4]){
    const pad=' '.repeat(spaces);
    html=once(html,`${pad}fetch("/api/concile-analysis", {\n${pad}  method: "POST",\n${pad}  headers: { "Content-Type": "application/json" },`,`${pad}fetch("/api/concile-analysis", {\n${pad}  method: "POST",\n${pad}  headers: liveAuthHeaders(true),`);
  }
  html=once(html,part(oldHtml,'function openLoginModal()', 'function doLogin()'),part(newHtml,'async function openLoginModal()', 'function doLogin()'));
  html=once(html,part(oldHtml,'function doLogout()', '// ── Utils'),part(newHtml,'function doLogout()', '// ── Utils'));
  fs.writeFileSync(path.join(root,apiPath),api);fs.writeFileSync(path.join(root,htmlPath),html);
  console.log('LIVE_SESSION_PATCH_OK');
}
if(require.main===module)patch(process.argv[2],process.argv[3],process.argv[4]);
module.exports={patch};

'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
function extract(source,name){const start=source.indexOf('function '+name+'(');assert(start>=0,name+' missing');const tail=source.slice(start),indent=source.slice(source.lastIndexOf('\n',start)+1,start),closing=new RegExp('\\n'+indent+'\\}').exec(tail);assert(closing,name+' end missing');return tail.slice(0,closing.index+closing[0].length);}
const ctx=vm.createContext({esc:String,initials:n=>String(n||'?').slice(0,2).toUpperCase(),COUNTRY_FLAGS:{Brazil:'🇧🇷'},liveHomeLogo:m=>m.home_logo||'',liveAwayLogo:m=>m.away_logo||'',heroCountry:m=>m.country||'',splitComp:r=>{const p=String(r||'').split(/\\s*[·•]\\s*/);return{league:p[0]||'',country:p[1]||''};}});
for(const name of ['tlmAnalyzedMatchStatus','tlmAnalyzedMatchIdentityHtml'])vm.runInContext(extract(html,name),ctx);
const rich={home:'Flamengo',away:'Bahia',home_logo:'https://img.test/home.png',away_logo:'https://img.test/away.png',utcDate:'2026-09-27T15:30:00Z',country:'Brazil',competition:'Série A · Brazil'};
const identity=ctx.tlmAnalyzedMatchIdentityHtml(rich);
assert.match(identity,/home\.png/);assert.match(identity,/away\.png/);assert.match(identity,/onerror=/);assert.match(identity,/<time[^>]+datetime="2026-09-27T15:30:00Z"/);assert.match(identity,/🇧🇷 Brazil — Série A/);
const fallback=ctx.tlmAnalyzedMatchIdentityHtml({home:'A',away:'B'});
assert.match(fallback,/Horaire indisponible/);assert.match(fallback,/Pays indisponible — Championnat indisponible/);assert.doesNotMatch(fallback,/<img[^>]+src=""/);
const over=ctx.tlmAnalyzedMatchStatus({...rich,ou25:{vote_count:4,consensus_count:4,consensus_direction:'over',locked:false}});assert.equal(over.text,'OVER 2,5 — 4/5');assert.equal(over.className,'over');
assert.equal(ctx.tlmAnalyzedMatchStatus({ou25:{vote_count:2,analysis_state:'analyzing'}}).text,'ANALYSE INCOMPLÈTE — 2/5');
assert.equal(ctx.tlmAnalyzedMatchStatus({ou25:{vote_count:0,analysis_state:'running'}}).text,'ANALYSE EN COURS');
assert.equal(ctx.tlmAnalyzedMatchStatus({analysis_exclusion_reason:'Résultats historiques insuffisants.',ou25:{vote_count:0,analysis_state:'excluded'}}).text,'DONNÉES INSUFFISANTES');
assert.equal(ctx.tlmAnalyzedMatchStatus({analysis_exclusion_reason:'Championnat écarté.',ou25:{vote_count:0,analysis_state:'excluded'}}).text,'NON ANALYSÉ — MATCH HORS CRITÈRES');
assert.equal(ctx.tlmAnalyzedMatchStatus({ou25:{vote_count:5,official:false}}).text,'AUCUN SIGNAL VALIDÉ');
assert.equal(ctx.tlmAnalyzedMatchStatus({ou25:{vote_count:0}}).text,'NON ANALYSÉ — MOTIF INDISPONIBLE');
console.log('PASS analyzed list: logos, kickoff, competition and exact real-state labels');

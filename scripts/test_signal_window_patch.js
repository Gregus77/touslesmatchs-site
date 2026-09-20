'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('node:assert/strict');
const {patch,files}=require('./patch_signal_window_35');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tlm-window-test-'));
const base=path.join(tmp,'base'),stage=path.join(tmp,'stage'),desired=path.resolve(__dirname,'..');
for(const f of files){const value=cp.execFileSync('git',['show','21eb8f6:'+f],{encoding:'utf8'});for(const dir of [base,stage]){fs.mkdirSync(path.dirname(path.join(dir,f)),{recursive:true});fs.writeFileSync(path.join(dir,f),value);}}
fs.appendFileSync(path.join(stage,'scripts/api_server.js'),'\n// unrelated production change must survive\n');
const homepage=path.join(stage,'public/index.html');
let html=fs.readFileSync(homepage,'utf8');
const oldLabel=html.split('\n').find(x=>x.includes("setHeroText('hero-consensus-label',votes?"));
assert(oldLabel);html=html.replace(oldLabel,"  var decisionText=analysisWaiting?'À partir de la 15e minute':'Consensus insuffisant — aucun signal';\n  setHeroText('hero-consensus-label',decisionText);");fs.writeFileSync(homepage,html);
patch(stage,desired,base);patch(stage,desired,base);
assert(fs.readFileSync(path.join(stage,'scripts/api_server.js'),'utf8').includes('unrelated production change must survive'));
for(const f of files.filter(f=>!['scripts/api_server.js','public/index.html'].includes(f)))assert.equal(fs.readFileSync(path.join(stage,f),'utf8'),fs.readFileSync(path.join(desired,f),'utf8').replace(/\r\n/g,'\n'));
const served=fs.readFileSync(homepage,'utf8');assert(served.includes("setHeroText('hero-consensus-label',decisionText)"));assert(served.includes("analysisWaiting?'À partir de la 35e minute'"));
console.log('SIGNAL_WINDOW_PATCH_TEST_OK');

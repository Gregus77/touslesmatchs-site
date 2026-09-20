'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('node:assert/strict');
const {patch,files}=require('./patch_closed_signal_display');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tlm-closed-test-')),base=path.join(tmp,'base'),stage=path.join(tmp,'stage'),desired=path.resolve(__dirname,'..');
for(const f of files){const value=cp.execFileSync('git',['show','eb5a5dc:'+f],{encoding:'utf8'});for(const dir of [base,stage]){fs.mkdirSync(path.dirname(path.join(dir,f)),{recursive:true});fs.writeFileSync(path.join(dir,f),value);}}
const homepage=path.join(stage,'public/index.html');let html=fs.readFileSync(homepage,'utf8');
const oldLabel=html.split('\n').find(x=>x.includes("setHeroText('hero-consensus-label',votes?"));
assert(oldLabel);html=html.replace(oldLabel,"  var decisionText='Production-specific verdict';\n  setHeroText('hero-consensus-label',decisionText);");fs.writeFileSync(homepage,html);
patch(stage,desired,base);patch(stage,desired,base);
assert(fs.readFileSync(homepage,'utf8').includes("var decisionText='Production-specific verdict'"));
for(const f of files.filter(f=>f!=='public/index.html'))assert.equal(fs.readFileSync(path.join(stage,f),'utf8'),fs.readFileSync(path.join(desired,f),'utf8').replace(/\r\n/g,'\n'));
// A conflicting later file must not partially modify earlier files.
fs.writeFileSync(path.join(stage,'public/live-ia.html'),'conflicting production source');
const before=fs.readFileSync(homepage,'utf8');assert.throws(()=>patch(stage,desired,base));assert.equal(fs.readFileSync(homepage,'utf8'),before);
console.log('CLOSED_DISPLAY_PATCH_TEST_OK');

'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('node:assert/strict');
const {patch,files}=require('./patch_signal_window_35');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tlm-window-test-'));
const base=path.join(tmp,'base'),stage=path.join(tmp,'stage'),desired=path.resolve(__dirname,'..');
for(const f of files){const value=cp.execFileSync('git',['show','21eb8f6:'+f],{encoding:'utf8'});for(const dir of [base,stage]){fs.mkdirSync(path.dirname(path.join(dir,f)),{recursive:true});fs.writeFileSync(path.join(dir,f),value);}}
fs.appendFileSync(path.join(stage,'scripts/api_server.js'),'\n// unrelated production change must survive\n');
patch(stage,desired,base);patch(stage,desired,base);
assert(fs.readFileSync(path.join(stage,'scripts/api_server.js'),'utf8').includes('unrelated production change must survive'));
for(const f of files.filter(f=>f!=='scripts/api_server.js'))assert.equal(fs.readFileSync(path.join(stage,f),'utf8'),fs.readFileSync(path.join(desired,f),'utf8').replace(/\r\n/g,'\n'));
console.log('SIGNAL_WINDOW_PATCH_TEST_OK');

'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('assert/strict');
const {patch}=require('./patch_live_session');
const root=path.join(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tlm-session-test-'));
const files=['scripts/api_server.js','public/live-ia.html'];
for(const dir of ['baseline','stage'])for(const file of files){fs.mkdirSync(path.dirname(path.join(tmp,dir,file)),{recursive:true});fs.writeFileSync(path.join(tmp,dir,file),cp.execFileSync('git',['show',`7d14e58:${file}`],{cwd:root}));}
const stage=path.join(tmp,'stage'),baseline=path.join(tmp,'baseline');
patch(stage,root,baseline);
const once=files.map(f=>fs.readFileSync(path.join(stage,f),'utf8'));
patch(stage,root,baseline);
assert.deepEqual(files.map(f=>fs.readFileSync(path.join(stage,f),'utf8')),once);
fs.copyFileSync(path.join(__dirname,'test_live_session.js'),path.join(stage,'scripts/test_live_session.js'));
cp.execFileSync(process.execPath,[path.join(stage,'scripts/test_live_session.js')],{stdio:'inherit'});
console.log('LIVE_SESSION_PATCH_TESTS_OK');

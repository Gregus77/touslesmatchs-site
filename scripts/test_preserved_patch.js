'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
const {patch}=require('./patch_preserved_half_time');
const root=path.join(__dirname,'..'),stage=fs.mkdtempSync(path.join(os.tmpdir(),'tlm-preserve-test-'));
const files=['scripts/api_server.js','scripts/live_state_coherence.js','scripts/official_signal_snapshots.js','public/index.html','public/app.html','public/live-ia.html'];
for(const f of files){fs.mkdirSync(path.dirname(path.join(stage,f)),{recursive:true});fs.writeFileSync(path.join(stage,f),cp.execFileSync('git',['show',`HEAD:${f}`],{cwd:root}));}
// Production already has the previous closed-window read attempt.
const api=path.join(stage,'scripts/api_server.js');
fs.writeFileSync(api,fs.readFileSync(api,'utf8').replace("snapshot.id === currentSnapshotKey)) {","snapshot.id === currentSnapshotKey || windowStatus === 'closed')) {")+ '\n// VPS_EDIT_MUST_SURVIVE\n');
patch(stage,root);
assert(fs.readFileSync(api,'utf8').includes('// VPS_EDIT_MUST_SURVIVE'));
const once=files.map(f=>fs.readFileSync(path.join(stage,f),'utf8'));
patch(stage,root);
assert.deepEqual(files.map(f=>fs.readFileSync(path.join(stage,f),'utf8')),once);
for(const f of ['test_preserved_half_time_votes.js','test_live_state_coherence_20260919.js']){
  fs.copyFileSync(path.join(__dirname,f),path.join(stage,'scripts',f));
  cp.execFileSync(process.execPath,[path.join(stage,'scripts',f)],{stdio:'inherit'});
}
console.log('PRESERVED_PATCH_IDEMPOTENT_AND_TESTED');

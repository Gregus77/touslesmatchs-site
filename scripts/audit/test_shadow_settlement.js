'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(require('path').join(__dirname,'../shadow_tournament_worker.js'),'utf8');
const body=src.match(/function settle\([^]*?\n\}/)[0];
const ctx={};vm.createContext(ctx);vm.runInContext(body,ctx);
for(let h=0;h<=4;h++)for(let a=0;a<=4;a++){
 assert.equal(ctx.settle('BTTS Oui',h,a),h>0&&a>0);assert.equal(ctx.settle('BTTS Non',h,a),h===0||a===0);
 for(const line of [1.5,2.5,3.5]){assert.equal(ctx.settle(`Over ${line} buts`,h,a),h+a>line);assert.equal(ctx.settle(`Under ${line} buts`,h,a),h+a<line);}
}
assert.equal(ctx.settle('NO BET',1,0),null);
console.log('PASS current shadow resolver: 200 valid-score boundary cases; abstention unresolved. No network or DB access.');

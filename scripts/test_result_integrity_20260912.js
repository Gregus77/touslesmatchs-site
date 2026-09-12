#!/usr/bin/env node
"use strict";
const fs=require("fs"),assert=require("assert"),vm=require("vm");
const src=fs.readFileSync(require("path").join(__dirname,"api_server.js"),"utf8");
const match=src.match(/function hasConsistentScoreProgression\([\s\S]*?\n\}/);
assert(match,"garde de progression absent");
const box={}; vm.runInNewContext(match[0]+";this.guard=hasConsistentScoreProgression;",box);
const guard=box.guard;
assert.strictEqual(guard({score_home_at_analysis:1,score_away_at_analysis:0},0,0),false);
assert.strictEqual(guard({score_home_at_analysis:2,score_away_at_analysis:1},2,0),false);
assert.strictEqual(guard({score_home_at_analysis:1,score_away_at_analysis:0},3,1),true);
assert.strictEqual(guard({score_home_at_analysis:null,score_away_at_analysis:null},0,0),true);
assert.strictEqual(guard({},-1,2),false);
assert.match(src,/\[result-integrity\] score final refusé/);
assert.match(src,/outcome === "win"[\s\S]{0,160}!hasConsistentScoreProgression\(row\)/);
console.log("OK: scores finaux régressifs refusés et exclus des statistiques clients");

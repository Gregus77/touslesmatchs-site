#!/usr/bin/env node
"use strict";
const fs=require("fs"),assert=require("assert");
const src=fs.readFileSync(require("path").join(__dirname,"api_server.js"),"utf8");
for(const field of ["observation_only","total_shots","shots_on_target","corners","goals_at_analysis","late_window","real_odd","implied_probability","confidence_probability","estimated_edge_points","historical_segment_winrate","elite_candidate"]){
  assert(src.includes(field),"champ shadow manquant: "+field);
}
assert.match(src,/quality_shadow:\s*qualityShadow/);
assert.match(src,/observation_only:\s*true/);
assert.doesNotMatch(src,/qualityShadow\.(?:ok|blocked|eligible)/);
console.log("OK: facteurs qualité journalisés en shadow sans influencer la diffusion");

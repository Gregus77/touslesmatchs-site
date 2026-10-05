'use strict';
const fs=require('fs');
const assert=require('assert');

const src=fs.readFileSync(require('path').join(__dirname,'api_server.js'),'utf8');

assert(src.includes('const GOAL05_POLICY_FROM_MINUTE = 30;'));
assert(src.includes('const GOAL05_POLICY_TO_MINUTE = 85;'));
assert(src.includes('const GOAL05_POLICY_MIN_ODD = 1.60;'));
assert(src.includes('const GOAL05_POLICY_MIN_VOTES = 4;'));

assert(src.includes('if (!GOAL05_ENABLED) return rejected("goal05_desactive")'));
assert(src.includes('if (!GOAL05_PUSH_ENABLED) return;'));
assert(src.includes('if (GOAL05_ENABLED) {'));
assert(src.includes('minute>=GOAL05_POLICY_FROM_MINUTE && minute<=GOAL05_POLICY_TO_MINUTE'));

assert(src.includes('groupIndex,'));
assert(src.includes('groupTotal,'));
assert(src.includes('groupName: t.group || null'));
assert(src.includes('if (Number(homeRank.groupIndex)!==Number(awayRank.groupIndex))'));
assert(src.includes('const bottomThreshold=Math.max(1,groupTotal-4);'));

assert(src.includes('const homeTopBottom=Number(homeRank.rank)<=5 && Number(awayRank.rank)>=bottomThreshold;'));
assert(src.includes('const awayTopBottom=Number(awayRank.rank)<=5 && Number(homeRank.rank)>=bottomThreshold;'));
assert(src.includes('if (targetScore>0) return rejected("equipe_cible_a_deja_marque"'));

assert(!src.includes('if (minute<25 || minute>80)'));
assert(!src.includes('minute>=25 && minute<=80 && !(hs>0 && as>0)'));
assert(src.includes('ai_consensus_non_verifie'));
assert(src.includes('const aiVotes=0;'));

console.log('GOAL05_POLICY_LOT_A_OK');

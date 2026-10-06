'use strict';
const fs=require('fs');
const path=require('path');
const assert=require('assert');

const api=fs.readFileSync(path.join(__dirname,'api_server.js'),'utf8');
const tg=fs.readFileSync(path.join(__dirname,'telegram_client.js'),'utf8');

for(const marker of [
  'const GOAL05_POLICY_FROM_MINUTE = 30;',
  'const GOAL05_POLICY_TO_MINUTE = 85;',
  'const GOAL05_POLICY_MIN_ODD = 1.60;',
  'const GOAL05_POLICY_MIN_VOTES = 4;',
  'const GOAL05_ODD_MAX_AGE_MS',
  'goal05_signal_registry',
  'function goal05AiConsensus(match,side)',
  'yesVotes>=GOAL05_POLICY_MIN_VOTES',
  'const aiConsensus=goal05AiConsensus(match,side);',
  'aiVoteDetails:aiConsensus.votes',
  'fetchRealOdds(match,{maxAgeMs:GOAL05_ODD_MAX_AGE_MS})',
  'oddFreshVerified',
  'clientTelegramPublisher.enqueue("goal05"',
  'if(!GOAL05_PUSH_ENABLED) return;',
  'if(!GOAL05_ENABLED)',
  'groupIndex,groupTotal,groupName',
  'if(Number(homeRank.groupIndex)!==Number(awayRank.groupIndex))',
  'const bottomThreshold=Math.max(1,groupTotal-4);',
  'Number(homeRank.rank)<=5&&Number(awayRank.rank)>=bottomThreshold',
  'Number(awayRank.rank)<=5&&Number(homeRank.rank)>=bottomThreshold',
  'if(targetScore>0) return rejected("equipe_cible_a_deja_marque"',
]) assert(api.includes(marker), 'missing API marker: '+marker);

assert(!api.includes('if (minute<25 || minute>80)'), 'legacy 25-80 window remains');
assert(!api.includes('minute>=25 && minute<=80 && !(hs>0 && as>0)'), 'legacy scoreless-side prefilter remains');

for(const marker of [
  "kind==='goal05'",
  "row.kind==='signal'||row.kind==='goal05'",
  "SIGNAL +0,5 BUT ÉQUIPE",
  "L’équipe ciblée, la cote et la sélection exacte sont réservées aux membres Premium."
]) assert(tg.includes(marker), 'missing Telegram marker: '+marker);

console.log('GOAL05_POLICY_REPAIR_OK');

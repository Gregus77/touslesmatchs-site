"use strict";

const SEASON_WEIGHTS = Object.freeze({0:0.40,1:0.25,2:0.20,3:0.15});
const COMPONENT_WEIGHTS = Object.freeze({history:30,attack:25,opponent:20,live:15,context:10});

function finite(value) {
  const n=Number(value);
  return Number.isFinite(n) ? n : null;
}
function clamp(value,min=0,max=100) {
  const n=finite(value);
  if(n===null) return null;
  return Math.max(min,Math.min(max,n));
}
function round1(value) {
  const n=finite(value);
  return n===null ? null : Math.round(n*10)/10;
}
function rankStrength(rank,total) {
  const r=finite(rank),t=finite(total);
  if(r===null||t===null||t<2||r<1||r>t) return null;
  return 100*(t-r)/(t-1);
}
function rankWeakness(rank,total) {
  const s=rankStrength(rank,total);
  return s===null ? null : 100-s;
}
function weightedKnown(items) {
  let points=0,weight=0;
  for(const item of items||[]) {
    if(item==null) continue;
    const value=finite(item.value),w=finite(item.weight);
    if(value===null||w===null||w<=0) continue;
    points+=clamp(value)*w; weight+=w;
  }
  return weight>0 ? {score:round1(points/weight),weight} : {score:null,weight:0};
}

function buildHistoryProfile(records) {
  const usable=(records||[]).filter(r=>finite(r?.targetRank)!==null&&finite(r?.opponentRank)!==null&&finite(r?.groupTotal)>=10);
  let totalWeight=0,targetPoints=0,oppPoints=0,topSixSeasons=0,bottomFiveSeasons=0;
  const seasons=[];
  for(const row of usable) {
    const offset=Math.max(0,Math.min(3,Number(row.offset)||0));
    const weight=finite(row.weight)??SEASON_WEIGHTS[offset]??0;
    const total=Number(row.groupTotal),targetRank=Number(row.targetRank),opponentRank=Number(row.opponentRank);
    const target=rankStrength(targetRank,total),opponent=rankWeakness(opponentRank,total);
    if(target===null||opponent===null||weight<=0) continue;
    totalWeight+=weight;targetPoints+=target*weight;oppPoints+=opponent*weight;
    if(targetRank<=Math.min(6,total)) topSixSeasons++;
    if(opponentRank>=Math.max(1,total-4)) bottomFiveSeasons++;
    seasons.push({offset,season:row.season??null,weight,targetRank,opponentRank,groupTotal:total,
      targetStrength:round1(target),opponentWeakness:round1(opponent)});
  }
  const targetScore=totalWeight?100*targetPoints/(100*totalWeight):null;
  const opponentWeakness=totalWeight?100*oppPoints/(100*totalWeight):null;
  const score=(targetScore===null||opponentWeakness===null)?null:round1(targetScore*0.65+opponentWeakness*0.35);
  const available=seasons.length;
  const structuralTop=available>=3&&topSixSeasons>=3;
  const structuralBottom=available>=3&&bottomFiveSeasons>=2;
  return {
    seasonsAvailable:available,
    seasonsRequested:4,
    seasons,
    topSixSeasons,
    bottomFiveSeasons,
    structuralTop,
    structuralBottom,
    historicalStrengthScore:score,
    targetStrengthScore:round1(targetScore),
    opponentWeaknessScore:round1(opponentWeakness),
    verified:available>=3&&structuralTop&&score!==null&&score>=70
  };
}

function fixtureTeamGoals(fixture,teamId) {
  const tid=Number(teamId);
  const homeId=Number(fixture?.teams?.home?.id),awayId=Number(fixture?.teams?.away?.id);
  const homeGoals=finite(fixture?.goals?.home),awayGoals=finite(fixture?.goals?.away);
  if(homeGoals===null||awayGoals===null) return null;
  if(homeId===tid) return {forGoals:homeGoals,againstGoals:awayGoals,venue:"home"};
  if(awayId===tid) return {forGoals:awayGoals,againstGoals:homeGoals,venue:"away"};
  return null;
}

function recentGoalProfile(fixtures,teamId) {
  const rows=(fixtures||[]).map(f=>{
    const goals=fixtureTeamGoals(f,teamId);
    if(!goals) return null;
    return {
      fixtureId:String(f?.fixture?.id||""),
      playedAt:String(f?.fixture?.date||""),
      ...goals
    };
  }).filter(Boolean).sort((a,b)=>String(b.playedAt).localeCompare(String(a.playedAt))).slice(0,5);
  if(!rows.length) return {sample:0,rows:[],scoredCount:null,concededCount:null,gfAvg:null,gaAvg:null,cleanSheets:null};
  const sum=(key)=>rows.reduce((n,r)=>n+Number(r[key]||0),0);
  return {
    sample:rows.length,
    rows,
    scoredCount:rows.filter(r=>r.forGoals>0).length,
    concededCount:rows.filter(r=>r.againstGoals>0).length,
    gfAvg:round1(sum("forGoals")/rows.length),
    gaAvg:round1(sum("againstGoals")/rows.length),
    cleanSheets:rows.filter(r=>r.againstGoals===0).length,
    failedToScore:rows.filter(r=>r.forGoals===0).length
  };
}

function scoreCandidate(input={}) {
  const history=input.history||{};
  const targetRecent=input.targetRecent||{};
  const opponentRecent=input.opponentRecent||{};

  const historyScore=finite(history.historicalStrengthScore);

  const attack=weightedKnown([
    finite(targetRecent.scoredCount)===null?null:{value:100*Number(targetRecent.scoredCount)/5,weight:45},
    finite(targetRecent.gfAvg)===null?null:{value:100*Number(targetRecent.gfAvg)/1.5,weight:35},
    finite(input.seasonGfAvg)===null?null:{value:100*Number(input.seasonGfAvg)/1.5,weight:20}
  ]).score;

  const opponent=weightedKnown([
    finite(opponentRecent.concededCount)===null?null:{value:100*Number(opponentRecent.concededCount)/5,weight:45},
    finite(opponentRecent.gaAvg)===null?null:{value:100*Number(opponentRecent.gaAvg)/1.5,weight:35},
    finite(opponentRecent.cleanSheets)===null?null:{value:100*(1-Math.min(5,Number(opponentRecent.cleanSheets))/5),weight:20}
  ]).score;

  const live=weightedKnown([
    finite(input.shotsOnTarget)===null?null:{value:100*Number(input.shotsOnTarget)/3,weight:30},
    finite(input.totalShots)===null?null:{value:100*Number(input.totalShots)/8,weight:25},
    finite(input.possession)===null?null:{value:100*(Number(input.possession)-40)/20,weight:15},
    finite(input.liveXg)===null?null:{value:100*Number(input.liveXg)/1.2,weight:30}
  ]).score;

  const context=weightedKnown([
    input.homeAdvantage==null?null:{value:input.homeAdvantage?100:65,weight:25},
    input.attackersAvailable==null?null:{value:input.attackersAvailable?100:0,weight:30},
    input.noRedCard==null?null:{value:input.noRedCard?100:0,weight:25},
    input.motivationVerified==null?null:{value:input.motivationVerified?100:50,weight:20}
  ]).score;

  const components={history:historyScore,attack,opponent,live,context};
  let weighted=0,knownWeight=0;
  for(const [name,weight] of Object.entries(COMPONENT_WEIGHTS)) {
    const score=finite(components[name]);
    if(score===null) continue;
    weighted+=clamp(score)*weight;knownWeight+=weight;
  }
  const total=knownWeight?round1(weighted/knownWeight):null;
  const rating=total===null?null:round1(total/10);
  const color=rating===null?"gray":rating>=8?"green":rating>=6.5?"orange":"red";
  return {
    components,
    score:total,
    rating,
    color,
    coveragePct:knownWeight,
    qualityVerified:rating!==null&&rating>=8&&knownWeight>=75
  };
}

function strictRecentChecks(targetRecent,opponentRecent) {
  const targetSample=Number(targetRecent?.sample||0),opponentSample=Number(opponentRecent?.sample||0);
  const formVerified=targetSample>=5&&Number(targetRecent.scoredCount)>=4&&Number(targetRecent.gfAvg)>=1.5;
  const opponentConcedes=opponentSample>=5&&Number(opponentRecent.concededCount)>=4&&Number(opponentRecent.gaAvg)>=1.5&&Number(opponentRecent.cleanSheets)<=2;
  return {formVerified,opponentConcedes};
}

module.exports={
  SEASON_WEIGHTS,COMPONENT_WEIGHTS,finite,clamp,round1,rankStrength,rankWeakness,
  weightedKnown,buildHistoryProfile,recentGoalProfile,scoreCandidate,strictRecentChecks
};

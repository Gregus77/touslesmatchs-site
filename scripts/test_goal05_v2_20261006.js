"use strict";
const assert=require("assert");
const v2=require("./goal05_v2");

function season(offset,targetRank,opponentRank,total=20){
  return {offset,season:2026-offset,targetRank,opponentRank,groupTotal:total};
}

const strong=v2.buildHistoryProfile([
  season(0,2,19),season(1,4,18),season(2,3,20),season(3,5,17)
]);
assert.equal(strong.seasonsAvailable,4);
assert.equal(strong.topSixSeasons,4);
assert.equal(strong.structuralTop,true);
assert.equal(strong.verified,true);
assert.ok(strong.historicalStrengthScore>=80);

const flash=v2.buildHistoryProfile([
  season(0,3,18),season(1,11,15),season(2,13,14),season(3,9,16)
]);
assert.equal(flash.structuralTop,false);
assert.equal(flash.verified,false);

const promoted=v2.buildHistoryProfile([season(0,2,19)]);
assert.equal(promoted.seasonsAvailable,1);
assert.equal(promoted.verified,false);

function fixture(id,date,homeId,awayId,hg,ag){
  return {fixture:{id,date},teams:{home:{id:homeId},away:{id:awayId}},goals:{home:hg,away:ag}};
}
const target=v2.recentGoalProfile([
  fixture(1,"2026-10-05",10,20,2,0),
  fixture(2,"2026-09-28",30,10,1,2),
  fixture(3,"2026-09-21",10,40,1,1),
  fixture(4,"2026-09-14",50,10,0,2),
  fixture(5,"2026-09-07",10,60,1,0)
],10);
assert.equal(target.sample,5);
assert.equal(target.scoredCount,5);
assert.equal(target.gfAvg,1.8);

const weakOpponent=v2.recentGoalProfile([
  fixture(11,"2026-10-05",70,80,2,1),
  fixture(12,"2026-09-28",80,90,0,2),
  fixture(13,"2026-09-21",100,80,3,1),
  fixture(14,"2026-09-14",80,110,1,2),
  fixture(15,"2026-09-07",120,80,2,0)
],80);
assert.equal(weakOpponent.concededCount,5);
assert.equal(weakOpponent.cleanSheets,0);

const strict=v2.strictRecentChecks(target,weakOpponent);
assert.equal(strict.formVerified,true);
assert.equal(strict.opponentConcedes,true);

const scored=v2.scoreCandidate({
  history:strong,
  targetRecent:target,
  opponentRecent:weakOpponent,
  seasonGfAvg:1.7,
  shotsOnTarget:4,totalShots:10,possession:58,liveXg:1.1,
  homeAdvantage:true,attackersAvailable:true,noRedCard:true,motivationVerified:true
});
assert.equal(scored.color,"green");
assert.ok(scored.rating>=8);
assert.equal(scored.qualityVerified,true);

const orange=v2.scoreCandidate({
  history:{historicalStrengthScore:65},
  targetRecent:{sample:5,scoredCount:4,gfAvg:1.3},
  opponentRecent:{sample:5,concededCount:4,gaAvg:1.2,cleanSheets:2},
  seasonGfAvg:1.2,shotsOnTarget:2,totalShots:6,possession:50,
  homeAdvantage:false,attackersAvailable:true,noRedCard:true,motivationVerified:true
});
assert.ok(["orange","red"].includes(orange.color));

const missingXg=v2.scoreCandidate({
  history:strong,targetRecent:target,opponentRecent:weakOpponent,seasonGfAvg:1.7,
  shotsOnTarget:3,totalShots:9,possession:55,liveXg:null,
  homeAdvantage:true,attackersAvailable:true,noRedCard:true,motivationVerified:true
});
assert.notEqual(missingXg.score,null);
assert.ok(missingXg.coveragePct>=75);

console.log("GOAL05_V2_SCORING_OK");

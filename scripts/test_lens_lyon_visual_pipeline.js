'use strict';
const assert=require('assert/strict'), fs=require('fs'),os=require('os'),path=require('path');
const poster=require('./generate_lens_lyon_poster');
const telegram=require('./telegram_client');
const base={fixtureId:123456789,home:'Lens',away:'Lyon',targetTeam:'Lens',
  country:'France',competition:'Ligue 1',homeColor:'#e8bb28',awayColor:'#fafafa',
  targetRank:3,opponentRank:16,teamCount:20,leagueAllowed:true,snapshotAt:'2026-10-10T00:00:00Z'};
function throws(c){assert.throws(()=>poster.validate(c));}
throws({...base,leagueAllowed:false});
throws({...base,targetRank:6});
throws({...base,opponentRank:15});
throws({...base,fixtureId:'../../etc/passwd'});
throws({...base,homeColor:'rgb(0,0,0)'});
throws({...base,targetTeam:'Another team'});
assert.equal(poster.validate(base).id,'123456789');
assert.match(poster.posterPrompt(poster.validate(base)),/two anonymous adult/i);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tlm-poster-test-'));
(async()=>{
  const result=await poster.generate(base,{dir,enabled:false});
  assert.equal(result.dryRun,true);
  assert.equal(fs.readdirSync(dir).length,0);
  assert.equal(telegram.posterPhotoUrl('https://www.touslesmatchs.com/media/matches/123456789.png'),
    'https://www.touslesmatchs.com/media/matches/123456789.png');
  assert.equal(telegram.posterPhotoUrl('https://attacker.example/p.png'),null);
  assert.equal(telegram.posterPhotoUrl('https://www.touslesmatchs.com.evil.tld/media/matches/123.png'),null);
  assert.equal(telegram.posterPhotoUrl('javascript:alert(1)'),null);
  const msg=telegram.render('scanner',{rows:[{
    home:'Lens',away:'Lyon',targetTeam:'Lens',targetRank:'3/20',opponentRank:'16/20',rating:8.1,
    country:'France',sport:'Football',kickoffLabel:'10/10 20:00',
    posterUrl:'https://www.touslesmatchs.com/media/matches/123456789.png',posterReviewed:true
  }]},{channel:'free',lang:'fr',tier:'free'});
  assert.equal(msg.photo,'https://www.touslesmatchs.com/media/matches/123456789.png');
  assert.equal(msg.caption,msg.text);
  assert.ok(msg.caption.length<=1024);
  const old=telegram.render('scanner',{rows:[{
    home:'Lens',away:'Lyon',targetTeam:'Lens',targetRank:'3/20',opponentRank:'16/20',rating:8.1,
    country:'France',sport:'Football',kickoffLabel:'10/10 20:00'
  }]},{channel:'free',lang:'fr',tier:'free'});
  assert.equal(old.photo,undefined);
  console.log('Lens–Lyon visual payload tests: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(dir,{recursive:true,force:true}));

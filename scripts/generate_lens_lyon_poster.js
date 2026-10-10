'use strict';
/*
 * Generate an editorial match poster in the approved Lens–Lyon style.
 * Optional and fail-closed: NEVER creates a sporting recommendation or publishes.
 * Usage: node scripts/generate_lens_lyon_poster.js path/to/verified-fixture.json --generate
 * Without --generate: validates and previews prompt, makes NO billable API call.
 */
const fs=require('fs');
const path=require('path');
const https=require('https');
const crypto=require('crypto');
const BASE=path.resolve(__dirname,'../public/media/matches');

function validate(input){
  if(!input||typeof input!=='object')throw Error('Fixture payload missing');
  const id=String(input.fixtureId||'');
  if(!/^[0-9]{1,14}$/.test(id))throw Error('Numeric fixtureId required');
  const fields=['home','away','targetTeam','country','competition','homeColor','awayColor'];
  for(const key of fields)if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>110)throw Error('Invalid '+key);
  if(![input.home,input.away].includes(input.targetTeam))throw Error('Target must match a team');
  if(input.home===input.away)throw Error('Teams cannot be identical');
  if(input.leagueAllowed!==true)throw Error('Competition has not passed the production whitelist');
  const ranks=[input.targetRank,input.opponentRank,input.teamCount].map(Number);
  if(!ranks.every(Number.isInteger)||ranks[2]<10||ranks[0]<1||ranks[1]>ranks[2]||ranks[0]>5||ranks[1]<ranks[2]-4){
    throw Error('Unverified Top5/Bottom5 ranks');
  }
  if(!/^#[0-9a-fA-F]{6}$/.test(input.homeColor)||!/^#[0-9a-fA-F]{6}$/.test(input.awayColor))throw Error('Actual team colors required');
  if(!Number.isFinite(Date.parse(input.snapshotAt||'')))throw Error('Timestamped source snapshot required');
  return {id,home:input.home.trim(),away:input.away.trim(),targetTeam:input.targetTeam.trim(),
    country:input.country.trim(),competition:input.competition.trim(),homeColor:input.homeColor,
    awayColor:input.awayColor,targetRank:ranks[0],opponentRank:ranks[1],teamCount:ranks[2],
    snapshotAt:input.snapshotAt};
}
function posterPrompt(v){
  return [
    'Create a high-end cinematic editorial football poster in the official TousLesMatchs Lens–Lyon visual language.',
    'Night football stadium, sapphire-blue floodlights, rich midnight blue atmosphere, dramatic cinematic lighting.',
    'Two anonymous adult football players viewed STRICTLY from behind, large on opposite sides, watching the pitch.',
    'Left player wears a kit based on '+v.home+' team colors '+v.homeColor+'. Right player wears '+v.away+' team colors '+v.awayColor+'.',
    'Elegant sports magazine composition, realistic fabric texture, crisp details, inviting center space for readable data overlays.',
    'NO fictional scores, minute, rankings, betting odds, trophies, player names or fabricated team crests.',
    'NO watermark, NO sponsorship marks, NO fake statistics. NO logos generated from imagination.',
    'Text may only identify these clubs: '+v.home+' and '+v.away+'. Never include any other match or team.',
    'The team to analyze later is '+v.targetTeam+'; this is a neutral visual, NOT a validated betting signal.',
    'Square 1:1 master artwork; preserve central contrast for accessible live score overlay on the website.'
  ].join('\n');
}
function fetchPoster(apiKey,prompt){
  return new Promise((resolve,reject)=>{
    const body=JSON.stringify({model:process.env.TLM_IMAGE_MODEL||'gpt-image-2.5-flare',prompt,
      size:'1024x1024',quality:'medium',output_format:'png',n:1});
    const req=https.request({hostname:'api.openai.com',path:'/v1/images/generations',method:'POST',
      headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json',
        'Content-Length':Buffer.byteLength(body)},timeout:120000},res=>{
      const chunks=[];let total=0;
      res.on('data',chunk=>{total+=chunk.length;if(total>30*1024*1024){req.destroy(new Error('Image response too large'));return;}chunks.push(chunk);});
      res.on('end',()=>{try{
        const json=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(res.statusCode!==200||!json.data?.[0]?.b64_json)throw Error('Image generation failed (HTTP '+res.statusCode+')');
        const png=Buffer.from(json.data[0].b64_json,'base64');
        if(png.length<1024||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid PNG');
        resolve(png);
      }catch(e){reject(e);}});
    });
    req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('Image API timeout')));
    req.end(body);
  });
}
async function generate(raw,{enabled=false,dir=BASE,request=fetchPoster}={}){
  const fixture=validate(raw);
  const file=path.join(dir,fixture.id+'.png');
  const manifest=path.join(dir,fixture.id+'.json');
  const url='/media/matches/'+fixture.id+'.png';
  if(!enabled)return {ok:true,dryRun:true,fixtureId:fixture.id,posterUrl:url,prompt:posterPrompt(fixture)};
  const apiKey=(process.env.OPENAI_API_KEY||'').trim();
  if(!apiKey)throw Error('OPENAI_API_KEY not configured; no billable request started');
  fs.mkdirSync(dir,{recursive:true});
  if(fs.existsSync(file)&&fs.existsSync(manifest)){
    const previous=JSON.parse(fs.readFileSync(manifest,'utf8'));
    if(previous.fixture?.home!==fixture.home||previous.fixture?.away!==fixture.away)throw Error('Fixture identity conflict');
    return {...previous,cached:true};
  }
  const png=await request(apiKey,posterPrompt(fixture));
  if(!Buffer.isBuffer(png)||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid generated PNG');
  const sha=crypto.createHash('sha256').update(png).digest('hex');
  const result={ok:true,fixtureId:fixture.id,posterUrl:url,sha256:sha,reviewStatus:'unreviewed',
    generatedAt:new Date().toISOString(),fixture};
  const temp=file+'.'+process.pid+'.tmp';
  fs.writeFileSync(temp,png,{flag:'wx'});
  fs.renameSync(temp,file);
  fs.writeFileSync(manifest,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  return result;
}
async function main(){
  const inputFile=process.argv[2];
  if(!inputFile)throw Error('Pass a verified fixture JSON path');
  const data=JSON.parse(fs.readFileSync(inputFile,'utf8'));
  const result=await generate(data,{enabled:process.argv.includes('--generate')});
  console.log(JSON.stringify(result,null,2));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={validate,posterPrompt,generate};

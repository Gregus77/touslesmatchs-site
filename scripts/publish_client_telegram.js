'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const client=require('./telegram_client');
function loadEnv(){
  const file=path.resolve(__dirname,'../.env');
  if(!fs.existsSync(file))return;
  for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const m=line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)$/);if(!m)continue;
    if(process.env[m[1]]===undefined)process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');
  }
}
async function main(kind,{preview=false,schedule=true}={}){
  loadEnv();
  if(schedule && kind==='reminder' && ![2,5].includes(Number(new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Paris',weekday:'short'}).format(new Date()).replace('Tue','2').replace('Fri','5'))))return;
  if(kind==='nopick'){
    const file=path.join(__dirname,'today_pick.json');
    if(!fs.existsSync(file)||!JSON.parse(fs.readFileSync(file,'utf8')).nopick)return;
  }
  if(preview||process.argv.includes('--dry-run')){
    for(const dest of client.destinations(process.env).filter(x=>kind==='guide'||x.tier==='free'))console.log(dest.channel+'\n'+client.render(kind,{},dest).text);
    return;
  }
  const secret=process.env.HERMES_ADMIN_TLM_BOT;
  if(!secret)throw new Error('Internal publication authentication missing');
  const body=JSON.stringify({kind,secret});
  await new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port:3001,path:'/internal/client-telegram-publication',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)},timeout:20000},res=>{
      let raw='';res.on('data',x=>raw+=x);res.on('end',()=>{try{const data=JSON.parse(raw);if(res.statusCode===200&&data.ok)resolve();else reject(new Error('Publication was not queued'));}catch{reject(new Error('Invalid publication response'));}});
    });
    req.on('error',()=>reject(new Error('Internal publication unavailable')));req.on('timeout',()=>req.destroy());req.end(body);
  });
  console.log('Publication queued; delivery requires Telegram message_id for each destination.');
}
module.exports={main};

'use strict';
const assert=require('assert');
const {render}=require('./telegram_client');
const old={...process.env};const originalNow=Date.now;
try {
 process.env.TLM_LAUNCH_ALL_ACCESS='1';
 process.env.TLM_FREE_OFFER_CONFIRMED='1';
 process.env.TLM_FREE_OFFER_ENDS_AT='2026-11-08T00:00:00+01:00';
 Date.now=()=>Date.parse('2026-11-07T22:59:59Z');
 const data={home:'Equipe A',away:'Equipe B',competition:'Ligue autorisée',minute:45,scoreHome:0,scoreAway:0,targetTeam:'Equipe A',votes:4,rating:8.5,color:'green',odd:1.7,oddFetchedAt:new Date(Date.now()).toISOString(),reason:'Critères V2 vérifiés'};
 const free={id:'-101',lang:'fr',tier:'free'};const premium={id:'-102',lang:'fr',tier:'premium'};
 let a=render('goal05',data,free),b=render('goal05',data,premium);
 assert.strictEqual(a.text,b.text,'Same signal content in Gratuit and Premium during campaign');
 assert.deepStrictEqual(a.reply_markup,b.reply_markup);
 assert(a.text.includes('Equipe A'));
 Date.now=()=>Date.parse('2026-11-07T23:00:00Z');
 a=render('goal05',data,free);b=render('goal05',data,premium);
 assert.notStrictEqual(a.text,b.text,'Campaign ends at midnight Paris after November 7');
 assert(a.text.includes('réservés à Premium'));
 process.env.TLM_FREE_OFFER_ENDS_AT='invalid';
 Date.now=()=>Date.parse('2026-10-09T17:00:00Z');
 assert(render('goal05',data,free).text.includes('réservés à Premium'),'Invalid deadline fails closed');
 console.log('TELEGRAM_CAMPAIGN_EQUALITY_AND_EXPIRY_OK');
} finally {Date.now=originalNow;for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old);}

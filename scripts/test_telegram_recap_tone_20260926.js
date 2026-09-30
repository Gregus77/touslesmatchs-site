'use strict';
const assert=require('assert'),client=require('./telegram_client');
const fr={id:'-1',lang:'fr',tier:'premium'};
const ru={id:'-2',lang:'ru',tier:'premium'};

const emptyFr=client.render('recap',{day:'2026-09-26',rows:[]},fr).text;
assert(emptyFr.includes('Aucun signal officiel diffusé aujourd’hui'));
assert(!/[✅❌]/.test(emptyFr));
assert(!/Gagnés\s*:\s*0|Perdus\s*:\s*0|Mise théorique|Résultat net/.test(emptyFr));

const emptyRu=client.render('recap',{day:'2026-09-26',rows:[]},ru).text;
assert(emptyRu.includes('официальные сигналы не публиковались'));
assert(!/[✅❌]/.test(emptyRu));
assert(!/Выиграно\s*:\s*0|Проиграно\s*:\s*0|Условная ставка|Чистый результат/.test(emptyRu));

const rows=[
 {home:'A',away:'B',outcome:'win',real_odd:1.8,final_score_home:2,final_score_away:1,best_bet:'Over 2.5 buts'},
 {home:'C',away:'D',outcome:'loss',real_odd:1.7,final_score_home:0,final_score_away:0,best_bet:'Under 2.5 buts'},
 {home:'E',away:'F',outcome:'pending',real_odd:1.9,best_bet:'Over 2.5 buts'},
];
const filled=client.render('recap',{day:'2026-09-26',rows},fr).text;
assert(filled.includes('Résultats du jour : gagnés 1 · perdus 1 · en attente 1'));
assert(!/[✅❌]/.test(filled));
assert(filled.includes('Mise théorique'));
assert(filled.includes('• A — B'));
console.log('PASS neutral Telegram recap tone in FR and RU');

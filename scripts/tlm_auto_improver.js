#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.TLM_DB_PATH || '/data/tlm.db';
const OUT_DIR = process.env.TLM_AUTO_IMPROVER_DIR || '/data/auto-improver';
const MINOR_AUTO_MIN_N = 30;
const MAJOR_AUTO_MIN_N = 50;

function nowIso(){ return new Date().toISOString(); }
function tableExists(db,name){ return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name); }
function cols(db,table){ return db.prepare(`PRAGMA table_info("${table.replaceAll('"','""')}")`).all().map(r=>r.name); }
function pick(row,names){
  for(const n of names){
    if(Object.prototype.hasOwnProperty.call(row,n) && row[n] !== null && row[n] !== undefined && row[n] !== '') return row[n];
  }
  return null;
}
function num(v){
  if(v===null||v===undefined||v==='') return null;
  const n=Number(v);
  return Number.isFinite(n)?n:null;
}
function outcome(v){
  const s=String(v??'').toLowerCase().trim();
  if(['win','won','gagne','gagné','1','true','success'].includes(s)) return 'win';
  if(['loss','lost','perdu','0','false','fail','failed'].includes(s)) return 'loss';
  if(s.includes('win')||s.includes('gagn')) return 'win';
  if(s.includes('loss')||s.includes('perd')) return 'loss';
  return 'pending';
}
function text(v){ return v==null?'':String(v).trim(); }
function ts(row){
  return pick(row,['resolved_at','result_at','updated_at','created_at','observed_at','picked_at','ts','date','match_date','fixture_date']) || '';
}
function normalize(row,source){
  const odd = num(pick(row,['odd_at_pick','real_odd','official_odd','odd','cote','odds','price_at_pick']));
  const minute = num(pick(row,['signal_minute','minute','snapshot_minute','picked_minute','live_minute']));
  const rating = num(pick(row,['rating','scanner_rating','note','score']));
  const confidence = num(pick(row,['confidence','official_confidence','score_quality','quality_score']));
  const consensus = num(pick(row,['consensus_count','yes_votes','consensus_votes','votes_count','vote_count']));
  const home = text(pick(row,['home','home_team','team_home','home_name']));
  const away = text(pick(row,['away','away_team','team_away','away_name']));
  const target = text(pick(row,['target_team','target','selection_team','picked_team','team']));
  const competition = text(pick(row,['competition','league','competition_name','tournament']));
  const country = text(pick(row,['country','league_country']));
  const sideRaw = text(pick(row,['target_side','selection_side']));
  const rankTarget = num(pick(row,['target_rank','rank_target','favorite_rank']));
  const rankOpp = num(pick(row,['opponent_rank','rank_opponent','adversary_rank']));
  const color = text(pick(row,['color','pastille']));
  const result = outcome(pick(row,['outcome','result','status','verdict']));
  return {
    source, id:text(pick(row,['id','signal_id','snapshot_id','official_signal_snapshot_id'])) || null,
    date:ts(row), home, away, target, competition, country,
    side:sideRaw||null, odd, minute, rating, confidence, consensus, rankTarget, rankOpp, color,
    outcome:result,
    finalHome:num(pick(row,['final_score_home','score_home','home_score'])),
    finalAway:num(pick(row,['final_score_away','score_away','away_score'])),
    telegramProven: Boolean(pick(row,['telegram_delivery_proven','delivery_proven','telegram_sent','sent'])),
    raw:row
  };
}
function bucketOdd(o){
  if(o==null) return 'cote inconnue';
  if(o<1.30) return '1.10–1.29';
  if(o<1.50) return '1.30–1.49';
  if(o<1.60) return '1.50–1.59';
  if(o<1.80) return '1.60–1.79';
  if(o<2.00) return '1.80–1.99';
  return '2.00+';
}
function bucketMinute(m){
  if(m==null) return 'minute inconnue';
  if(m<=44) return '30–44';
  if(m<=59) return '45–59';
  if(m<=74) return '60–74';
  return '75–85';
}
function segment(rows,keyFn){
  const map=new Map();
  for(const r of rows){
    const k=keyFn(r)||'inconnu';
    if(!map.has(k)) map.set(k,[]);
    map.get(k).push(r);
  }
  return [...map.entries()].map(([name,list])=>metrics(list,name)).sort((a,b)=>b.n-a.n || b.winrate-a.winrate);
}
function metrics(rows,name='global'){
  const resolved=rows.filter(r=>r.outcome==='win'||r.outcome==='loss');
  const wins=resolved.filter(r=>r.outcome==='win').length;
  const losses=resolved.filter(r=>r.outcome==='loss').length;
  const withOdd=resolved.filter(r=>r.odd && r.odd>1);
  const pnl=withOdd.reduce((s,r)=>s+(r.outcome==='win'?(r.odd-1):-1),0);
  return {
    name,n:resolved.length,wins,losses,pending:rows.length-resolved.length,
    winrate:resolved.length?Number((100*wins/resolved.length).toFixed(1)):null,
    avgOdd:withOdd.length?Number((withOdd.reduce((s,r)=>s+r.odd,0)/withOdd.length).toFixed(2)):null,
    roi:withOdd.length?Number((100*pnl/withOdd.length).toFixed(1)):null,
    oddN:withOdd.length
  };
}
function safeRows(db,table){
  if(!tableExists(db,table)) return [];
  try { return db.prepare(`SELECT * FROM "${table.replaceAll('"','""')}"`).all(); }
  catch(e){ return []; }
}
function ensureSchema(db){
  db.exec(`
    CREATE TABLE IF NOT EXISTS tlm_auto_improver_runs(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      policy_version TEXT NOT NULL,
      resolved_n INTEGER NOT NULL,
      wins INTEGER NOT NULL,
      losses INTEGER NOT NULL,
      winrate REAL,
      report_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tlm_auto_improver_experiments(
      experiment_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      hypothesis TEXT NOT NULL,
      status TEXT NOT NULL,
      config_control TEXT,
      config_candidate TEXT,
      metrics_before TEXT,
      metrics_after TEXT,
      activated_at TEXT,
      rolled_back_at TEXT,
      reason TEXT
    );
  `);
}

const db = new Database(DB_PATH);
ensureSchema(db);

const officialTables=['goal05_signal_results','goal05_signal_registry'];
const scannerTables=['goal05_scanner_history'];
let official=[];
for(const t of officialTables){
  if(tableExists(db,t)){
    const rows=safeRows(db,t).map(r=>normalize(r,'official'));
    if(t==='goal05_signal_results' || official.length===0) official=rows;
  }
}
const scanner = scannerTables.flatMap(t=>safeRows(db,t).map(r=>normalize(r,'scanner_owner')));

// Dédupliquer par id si possible, sinon match+cible+date.
function dedupe(rows){
  const map=new Map();
  for(const r of rows){
    const key=r.id||[r.home,r.away,r.target,String(r.date).slice(0,10)].join('|');
    const prev=map.get(key);
    if(!prev || (prev.outcome==='pending' && r.outcome!=='pending')) map.set(key,r);
  }
  return [...map.values()];
}
official=dedupe(official);
const ownerPlayed=dedupe(scanner).filter(r=>{
  const raw=JSON.stringify(r.raw).toLowerCase();
  // Le scanner importé actuellement contient l'historique propriétaire joué + observations.
  // On conserve toute entrée explicitement résolue; les pending ne contribuent jamais au winrate.
  return r.outcome==='win'||r.outcome==='loss'||/jouable|pronostic|conseill|played|pick/.test(raw);
});

const resolvedOfficial=official.filter(r=>r.outcome==='win'||r.outcome==='loss');
const resolvedOwner=ownerPlayed.filter(r=>r.outcome==='win'||r.outcome==='loss');
const learningRows=dedupe([...resolvedOfficial,...resolvedOwner]);

const global=metrics(learningRows);
const report={
  generatedAt:nowIso(),
  dbPath:DB_PATH,
  policyVersion:'goal05_v2_auto_improver_20261008',
  sources:{
    officialRows:official.length,
    officialResolved:resolvedOfficial.length,
    ownerRows:ownerPlayed.length,
    ownerResolved:resolvedOwner.length
  },
  global,
  segments:{
    competition:segment(learningRows,r=>r.competition||'inconnu').slice(0,20),
    targetTeam:segment(learningRows,r=>r.target||'inconnu').slice(0,20),
    odds:segment(learningRows,r=>bucketOdd(r.odd)),
    minute:segment(learningRows,r=>bucketMinute(r.minute)),
    consensus:segment(learningRows,r=>r.consensus==null?'consensus inconnu':r.consensus+'/5'),
    color:segment(learningRows,r=>r.color||'couleur inconnue')
  },
  guardrails:{
    autoPromotionMinorMinN:MINOR_AUTO_MIN_N,
    autoPromotionMajorMinN:MAJOR_AUTO_MIN_N,
    hardRulesLocked:true,
    hardRules:['Top5/Bottom5','30–85','équipe cible à 0 but','cote fraîche >=1.60','consensus >=4/5'],
    canAutoPromoteMinor:global.n>=MINOR_AUTO_MIN_N,
    canAutoPromoteMajor:global.n>=MAJOR_AUTO_MIN_N
  },
  decision: global.n<MINOR_AUTO_MIN_N
    ? 'OBSERVATION_ONLY_SAMPLE_TOO_SMALL'
    : 'ELIGIBLE_FOR_SHADOW_EXPERIMENTS_ONLY',
  warnings:[]
};

if(global.n<10) report.warnings.push('Échantillon très faible : aucune conclusion sportive robuste.');
else if(global.n<30) report.warnings.push('Échantillon insuffisant pour auto-promotion : tendances descriptives uniquement.');
if(global.oddN<global.n) report.warnings.push('Certaines cotes réelles sont absentes : ROI calculé uniquement sur les lignes avec cote.');
if(!resolvedOfficial.length) report.warnings.push('Aucun signal officiel résolu actuellement : apprentissage principalement propriétaire/scanner.');

fs.mkdirSync(OUT_DIR,{recursive:true});
const latest=path.join(OUT_DIR,'latest.json');
const dated=path.join(OUT_DIR,`run-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
fs.writeFileSync(latest,JSON.stringify(report,null,2)+'\n',{mode:0o600});
fs.writeFileSync(dated,JSON.stringify(report,null,2)+'\n',{mode:0o600});

db.prepare(`INSERT INTO tlm_auto_improver_runs(created_at,policy_version,resolved_n,wins,losses,winrate,report_json)
VALUES(?,?,?,?,?,?,?)`).run(report.generatedAt,report.policyVersion,global.n,global.wins,global.losses,global.winrate,JSON.stringify(report));

console.log('TLM_AUTO_IMPROVER_FIRST_ANALYSIS');
console.log(JSON.stringify({
  generatedAt:report.generatedAt,
  sources:report.sources,
  global:report.global,
  decision:report.decision,
  warnings:report.warnings,
  topCompetitions:report.segments.competition.slice(0,5),
  odds:report.segments.odds,
  minute:report.segments.minute
},null,2));

db.close();

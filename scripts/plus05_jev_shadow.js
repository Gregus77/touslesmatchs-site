'use strict';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const CHOICES = ['SEND','WAIT','REANALYZE','REJECT'];

function finite(v){ return v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v); }

function config(env=process.env){
  const allowed=String(env.JEV_ALLOWED_RESPONSE_MODELS||env.JEV_MODEL||'').split(',').map(s=>s.trim()).filter(Boolean);
  return {
    enabled: env.PLUS05_JEV_SHADOW === '1',
    configured: Boolean(env.TYPESAFE_API_KEY && env.JEV_MODEL),
    model: env.JEV_MODEL || '',
    allowed_models: allowed.length ? allowed : [env.JEV_MODEL].filter(Boolean),
    timeout_ms: Math.min(20000,Math.max(1000,finite(env.JEV_TIMEOUT_MS)||8000)),
  };
}

function buildState({w,live,quote,deep,votes}){
  return {
    strategy:'favorite_team_over_0_5',
    match:{
      home:String(w.home||''),away:String(w.away||''),competition:String(w.competition||''),
      minute:finite(live?.minute),score_home:finite(live?.score_home),score_away:finite(live?.score_away)
    },
    target:{
      team:String(w.fav_name||''),side:String(w.side||''),rank:finite(w.fav_rank),
      opponent:String(w.opp_name||''),opponent_rank:finite(w.opp_rank),total_teams:finite(w.total_teams)
    },
    market:{selection:'favorite team over 0.5 goals FT',odd:finite(quote?.odd)},
    form:{
      favorite_scored_in_last5:finite(w.fav_scored_in),favorite_goals_last5:finite(w.fav_goals5),
      opponent_conceded_in_last5:finite(w.opp_conceded_in),risk_color:String(w.risk_color||'')
    },
    deep:{
      history_verified:deep?.history?.verified===true,history_seasons:finite(deep?.history?.seasons),
      favorite_rank_avg:finite(deep?.history?.favAvg),opponent_rank_avg:finite(deep?.history?.oppAvg),
      attackers_verified:deep?.attackers?.verified===true,forwards:finite(deep?.attackers?.forwards),
      missing_attackers:Array.isArray(deep?.attackers?.missingAttackers)?deep.attackers.missingAttackers.map(String).slice(0,8):[]
    },
    council:{yes:finite(votes?.yes),answered:finite(votes?.answered),total:finite(votes?.total)}
  };
}

function requestBody(model,state){
  return {
    model,state,
    questions:{
      plus05_decision:{
        type:'choice',
        instructions:'Assess only whether the named favorite is sufficiently supported to score at least one goal before full time from this live state. Do not invent data. This is SHADOW evaluation only and cannot publish a signal.',
        criteria:{
          SEND:'Evidence is strong enough now for the favorite team over 0.5 goals FT selection.',
          WAIT:'Candidate is plausible but current evidence is not strong enough yet; wait for a later live observation.',
          REANALYZE:'A material state change or inconsistency requires a fresh controlled analysis.',
          REJECT:'Evidence is insufficient or contradictory for the favorite to score before full time.'
        }
      }
    }
  };
}

function validate(body,allowed){
  if(!body||typeof body!=='object'||!allowed.includes(body.model)) throw new Error('model_unavailable');
  const a=body.answers?.plus05_decision;
  if(!a||a.type!=='choice'||!CHOICES.includes(a.choice)||typeof a.confidence!=='number'||!Number.isFinite(a.confidence)) throw new Error('invalid_schema');
  return {model:body.model,choice:a.choice,confidence:a.confidence,probabilities:a.probabilities||null};
}

function createPlus05JevShadow({env=process.env,transport=fetch,log=console}={}){
  const cfg=config(env);
  async function evaluate(input){
    if(!cfg.enabled) return {seat:'Jev',failed:true,error:'disabled'};
    if(!cfg.configured) return {seat:'Jev',failed:true,error:'not_configured'};
    const controller=new AbortController(); let timer;
    try{
      const res=await Promise.race([
        transport(ENDPOINT,{
          method:'POST',redirect:'error',signal:controller.signal,
          headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.TYPESAFE_API_KEY}`},
          body:JSON.stringify(requestBody(cfg.model,buildState(input)))
        }),
        new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('timeout'));},cfg.timeout_ms);})
      ]);
      if(!res.ok) throw new Error(`http_${res.status}`);
      const body=await res.json();
      const a=validate(body,cfg.allowed_models);
      const decision=a.choice==='SEND'?'yes':a.choice==='REJECT'?'no':'abstain';
      return {seat:'Jev',failed:false,decision,yes:decision==='yes',confidence:Math.round(a.confidence*100),raison:`Jev ${a.choice}`,rawChoice:a.choice};
    }catch(e){
      log.error?.('[plus05-jev-shadow]',e.message);
      return {seat:'Jev',failed:true,error:String(e.message||'jev_error')};
    }finally{clearTimeout(timer);}
  }
  return {config:cfg,evaluate,buildState,requestBody};
}

module.exports={CHOICES,config,buildState,requestBody,createPlus05JevShadow};

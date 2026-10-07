/* Official Goal05 popup/sound only. Does not create or publish predictions. */
(function(root){
  'use strict';
  function prepare(payload,now){
    var s=payload&&payload.signal;
    if(!payload||payload.ok!==true||payload.locked!==false||!s)return null;
    if(s.type!=='goal05_team_over_0_5'||s.status!=='active'||!s.id||!s.team||!s.home||!s.away)return null;
    var age=now-Date.parse(s.sentAt);
    // Delivery freshness, not a new sporting rule. Never beep for yesterday's file.
    if(!Number.isFinite(age)||age<0||age>120000||!Number.isFinite(Number(s.odd))||Number(s.odd)<=1)return null;
    return {id:String(s.id),team:String(s.team),home:String(s.home),away:String(s.away),odd:Number(s.odd).toFixed(2).replace('.',',')};
  }
  function claim(storage,account,id){
    if(!account||!id)return false;
    try{
      var key='tlm_goal05_seen_v1_'+encodeURIComponent(account);
      var seen=JSON.parse(storage.getItem(key)||'[]');
      if(!Array.isArray(seen)||seen.indexOf(id)!==-1)return false;
      storage.setItem(key,JSON.stringify(seen.concat(id).slice(-50)));
      return true;
    }catch(e){return false;}
  }
  var api={prepare:prepare,claim:claim};
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  if(root.TLMSignalAlerts)return;
  root.TLMSignalAlerts=api;
  var audio=null,busy=false,hideTimer=null,popup=null;
  function auth(){
    try{return {token:localStorage.getItem('tlm_session_token')||localStorage.getItem('tlm_token')||localStorage.getItem('tlm_session')||'',email:localStorage.getItem('tlm_email')||''};}
    catch(e){return {token:'',email:''};}
  }
  function enabled(){try{return localStorage.getItem('tlm_signal_alerts')==='1';}catch(e){return false;}}
  function status(text){var el=document.getElementById('tlm-alert-status');if(el)el.textContent=text;}
  function close(){if(popup)popup.hidden=true;clearTimeout(hideTimer);}
  function update(){
    var button=document.getElementById('tlm-alert-toggle');
    if(button){button.textContent=enabled()?'Désactiver popup + son':'Activer popup + son';button.setAttribute('aria-pressed',String(enabled()));}
    if(!enabled())close();
  }
  async function unlock(){
    try{
      var Ctx=root.AudioContext||root.webkitAudioContext;
      if(!Ctx)return false;
      if(!audio)audio=new Ctx();
      if(audio.state==='suspended')await audio.resume();
      return audio.state==='running';
    }catch(e){return false;}
  }
  function tone(){
    if(!audio||audio.state!=='running')return false;
    try{
      var osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime;
      osc.frequency.value=880;gain.gain.setValueAtTime(.001,t);
      gain.gain.exponentialRampToValueAtTime(.15,t+.03);gain.gain.exponentialRampToValueAtTime(.001,t+.5);
      osc.connect(gain);gain.connect(audio.destination);osc.onended=function(){osc.disconnect();gain.disconnect();};
      osc.start();osc.stop(t+.55);return true;
    }catch(e){return false;}
  }
  function show(s){
    if(!popup){
      popup=document.createElement('aside');popup.id='tlm-signal-popup';popup.className='tlm-signal-popup';popup.setAttribute('role','status');
      var title=document.createElement('strong');title.id='tlm-alert-title';popup.appendChild(title);
      var text=document.createElement('p');text.id='tlm-alert-text';popup.appendChild(text);
      var link=document.createElement('a');link.href='/live-ia';link.textContent='Voir Live IA';popup.appendChild(link);
      var button=document.createElement('button');button.type='button';button.textContent='Fermer';button.addEventListener('click',close);popup.appendChild(button);
      document.body.appendChild(popup);
    }
    document.getElementById('tlm-alert-title').textContent='Signal +0,5 : '+s.team;
    document.getElementById('tlm-alert-text').textContent=s.home+' — '+s.away+' · '+s.team+' +0,5 but · cote '+s.odd;
    popup.hidden=false;clearTimeout(hideTimer);hideTimer=setTimeout(close,9000);
    if(!tone())status('Popup actif. Touchez « Tester le son » pour autoriser le son sur cet appareil.');
  }
  async function check(){
    var session=auth();
    if(busy||document.hidden||!enabled()||!session.token||!session.email)return;
    busy=true;
    var controller=new AbortController(),requestTimer=setTimeout(function(){controller.abort();},10000);
    try{
      var response=await fetch('/api/goal05/latest?t='+Date.now(),{cache:'no-store',signal:controller.signal,headers:{Authorization:'Bearer '+session.token,'X-TLM-Email':session.email}});
      if(!response.ok)throw new Error('signal');
      var payload=await response.json();
      var deliver=function(){
        var current=auth();
        if(!enabled()||document.hidden||current.token!==session.token||current.email!==session.email)return;
        if(payload.locked!==false){close();status('Les alertes de signaux nécessitent un accès Premium actif.');return;}
        var s=prepare(payload,Date.now());
        if(s&&claim(localStorage,session.email,s.id))show(s);
      };
      if(navigator.locks&&navigator.locks.request)await navigator.locks.request('tlm-goal05-alert-'+session.email,deliver);
      else deliver();
    }catch(e){status('Vérification des signaux indisponible. Nouvelle tentative lorsque la page est ouverte.');}
    finally{clearTimeout(requestTimer);busy=false;}
  }
  api.check=check;
  document.addEventListener('DOMContentLoaded',function(){
    update();
    var toggle=document.getElementById('tlm-alert-toggle'),testSound=document.getElementById('tlm-alert-test');
    if(toggle)toggle.addEventListener('click',async function(){
      if(enabled()){try{localStorage.setItem('tlm_signal_alerts','0');}catch(e){}update();status('Alertes désactivées.');return;}
      try{localStorage.setItem('tlm_signal_alerts','1');}catch(e){status('Stockage bloqué : impossible de conserver votre choix.');return;}
      update();var audible=await unlock();if(audible)tone();
      status(audible?'Popup + son activés tant que la page est ouverte.':'Popup activé. Le son est bloqué ou non pris en charge par cet appareil.');
      check();
    });
    if(testSound)testSound.addEventListener('click',async function(){status(await unlock()&&tone()?'Son de test joué.':'Son bloqué ou non pris en charge par cet appareil.');});
    document.addEventListener('pointerdown',function(){if(enabled())unlock();},{passive:true});
    document.addEventListener('visibilitychange',function(){if(!document.hidden)check();});
    document.addEventListener('tlm-auth-change',function(){close();update();check();});
    root.addEventListener('storage',function(){close();update();check();});
    check();setInterval(check,30000);
  });
})(typeof window==='object'?window:globalThis);

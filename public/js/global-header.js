(function(){
  'use strict';
  var links=[['/','Accueil'],['/live-ia','Live IA'],['/performances','Résultats'],['/bankroll','Bankroll'],['/dashboard','Compte']];
  var languages=[['fr','Français'],['en','English'],['es','Español'],['pt','Português'],['ru','Русский'],['zh','中文']];
  function currentPath(){var p=location.pathname.replace(/\.html$/,'').replace(/\/$/,'')||'/';return p;}
  function active(href){var p=currentPath(),h=href.replace(/\/$/,'')||'/';return p===h;}
  function linkHtml(pair){return '<a href="'+pair[0]+'"'+(active(pair[0])?' aria-current="page"':'')+'>'+pair[1]+'</a>';}
  function authHeaders(){try{var token=localStorage.getItem('tlm_session_token')||localStorage.getItem('tlm_token')||localStorage.getItem('tlm_session')||'',email=localStorage.getItem('tlm_email')||'',headers={Accept:'application/json'};if(token)headers.Authorization='Bearer '+token;if(email)headers['X-TLM-Email']=email;return headers;}catch(e){return {Accept:'application/json'};}}
  function refreshStatus(){var el=document.getElementById('tlm-global-status');if(!el)return;el.textContent='Vérification…';fetch('/api/auth/access?t='+Date.now(),{headers:authHeaders(),cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('auth');return r.json();}).then(function(d){el.textContent=d&&d.locked===false?'Premium':'Gratuit';}).catch(function(){el.textContent='Gratuit';});}
  function selectedLanguage(){try{return localStorage.getItem('tlm_lang')||document.documentElement.lang||'fr';}catch(e){return 'fr';}}
  function mount(){
    document.querySelectorAll('header.tlm-global-header').forEach(function(n){n.remove();});
    // Ces pages ont un ancien bandeau supérieur et parfois un menu mobile
    // associé. La navigation basse de l'application n'est jamais ciblée.
    document.querySelectorAll('body:not(.tlm-page-app)>nav,body:not(.tlm-page-app)>.nav,body:not(.tlm-page-app)>.mmenu,.lang-float,.language-selector,.lang-selector').forEach(function(n){n.remove();});
    var header=document.createElement('header');header.className='tlm-global-header';header.setAttribute('data-shared-header','v1');
    header.innerHTML='<div class="tlm-gh-inner">'
      +'<a class="tlm-gh-brand" href="/"><img src="/logo192.png?v=brand-20260826" alt="Symbole TousLesMatchs"><span>TOUSLES<b>MATCHS</b></span></a>'
      +'<div class="tlm-gh-nav" aria-label="Navigation principale">'+links.map(linkHtml).join('')+'</div>'
      +'<div class="tlm-gh-right"><select class="tlm-gh-language" id="tlm-global-language" aria-label="Langue">'+languages.map(function(x){return '<option value="'+x[0]+'"'+(x[0]===selectedLanguage()?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select>'
      +'<span class="tlm-gh-status" id="tlm-global-status">Vérification…</span><a class="tlm-gh-account" href="/dashboard">Mon compte</a><button class="tlm-gh-menu" type="button" aria-label="Ouvrir le menu" aria-expanded="false">☰</button></div></div>'
      +'<div class="tlm-gh-drawer" id="tlm-global-drawer">'+links.map(linkHtml).join('')+'</div>';
    document.body.prepend(header);
    var select=header.querySelector('#tlm-global-language');
    select.addEventListener('change',function(){
      try{localStorage.setItem('tlm_lang',select.value);}catch(e){}
      document.documentElement.lang=select.value;
      if(window.i18n&&typeof window.i18n.setLang==='function')window.i18n.setLang(select.value);
      document.dispatchEvent(new CustomEvent('tlm-language-change',{detail:{lang:select.value}}));
    });
    var button=header.querySelector('.tlm-gh-menu'),drawer=header.querySelector('.tlm-gh-drawer');
    button.addEventListener('click',function(){var open=drawer.classList.toggle('open');button.setAttribute('aria-expanded',String(open));button.textContent=open?'×':'☰';});
    drawer.addEventListener('click',function(e){if(e.target.closest('a')){drawer.classList.remove('open');button.setAttribute('aria-expanded','false');button.textContent='☰';}});
    document.addEventListener('tlm-auth-change',refreshStatus);window.addEventListener('storage',refreshStatus);
    refreshStatus();
  }
  window.tlmMountGlobalHeader=mount;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

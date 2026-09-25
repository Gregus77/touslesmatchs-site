(function(){
  'use strict';
  var links=[['/','Accueil'],['/live-ia','Live IA'],['/performances','Résultats'],['/bankroll','Bankroll']];
  var accountLink=['/dashboard','Se connecter'];
  var languages=[['fr','Français'],['en','English'],['es','Español'],['pt','Português'],['ru','Русский'],['zh','中文']];
  function currentPath(){var p=location.pathname.replace(/\.html$/,'').replace(/\/$/,'')||'/';return p;}
  function active(href){var p=currentPath(),h=href.replace(/\/$/,'')||'/';return p===h;}
  function linkHtml(pair){return '<a href="'+pair[0]+'"'+(active(pair[0])?' aria-current="page"':'')+'>'+pair[1]+'</a>';}
  function authHeaders(){try{var token=localStorage.getItem('tlm_session_token')||localStorage.getItem('tlm_token')||localStorage.getItem('tlm_session')||'',email=localStorage.getItem('tlm_email')||'',headers={Accept:'application/json'};if(token)headers.Authorization='Bearer '+token;if(email)headers['X-TLM-Email']=email;return headers;}catch(e){return {Accept:'application/json'};}}
  var statusRequest=0;
  function translate(label){var lang=selectedLanguage();return window.TLMI18nAuto&&typeof window.TLMI18nAuto.translate==='function'?window.TLMI18nAuto.translate(label,lang):label;}
  function setAccount(connected,plan){
    var label=connected?'Mon compte':'Se connecter';
    document.querySelectorAll('.tlm-gh-account,.tlm-gh-drawer-account').forEach(function(el){el.textContent=translate(label);el.dataset.connected=connected?'true':'false';el.dataset.plan=plan||'';});
    var badge=document.getElementById('tlm-global-status');if(!badge)return;
    var labels={free:'Gratuit',standard:'Premium',premium:'Premium',elite:'Premium',vip:'Premium'};
    badge.hidden=!(connected&&labels[plan]);
    badge.textContent=badge.hidden?'':translate(labels[plan]);
  }
  function refreshStatus(){
    var seq=++statusRequest,headers=authHeaders();setAccount(false,null);
    if(!headers.Authorization)return;
    fetch('/api/auth/session?t='+Date.now(),{headers:headers,cache:'no-store'})
      .then(function(r){if(!r.ok)throw new Error('session');return r.json();})
      .then(function(d){if(seq===statusRequest&&d&&d.ok)setAccount(true,d.plan);})
      .catch(function(){
        // L'ancien code d'accès peut avoir un jeton différent de la session OTP.
        // Le contrôle de droits ne prouve un compte QUE lorsqu'il est déverrouillé.
        fetch('/api/auth/access?t='+Date.now(),{headers:headers,cache:'no-store'})
          .then(function(r){if(!r.ok)throw new Error('access');return r.json();})
          .then(function(d){if(seq===statusRequest&&d&&d.ok&&d.locked===false)setAccount(true,d.plan);})
          .catch(function(){if(seq===statusRequest)setAccount(false,null);});
      });
  }
  function selectedLanguage(){
    try{
      var selected=localStorage.getItem('tlm_lang')||(window.i18n&&typeof window.i18n.current==='function'?window.i18n.current():document.documentElement.lang)||'fr';
      selected=selected.slice(0,2).toLowerCase();
      return languages.some(function(x){return x[0]===selected;})?selected:'fr';
    }catch(e){return 'fr';}
  }
  function mount(){
    document.querySelectorAll('header.tlm-global-header').forEach(function(n){n.remove();});
    // Ces pages ont un ancien bandeau supérieur et parfois un menu mobile
    // associé. La navigation basse de l'application n'est jamais ciblée.
    document.querySelectorAll('body:not(.tlm-page-app)>nav,body:not(.tlm-page-app)>.nav,body:not(.tlm-page-app)>.mmenu,.lang-float,.language-selector,.lang-selector,#tlm-language-universal').forEach(function(n){n.remove();});
    var header=document.createElement('header');header.className='tlm-global-header';header.setAttribute('data-shared-header','v1');
    header.innerHTML='<div class="tlm-gh-inner">'
      +'<a class="tlm-gh-brand" href="/"><img src="/logo192.png?v=brand-20260826" alt="Symbole TousLesMatchs"><span>TOUSLES<b>MATCHS</b></span></a>'
      +'<div class="tlm-gh-nav" aria-label="Navigation principale">'+links.map(linkHtml).join('')+'</div>'
      +'<div class="tlm-gh-right"><select class="tlm-gh-language" id="tlm-global-language" aria-label="Langue">'+languages.map(function(x){return '<option value="'+x[0]+'"'+(x[0]===selectedLanguage()?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select>'
      +'<span class="tlm-gh-status" id="tlm-global-status" hidden></span><a class="tlm-gh-account" href="/dashboard"'+(active('/dashboard')?' aria-current="page"':'')+'>Se connecter</a><button class="tlm-gh-menu" type="button" aria-label="Ouvrir le menu" aria-expanded="false">☰</button></div></div>'
      +'<div class="tlm-gh-drawer" id="tlm-global-drawer">'+links.map(linkHtml).join('')+'<a class="tlm-gh-drawer-account" href="/dashboard"'+(active('/dashboard')?' aria-current="page"':'')+'>Se connecter</a></div>';
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
    document.addEventListener('tlm-language-change',function(){
      var lang=selectedLanguage();select.value=lang;
      header.querySelectorAll('.tlm-gh-nav a,.tlm-gh-drawer a').forEach(function(el){
        var path=el.getAttribute('href'),pair=links.concat([accountLink]).find(function(x){return x[0]===path;});
        if(pair&&path!=='/dashboard')el.textContent=translate(pair[1]);
      });
      var connected=header.querySelector('.tlm-gh-account').dataset.connected==='true';
      setAccount(connected,header.querySelector('.tlm-gh-account').dataset.plan||null);
    });
    document.addEventListener('tlm-auth-change',refreshStatus);window.addEventListener('storage',refreshStatus);
    refreshStatus();
  }
  window.tlmMountGlobalHeader=mount;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

/* TLM commercial-plan compatibility:
   Standard / Elite / VIP historiques = Premium côté client. */
(function(){
  function commercialPlan(p){
    p=String(p||'free').toLowerCase();
    return /^(standard|premium|elite|vip)$/.test(p) ? 'premium' : p;
  }

  window.tlmCommercialPlan=commercialPlan;

  function normalizeVisiblePlan(){
    document.querySelectorAll('.plan-badge,.dash-plan,[data-plan-badge]').forEach(function(el){
      var t=(el.textContent||'').trim().toLowerCase();
      if(t==='elite'||t==='vip'||t==='standard'){
        el.textContent='PREMIUM';
      }
    });
  }

  document.addEventListener('DOMContentLoaded',normalizeVisiblePlan);

  new MutationObserver(normalizeVisiblePlan).observe(document.documentElement,{
    childList:true,
    subtree:true,
    characterData:true
  });
})();


/* TLM-COMMERCIAL-ACCOUNT-BEGIN */
(function(){
  "use strict";

  function commercialPlan(value){
    var p=String(value||"free").toLowerCase();
    return /^(standard|premium|elite|vip)$/.test(p) ? "premium" : p;
  }

  function saveCommercialPlan(value){
    var p=commercialPlan(value);
    try { localStorage.setItem("tlm_plan",p); } catch(e){}
    return p;
  }

  function token(){
    try {
      return localStorage.getItem("tlm_token")
        || localStorage.getItem("tlm_session_token")
        || localStorage.getItem("token")
        || "";
    } catch(e){ return ""; }
  }

  function headers(){
    var t=token();
    return t ? {Authorization:"Bearer "+t} : {};
  }

  function formatDate(v){
    if(!v)return "";
    var d=new Date(v);
    if(isNaN(d.getTime()))return "";
    return d.toLocaleDateString("fr-FR",{
      day:"2-digit",month:"2-digit",year:"numeric"
    });
  }

  function paidActive(account){
    if(!account)return false;
    if(commercialPlan(account.plan)!=="premium")return false;
    if(String(account.status||"active").toLowerCase()==="expired")return false;
    if(account.expires_at && Date.parse(account.expires_at)<=Date.now())return false;
    return true;
  }

  async function account(){
    if(!token())return null;

    var urls=["/api/auth/session?t="+Date.now(),"/api/auth/me?t="+Date.now()];

    for(var i=0;i<urls.length;i++){
      try{
        var r=await fetch(urls[i],{
          headers:headers(),
          cache:"no-store",
          credentials:"same-origin"
        });
        if(!r.ok)continue;
        var d=await r.json();
        if(d && (d.ok!==false)){
          d.plan=saveCommercialPlan(d.plan);
          return d;
        }
      }catch(e){}
    }
    return null;
  }

  function normalizeVisiblePlan(){
    document.querySelectorAll(
      ".nav-plan-badge,.dash-plan,[data-plan-badge],[data-account-plan]"
    ).forEach(function(el){
      var t=(el.textContent||"").trim().toLowerCase();
      if(/^(elite|vip|standard|premium)$/.test(t)){
        el.textContent="PREMIUM";
        el.classList.remove("elite","vip","standard");
        el.classList.add("premium");
      }
    });
  }

  async function refreshCommercialUI(){
    normalizeVisiblePlan();

    var a=await account();
    if(!a)return;

    normalizeVisiblePlan();

    var active=paidActive(a);
    var expiry=formatDate(a.expires_at);

    var cta=document.getElementById("premium-main-cta");

    if(cta){
      if(active){
        cta.textContent=expiry
          ? "✓ Premium actif jusqu’au "+expiry
          : "✓ Votre abonnement Premium est actif";

        cta.removeAttribute("href");
        cta.setAttribute("aria-disabled","true");
        cta.style.cursor="default";
        cta.style.background="linear-gradient(135deg,#16a34a,#059669)";
        cta.onclick=function(e){e.preventDefault();return false;};
      }else{
        cta.textContent="Passer Premium — 14,90 €/mois";
        cta.href="/premium-checkout?lang=fr";
        cta.removeAttribute("aria-disabled");
        cta.style.cursor="pointer";
        cta.onclick=null;
      }
    }

    document.querySelectorAll("[data-premium-expiry]").forEach(function(el){
      el.textContent=active && expiry ? expiry : "";
    });
  }

  window.TLMCommercialAccount={
    commercialPlan:commercialPlan,
    savePlan:saveCommercialPlan,
    account:account,
    paidActive:paidActive,
    refresh:refreshCommercialUI
  };

  document.addEventListener("DOMContentLoaded",function(){
    refreshCommercialUI();
    setTimeout(refreshCommercialUI,400);
    setTimeout(refreshCommercialUI,1200);
  });
})();
/* TLM-COMMERCIAL-ACCOUNT-END */

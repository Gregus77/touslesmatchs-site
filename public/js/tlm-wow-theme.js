/* TousLesMatchs — activation du thème visuel global. Aucun comportement métier modifié. */
(function(){
  'use strict';
  var file=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  var config={
    'index.html':['home','Le Concile IA sportif'],
    'live-ia.html':['live','Analyse sportive en direct'],
    'performances.html':['performances','Résultats publics et vérifiés'],
    'dashboard.html':['dashboard','Mon espace TousLesMatchs'],
    'bankroll.html':['bankroll','Gestion intelligente du capital'],
    'faq.html':['faq','Comprendre le Concile IA'],
    'pronostic-ia.html':['editorial','Méthode et transparence'],
    'resultats-quotidiens.html':['resultats','Résultats du Concile'],
    'merci.html':['merci','Bienvenue dans le Concile'],
    'app.html':['app','Application TousLesMatchs'],
    'admin-dashboard.html':['admin','Pilotage du Concile'],
    'cgu.html':['legal','Informations légales'],
    'cgv.html':['legal','Informations légales'],
    'confidentialite.html':['legal','Protection de vos données'],
    'mentions-legales.html':['legal','Informations légales']
  };
  var item=config[file]||['standard','TousLesMatchs'];
  document.body.classList.add('tlm-wow','tlm-page-'+item[0]);
  document.documentElement.style.setProperty('color-scheme','dark');

  if(item[0]!=='home' && item[0]!=='app' && item[0]!=='admin'){
    var title=document.querySelector('.page-title, .dash-welcome, main h1, .page h1, .wrap h1, .container h1, body > h1');
    if(title && !title.classList.contains('tlm-wow-title')){
      title.classList.add('tlm-wow-title');
      title.setAttribute('data-kicker',item[1]);
    }
  }

  /* Marque la page active sans changer les URLs. */
  var links=document.querySelectorAll('nav a[href]');
  for(var i=0;i<links.length;i++){
    try{
      var target=new URL(links[i].getAttribute('href'),location.href).pathname.split('/').pop()||'index.html';
      if(target.toLowerCase()===file){links[i].setAttribute('aria-current','page');}
    }catch(e){}
  }

  /*
   * Marque officielle TousLesMatchs.
   * Le fichier est issu du paquet de marque officiel conservé dans Git.
   * Aucun emoji / étoile générique n'est utilisé comme identité de marque.
   */
  function restoreOfficialBrand(){
    if(item[0]==='app') return; /* app.html possède son propre header, patché séparément */

    var style=document.getElementById('tlm-official-brand-css');
    if(!style){
      style=document.createElement('style');
      style.id='tlm-official-brand-css';
      style.textContent='\
        .tlm-official-brand-mark{width:38px;height:38px;display:inline-block;flex:0 0 38px;object-fit:cover;border-radius:9px;box-shadow:0 0 15px rgba(79,214,242,.35)}\
        .nav-brand.tlm-brand-restored,.nav-logo.tlm-brand-restored{display:inline-flex!important;align-items:center!important;gap:9px!important;text-decoration:none!important}\
        @media(max-width:560px){.tlm-official-brand-mark{width:32px;height:32px;flex-basis:32px}.nav-brand.tlm-brand-restored,.nav-logo.tlm-brand-restored{gap:7px!important}}';
      document.head.appendChild(style);
    }

    var candidates=document.querySelectorAll('.nav-brand,.nav-logo,header .brand');
    for(var n=0;n<candidates.length;n++){
      var brand=candidates[n];
      if(brand.querySelector('img')) continue;
      var txt=(brand.textContent||'').replace(/\s+/g,'').toLowerCase();
      if(txt.indexOf('touslesmatchs')<0) continue;
      var img=document.createElement('img');
      img.className='tlm-official-brand-mark';
      img.src='/assets/brand/logo192.png?v=official-20260826';
      img.alt='Logo TousLesMatchs';
      img.width=38;
      img.height=38;
      brand.insertBefore(img,brand.firstChild);
      brand.classList.add('tlm-brand-restored');
    }
  }

  /*
   * Explication pédagogique de la fenêtre live 15'–40'.
   * Information d'interface uniquement : ne change ni le scoring, ni les votes,
   * ni la décision du moteur. Un signal déjà validé reste affiché après 40'.
   */
  function liveWindowCopy(minute,hasValidatedSignal){
    if(hasValidatedSignal){
      return {
        state:'validated',
        title:'✅ Signal déjà validé',
        text:"Le signal a été validé pendant la fenêtre d’analyse. Il reste disponible même si le match dépasse maintenant la 40e minute."
      };
    }
    if(isFinite(minute) && minute<15){
      return {
        state:'observe',
        title:'⏳ Observation du match',
        text:"Le Concile attend la 15e minute pour observer le rythme, les occasions et le comportement des deux équipes avant d’analyser."
      };
    }
    if(isFinite(minute) && minute>40){
      return {
        state:'closed',
        title:'🔒 Analyse indisponible après la 40e minute',
        text:"Après la 40e minute, les bookmakers disposent de beaucoup plus d’informations sur le déroulement du match et ajustent fortement leurs cotes. Elles deviennent généralement moins intéressantes. TousLesMatchs concentre donc ses analyses entre la 15e et la 40e minute."
      };
    }
    return {
      state:'active',
      title:'🧠 Analyse du Concile en cours',
      text:"C’est notre fenêtre d’analyse : les IA étudient le match en direct et cherchent une opportunité avec une cote encore intéressante."
    };
  }

  function decorateLiveCards(){
    if(item[0]!=='live') return;

    if(!document.getElementById('tlm-live-window-css')){
      var style=document.createElement('style');
      style.id='tlm-live-window-css';
      style.textContent='\
        .tlm-live-window-note{margin-top:12px;padding:11px 12px;border-radius:11px;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.035);font-size:12px;line-height:1.5;color:#c4c9e6}\
        .tlm-live-window-note strong{display:block;margin-bottom:3px;color:#f7f8ff;font-size:12.5px}\
        .tlm-live-window-note.observe{border-color:rgba(247,169,30,.28);background:rgba(247,169,30,.07)}\
        .tlm-live-window-note.active{border-color:rgba(51,220,245,.3);background:rgba(51,220,245,.07)}\
        .tlm-live-window-note.closed{border-color:rgba(148,155,196,.22);background:rgba(148,155,196,.055)}\
        .tlm-live-window-note.validated{border-color:rgba(28,201,143,.36);background:rgba(28,201,143,.08)}';
      document.head.appendChild(style);
    }

    var cards=document.querySelectorAll('.match-card');
    for(var c=0;c<cards.length;c++){
      var card=cards[c];
      var minEl=card.querySelector('.mc-minute');
      if(!minEl) continue;
      var raw=String(minEl.textContent||'');
      var match=raw.match(/(\d{1,3})/);
      if(!match) continue;
      var minute=Number(match[1]);
      if(!isFinite(minute)) continue;

      var cardText=String(card.textContent||'').toLowerCase();
      var hasValidatedSignal=!!card.querySelector('.mc-analysis.visible .mc-analysis-bet,.conf-badge.green,[data-pinned-signal]') || /signal\s+valid[ée]|analyse\s+termin[ée]e|gagn[ée]|perdu/.test(cardText);
      var copy=liveWindowCopy(minute,hasValidatedSignal);
      var note=card.querySelector('.tlm-live-window-note');
      if(!note){
        note=document.createElement('div');
        note.className='tlm-live-window-note';
        var cta=card.querySelector('.mc-cta');
        if(cta) cta.insertAdjacentElement('beforebegin',note);
        else card.appendChild(note);
      }
      note.className='tlm-live-window-note '+copy.state;
      note.innerHTML='<strong>'+copy.title+'</strong><span>'+copy.text+'</span>';
    }
  }

  var liveObserver=null;
  function mountLiveWindowObserver(){
    if(item[0]!=='live') return;
    decorateLiveCards();
    if(!window.MutationObserver || liveObserver) return;
    var root=document.querySelector('.matches-wrap')||document.body;
    var timer=0;
    liveObserver=new MutationObserver(function(){
      clearTimeout(timer);
      timer=setTimeout(decorateLiveCards,80);
    });
    liveObserver.observe(root,{childList:true,subtree:true,characterData:true});
  }

  /*
   * Couche conversion accueil — ajout ciblé, sans remplacer le Hero WOW,
   * sans modifier Stripe/API/Telegram et sans supprimer les sections existantes.
   */
  function enhanceHomeConversion(){
    if(item[0]!=='home' || window.__tlmHomeConversionMounted) return;
    window.__tlmHomeConversionMounted=true;

    var style=document.createElement('style');
    style.id='tlm-home-conversion-css';
    style.textContent='\
      .tlm-conv-strip{margin:16px 0;padding:14px;border:1px solid rgba(255,107,0,.34);border-radius:16px;background:linear-gradient(135deg,rgba(255,107,0,.09),rgba(17,23,62,.88));box-shadow:0 18px 45px rgba(0,0,0,.22)}\
      .tlm-conv-strip-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}\
      .tlm-conv-proof{padding:12px;text-align:center;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(5,9,29,.48)}\
      .tlm-conv-proof b{display:block;color:#ff9b54;font-size:18px;line-height:1.1}\
      .tlm-conv-proof span{display:block;margin-top:5px;color:#c8cee9;font-size:10.5px;line-height:1.35}\
      .tlm-conv-message{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;margin:16px 0;padding:18px 20px;border:1px solid rgba(56,215,255,.28);border-radius:16px;background:linear-gradient(120deg,rgba(11,20,55,.96),rgba(33,22,70,.9))}\
      .tlm-conv-message strong{display:block;color:#fff;font-size:clamp(18px,2vw,25px);letter-spacing:-.03em}\
      .tlm-conv-message p{margin:6px 0 0!important;color:#bfc9e7!important;font-size:12.5px;line-height:1.5}\
      .tlm-conv-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}\
      .tlm-conv-btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:10px 16px;border-radius:11px;text-decoration:none;font-size:13px;font-weight:900;white-space:nowrap}\
      .tlm-conv-btn.primary{background:#ff6b00;color:#fff;box-shadow:0 10px 26px rgba(255,107,0,.25)}\
      .tlm-conv-btn.secondary{border:1px solid rgba(255,255,255,.17);background:rgba(255,255,255,.05);color:#fff}\
      .tlm-price-focus{margin:12px 0 18px;text-align:center;color:#bfc9e7;font-size:12px}\
      .tlm-price-focus b{color:#fff}.tlm-price-focus em{font-style:normal;color:#ff9b54;font-weight:900}\
      .tlm-mobile-conv{display:none;position:fixed;left:10px;right:10px;bottom:10px;z-index:9997;padding:10px;border:1px solid rgba(255,107,0,.55);border-radius:14px;background:rgba(6,11,29,.96);box-shadow:0 18px 48px rgba(0,0,0,.5);backdrop-filter:blur(15px)}\
      .tlm-mobile-conv a{display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:10px;background:#ff6b00;color:#fff;text-decoration:none;font-size:13px;font-weight:900}\
      @media(max-width:760px){.tlm-conv-strip-grid{grid-template-columns:1fr 1fr}.tlm-conv-message{grid-template-columns:1fr}.tlm-conv-actions{justify-content:stretch;display:grid}.tlm-conv-actions a{width:100%}.tlm-mobile-conv{display:block}body.tlm-page-home{padding-bottom:76px}}\
      @media(max-width:390px){.tlm-conv-strip-grid{grid-template-columns:1fr}.tlm-conv-proof{padding:10px}}';
    document.head.appendChild(style);

    var heroRow=document.querySelector('.row-hero');
    if(heroRow && !document.getElementById('tlm-conv-strip')){
      var strip=document.createElement('section');
      strip.id='tlm-conv-strip';
      strip.className='tlm-conv-strip';
      strip.setAttribute('aria-label','Les points clés TousLesMatchs');
      strip.innerHTML='<div class="tlm-conv-strip-grid">'
        +'<div class="tlm-conv-proof"><b>5 IA</b><span>analysent séparément le même match</span></div>'
        +'<div class="tlm-conv-proof"><b>4/5</b><span>accord IA minimum mis en avant</span></div>'
        +'<div class="tlm-conv-proof"><b>Public</b><span>gagnés et perdus restent consultables</span></div>'
        +'<div class="tlm-conv-proof"><b>18+</b><span>aucun résultat ni gain n’est garanti</span></div>'
        +'</div>';
      heroRow.insertAdjacentElement('afterend',strip);
    }

    var proof=document.getElementById('proof-bar') || document.querySelector('.proof-bar');
    if(proof && !document.getElementById('tlm-conv-message')){
      var message=document.createElement('section');
      message.id='tlm-conv-message';
      message.className='tlm-conv-message';
      message.innerHTML='<div><strong>Voyez les résultats avant de payer.</strong>'
        +'<p>Consultez l’historique réel, créez votre accès gratuit, puis choisissez une offre seulement si le service vous convient.</p></div>'
        +'<div class="tlm-conv-actions">'
        +'<a class="tlm-conv-btn primary" href="#email-capture-card">Recevoir le prochain signal gratuit</a>'
        +'<a class="tlm-conv-btn secondary" href="/performances">Voir les résultats</a>'
        +'</div>';
      var card=proof.closest('.card') || proof;
      card.insertAdjacentElement('afterend',message);
    }

    var plans=document.getElementById('plans');
    if(plans && !document.getElementById('tlm-price-focus')){
      var focus=document.createElement('div');
      focus.id='tlm-price-focus';
      focus.className='tlm-price-focus';
      focus.innerHTML='<b>Deux offres actives :</b> <em>4,90 €</em> jusqu’à 3 signaux/jour ou <em>14,90 €</em> jusqu’à 10 signaux/jour · sans engagement.';
      plans.insertAdjacentElement('beforebegin',focus);
    }

    if(!document.getElementById('tlm-mobile-conv')){
      var mobile=document.createElement('div');
      mobile.id='tlm-mobile-conv';
      mobile.className='tlm-mobile-conv';
      mobile.innerHTML='<a href="#email-capture-card">Recevoir le prochain signal gratuit</a>';
      document.body.appendChild(mobile);
    }
  }

  function bootTlmUi(){
    restoreOfficialBrand();
    enhanceHomeConversion();
    mountLiveWindowObserver();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootTlmUi);
  else bootTlmUi();
})();

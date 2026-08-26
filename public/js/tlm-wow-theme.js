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

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',enhanceHomeConversion);
  else enhanceHomeConversion();
})();

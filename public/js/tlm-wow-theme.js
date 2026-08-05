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
})();

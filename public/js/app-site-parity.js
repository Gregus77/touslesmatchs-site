/* The Android entry opens the canonical site: one UI, one set of statistics. */
(function(){
  'use strict';
  var query=new URLSearchParams(window.location.search);
  var routes={pick:'/',live:'/live-ia',perf:'/performances',me:'/dashboard'};
  var route=routes[query.get('tab')]||'/';
  var target=new URL(route,window.location.origin);
  target.searchParams.set('source','android');
  target.searchParams.set('app','site');
  var native=query.get('native');
  if(native&&/^\d{1,6}$/.test(native))target.searchParams.set('native',native);
  var lang=query.get('lang');
  if(['fr','en','es','pt','ru','zh'].indexOf(lang)!==-1){
    target.searchParams.set('lang',lang);
    try{window.localStorage.setItem('tlm_lang',lang);}catch(e){}
  }
  document.documentElement.classList.add('app-site-loading');
  window.location.replace(target.pathname+target.search);
})();

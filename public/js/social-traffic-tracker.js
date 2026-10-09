(function(){
  'use strict';
  // Reuse the site's existing pixel: no cookies, no localStorage, no fingerprinting.
  // Only one event for this full page load; client never sends credentials.
  var q=new URLSearchParams(window.location.search||'');
  var url='/api/t?p='+encodeURIComponent(location.pathname)
    +'&r='+encodeURIComponent((function(){try{return document.referrer?new URL(document.referrer).origin:'';}catch(e){return '';}})())
    +'&s='+encodeURIComponent(q.get('utm_source')||'')
    +'&m='+encodeURIComponent(q.get('utm_medium')||'')
    +'&c='+encodeURIComponent(q.get('utm_campaign')||'')
    +'&_='+Date.now();
  var beacon=new Image();
  beacon.src=url;
})();
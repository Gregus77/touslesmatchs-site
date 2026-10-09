(function () {
  'use strict';
  // Anonymous acquisition measurement from existing /api/t. No cookies, no device fingerprint.
  var q=new URLSearchParams(location.search);
  var names={facebook:'facebook',fb:'facebook',instagram:'instagram',ig:'instagram',
    youtube:'youtube',yt:'youtube',tiktok:'tiktok',telegram:'telegram'};
  function source(raw){return names[String(raw||'').toLowerCase().trim()]||'';}
  function refSource(raw){
    try{
      var h=new URL(raw).hostname.toLowerCase().replace(/^www\./,'');
      if(/(^|\.)facebook\.com$|(^|\.)fb\.com$/.test(h))return 'facebook';
      if(/(^|\.)instagram\.com$/.test(h))return 'instagram';
      if(/(^|\.)youtube\.com$|^youtu\.be$/.test(h))return 'youtube';
      if(/(^|\.)tiktok\.com$/.test(h))return 'tiktok';
      if(/(^|\.)t\.me$/.test(h))return 'telegram';
    }catch(_){}
    return '';
  }
  function safeTag(v){return String(v||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,65);}
  var ref='';
  try{if(document.referrer){var u=new URL(document.referrer);ref=u.origin+u.pathname;}}catch(_){}
  var src=source(q.get('utm_source'))||(!q.has('utm_source')?refSource(ref):'');
  var medium=safeTag(q.get('utm_medium'))||'social';
  var campaign=safeTag(q.get('utm_campaign'));
  var key='tlm_social_attribution_session_v1';
  try{
    var stored=JSON.parse(sessionStorage.getItem(key)||'null');
    if(src){sessionStorage.setItem(key,JSON.stringify({src:src,medium:medium,campaign:campaign,at:Date.now()}));}
    else if(!q.has('utm_source')&&stored&&Date.now()-Number(stored.at)<30*60000&&source(stored.src)){
      src=source(stored.src);medium=stored.medium||'social';campaign=stored.campaign||'';
    }
  }catch(_){}
  function send(page){
    var u='/api/t?p='+encodeURIComponent(page)+'&r='+encodeURIComponent(ref)
      +'&s='+encodeURIComponent(src)+'&m='+encodeURIComponent(src?medium:'')
      +'&c='+encodeURIComponent(campaign)+'&_='+Date.now();
    new Image().src=u;
  }
  send(location.pathname);
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest&&e.target.closest('a[href]');
    if(!a)return;
    var href=a.getAttribute('href')||'';
    if(/\/api\/premium-checkout(?:\?|$)/.test(href))send('/event/premium-click');
  },true);
})();

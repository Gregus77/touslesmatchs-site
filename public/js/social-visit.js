(function(){
  'use strict';
  // Do not install cookies or send personal details. Reuse the same site-owned /api/t beacon.
  // This file is for app/results pages only; home and Live IA already have a beacon.
  if(window.__tlmSocialTrafficBeacon)return;
  window.__tlmSocialTrafficBeacon=true;
  try {
    var q=new URLSearchParams(window.location.search);
    var social=window.tlmSourceAttribution||{};
    var ref='';
    try { if(document.referrer)ref=new URL(document.referrer).origin; } catch(_){}
    var image=new Image();
    image.src='/api/t?p='+encodeURIComponent(location.pathname)
      +'&r='+encodeURIComponent(ref)
      +'&s='+encodeURIComponent((social.source||q.get('utm_source')||'').slice(0,60))
      +'&m='+encodeURIComponent((social.medium||q.get('utm_medium')||'').slice(0,60))
      +'&c='+encodeURIComponent((social.campaign||q.get('utm_campaign')||'').slice(0,60))
      +'&_='+Date.now();
  } catch(_){}
})();

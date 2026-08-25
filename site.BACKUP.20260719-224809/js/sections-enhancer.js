/* sections-enhancer.js — TousLesMatchs: Comment ca marche, Qui sommes-nous, SEO */
(function(){
'use strict';

// ─── PRIORITÉ 4.8 : Comment ca marche (Concile IA etapes) ───
function injectHowItWorks(){
  if(document.getElementById('how-it-works-enhanced'))return;
  var faqSection=document.getElementById('faq');
  if(!faqSection)return;

  var section=document.createElement('section');
  section.id='how-it-works-enhanced';
  section.className='section-wrap';
  section.style.cssText='border-top:1px solid var(--b1);';

  section.innerHTML='\
    <div class="s-eyebrow">Methode</div>\
    <div class="s-title">Comment ca marche</div>\
    <div class="s-sub">Le Concile IA en 4 etapes transparentes — de la collecte a la publication.</div>\
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:24px">\
      <div style="background:rgba(52,211,153,.06);border:1px solid rgba(52,211,153,.18);border-radius:16px;padding:24px 20px">\
        <div style="width:40px;height:40px;border-radius:10px;background:rgba(52,211,153,.12);display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:12px">\ud83d\udee1\ufe0f</div>\
        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#34d399;margin-bottom:6px">Etape 1</div>\
        <div style="font-size:16px;font-weight:800;letter-spacing:-.02em;margin-bottom:8px">Collecte multicanal</div>\
        <div style="font-size:13px;color:var(--muted2);line-height:1.7">A 6h00, Hermes collecte les matchs via API-SPORTS et verifie chaque donnee sur 3 sources : SofaScore, FBref, Transfermarkt. Aucun match non confirme.</div>\
      </div>\
      <div style="background:rgba(34,211,238,.06);border:1px solid rgba(34,211,238,.18);border-radius:16px;padding:24px 20px">\
        <div style="width:40px;height:40px;border-radius:10px;background:rgba(34,211,238,.12);display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:12px">\ud83e\udde0</div>\
        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#22d3ee;margin-bottom:6px">Etape 2</div>\
        <div style="font-size:16px;font-weight:800;letter-spacing:-.02em;margin-bottom:8px">6 agents analysent</div>\
        <div style="font-size:13px;color:var(--muted2);line-height:1.7">Chaque IA specialisee croise les stats, la forme, les blessures, les duels et des milliers de points de donnees. Chaque agent produit un signal independant.</div>\
      </div>\
      <div style="background:rgba(129,140,248,.06);border:1px solid rgba(129,140,248,.18);border-radius:16px;padding:24px 20px">\
        <div style="width:40px;height:40px;border-radius:10px;background:rgba(129,140,248,.12);display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:12px">\u2696\ufe0f</div>\
        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#818cf8;margin-bottom:6px">Etape 3</div>\
        <div style="font-size:16px;font-weight:800;letter-spacing:-.02em;margin-bottom:8px">Le Chief tranche</div>\
        <div style="font-size:13px;color:var(--muted2);line-height:1.7">Le Concile confronte les avis. Le Chief arbitre les desaccords, rejette les signaux trop fragiles. Si le doute est trop fort : NO BET.</div>\
      </div>\
      <div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.18);border-radius:16px;padding:24px 20px">\
        <div style="width:40px;height:40px;border-radius:10px;background:rgba(245,158,11,.12);display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:12px">\ud83d\udce9</div>\
        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#f59e0b;margin-bottom:6px">Etape 4</div>\
        <div style="font-size:16px;font-weight:800;letter-spacing:-.02em;margin-bottom:8px">Publication & suivi</div>\
        <div style="font-size:13px;color:var(--muted2);line-height:1.7">Pick publie a 7h00 sur le site + email + Telegram. Chaque resultat est trace et integre pour ameliorer le modele.</div>\
      </div>\
    </div>\
    <style>@media(max-width:640px){#how-it-works-enhanced>div:last-child{grid-template-columns:1fr!important}}</style>\
  ';

  faqSection.parentNode.insertBefore(section,faqSection);

  // Remove the duplicate hidden how section if it exists
  var hiddenHow=document.querySelector('section[style*="display:none"] h3')||document.querySelector('section[style*="display:none"] div[style*="font-size:clamp"]');
  // Actually let's just leave the old hidden one alone — no harm done
}

// ─── PRIORITÉ 4.10 : Qui sommes-nous ───
function injectAboutUs(){
  if(document.getElementById('about-us-section'))return;
  var howSection=document.getElementById('how-it-works-enhanced');
  var refSection=document.getElementById('faq');
  if(!refSection)return;

  var section=document.createElement('section');
  section.id='about-us-section';
  section.className='section-wrap';
  section.style.cssText='border-top:1px solid var(--b1);';

  section.innerHTML='\
    <div class="s-eyebrow">A propos</div>\
    <div class="s-title">Qui sommes-nous</div>\
    <div class="s-sub">TousLesMatchs.com est ne d\'une conviction : les parieurs meritent mieux que des pronostics au doigte mouille.</div>\
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px">\
      <div style="background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.15);border-radius:14px;padding:24px">\
        <div style="font-size:24px;margin-bottom:10px">\ud83e\udd16</div>\
        <div style="font-size:16px;font-weight:800;margin-bottom:8px">Notre mission</div>\
        <div style="font-size:13px;color:var(--muted2);line-height:1.7">Democratiser l\'analyse sportive assistee par IA. Nous mettons la puissance de 6 agents specialises + 1 Chief au service de tous les parieurs, debutants ou confirmes.</div>\
      </div>\
      <div style="background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.15);border-radius:14px;padding:24px">\
        <div style="font-size:24px;margin-bottom:10px">\ud83c\udfaf</div>\
        <div style="font-size:16px;font-weight:800;margin-bottom:8px">Notre engagement</div>\
        <div style="font-size:13px;color:var(--muted2);line-height:1.7">Transparence totale. Tous nos resultats sont publics. Nous ne cachons aucun pick perdu. Nos statistiques sont calculees automatiquement depuis notre base de donnees.</div>\
      </div>\
    </div>\
    <div style="margin-top:20px;padding:20px;background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.15);border-radius:14px">\
      <div style="font-size:14px;font-weight:700;margin-bottom:8px">\ud83d\udca1 Nos valeurs</div>\
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">\
        <div style="font-size:13px;color:var(--muted2);line-height:1.5"><span style="color:#10b981;font-weight:700">\u2713</span> Transparence des resultats</div>\
        <div style="font-size:13px;color:var(--muted2);line-height:1.5"><span style="color:#10b981;font-weight:700">\u2713</span> Jeu responsable (18+)</div>\
        <div style="font-size:13px;color:var(--muted2);line-height:1.5"><span style="color:#10b981;font-weight:700">\u2713</span> Donnees verifiees multi-sources</div>\
        <div style="font-size:13px;color:var(--muted2);line-height:1.5"><span style="color:#10b981;font-weight:700">\u2713</span> Amelioration continue du modele</div>\
      </div>\
    </div>\
    <div style="margin-top:16px;text-align:center;padding:16px;background:rgba(255,255,255,.02);border:1px solid var(--b1);border-radius:10px">\
      <div style="font-size:13px;color:var(--muted2);line-height:1.6"><span>\ud83d\udce7 Contact :</span> <a href="mailto:contact@touslesmatchs.com" style="color:var(--indigo2);text-decoration:none">contact@touslesmatchs.com</a></div>\
    </div>\
  ';

  refSection.parentNode.insertBefore(section,refSection);
}

// ─── PRIORITÉ 3.6-3.7 : SEO dynamique ───
function enhanceSEO(){
  // Meta description plus riche
  var metaDesc=document.querySelector('meta[name="description"]');
  if(metaDesc){
    metaDesc.content='Pronostics sportifs IA par le Concile Hermes - 6 agents + 1 Chief. '+document.querySelector('#kpi-winrate')?.textContent||'77%'+' de winrate. Resultats verifies, historique transparent. Testez des 1\u20ac.';
  }

  // Ajouter une meta author
  var authorMeta=document.createElement('meta');
  authorMeta.name='author';
  authorMeta.content='TousLesMatchs.com';
  document.head.appendChild(authorMeta);

  // JSON-LD par match dans la feed
  function addMatchJSONLD(){
    var picks=window.PICKS_FEED||[];
    if(!picks.length)return;

    // Nettoyer les anciens JSON-LD de match
    document.querySelectorAll('script[type="application/ld+json"][data-match]').forEach(function(el){el.remove();});

    var existingGraph=null;
    var mainScript=document.querySelector('script[type="application/ld+json"]');
    if(mainScript){
      try{existingGraph=JSON.parse(mainScript.textContent);}catch(e){}
    }

    picks.slice(0,5).forEach(function(p,idx){
      if(p.status!=='finished')return;
      var isWin=p.result==='win';
      var matchSchema={
        '@context':'https://schema.org',
        '@type':'SportsEvent',
        'name':(p.home||'')+' vs '+(p.away||''),
        'description':'Pronostic: '+(p.pick||'')+' | Cote @'+(p.cote||'')+' | Resultat: '+(isWin?'Gagne':'Perdu'),
        'startDate':p.date||'',
        'sport':p.competition||'Football',
        'homeTeam':{'@type':'SportsTeam','name':p.home||''},
        'awayTeam':{'@type':'SportsTeam','name':p.away||''}
      };
      var script=document.createElement('script');
      script.type='application/ld+json';
      script.setAttribute('data-match',String(idx));
      script.textContent=JSON.stringify(matchSchema);
      document.head.appendChild(script);
    });
  }

  // Observer les changements de PICKS_FEED
  var origPush=Array.prototype.push;
  if(window.PICKS_FEED){
    addMatchJSONLD();
  }
  setTimeout(addMatchJSONLD,2000);
}

// ─── PRIORITÉ 5.11 : Mobile responsive ───
function fixMobileResponsive(){
  var style=document.createElement('style');
  style.textContent='\
    @media(max-width:768px){\
      .section-wrap{padding:60px 16px!important}\
      .hero{padding:120px 16px 80px!important}\
      .plans-grid{grid-template-columns:1fr!important}\
      nav{padding:0 16px!important}\
      .nav-center{display:none!important}\
      .nav-right{gap:6px!important}\
      .nav-cta,.nav-login{font-size:12px;padding:6px 12px!important}\
      .hero-stats{flex-wrap:wrap!important}\
      .hs{padding:12px 10px!important}\
      .hs-val{font-size:22px!important}\
      .teams-block{flex-direction:column!important;gap:12px!important}\
      .score-col{min-width:80px!important}\
      .sd{font-size:32px!important}\
      .team-abbr{width:42px;height:42px;font-size:13px}\
      .pick-head{flex-direction:column!important;gap:8px!important;align-items:flex-start!important}\
      .ph-left{flex-wrap:wrap!important}\
      .pf-past-item{flex-wrap:wrap!important;gap:4px!important}\
      .pf-section-title{font-size:13px!important}\
      .roi-kpis{flex-wrap:wrap!important}\
      .roi-kpi{min-width:calc(50% - 8px)!important}\
      .tlm-live-match{grid-template-columns:1fr!important;text-align:center!important}\
      .tlm-live-team-name{font-size:20px!important}\
      .pc{padding:20px!important}\
      .pc-price{font-size:28px!important}\
      .community-grid{grid-template-columns:repeat(2,1fr)!important}\
      .steps .step{flex-direction:column!important;text-align:center!important}\
      .step-n{margin:0 auto 8px!important}\
      #about-us-section>div:first-of-type{grid-template-columns:1fr!important}\
      #history-table{font-size:11px!important}\
      #history-table th,#history-table td{padding:8px 6px!important}\
      .bm-btn{font-size:11px!important;padding:8px 10px!important}\
      .tg-plans-cta,.tg-pick-banner{flex-direction:column!important;text-align:center!important;gap:12px!important}\
      .social-cta-row{flex-direction:column!important;gap:8px!important}\
      #proof-block{grid-template-columns:repeat(2,1fr)!important}\
      .proof-item{padding:8px 4px!important}\
      .proof-val{font-size:16px!important}\
      #ia-votes-summary{flex-direction:column!important;align-items:flex-start!important}\
      #ia-votes-summary>div:last-child{border-left:none!important;padding-left:0!important;border-top:1px solid rgba(255,255,255,.1);padding-top:6px;width:100%}\
      .how-section .steps{gap:16px!important}\
      #history-barchart{height:80px!important}\
      #history-barchart>div{width:20px!important}\
    }\
    @media(max-width:480px){\
      .hero-title{font-size:28px!important}\
      .hero-sub{font-size:14px!important}\
      .cta-main,.cta-ghost{font-size:13px!important;padding:12px 20px!important}\
      #history-table{font-size:10px!important}\
      #history-table th,#history-table td{padding:6px 4px!important}\
      .search-box{flex-direction:column!important}\
    }\
  ';
  document.head.appendChild(style);
}

// ─── INIT ───
var init=function(){
  var check=function(){
    if(document.getElementById('faq')){
      injectHowItWorks();
      injectAboutUs();
      fixMobileResponsive();
    }else{
      setTimeout(check,500);
    }
  };
  check();
  setTimeout(enhanceSEO,3000);
  // Re-check SEO after data loads
  setTimeout(function(){enhanceSEO();window.PICKS_FEED&&addMatchJSONLD&&addMatchJSONLD();},5000);
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();

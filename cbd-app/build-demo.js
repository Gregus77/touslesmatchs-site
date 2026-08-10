'use strict';
/**
 * Genere demo.html : version autonome (un seul fichier, aucun serveur)
 * de CBD Atlas, avec les donnees de demonstration figees dedans.
 *   node build-demo.js
 */
const fs = require('fs');
const path = require('path');

const ency = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'encyclopedia.json'), 'utf8'));
const { PLANS, svgProduit } = require('./server');

const db = { distributeurs: [], boutiques: [], produits: [], commandes: [], abonnements: [], seq: 1 };
require('./lib/seed').seed(db);

const planDe = (id) => PLANS.find((p) => p.id === id) || PLANS[0];
const dataUri = (t) => 'data:image/svg+xml;base64,' + Buffer.from(svgProduit(t)).toString('base64');

const IMAGES = {};
ency.types.forEach((t) => { IMAGES[t.id] = dataUri(t.id); });

const boutiques = db.boutiques.map((s) => {
  const d = db.distributeurs.find((x) => x.id === s.distributeur_id);
  const pl = planDe(d.plan);
  return Object.assign({}, s, {
    enseigne: d.nom, plan: pl.id, vente_en_ligne: pl.marketplace, mise_en_avant: pl.mise_en_avant,
    produits: db.produits.filter((p) => p.boutique_id === s.id).length
  });
});

const produits = db.produits.map((p) => {
  const s = db.boutiques.find((b) => b.id === p.boutique_id);
  const d = db.distributeurs.find((x) => x.id === p.distributeur_id);
  const pl = planDe(d.plan);
  return Object.assign({}, p, {
    boutique: s.nom, ville: s.ville, livraison: s.livraison, frais_livraison: s.frais_livraison,
    delai_livraison_h: s.delai_livraison_h, enseigne: d.nom,
    achetable: pl.marketplace, mise_en_avant: pl.mise_en_avant
  });
});

const DATA = { ency, boutiques, produits, plans: PLANS, images: IMAGES };

const html = `<title>CBD Atlas — encyclopédie et marketplace du CBD légal</title>
<style>
:root{
  --papier:#f6f4ee; --surface:#fffefb; --surface-2:#efece3;
  --encre:#16211b; --encre-doux:#5a6a60; --trait:#ddd8cb;
  --foret:#1f4a35; --sauge:#7d9c88; --cuivre:#a9682f;
  --alerte:#8f2f26; --valide:#2c6b45;
  --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --r:10px; --max:1120px;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --papier:#101512; --surface:#171e1a; --surface-2:#1e2621;
  --encre:#e7ece7; --encre-doux:#9aa89f; --trait:#2b352e;
  --foret:#8cc9a4; --sauge:#5f8672; --cuivre:#d79a62;
  --alerte:#e0837a; --valide:#7fc79c;
}}
:root[data-theme="dark"]{
  --papier:#101512; --surface:#171e1a; --surface-2:#1e2621;
  --encre:#e7ece7; --encre-doux:#9aa89f; --trait:#2b352e;
  --foret:#8cc9a4; --sauge:#5f8672; --cuivre:#d79a62;
  --alerte:#e0837a; --valide:#7fc79c;
}
*{box-sizing:border-box}
body{margin:0;background:var(--papier);color:var(--encre);font-family:var(--sans);line-height:1.55;
  font-size:15px;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:var(--serif);font-weight:600;letter-spacing:-.01em;text-wrap:balance;margin:0}
h1{font-size:clamp(1.9rem,4vw,2.7rem);line-height:1.08}
h2{font-size:1.45rem}h3{font-size:1.05rem}
p{margin:0}
a{color:var(--foret)}
img{display:block;max-width:100%}
.wrap{max-width:var(--max);margin:0 auto;padding:0 20px}
.bandeau{background:var(--foret);color:var(--papier);font-size:.74rem;letter-spacing:.04em;
  text-transform:uppercase;text-align:center;padding:7px 16px}
:root[data-theme="dark"] .bandeau,
:root:not([data-theme="light"]) .bandeau{color:#0d120f}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]) .bandeau{color:var(--papier)}}
.rail{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--papier) 92%,transparent);
  backdrop-filter:blur(8px);border-bottom:1px solid var(--trait)}
.rail .wrap{display:flex;align-items:center;gap:18px;min-height:60px;flex-wrap:wrap}
.marque{font-family:var(--serif);font-size:1.15rem;font-weight:600;display:flex;align-items:center;gap:9px}
.marque .sceau{width:26px;height:26px;border-radius:50%;border:1.5px solid var(--foret);display:grid;
  place-items:center;font-size:.72rem;color:var(--foret);font-family:var(--mono)}
nav{display:flex;gap:2px;margin-left:auto;flex-wrap:wrap}
nav button{font:inherit;font-size:.88rem;font-weight:550;border:0;background:none;color:var(--encre-doux);
  padding:7px 12px;border-radius:99px;cursor:pointer}
nav button:hover{color:var(--encre);background:var(--surface-2)}
nav button[aria-current="true"]{background:var(--foret);color:var(--papier)}
:root[data-theme="dark"] nav button[aria-current="true"]{color:#0d120f}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) nav button[aria-current="true"]{color:#0d120f}}
:focus-visible{outline:2px solid var(--cuivre);outline-offset:2px}
main{padding:34px 0 60px}
.vue{display:none}.vue.actif{display:block}
.pile{display:flex;flex-direction:column;gap:26px}
.eyebrow{font-family:var(--mono);font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--sauge)}
.chapeau{color:var(--encre-doux);max-width:62ch}
.grille{display:grid;gap:14px}
.c2{grid-template-columns:repeat(auto-fit,minmax(290px,1fr))}
.c3{grid-template-columns:repeat(auto-fill,minmax(230px,1fr))}
.c4{grid-template-columns:repeat(auto-fill,minmax(185px,1fr))}
.bloc{background:var(--surface);border:1px solid var(--trait);border-radius:var(--r);padding:16px}
.chiffre{font-family:var(--serif);font-size:2rem;line-height:1;font-variant-numeric:tabular-nums}
.puce{display:inline-block;font-size:.72rem;font-weight:650;padding:2px 8px;border-radius:99px;
  background:var(--surface-2);color:var(--encre-doux);border:1px solid var(--trait)}
.puce.vert{background:color-mix(in srgb,var(--foret) 14%,transparent);color:var(--foret);border-color:transparent}
.puce.cuivre{background:color-mix(in srgb,var(--cuivre) 16%,transparent);color:var(--cuivre);border-color:transparent}
.puce.rouge{background:color-mix(in srgb,var(--alerte) 14%,transparent);color:var(--alerte);border-color:transparent}
.btn{font:inherit;font-size:.87rem;font-weight:600;padding:9px 16px;border-radius:8px;border:1px solid var(--foret);
  background:var(--foret);color:var(--papier);cursor:pointer}
:root[data-theme="dark"] .btn{color:#0d120f}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .btn{color:#0d120f}}
.btn.creux{background:transparent;color:var(--encre);border-color:var(--trait)}
.btn.creux:hover{border-color:var(--foret);color:var(--foret)}
.btn.mini{padding:5px 11px;font-size:.79rem}
input,select,textarea{font:inherit;font-size:.88rem;padding:8px 11px;border:1px solid var(--trait);
  border-radius:8px;background:var(--surface);color:var(--encre)}
label.case{display:inline-flex;align-items:center;gap:6px;font-size:.85rem;color:var(--encre-doux)}
.barre{display:flex;flex-wrap:wrap;gap:9px;align-items:center;padding:12px;background:var(--surface-2);
  border:1px solid var(--trait);border-radius:var(--r)}
.fiche{background:var(--surface);border:1px solid var(--trait);border-radius:var(--r);overflow:hidden;
  display:flex;flex-direction:column;text-align:left;padding:0;cursor:pointer;color:inherit;font:inherit}
.fiche img{aspect-ratio:1;object-fit:cover;width:100%}
.fiche .corps{padding:11px 12px;display:flex;flex-direction:column;gap:4px;flex:1}
.fiche .nom{font-weight:650;font-size:.92rem;line-height:1.25}
.fiche .info{font-size:.76rem;color:var(--encre-doux)}
.fiche .bas{margin-top:auto;padding-top:8px;display:flex;align-items:center;justify-content:space-between;gap:8px}
.prix{font-family:var(--serif);font-size:1.12rem;font-variant-numeric:tabular-nums}
table{width:100%;border-collapse:collapse;font-size:.85rem;font-variant-numeric:tabular-nums}
th{text-align:left;font-family:var(--mono);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--sauge);font-weight:500;padding:8px 10px;border-bottom:1px solid var(--trait)}
td{padding:9px 10px;border-bottom:1px solid var(--trait);vertical-align:top}
.defile{overflow-x:auto;background:var(--surface);border:1px solid var(--trait);border-radius:var(--r)}
.carte-geo{background:var(--surface-2);border:1px solid var(--trait);border-radius:var(--r);padding:6px}
.deux{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:16px;align-items:start}
@media(max-width:880px){.deux{grid-template-columns:1fr}}
.liste-b{display:flex;flex-direction:column;gap:10px;max-height:640px;overflow:auto;padding-right:4px}
.pin{cursor:pointer}
.pin circle{transition:r .12s}
.pin:hover circle:last-of-type,.pin:focus circle:last-of-type{r:9}
.voile{position:fixed;inset:0;background:rgba(10,16,13,.6);display:none;place-items:center;padding:18px;z-index:60}
.voile[open]{display:grid}
.modale{background:var(--surface);border:1px solid var(--trait);border-radius:14px;max-width:620px;width:100%;
  max-height:86vh;overflow:auto;padding:22px}
.paire{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.paire dt{font-family:var(--mono);font-size:.67rem;letter-spacing:.1em;text-transform:uppercase;color:var(--sauge)}
.paire dd{margin:2px 0 0;font-size:.9rem}
.avis{border-left:2px solid var(--cuivre);background:color-mix(in srgb,var(--cuivre) 7%,transparent);
  padding:13px 15px;border-radius:0 var(--r) var(--r) 0;font-size:.86rem;color:var(--encre-doux)}
.panier{position:fixed;right:14px;bottom:14px;z-index:50;background:var(--surface);border:1px solid var(--trait);
  border-radius:12px;padding:11px 14px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 30px rgba(10,20,14,.18)}
.tarif{display:flex;flex-direction:column;gap:9px}
.tarif ul{margin:0;padding-left:17px;font-size:.85rem;color:var(--encre-doux);display:flex;flex-direction:column;gap:4px}
.tarif .montant{font-family:var(--serif);font-size:2rem;font-variant-numeric:tabular-nums}
.pied{border-top:1px solid var(--trait);padding:22px 0 40px;font-size:.8rem;color:var(--encre-doux)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>

<div class="bandeau">Réservé aux 18 ans et plus · THC ≤ 0,3 % · le CBD n'est pas un médicament</div>

<div class="rail"><div class="wrap">
  <div class="marque"><span class="sceau">CBD</span> Atlas</div>
  <nav id="nav"></nav>
</div></div>

<main class="wrap">
  <section class="vue actif" id="v-accueil"></section>
  <section class="vue" id="v-encyclopedie"></section>
  <section class="vue" id="v-boutiques"></section>
  <section class="vue" id="v-marketplace"></section>
  <section class="vue" id="v-pro"></section>
  <section class="vue" id="v-legal"></section>
</main>

<div class="wrap pied" id="pied"></div>
<div class="voile" id="voile"><div class="modale" id="modale"></div></div>
<div class="panier" id="panier" hidden></div>

<script>
const D = ${JSON.stringify(DATA)};
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eur = (n) => Number(n).toFixed(2).replace('.', ',') + ' €';
const img = (t) => D.images[t] || D.images.fleur;
const sansAccent = (s) => String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');

/* ---------------------------------------------------------------- navigation */
const VUES = [['accueil','Accueil'],['encyclopedie','Encyclopédie'],['boutiques','Boutiques'],
  ['marketplace','Marketplace'],['pro','Espace distributeur'],['legal','Cadre légal']];

$('#nav').innerHTML = VUES.map(([id,l],i)=>
  '<button data-vue="'+id+'" aria-current="'+(i===0)+'">'+l+'</button>').join('');
$('#nav').onclick = (e) => { const b = e.target.closest('[data-vue]'); if (b) aller(b.dataset.vue); };

function aller(id){
  document.querySelectorAll('.vue').forEach(v=>v.classList.toggle('actif', v.id==='v-'+id));
  document.querySelectorAll('#nav button').forEach(b=>b.setAttribute('aria-current', String(b.dataset.vue===id)));
  window.scrollTo({top:0,behavior:'instant'});
}

/* --------------------------------------------------------------- carte SVG */
const CONTOUR=[[2.37,51.03],[4.23,49.96],[5.5,49.5],[6.36,49.46],[7.6,49.05],[7.6,48],[7.55,47.6],[6.9,47.35],
[6.05,46.4],[6.8,46],[7,45.5],[6.6,45.1],[7,44.25],[7.5,43.78],[6,43.1],[4.8,43.35],[3,43.2],[3.05,42.47],
[1.7,42.5],[0.6,42.7],[-1.4,43.3],[-1.25,44.5],[-1.05,45.6],[-1.15,46.3],[-2.2,47.2],[-4.8,48],[-4.6,48.7],
[-3,48.85],[-1.6,48.65],[-1.5,49.7],[0.1,49.5],[1.6,50.2]];
const CORSE=[[9.4,43],[9.55,42.6],[9.5,42.1],[9.25,41.38],[8.8,41.55],[8.6,42.35],[8.75,42.6],[9.1,42.7]];
const W=680,H=660,PAD=24,K=Math.cos(46.5*Math.PI/180),B={a:-5.2,b:9.8,c:41.2,d:51.3};
const proj=(lng,lat)=>[((lng*K-B.a*K)/((B.b-B.a)*K))*(W-2*PAD)+PAD,((B.d-lat)/(B.d-B.c))*(H-2*PAD)+PAD];
const trace=(p)=>p.map((q,i)=>(i?'L':'M')+proj(q[0],q[1]).map(n=>n.toFixed(1)).join(' ')).join(' ')+' Z';

function dessinerCarte(hote, liste, onClic){
  hote.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Carte des boutiques CBD référencées en France">'
    +'<path d="'+trace(CONTOUR)+'" fill="var(--surface)" stroke="var(--sauge)" stroke-width="1.5" stroke-linejoin="round"/>'
    +'<path d="'+trace(CORSE)+'" fill="var(--surface)" stroke="var(--sauge)" stroke-width="1.5" stroke-linejoin="round"/>'
    +liste.map(b=>{const[x,y]=proj(b.lng,b.lat);const c=b.mise_en_avant?'var(--cuivre)':'var(--foret)';
      return '<g class="pin" data-id="'+b.id+'" tabindex="0" role="button" aria-label="'+esc(b.nom)+'">'
        +'<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="13" fill="'+c+'" opacity=".13"/>'
        +'<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="6" fill="'+c+'" stroke="var(--surface)" stroke-width="2"/>'
        +'<title>'+esc(b.nom+' — '+b.ville)+'</title></g>';}).join('')+'</svg>';
  hote.querySelectorAll('.pin').forEach(g=>{
    const b=liste.find(x=>x.id===g.dataset.id);
    g.onclick=()=>onClic(b);
    g.onkeydown=(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onClic(b);}};
  });
}

/* -------------------------------------------------------------------- panier */
let panier=[];
function ajouter(p){
  const l=panier.find(i=>i.id===p.id);
  if(l) l.q++; else panier.push({id:p.id,nom:p.nom,prix:p.prix,q:1});
  rendrePanier();
}
function rendrePanier(){
  const n=panier.reduce((s,i)=>s+i.q,0);
  const total=panier.reduce((s,i)=>s+i.q*i.prix,0);
  const el=$('#panier');
  el.hidden=n===0;
  el.innerHTML='<span class="puce vert">'+n+' article'+(n>1?'s':'')+'</span>'
    +'<strong class="prix">'+eur(total)+'</strong>'
    +'<button class="btn mini" id="commander">Commander</button>'
    +'<button class="btn creux mini" id="vider">Vider</button>';
  if(!n) return;
  $('#commander').onclick=()=>{
    ouvrir('<h2>Récapitulatif de commande</h2>'
      +'<div class="defile" style="margin:14px 0"><table><thead><tr><th>Produit</th><th>Qté</th><th>Montant</th></tr></thead><tbody>'
      +panier.map(i=>'<tr><td>'+esc(i.nom)+'</td><td>'+i.q+'</td><td>'+eur(i.q*i.prix)+'</td></tr>').join('')
      +'</tbody></table></div>'
      +'<p><strong class="prix">Total '+eur(total)+'</strong></p>'
      +'<p class="chapeau" style="margin-top:10px">Démonstration : le paiement n\\'est pas branché. En production, cette étape ouvre Stripe Checkout et la commande part chez le distributeur, commission plateforme déduite (5 % en formule Marketplace, 3 % en Enseigne).</p>'
      +'<p class="chapeau" style="margin-top:8px">La validation exige la confirmation de majorité et n\\'accepte qu\\'un seul vendeur par commande.</p>');
  };
  $('#vider').onclick=()=>{panier=[];rendrePanier();};
}

/* ------------------------------------------------------------------- modale */
function ouvrir(html){
  $('#modale').innerHTML=html+'<p style="margin-top:16px"><button class="btn creux" id="fermer">Fermer</button></p>';
  $('#voile').setAttribute('open','');
  $('#fermer').onclick=fermer;
  $('#fermer').focus();
}
function fermer(){$('#voile').removeAttribute('open');}
$('#voile').onclick=(e)=>{if(e.target.id==='voile')fermer();};
document.addEventListener('keydown',(e)=>{if(e.key==='Escape')fermer();});

/* ------------------------------------------------------------------ accueil */
const villes=[...new Set(D.boutiques.map(b=>b.ville))];
$('#v-accueil').innerHTML=
 '<div class="pile">'
 +'<div><p class="eyebrow">Encyclopédie · annuaire · marketplace</p>'
 +'<h1 style="margin:8px 0 12px">Le CBD légal, documenté&nbsp;;<br>puis mis sur la carte.</h1>'
 +'<p class="chapeau">Neuf formes de produits, huit molécules avec leur formule et leur statut juridique, les prix réellement constatés, '
 +'la carte des magasins avec horaires et livraison, et la commande en ligne chez les distributeurs abonnés.</p>'
 +'<p style="margin-top:16px;display:flex;gap:9px;flex-wrap:wrap">'
 +'<button class="btn" data-vue="marketplace">Parcourir les produits</button>'
 +'<button class="btn creux" data-vue="boutiques">Voir la carte</button>'
 +'<button class="btn creux" data-vue="encyclopedie">Ouvrir l\\'encyclopédie</button></p></div>'
 +'<div class="grille c4">'
 +[[D.boutiques.length,'boutiques référencées'],[villes.length,'villes couvertes'],
   [D.produits.length,'références au catalogue'],[D.ency.molecules.length,'molécules documentées']]
   .map(([n,l])=>'<div class="bloc"><div class="chiffre">'+n+'</div><p class="info" style="color:var(--encre-doux);font-size:.83rem">'+l+'</p></div>').join('')
 +'</div>'
 +'<div><h2>Les neuf formes</h2><p class="chapeau" style="margin:4px 0 14px">Chacune a ses molécules, son prix au gramme ou au flacon, et son propre régime juridique.</p>'
 +'<div class="grille c3">'+D.ency.types.map(t=>
   '<button class="fiche" data-type="'+t.id+'"><img src="'+img(t.id)+'" alt=""><div class="corps">'
   +'<span class="nom">'+esc(t.nom)+'</span>'
   +'<span class="info">'+esc(t.prix_indicatif)+'</span>'
   +'<span class="info">CBD '+esc(t.taux_cbd)+'</span></div></button>').join('')+'</div></div>'
 +'<div class="avis"><strong>Ce que la plateforme refuse automatiquement.</strong> Tout produit au-dessus de 0,3 % de THC, '
 +'toute molécule classée stupéfiant en France (HHC, HHC-O, HHCP, THCP), toute allégation thérapeutique, '
 +'et toute fiche sans certificat d\\'analyse ni numéro de lot.</div>'
 +'</div>';

/* -------------------------------------------------------------- encyclopédie */
function molNom(id){const m=D.ency.molecules.find(x=>x.id===id);return m?m.nom:id;}
$('#v-encyclopedie').innerHTML=
 '<div class="pile">'
 +'<div><p class="eyebrow">Documentation</p><h1 style="margin:8px 0 10px">Encyclopédie du CBD</h1>'
 +'<p class="chapeau">Contenu informatif : composition, taux, extraction, conservation, statut légal. Aucune allégation de santé.</p></div>'
 +'<div class="barre"><input id="e-q" placeholder="Rechercher une forme, une molécule…" style="flex:1;min-width:200px">'
 +'<select id="e-type"><option value="">Toutes les formes</option>'
 +D.ency.types.map(t=>'<option value="'+t.id+'">'+esc(t.nom)+'</option>').join('')+'</select></div>'
 +'<div class="grille c2" id="e-liste"></div>'
 +'<div><h2>Les molécules</h2><p class="chapeau" style="margin:4px 0 12px">Formule brute, masse molaire, point de vaporisation, caractère psychotrope et statut en France.</p>'
 +'<div class="defile"><table id="e-mol"></table></div></div>'
 +'</div>';

function ficheType(t){
  return '<article class="bloc" id="t-'+t.id+'">'
   +'<div style="display:flex;gap:13px;align-items:flex-start">'
   +'<img src="'+img(t.id)+'" alt="" style="width:58px;border-radius:8px;flex:none">'
   +'<div><h3>'+esc(t.nom)+'</h3><p class="chapeau" style="font-size:.87rem;margin-top:4px">'+esc(t.description)+'</p></div></div>'
   +'<dl class="paire" style="margin:14px 0 0">'
   +'<div><dt>Prix constaté</dt><dd>'+esc(t.prix_indicatif)+'</dd></div>'
   +'<div><dt>Taux de CBD</dt><dd>'+esc(t.taux_cbd)+'</dd></div>'
   +'<div><dt>Molécules</dt><dd>'+t.molecules.map(m=>'<span class="puce vert" style="margin:2px 3px 0 0">'+esc(molNom(m))+'</span>').join('')+'</dd></div>'
   +'<div><dt>Production</dt><dd>'+t.culture.map(c=>'<span class="puce" style="margin:2px 3px 0 0">'+esc(c)+'</span>').join('')+'</dd></div>'
   +'</dl>'
   +'<dl class="paire" style="margin-top:12px;grid-template-columns:1fr">'
   +'<div><dt>Statut légal</dt><dd style="font-size:.85rem">'+esc(t.legalite)+'</dd></div>'
   +'<div><dt>Conservation</dt><dd style="font-size:.85rem">'+esc(t.conservation)+'</dd></div></dl>'
   +'<p style="margin-top:12px"><button class="btn creux mini" data-offres="'+t.id+'">Voir les offres</button></p></article>';
}

function rendreEncy(){
  const q=sansAccent($('#e-q').value.trim()), f=$('#e-type').value;
  const l=D.ency.types.filter(t=>(!f||t.id===f)&&(!q||sansAccent(t.nom+' '+t.description+' '+t.legalite).includes(q)));
  $('#e-liste').innerHTML=l.length?l.map(ficheType).join('')
    :'<p class="chapeau">Aucune fiche ne correspond à cette recherche.</p>';
  const mols=D.ency.molecules.filter(m=>!q||sansAccent(m.nom+' '+m.resume+' '+m.statut_fr).includes(q));
  $('#e-mol').innerHTML='<thead><tr><th>Molécule</th><th>Formule</th><th>Masse</th><th>Psychotrope</th><th>Vaporisation</th><th>Statut en France</th></tr></thead><tbody>'
   +mols.map(m=>'<tr><td><strong>'+esc(m.nom)+'</strong><div class="chapeau" style="font-size:.78rem">'+esc(m.resume)+'</div></td>'
   +'<td style="font-family:var(--mono)">'+esc(m.formule)+'</td><td>'+esc(m.masse)+'</td>'
   +'<td>'+(m.psychotrope?'<span class="puce rouge">oui</span>':'<span class="puce vert">non</span>')+'</td>'
   +'<td>'+esc(m.ebullition)+'</td><td style="max-width:330px">'+esc(m.statut_fr)+'</td></tr>').join('')+'</tbody>';
}
$('#e-q').oninput=rendreEncy;$('#e-type').onchange=rendreEncy;rendreEncy();

/* ---------------------------------------------------------------- boutiques */
const JOURS=[['lun','Lundi'],['mar','Mardi'],['mer','Mercredi'],['jeu','Jeudi'],['ven','Vendredi'],['sam','Samedi'],['dim','Dimanche']];
function ouvertMaintenant(b){
  const cl=['dim','lun','mar','mer','jeu','ven','sam'][new Date().getDay()];
  const h=(b.horaires||{})[cl];if(!h||/ferme/i.test(h))return false;
  const m=h.match(/(\\d{1,2}):(\\d{2})\\s*-\\s*(\\d{1,2}):(\\d{2})/);if(!m)return false;
  const n=new Date().getHours()*60+new Date().getMinutes();
  return n>=+m[1]*60+ +m[2] && n<=+m[3]*60+ +m[4];
}

$('#v-boutiques').innerHTML=
 '<div class="pile">'
 +'<div><p class="eyebrow">Annuaire géolocalisé</p><h1 style="margin:8px 0 10px">Où acheter, près de chez soi</h1>'
 +'<p class="chapeau">Chaque point est un magasin publié par un distributeur abonné. Cliquez pour ouvrir horaires, livraison et catalogue.</p></div>'
 +'<div class="barre"><input id="b-q" placeholder="Ville, code postal, enseigne…" style="flex:1;min-width:190px">'
 +'<label class="case"><input type="checkbox" id="b-livre"> Livre à domicile</label>'
 +'<label class="case"><input type="checkbox" id="b-ouvert"> Ouvert maintenant</label>'
 +'<span class="puce" id="b-compte"></span></div>'
 +'<div class="deux"><div class="carte-geo" id="b-carte"></div><div class="liste-b" id="b-liste"></div></div>'
 +'</div>';

function filtrerBoutiques(){
  const q=sansAccent($('#b-q').value.trim());
  return D.boutiques.filter(b=>
    (!q||sansAccent(b.nom+' '+b.ville+' '+b.code_postal+' '+b.enseigne+' '+b.adresse).includes(q))
    &&(!$('#b-livre').checked||b.livraison)
    &&(!$('#b-ouvert').checked||ouvertMaintenant(b)))
    .sort((a,b)=>(b.mise_en_avant-a.mise_en_avant)||(b.note-a.note));
}

function rendreBoutiques(){
  const l=filtrerBoutiques();
  $('#b-compte').textContent=l.length+' boutique'+(l.length>1?'s':'');
  $('#b-liste').innerHTML=l.length?l.map(b=>
    '<article class="bloc" data-shop="'+b.id+'" style="cursor:pointer">'
    +'<div style="display:flex;justify-content:space-between;gap:10px">'
    +'<div><h3>'+esc(b.nom)+' '+(b.mise_en_avant?'<span class="puce cuivre">Enseigne</span>':'')+'</h3>'
    +'<p class="chapeau" style="font-size:.84rem">'+esc(b.adresse)+', '+esc(b.code_postal)+' '+esc(b.ville)+'</p></div>'
    +'<div style="text-align:right;flex:none"><div class="prix">'+b.note.toFixed(1)+'</div>'
    +'<div class="chapeau" style="font-size:.72rem">'+b.avis+' avis</div></div></div>'
    +'<p style="margin-top:9px;display:flex;gap:5px;flex-wrap:wrap">'
    +'<span class="puce">'+b.produits+' produits</span>'
    +(b.vente_en_ligne?'<span class="puce vert">Commande en ligne</span>':'<span class="puce">Vitrine</span>')
    +(b.livraison?'<span class="puce vert">Livraison '+eur(b.frais_livraison)+'</span>':'<span class="puce">Retrait</span>')
    +(ouvertMaintenant(b)?'<span class="puce vert">Ouvert</span>':'<span class="puce">Fermé</span>')
    +'</p></article>').join('')
    :'<p class="chapeau">Aucune boutique ne correspond à ces critères.</p>';
  $('#b-liste').querySelectorAll('[data-shop]').forEach(el=>{
    el.onclick=()=>ficheBoutique(l.find(b=>b.id===el.dataset.shop));});
  dessinerCarte($('#b-carte'), l, ficheBoutique);
}

function ficheBoutique(b){
  if(!b)return;
  const cat=D.produits.filter(p=>p.boutique_id===b.id);
  ouvrir('<p class="eyebrow">'+esc(b.enseigne)+'</p><h2 style="margin:6px 0 4px">'+esc(b.nom)+'</h2>'
   +'<p class="chapeau">'+esc(b.adresse)+', '+esc(b.code_postal)+' '+esc(b.ville)+' · '+esc(b.telephone)+'</p>'
   +'<p style="margin:12px 0;display:flex;gap:5px;flex-wrap:wrap">'
   +(ouvertMaintenant(b)?'<span class="puce vert">Ouvert maintenant</span>':'<span class="puce">Fermé actuellement</span>')
   +(b.vente_en_ligne?'<span class="puce vert">Commande en ligne</span>':'<span class="puce">Consultation seule</span>')
   +(b.click_and_collect?'<span class="puce">Click &amp; collect</span>':'')+'</p>'
   +'<dl class="paire"><div><dt>Livraison</dt><dd>'+(b.livraison?esc(b.conditions_livraison)+' — '+eur(b.frais_livraison)+' en '+b.delai_livraison_h+' h':'Retrait en boutique uniquement')+'</dd></div>'
   +'<div><dt>Note</dt><dd>'+b.note.toFixed(1)+' / 5 sur '+b.avis+' avis</dd></div></dl>'
   +'<h3 style="margin:18px 0 6px">Horaires</h3><div class="defile"><table><tbody>'
   +JOURS.map(([k,l])=>'<tr><td>'+l+'</td><td>'+esc((b.horaires||{})[k]||'—')+'</td></tr>').join('')+'</tbody></table></div>'
   +'<h3 style="margin:18px 0 8px">Catalogue ('+cat.length+')</h3><div class="grille c4">'
   +cat.map(p=>'<div class="fiche"><img src="'+img(p.type)+'" alt=""><div class="corps">'
     +'<span class="nom">'+esc(p.nom)+'</span><span class="info">CBD '+p.taux_cbd+' % · THC '+p.taux_thc+' %</span>'
     +'<span class="bas"><span class="prix">'+eur(p.prix)+'</span>'
     +(p.achetable?'<button class="btn mini" data-add="'+p.id+'">+</button>':'<span class="puce">vitrine</span>')
     +'</span></div></div>').join('')+'</div>');
  $('#modale').querySelectorAll('[data-add]').forEach(btn=>{
    btn.onclick=()=>ajouter(D.produits.find(p=>p.id===btn.dataset.add));});
}
['b-q','b-livre','b-ouvert'].forEach(id=>{const e=$('#'+id);e.oninput=rendreBoutiques;e.onchange=rendreBoutiques;});
rendreBoutiques();

/* -------------------------------------------------------------- marketplace */
$('#v-marketplace').innerHTML=
 '<div class="pile">'
 +'<div><p class="eyebrow">Marketplace</p><h1 style="margin:8px 0 10px">Le supermarché du CBD</h1>'
 +'<p class="chapeau">Tous les catalogues des distributeurs abonnés, filtrables. Les vendeurs en formule vitrine sont consultables mais ne vendent pas en ligne.</p></div>'
 +'<div class="barre"><input id="m-q" placeholder="amnesia, huile, baume…" style="flex:1;min-width:170px">'
 +'<select id="m-type"><option value="">Toutes les formes</option>'
 +D.ency.types.map(t=>'<option value="'+t.id+'">'+esc(t.nom)+'</option>').join('')+'</select>'
 +'<select id="m-tri"><option value="pertinence">Tri : pertinence</option><option value="prix_asc">Prix croissant</option>'
 +'<option value="prix_desc">Prix décroissant</option><option value="cbd">Taux de CBD</option></select>'
 +'<input id="m-prix" type="number" min="0" placeholder="Prix max" style="width:105px">'
 +'<label class="case"><input type="checkbox" id="m-achat" checked> Achetable en ligne</label>'
 +'<span class="puce" id="m-compte"></span></div>'
 +'<div class="grille c4" id="m-liste"></div></div>';

function rendreMarket(){
  const q=sansAccent($('#m-q').value.trim()),t=$('#m-type').value,tri=$('#m-tri').value;
  const pmax=parseFloat($('#m-prix').value);
  let l=D.produits.filter(p=>(!t||p.type===t)
    &&(!$('#m-achat').checked||p.achetable)
    &&(!isFinite(pmax)||p.prix<=pmax)
    &&(!q||sansAccent(p.nom+' '+(p.variete||'')+' '+p.type+' '+p.enseigne+' '+p.ville).includes(q)));
  if(tri==='prix_asc')l.sort((a,b)=>a.prix-b.prix);
  else if(tri==='prix_desc')l.sort((a,b)=>b.prix-a.prix);
  else if(tri==='cbd')l.sort((a,b)=>b.taux_cbd-a.taux_cbd);
  else l.sort((a,b)=>(b.mise_en_avant-a.mise_en_avant)||(b.taux_cbd-a.taux_cbd));
  $('#m-compte').textContent=l.length+' produit'+(l.length>1?'s':'');
  $('#m-liste').innerHTML=l.length?l.slice(0,48).map(p=>
    '<button class="fiche" data-prod="'+p.id+'"><img src="'+img(p.type)+'" alt=""><div class="corps">'
    +'<span class="nom">'+esc(p.nom)+' '+(p.mise_en_avant?'<span class="puce cuivre">mis en avant</span>':'')+'</span>'
    +'<span class="info">'+esc(p.enseigne)+' · '+esc(p.ville)+'</span>'
    +'<span class="info">CBD '+p.taux_cbd+' % · THC '+p.taux_thc+' %</span>'
    +'<span class="info">'+(p.livraison?'Livraison '+eur(p.frais_livraison)+' en '+p.delai_livraison_h+' h':'Retrait en boutique')+'</span>'
    +'<span class="bas"><span class="prix">'+eur(p.prix)+'<span class="info"> / '+esc(p.unite)+'</span></span>'
    +(p.achetable?'<span class="puce vert">en ligne</span>':'<span class="puce">vitrine</span>')+'</span>'
    +'</div></button>').join('')
    :'<p class="chapeau">Aucun produit ne correspond à ces filtres.</p>';
  $('#m-liste').querySelectorAll('[data-prod]').forEach(b=>{
    b.onclick=()=>ficheProduit(D.produits.find(p=>p.id===b.dataset.prod));});
}

function ficheProduit(p){
  ouvrir('<p class="eyebrow">'+esc(p.type)+'</p><h2 style="margin:6px 0 10px">'+esc(p.nom)+'</h2>'
   +'<img src="'+img(p.type)+'" alt="" style="width:120px;border-radius:12px;margin-bottom:12px">'
   +'<p class="chapeau">'+esc(p.description)+'</p>'
   +'<dl class="paire" style="margin-top:14px">'
   +'<div><dt>Taux de CBD</dt><dd>'+p.taux_cbd+' %</dd></div>'
   +'<div><dt>Taux de THC</dt><dd>'+p.taux_thc+' % <span class="puce vert">conforme</span></dd></div>'
   +'<div><dt>Spectre</dt><dd>'+esc(p.spectre)+'</dd></div>'
   +'<div><dt>Culture / extraction</dt><dd>'+esc(p.culture)+'</dd></div>'
   +'<div><dt>Terpènes</dt><dd>'+esc(p.terpenes)+'</dd></div>'
   +'<div><dt>Lot</dt><dd>'+esc(p.lot)+' <span class="puce vert">COA disponible</span></dd></div>'
   +'<div><dt>Vendeur</dt><dd>'+esc(p.enseigne)+' — '+esc(p.boutique)+', '+esc(p.ville)+'</dd></div>'
   +'<div><dt>Stock</dt><dd>'+p.stock+'</dd></div></dl>'
   +'<p style="margin:16px 0 10px"><span class="prix" style="font-size:1.5rem">'+eur(p.prix)+'</span> <span class="info">/ '+esc(p.unite)+'</span></p>'
   +(p.achetable?'<button class="btn" id="ajout">Ajouter au panier</button>'
      :'<p class="puce">Vendeur en formule vitrine — rendez-vous en boutique.</p>')
   +'<p class="chapeau" style="margin-top:14px;font-size:.78rem">Produit de consommation courante contenant au maximum 0,3 % de THC. '
   +'N\\'est pas un médicament et ne soigne aucune pathologie. Interdit aux mineurs, aux femmes enceintes et allaitantes.</p>');
  const a=$('#ajout'); if(a) a.onclick=()=>{ajouter(p);fermer();};
}
['m-q','m-prix'].forEach(id=>$('#'+id).oninput=rendreMarket);
['m-type','m-tri','m-achat'].forEach(id=>$('#'+id).onchange=rendreMarket);
rendreMarket();

/* ---------------------------------------------------------------------- pro */
$('#v-pro').innerHTML=
 '<div class="pile">'
 +'<div><p class="eyebrow">Modèle économique</p><h1 style="margin:8px 0 10px">Ce que paie le distributeur</h1>'
 +'<p class="chapeau">Abonnement mensuel pour être sur la carte, plus une commission sur les ventes quand la formule autorise la vente en ligne. '
 +'Les quotas sont appliqués côté serveur : une formule vitrine ne peut pas encaisser.</p></div>'
 +'<div class="grille c3">'+D.plans.map(p=>
   '<article class="bloc tarif"'+(p.id==='pro'?' style="border-color:var(--foret)"':'')+'>'
   +(p.id==='pro'?'<span class="puce vert">le plus choisi</span>':'')
   +'<h3>'+esc(p.nom)+'</h3><div class="montant">'+p.prix+' €<span class="info" style="font-size:.8rem"> / mois</span></div>'
   +'<ul>'+p.avantages.map(a=>'<li>'+esc(a)+'</li>').join('')+'</ul></article>').join('')+'</div>'
 +'<div><h2>Ce que voit le distributeur</h2><p class="chapeau" style="margin:4px 0 12px">Tableau de bord de démonstration pour l\\'enseigne la plus active.</p>'
 +'<div class="defile"><table id="p-tab"></table></div></div>'
 +'<div class="avis">Publier une fiche passe par le filtre de conformité : THC ≤ 0,3 %, aucune molécule classée stupéfiant, '
 +'aucune allégation thérapeutique, certificat d\\'analyse et numéro de lot obligatoires. '
 +'Un refus indique précisément la règle enfreinte.</div></div>';

(function(){
  const parEnseigne={};
  D.boutiques.forEach(b=>{
    parEnseigne[b.enseigne]=parEnseigne[b.enseigne]||{plan:b.plan,boutiques:0,produits:0,ca:0};
    parEnseigne[b.enseigne].boutiques++;parEnseigne[b.enseigne].produits+=b.produits;});
  D.produits.forEach(p=>{if(parEnseigne[p.enseigne])parEnseigne[p.enseigne].ca+=p.prix*Math.min(p.stock,12);});
  $('#p-tab').innerHTML='<thead><tr><th>Enseigne</th><th>Formule</th><th>Boutiques</th><th>Références</th>'
   +'<th>Abonnement</th><th>Valeur du stock exposé</th></tr></thead><tbody>'
   +Object.entries(parEnseigne).map(([nom,v])=>{
     const pl=D.plans.find(p=>p.id===v.plan);
     return '<tr><td><strong>'+esc(nom)+'</strong></td><td>'+esc(pl.nom)+'</td><td>'+v.boutiques+'</td>'
      +'<td>'+v.produits+'</td><td>'+pl.prix+' € / mois</td><td>'+eur(v.ca)+'</td></tr>';}).join('')
   +'</tbody>';
})();

/* -------------------------------------------------------------------- légal */
$('#v-legal').innerHTML=
 '<div class="pile">'
 +'<div><p class="eyebrow">Conformité</p><h1 style="margin:8px 0 10px">Le cadre légal, appliqué par le code</h1>'
 +'<p class="chapeau">Synthèse informative, pas un conseil juridique. Chaque règle ci-dessous correspond à un contrôle réellement exécuté avant publication.</p></div>'
 +'<div class="grille c2">'+D.ency.legalite.map(r=>
   '<article class="bloc"><h3>'+esc(r.titre)+'</h3><p class="chapeau" style="margin-top:5px;font-size:.88rem">'+esc(r.texte)+'</p></article>').join('')+'</div>'
 +'<div class="avis">'+esc(D.ency.disclaimer)+'</div>'
 +'<p class="chapeau" style="font-size:.8rem">Sources : arrêté du 30 décembre 2021 · Conseil d\\'État, 29 décembre 2022 · arrêté du 12 juin 2023 (HHC) · '
 +'règlement UE 2015/2283 (Novel Food) · règlement UE 1223/2009 (cosmétiques) · règlement UE 1924/2006 (allégations).</p></div>';

/* ------------------------------------------------------------------- divers */
$('#pied').innerHTML='<p><strong>CBD Atlas</strong> — démonstration statique. Les boutiques, prix et notes sont fictifs et servent à montrer le fonctionnement. '
 +'L\\'application réelle tourne sur une API Node (<span style="font-family:var(--mono)">cbd-app/server.js</span>) avec géolocalisation, panier et espace distributeur.</p>'
 +'<p style="margin-top:8px">Vente interdite aux mineurs. Le CBD n\\'est pas un médicament. Information et aide : '
 +'<a href="https://www.drogues-info-service.fr" target="_blank" rel="noopener">drogues-info-service.fr</a> — 0 800 23 13 13.</p>';

document.body.addEventListener('click',(e)=>{
  const v=e.target.closest('[data-vue]'); if(v&&!v.closest('#nav')) aller(v.dataset.vue);
  const t=e.target.closest('[data-type]');
  if(t){aller('encyclopedie');$('#e-type').value=t.dataset.type;rendreEncy();}
  const o=e.target.closest('[data-offres]');
  if(o){aller('marketplace');$('#m-type').value=o.dataset.offres;rendreMarket();}
});
</script>`;

fs.writeFileSync(path.join(__dirname, 'demo.html'), html);
console.log('demo.html genere : ' + (html.length / 1024).toFixed(0) + ' Ko');

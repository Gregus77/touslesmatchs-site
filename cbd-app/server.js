'use strict';
/**
 * CBD Atlas - API + serveur statique, zero dependance.
 *   node server.js            -> http://localhost:3010
 *   PORT=8080 node server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const store = require('./lib/store');
const { verifierProduit, THC_MAX } = require('./lib/compliance');

const PORT = Number(process.env.PORT || 3010);
const PUBLIC_DIR = path.join(__dirname, 'public');
const ENCYCLOPEDIE = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'encyclopedia.json'), 'utf8'));

const PLANS = [
  {
    id: 'basic', nom: 'Vitrine', prix: 29, periode: 'mois',
    max_boutiques: 1, max_produits: 20, marketplace: false, mise_en_avant: false,
    avantages: [
      '1 boutique geolocalisee sur la carte',
      'Fiche complete : horaires, telephone, adresse',
      'Jusqu\'a 20 produits au catalogue (consultation seule)',
      'Badge conformite apres verification du COA'
    ]
  },
  {
    id: 'pro', nom: 'Marketplace', prix: 79, periode: 'mois',
    max_boutiques: 3, max_produits: 200, marketplace: true, mise_en_avant: false,
    avantages: [
      'Jusqu\'a 3 boutiques geolocalisees',
      'Vente en ligne activee (panier + commande)',
      'Jusqu\'a 200 references produits',
      'Gestion des zones, frais et delais de livraison',
      'Statistiques de vues et de conversion',
      'Commission plateforme 5 % sur les ventes'
    ]
  },
  {
    id: 'premium', nom: 'Enseigne', prix: 149, periode: 'mois',
    max_boutiques: 25, max_produits: 2000, marketplace: true, mise_en_avant: true,
    avantages: [
      'Jusqu\'a 25 boutiques geolocalisees',
      'Catalogue illimite en pratique (2000 references)',
      'Mise en avant en tete des resultats de recherche',
      'Page enseigne dediee et bandeau sur la carte',
      'Export CSV des commandes',
      'Commission plateforme reduite a 3 %'
    ]
  }
];

// ---------------------------------------------------------------- utilitaires

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1e6) { reject(new Error('Corps de requete trop volumineux')); req.destroy(); }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('JSON invalide')); }
    });
    req.on('error', reject);
  });
}

// Distance grand-cercle en km.
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function planDe(id) { return PLANS.find((p) => p.id === id) || PLANS[0]; }

function abonnementActif(db, distId) {
  const now = Date.now();
  return db.abonnements.find((a) =>
    a.distributeur_id === distId && a.statut === 'actif' && new Date(a.fin).getTime() > now) || null;
}

// Authentifie un distributeur via l'en-tete Authorization: Bearer <token>.
function auth(req) {
  const db = store.load();
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!t) return null;
  return db.distributeurs.find((d) => d.token === t) || null;
}

function publicShop(db, s) {
  const dist = db.distributeurs.find((d) => d.id === s.distributeur_id);
  const plan = planDe(dist ? dist.plan : 'basic');
  return Object.assign({}, s, {
    enseigne: dist ? dist.nom : '',
    plan: plan.id,
    vente_en_ligne: plan.marketplace,
    mise_en_avant: plan.mise_en_avant,
    produits: db.produits.filter((p) => p.boutique_id === s.id && p.actif).length
  });
}

function publicProduit(db, p) {
  const s = db.boutiques.find((b) => b.id === p.boutique_id);
  const dist = db.distributeurs.find((d) => d.id === p.distributeur_id);
  const plan = planDe(dist ? dist.plan : 'basic');
  return Object.assign({}, p, {
    boutique: s ? s.nom : '',
    ville: s ? s.ville : '',
    lat: s ? s.lat : null,
    lng: s ? s.lng : null,
    livraison: s ? s.livraison : false,
    frais_livraison: s ? s.frais_livraison : 0,
    delai_livraison_h: s ? s.delai_livraison_h : 0,
    enseigne: dist ? dist.nom : '',
    achetable: plan.marketplace,
    mise_en_avant: plan.mise_en_avant,
    image: '/img/produit/' + p.type + '.svg'
  });
}

// ------------------------------------------------------------------- visuels

const COULEURS = {
  fleur: ['#2f7d4f', '#8fd6a4'], resine: ['#6b4423', '#c99a63'],
  huile: ['#8a6b1f', '#f2d675'], eliquide: ['#1f5f8a', '#7fc7f2'],
  pommade: ['#7a4a6b', '#e2b7d6'], infusion: ['#4a7a3c', '#c6e2a4'],
  comestible: ['#a33b4e', '#f2a3b1'], cristaux: ['#3d5a80', '#dbe9f4'],
  cosmetique: ['#8a5a2b', '#f0cfa8']
};

const FORMES = {
  fleur: '<path d="M100 42c16 10 24 28 24 48 0 22-11 38-24 48-13-10-24-26-24-48 0-20 8-38 24-48z" fill="rgba(255,255,255,.85)"/><path d="M100 60v78" stroke="rgba(0,0,0,.25)" stroke-width="3"/>',
  resine: '<rect x="58" y="70" width="84" height="60" rx="10" fill="rgba(255,255,255,.85)"/><circle cx="82" cy="100" r="7" fill="rgba(0,0,0,.2)"/><circle cx="118" cy="92" r="5" fill="rgba(0,0,0,.2)"/>',
  huile: '<path d="M100 46c18 26 30 44 30 58a30 30 0 11-60 0c0-14 12-32 30-58z" fill="rgba(255,255,255,.9)"/>',
  eliquide: '<rect x="86" y="46" width="28" height="90" rx="12" fill="rgba(255,255,255,.9)"/><rect x="92" y="136" width="16" height="22" rx="6" fill="rgba(255,255,255,.6)"/>',
  pommade: '<rect x="60" y="80" width="80" height="56" rx="12" fill="rgba(255,255,255,.9)"/><rect x="72" y="62" width="56" height="20" rx="8" fill="rgba(255,255,255,.6)"/>',
  infusion: '<path d="M64 78h60v34a30 30 0 01-60 0z" fill="rgba(255,255,255,.9)"/><path d="M124 86h14a14 14 0 010 28h-14" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="8"/>',
  comestible: '<circle cx="82" cy="96" r="20" fill="rgba(255,255,255,.9)"/><circle cx="120" cy="112" r="16" fill="rgba(255,255,255,.75)"/><circle cx="112" cy="76" r="12" fill="rgba(255,255,255,.6)"/>',
  cristaux: '<path d="M100 52l30 30-30 30-30-30z" fill="rgba(255,255,255,.9)"/><path d="M100 116l22 22-22 22-22-22z" fill="rgba(255,255,255,.7)"/>',
  cosmetique: '<rect x="80" y="64" width="40" height="76" rx="10" fill="rgba(255,255,255,.9)"/><rect x="90" y="48" width="20" height="18" rx="5" fill="rgba(255,255,255,.6)"/>'
};

function svgProduit(type) {
  const [c1, c2] = COULEURS[type] || ['#3a5a40', '#a3c9a8'];
  const forme = FORMES[type] || FORMES.fleur;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="${type}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="200" height="200" rx="18" fill="url(#g)"/>${forme}
<text x="100" y="182" text-anchor="middle" font-family="system-ui,sans-serif" font-size="15" fill="rgba(255,255,255,.95)">${type}</text></svg>`;
}

// -------------------------------------------------------------------- statique

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon'
};

function servirStatique(res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  if (!path.extname(rel)) rel += '.html';
  const file = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403).end('Interdit'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }).end('<h1>404</h1><p><a href="/">Retour a l\'accueil</a></p>'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

// ------------------------------------------------------------------------ API

async function api(req, res, pathname, q) {
  const db = store.load();
  const m = req.method;

  if (pathname === '/api/encyclopedie' && m === 'GET') {
    return json(res, 200, ENCYCLOPEDIE);
  }

  if (pathname === '/api/plans' && m === 'GET') {
    return json(res, 200, { plans: PLANS });
  }

  // --- Boutiques (annuaire geolocalise) -----------------------------------
  if (pathname === '/api/boutiques' && m === 'GET') {
    const lat = parseFloat(q.lat), lng = parseFloat(q.lng);
    const rayon = parseFloat(q.rayon) || 50;
    const terme = norm(q.q);
    let out = db.boutiques.filter((s) => s.actif).map((s) => publicShop(db, s));

    if (terme) {
      out = out.filter((s) => norm([s.nom, s.ville, s.code_postal, s.enseigne, s.adresse].join(' ')).includes(terme));
    }
    if (q.livraison === '1') out = out.filter((s) => s.livraison);
    if (q.ouvert === '1') out = out.filter((s) => estOuvert(s));

    if (isFinite(lat) && isFinite(lng)) {
      out = out.map((s) => Object.assign(s, { distance_km: Math.round(distanceKm(lat, lng, s.lat, s.lng) * 10) / 10 }))
        .filter((s) => s.distance_km <= rayon)
        .sort((a, b) => (b.mise_en_avant - a.mise_en_avant) || (a.distance_km - b.distance_km));
    } else {
      out.sort((a, b) => (b.mise_en_avant - a.mise_en_avant) || (b.note - a.note));
    }
    return json(res, 200, { total: out.length, boutiques: out.slice(0, 200) });
  }

  const mShop = pathname.match(/^\/api\/boutiques\/([\w-]+)$/);
  if (mShop && m === 'GET') {
    const s = db.boutiques.find((b) => b.id === mShop[1] && b.actif);
    if (!s) return json(res, 404, { erreur: 'Boutique introuvable' });
    const fiche = publicShop(db, s);
    fiche.catalogue = db.produits.filter((p) => p.boutique_id === s.id && p.actif).map((p) => publicProduit(db, p));
    fiche.ouvert = estOuvert(s);
    return json(res, 200, fiche);
  }

  // --- Produits (marketplace) ---------------------------------------------
  if (pathname === '/api/produits' && m === 'GET') {
    const terme = norm(q.q);
    let out = db.produits.filter((p) => p.actif).map((p) => publicProduit(db, p));
    if (q.type) out = out.filter((p) => p.type === q.type);
    if (q.boutique) out = out.filter((p) => p.boutique_id === q.boutique);
    if (q.ville) out = out.filter((p) => norm(p.ville) === norm(q.ville));
    if (q.achetable === '1') out = out.filter((p) => p.achetable && p.stock > 0);
    if (q.livraison === '1') out = out.filter((p) => p.livraison);
    if (terme) out = out.filter((p) => norm([p.nom, p.variete, p.type, p.terpenes, p.enseigne, p.ville].join(' ')).includes(terme));
    if (q.prix_max) out = out.filter((p) => p.prix <= parseFloat(q.prix_max));
    if (q.cbd_min) out = out.filter((p) => p.taux_cbd >= parseFloat(q.cbd_min));

    const tri = q.tri || 'pertinence';
    if (tri === 'prix_asc') out.sort((a, b) => a.prix - b.prix);
    else if (tri === 'prix_desc') out.sort((a, b) => b.prix - a.prix);
    else if (tri === 'cbd') out.sort((a, b) => b.taux_cbd - a.taux_cbd);
    else out.sort((a, b) => (b.mise_en_avant - a.mise_en_avant) || (b.taux_cbd - a.taux_cbd));

    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const parPage = Math.min(60, parseInt(q.par_page, 10) || 24);
    return json(res, 200, {
      total: out.length, page, par_page: parPage,
      produits: out.slice((page - 1) * parPage, page * parPage)
    });
  }

  const mProd = pathname.match(/^\/api\/produits\/([\w-]+)$/);
  if (mProd && m === 'GET') {
    const p = db.produits.find((x) => x.id === mProd[1] && x.actif);
    if (!p) return json(res, 404, { erreur: 'Produit introuvable' });
    return json(res, 200, publicProduit(db, p));
  }

  // --- Espace distributeur -------------------------------------------------
  if (pathname === '/api/pro/inscription' && m === 'POST') {
    const b = await readBody(req);
    if (!b.nom || !b.email) return json(res, 400, { erreur: 'Nom commercial et email obligatoires.' });
    if (!/^\S+@\S+\.\S+$/.test(b.email)) return json(res, 400, { erreur: 'Email invalide.' });
    if (!b.siret || String(b.siret).replace(/\s/g, '').length !== 14) {
      return json(res, 400, { erreur: 'SIRET a 14 chiffres obligatoire (verification de l\'existence legale du distributeur).' });
    }
    if (db.distributeurs.some((d) => norm(d.email) === norm(b.email))) {
      return json(res, 409, { erreur: 'Un compte existe deja avec cet email.' });
    }
    const plan = planDe(b.plan);
    const dist = {
      id: store.id('dist'), nom: String(b.nom).slice(0, 80), email: String(b.email).toLowerCase(),
      siret: String(b.siret).replace(/\s/g, ''), plan: plan.id, token: store.token(),
      cree_le: new Date().toISOString(), verifie: false
    };
    db.distributeurs.push(dist);
    db.abonnements.push({
      id: store.id('sub'), distributeur_id: dist.id, plan: plan.id, statut: 'actif',
      debut: dist.cree_le, fin: new Date(Date.now() + 30 * 86400000).toISOString(),
      montant_mensuel: plan.prix
    });
    store.save();
    return json(res, 201, {
      distributeur: { id: dist.id, nom: dist.nom, plan: plan.id },
      token: dist.token, plan,
      message: 'Compte cree. Conservez ce token : il sert a publier vos boutiques et produits. Le badge conformite est attribue apres verification manuelle du SIRET et des COA.'
    });
  }

  if (pathname === '/api/pro/moi' && m === 'GET') {
    const d = auth(req);
    if (!d) return json(res, 401, { erreur: 'Token distributeur manquant ou invalide.' });
    const sub = abonnementActif(db, d.id);
    const boutiques = db.boutiques.filter((s) => s.distributeur_id === d.id);
    return json(res, 200, {
      distributeur: { id: d.id, nom: d.nom, email: d.email, plan: d.plan, verifie: d.verifie },
      plan: planDe(d.plan), abonnement: sub,
      boutiques: boutiques.map((s) => publicShop(db, s)),
      produits: db.produits.filter((p) => p.distributeur_id === d.id).map((p) => publicProduit(db, p)),
      commandes: db.commandes.filter((c) => c.distributeur_id === d.id)
    });
  }

  if (pathname === '/api/pro/boutiques' && m === 'POST') {
    const d = auth(req);
    if (!d) return json(res, 401, { erreur: 'Token distributeur manquant ou invalide.' });
    if (!abonnementActif(db, d.id)) return json(res, 402, { erreur: 'Abonnement inactif ou expire. Renouvelez pour publier.' });
    const plan = planDe(d.plan);
    const dejaLa = db.boutiques.filter((s) => s.distributeur_id === d.id).length;
    if (dejaLa >= plan.max_boutiques) {
      return json(res, 403, { erreur: 'Limite du plan ' + plan.nom + ' atteinte (' + plan.max_boutiques + ' boutique(s)). Passez au plan superieur.' });
    }
    const b = await readBody(req);
    const lat = parseFloat(b.lat), lng = parseFloat(b.lng);
    if (!b.nom || !b.adresse || !b.ville) return json(res, 400, { erreur: 'Nom, adresse et ville obligatoires.' });
    if (!isFinite(lat) || !isFinite(lng)) return json(res, 400, { erreur: 'Coordonnees GPS (lat/lng) obligatoires pour la geolocalisation.' });
    const shop = {
      id: store.id('shop'), distributeur_id: d.id, nom: String(b.nom).slice(0, 80),
      adresse: String(b.adresse).slice(0, 160), ville: String(b.ville).slice(0, 60),
      code_postal: String(b.code_postal || '').slice(0, 10), lat, lng,
      telephone: String(b.telephone || '').slice(0, 24),
      horaires: b.horaires && typeof b.horaires === 'object' ? b.horaires : {},
      livraison: !!b.livraison, frais_livraison: Number(b.frais_livraison) || 0,
      conditions_livraison: String(b.conditions_livraison || '').slice(0, 200),
      delai_livraison_h: Number(b.delai_livraison_h) || 0,
      click_and_collect: b.click_and_collect !== false,
      note: 0, avis: 0, actif: true, cree_le: new Date().toISOString()
    };
    db.boutiques.push(shop);
    store.save();
    return json(res, 201, publicShop(db, shop));
  }

  if (pathname === '/api/pro/produits' && m === 'POST') {
    const d = auth(req);
    if (!d) return json(res, 401, { erreur: 'Token distributeur manquant ou invalide.' });
    if (!abonnementActif(db, d.id)) return json(res, 402, { erreur: 'Abonnement inactif ou expire.' });
    const plan = planDe(d.plan);
    if (db.produits.filter((p) => p.distributeur_id === d.id).length >= plan.max_produits) {
      return json(res, 403, { erreur: 'Limite de ' + plan.max_produits + ' produits atteinte pour le plan ' + plan.nom + '.' });
    }
    const b = await readBody(req);
    const shop = db.boutiques.find((s) => s.id === b.boutique_id && s.distributeur_id === d.id);
    if (!shop) return json(res, 400, { erreur: 'Boutique inconnue ou n\'appartenant pas a ce compte.' });
    if (!ENCYCLOPEDIE.types.some((t) => t.id === b.type)) {
      return json(res, 400, { erreur: 'Type de produit inconnu. Types valides : ' + ENCYCLOPEDIE.types.map((t) => t.id).join(', ') });
    }
    const p = {
      id: store.id('prod'), boutique_id: shop.id, distributeur_id: d.id,
      type: b.type, nom: String(b.nom || '').slice(0, 90), variete: b.variete ? String(b.variete).slice(0, 60) : null,
      taux_cbd: Number(b.taux_cbd), taux_thc: Number(b.taux_thc),
      prix: Number(b.prix), unite: String(b.unite || 'unite').slice(0, 30),
      stock: Math.max(0, parseInt(b.stock, 10) || 0),
      culture: String(b.culture || '').slice(0, 40), spectre: String(b.spectre || '').slice(0, 40),
      terpenes: String(b.terpenes || '').slice(0, 90),
      lot: String(b.lot || '').slice(0, 30), coa: b.coa === true,
      description: String(b.description || '').slice(0, 600),
      actif: true, cree_le: new Date().toISOString()
    };
    const check = verifierProduit(p);
    if (!check.ok) return json(res, 422, { erreur: 'Fiche produit non conforme', details: check.erreurs });
    db.produits.push(p);
    store.save();
    return json(res, 201, publicProduit(db, p));
  }

  // --- Commandes (marketplace) --------------------------------------------
  if (pathname === '/api/commandes' && m === 'POST') {
    const b = await readBody(req);
    if (b.majeur !== true) return json(res, 403, { erreur: 'Vente interdite aux mineurs. Confirmation de majorite requise.' });
    if (!Array.isArray(b.lignes) || !b.lignes.length) return json(res, 400, { erreur: 'Panier vide.' });
    if (!b.email || !/^\S+@\S+\.\S+$/.test(b.email)) return json(res, 400, { erreur: 'Email de contact invalide.' });

    const lignes = [];
    let total = 0, distributeurId = null;
    for (const l of b.lignes) {
      const p = db.produits.find((x) => x.id === l.produit_id && x.actif);
      if (!p) return json(res, 400, { erreur: 'Produit introuvable : ' + l.produit_id });
      const plan = planDe((db.distributeurs.find((d) => d.id === p.distributeur_id) || {}).plan);
      if (!plan.marketplace) return json(res, 403, { erreur: 'Ce vendeur est en formule vitrine : produit consultable mais non vendu en ligne.' });
      const qte = Math.max(1, parseInt(l.quantite, 10) || 1);
      if (qte > p.stock) return json(res, 409, { erreur: 'Stock insuffisant pour ' + p.nom + ' (reste ' + p.stock + ').' });
      if (distributeurId && distributeurId !== p.distributeur_id) {
        return json(res, 400, { erreur: 'Une commande ne peut concerner qu\'un seul vendeur. Validez un panier par vendeur.' });
      }
      distributeurId = p.distributeur_id;
      const montant = Math.round(p.prix * qte * 100) / 100;
      total += montant;
      lignes.push({ produit_id: p.id, nom: p.nom, type: p.type, prix_unitaire: p.prix, quantite: qte, montant });
    }

    const shop = db.boutiques.find((s) => s.id === (db.produits.find((x) => x.id === lignes[0].produit_id) || {}).boutique_id);
    const mode = b.mode === 'retrait' ? 'retrait' : 'livraison';
    const port = mode === 'livraison' && shop ? (total >= 60 ? 0 : shop.frais_livraison) : 0;
    const plan = planDe((db.distributeurs.find((d) => d.id === distributeurId) || {}).plan);
    const commission = Math.round(total * (plan.id === 'premium' ? 0.03 : 0.05) * 100) / 100;

    const cmd = {
      id: store.id('cmd'), distributeur_id: distributeurId, boutique_id: shop ? shop.id : null,
      email: String(b.email).toLowerCase(), mode, lignes,
      sous_total: Math.round(total * 100) / 100, frais_livraison: port,
      total: Math.round((total + port) * 100) / 100,
      commission_plateforme: commission,
      statut: 'en_attente_paiement', cree_le: new Date().toISOString()
    };
    for (const l of lignes) {
      const p = db.produits.find((x) => x.id === l.produit_id);
      p.stock -= l.quantite;
    }
    db.commandes.push(cmd);
    store.save();
    return json(res, 201, Object.assign({}, cmd, {
      paiement: 'Simulation : brancher Stripe Checkout ici (aucun paiement reel n\'est traite).'
    }));
  }

  const mCmd = pathname.match(/^\/api\/commandes\/([\w-]+)$/);
  if (mCmd && m === 'GET') {
    const c = db.commandes.find((x) => x.id === mCmd[1]);
    if (!c) return json(res, 404, { erreur: 'Commande introuvable' });
    return json(res, 200, c);
  }

  // --- Conformite ----------------------------------------------------------
  if (pathname === '/api/conformite/verifier' && m === 'POST') {
    const b = await readBody(req);
    return json(res, 200, Object.assign({ thc_max: THC_MAX }, verifierProduit(b)));
  }

  if (pathname === '/api/stats' && m === 'GET') {
    return json(res, 200, {
      boutiques: db.boutiques.filter((s) => s.actif).length,
      distributeurs: db.distributeurs.length,
      produits: db.produits.filter((p) => p.actif).length,
      villes: [...new Set(db.boutiques.map((s) => s.ville))].length,
      types: ENCYCLOPEDIE.types.length,
      molecules: ENCYCLOPEDIE.molecules.length
    });
  }

  return json(res, 404, { erreur: 'Endpoint inconnu : ' + pathname });
}

// Ouverture selon les horaires declares, heure de Paris.
function estOuvert(s) {
  const jours = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const plage = (s.horaires || {})[jours[now.getDay()]];
  if (!plage || /ferme/i.test(plage)) return false;
  const mm = plage.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!mm) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= +mm[1] * 60 + +mm[2] && cur <= +mm[3] * 60 + +mm[4];
}

// ---------------------------------------------------------------------- serveur

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    });
    return res.end();
  }
  res.setHeader('Access-Control-Allow-Origin', '*');

  const mImg = pathname.match(/^\/img\/produit\/([\w-]+)\.svg$/);
  if (mImg) {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' });
    return res.end(svgProduit(mImg[1]));
  }

  if (pathname.startsWith('/api/')) {
    try {
      return await api(req, res, pathname, parsed.query);
    } catch (e) {
      return json(res, 400, { erreur: e.message || 'Requete invalide' });
    }
  }

  return servirStatique(res, pathname);
});

if (require.main === module) {
  store.load();
  server.listen(PORT, () => {
    const db = store.load();
    console.log('CBD Atlas sur http://localhost:' + PORT);
    console.log('  ' + db.boutiques.length + ' boutiques, ' + db.produits.length + ' produits, ' + db.distributeurs.length + ' distributeurs');
  });
  process.on('SIGINT', () => { store.flush(); process.exit(0); });
  process.on('SIGTERM', () => { store.flush(); process.exit(0); });
}

module.exports = { server, PLANS };

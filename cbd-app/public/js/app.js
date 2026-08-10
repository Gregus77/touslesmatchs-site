/* CBD Atlas - socle commun : navigation, controle d'age, panier, appels API. */
(function () {
  'use strict';

  const NAV = [
    ['/', 'Accueil'],
    ['/encyclopedie', 'Encyclopedie'],
    ['/boutiques', 'Boutiques'],
    ['/marketplace', 'Marketplace'],
    ['/legalite', 'Legalite'],
    ['/pro', 'Espace pro']
  ];

  // ------------------------------------------------------------------ API
  async function api(chemin, options) {
    const o = Object.assign({ headers: {} }, options || {});
    if (o.body && typeof o.body !== 'string') {
      o.body = JSON.stringify(o.body);
      o.headers['Content-Type'] = 'application/json';
    }
    const tok = localStorage.getItem('cbd_token');
    if (tok && chemin.startsWith('/api/pro')) o.headers.Authorization = 'Bearer ' + tok;
    const r = await fetch(chemin, o);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.erreur || 'Erreur ' + r.status), { details: data.details, status: r.status });
    return data;
  }

  const euro = (n) => Number(n).toFixed(2).replace('.', ',') + ' EUR';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ------------------------------------------------------------- structure
  function monterEntete() {
    const ici = location.pathname.replace(/\.html$/, '') || '/';
    const liens = NAV.map(([h, t]) =>
      `<a href="${h}" class="${h === ici ? 'actif' : ''}">${t}</a>`).join('');

    const el = document.createElement('div');
    el.innerHTML = `
      <div class="bandeau">Produits reserves aux <strong>adultes de 18 ans et plus</strong> &middot; THC &le; 0,3 % &middot; Aucune allegation therapeutique &middot; Le CBD n'est pas un medicament</div>
      <header class="top"><div class="wrap">
        <a class="logo" href="/"><span class="leaf">🌿</span> CBD Atlas</a>
        <button class="burger" aria-label="Menu">☰</button>
        <nav class="nav">${liens}
          <button class="btn mini" id="btn-panier" style="position:relative;margin-left:6px">Panier <span class="badgep" id="badge-panier" hidden>0</span></button>
        </nav>
      </div></header>`;
    document.body.prepend(el);
    el.querySelector('.burger').onclick = () => el.querySelector('.nav').classList.toggle('ouvert');
    el.querySelector('#btn-panier').onclick = () => Panier.basculer();
  }

  function monterPied() {
    const p = document.createElement('footer');
    p.className = 'pied';
    p.innerHTML = `<div class="wrap">
      <div class="grid g2">
        <div>
          <strong>CBD Atlas</strong> &mdash; l'encyclopedie et l'annuaire des produits CBD legaux en France.
          <p style="margin-top:6px">Donnees produits declarees par les distributeurs, sous leur responsabilite. Chaque reference doit disposer d'un certificat d'analyse (COA).</p>
        </div>
        <div>
          <p><strong>Rappels legaux</strong><br>
          Vente interdite aux mineurs. THC &le; 0,3 % dans le produit fini. Le CBD n'est pas un medicament et ne remplace aucun traitement.
          Deconseille aux femmes enceintes ou allaitantes. Consommation deconseillee avant de conduire.</p>
          <p>Information et aide : <a href="https://www.drogues-info-service.fr" target="_blank" rel="noopener">drogues-info-service.fr</a> &mdash; 0 800 23 13 13</p>
        </div>
      </div>
      <p style="margin-top:16px;opacity:.7">&copy; ${new Date().getFullYear()} CBD Atlas &middot; <a href="/legalite">Cadre legal</a> &middot; <a href="/pro">Referencer ma boutique</a></p>
    </div>`;
    document.body.appendChild(p);
  }

  // ---------------------------------------------------------- controle age
  function controleAge() {
    if (localStorage.getItem('cbd_majeur') === '1') return;
    const v = document.createElement('div');
    v.className = 'voile ouvert';
    v.innerHTML = `<div class="modale" style="max-width:430px;text-align:center">
      <div style="font-size:2.4rem">🌿</div>
      <h2 style="margin:8px 0 6px">Avez-vous 18 ans ou plus ?</h2>
      <p style="color:var(--texte-doux)">L'acces a ce site est reserve aux personnes majeures. Les produits presentes contiennent au maximum 0,3 % de THC et ne sont pas des medicaments.</p>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:18px">
        <button class="btn" id="oui">Oui, j'ai 18 ans ou plus</button>
        <button class="btn ghost" id="non">Non</button>
      </div></div>`;
    document.body.appendChild(v);
    v.querySelector('#oui').onclick = () => { localStorage.setItem('cbd_majeur', '1'); v.remove(); };
    v.querySelector('#non').onclick = () => { document.body.innerHTML =
      '<div class="vide" style="padding-top:120px"><h1>Acces refuse</h1><p>Ce site est reserve aux personnes majeures.</p></div>'; };
  }

  // ------------------------------------------------------------------ panier
  const Panier = {
    lire() { try { return JSON.parse(localStorage.getItem('cbd_panier') || '[]'); } catch (e) { return []; } },
    ecrire(items) { localStorage.setItem('cbd_panier', JSON.stringify(items)); this.rendre(); },
    ajouter(produit) {
      const items = this.lire();
      const ex = items.find((i) => i.id === produit.id);
      if (ex) ex.quantite++;
      else items.push({ id: produit.id, nom: produit.nom, prix: produit.prix, unite: produit.unite,
        image: produit.image, boutique: produit.boutique, quantite: 1 });
      this.ecrire(items);
      this.basculer(true);
    },
    retirer(id) { this.ecrire(this.lire().filter((i) => i.id !== id)); },
    total() { return this.lire().reduce((s, i) => s + i.prix * i.quantite, 0); },
    basculer(force) {
      const el = document.getElementById('tiroir-panier');
      el.classList.toggle('ouvert', force === true ? true : !el.classList.contains('ouvert'));
    },
    monter() {
      const el = document.createElement('aside');
      el.id = 'tiroir-panier';
      el.className = 'panier';
      el.innerHTML = `<header><strong>Mon panier</strong><button class="btn ghost mini" id="fermer-panier">Fermer</button></header>
        <div class="items" id="panier-items"></div>
        <footer>
          <div style="display:flex;justify-content:space-between;font-weight:800;margin-bottom:10px">
            <span>Total</span><span id="panier-total">0,00 EUR</span></div>
          <p style="font-size:.76rem;color:var(--texte-doux);margin:0 0 10px">Frais de livraison calcules a la commande, selon la boutique. Un panier = un vendeur.</p>
          <button class="btn" style="width:100%" id="commander">Passer commande</button>
        </footer>`;
      document.body.appendChild(el);
      el.querySelector('#fermer-panier').onclick = () => this.basculer(false);
      el.querySelector('#commander').onclick = () => this.commander();
      this.rendre();
    },
    rendre() {
      const box = document.getElementById('panier-items');
      if (!box) return;
      const items = this.lire();
      box.innerHTML = items.length ? items.map((i) => `
        <div class="pitem">
          <img src="${esc(i.image)}" alt="">
          <div style="flex:1">
            <div style="font-weight:700;font-size:.9rem">${esc(i.nom)}</div>
            <div style="font-size:.78rem;color:var(--texte-doux)">${esc(i.boutique)} &middot; ${i.quantite} x ${euro(i.prix)}</div>
          </div>
          <button class="btn ghost mini" data-retirer="${esc(i.id)}">x</button>
        </div>`).join('') : '<div class="vide">Panier vide.</div>';
      box.querySelectorAll('[data-retirer]').forEach((b) => {
        b.onclick = () => this.retirer(b.getAttribute('data-retirer'));
      });
      document.getElementById('panier-total').textContent = euro(this.total());
      const badge = document.getElementById('badge-panier');
      const n = items.reduce((s, i) => s + i.quantite, 0);
      badge.hidden = n === 0;
      badge.textContent = n;
    },
    async commander() {
      const items = this.lire();
      if (!items.length) return alert('Votre panier est vide.');
      const email = prompt('Email de contact pour le suivi de commande :');
      if (!email) return;
      if (!confirm('Je certifie etre majeur(e) et avoir pris connaissance des mentions legales.')) return;
      try {
        const cmd = await api('/api/commandes', {
          method: 'POST',
          body: { email, majeur: true, mode: 'livraison', lignes: items.map((i) => ({ produit_id: i.id, quantite: i.quantite })) }
        });
        alert('Commande ' + cmd.id + ' enregistree.\nSous-total ' + euro(cmd.sous_total) +
          '\nLivraison ' + euro(cmd.frais_livraison) + '\nTotal ' + euro(cmd.total) +
          '\n\n' + cmd.paiement);
        this.ecrire([]);
        this.basculer(false);
      } catch (e) { alert('Commande refusee : ' + e.message); }
    }
  };

  function init() {
    monterEntete();
    Panier.monter();
    monterPied();
    controleAge();
  }

  window.CBD = { api, euro, esc, Panier, init };
  document.addEventListener('DOMContentLoaded', init);
})();

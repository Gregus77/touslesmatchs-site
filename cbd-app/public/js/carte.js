/* Carte de France en SVG, sans dependance ni tuiles externes.
   Projection equirectangulaire corrigee au parallele 46,5 N. */
(function () {
  'use strict';

  const CONTOUR = [
    [2.37, 51.03], [4.23, 49.96], [5.50, 49.50], [6.36, 49.46], [7.60, 49.05],
    [7.60, 48.00], [7.55, 47.60], [6.90, 47.35], [6.05, 46.40], [6.80, 46.00],
    [7.00, 45.50], [6.60, 45.10], [7.00, 44.25], [7.50, 43.78], [6.00, 43.10],
    [4.80, 43.35], [3.00, 43.20], [3.05, 42.47], [1.70, 42.50], [0.60, 42.70],
    [-1.40, 43.30], [-1.25, 44.50], [-1.05, 45.60], [-1.15, 46.30], [-2.20, 47.20],
    [-4.80, 48.00], [-4.60, 48.70], [-3.00, 48.85], [-1.60, 48.65], [-1.50, 49.70],
    [0.10, 49.50], [1.60, 50.20]
  ];

  const CORSE = [
    [9.40, 43.00], [9.55, 42.60], [9.50, 42.10], [9.25, 41.38], [8.80, 41.55],
    [8.60, 42.35], [8.75, 42.60], [9.10, 42.70]
  ];

  const W = 760, H = 720, PAD = 26;
  const LAT0 = 46.5, K = Math.cos((LAT0 * Math.PI) / 180);
  const BORNES = { minLng: -5.2, maxLng: 9.8, minLat: 41.2, maxLat: 51.3 };

  function projeter(lng, lat) {
    const x0 = BORNES.minLng * K, x1 = BORNES.maxLng * K;
    const x = ((lng * K - x0) / (x1 - x0)) * (W - 2 * PAD) + PAD;
    const y = ((BORNES.maxLat - lat) / (BORNES.maxLat - BORNES.minLat)) * (H - 2 * PAD) + PAD;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  }

  const chemin = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + projeter(p[0], p[1]).join(' ')).join(' ') + ' Z';

  /**
   * Dessine la carte dans un conteneur.
   * @param {HTMLElement} hote
   * @param {Array} boutiques  objets {id,nom,ville,lat,lng,mise_en_avant}
   * @param {Function} onClic  appele avec la boutique cliquee
   * @param {Object|null} moi  {lat,lng} position de l'utilisateur
   */
  function dessiner(hote, boutiques, onClic, moi) {
    const pins = boutiques.map((b) => {
      const [x, y] = projeter(b.lng, b.lat);
      const c = b.mise_en_avant ? '#c8a24a' : '#2f7d4f';
      return `<g class="pin" data-id="${b.id}" tabindex="0" role="button" aria-label="${(b.nom || '').replace(/"/g, '')}">
        <circle cx="${x}" cy="${y}" r="7" fill="${c}" stroke="#fff" stroke-width="2.5"/>
        <title>${(b.nom || '') + ' - ' + (b.ville || '')}</title></g>`;
    }).join('');

    const moiPin = moi ? (() => {
      const [x, y] = projeter(moi.lng, moi.lat);
      return `<g><circle cx="${x}" cy="${y}" r="16" fill="#2f7d4f" opacity=".15"/>
        <circle cx="${x}" cy="${y}" r="5" fill="#1d5133" stroke="#fff" stroke-width="2"/></g>`;
    })() : '';

    hote.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Carte des boutiques CBD en France">
      <rect width="${W}" height="${H}" fill="#eaf1ec"/>
      <path d="${chemin(CONTOUR)}" fill="#ffffff" stroke="#c3d3c8" stroke-width="2" stroke-linejoin="round"/>
      <path d="${chemin(CORSE)}" fill="#ffffff" stroke="#c3d3c8" stroke-width="2" stroke-linejoin="round"/>
      ${moiPin}${pins}
    </svg>`;

    hote.querySelectorAll('.pin').forEach((g) => {
      const b = boutiques.find((x) => x.id === g.getAttribute('data-id'));
      g.onclick = () => onClic(b);
      g.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClic(b); } };
    });
  }

  window.CarteFrance = { dessiner, projeter };
})();

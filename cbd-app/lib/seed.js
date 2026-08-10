'use strict';
// Jeu de donnees de demonstration (boutiques et produits fictifs).
const crypto = require('crypto');

const HORAIRES_STD = {
  lun: '10:00-19:00', mar: '10:00-19:00', mer: '10:00-19:00',
  jeu: '10:00-19:00', ven: '10:00-20:00', sam: '10:00-20:00', dim: 'Ferme'
};

const DISTRIBUTEURS = [
  ['Chanvre & Co', 'contact@chanvre-co.fr', 'pro', [
    ['Chanvre & Co Paris Marais', '18 rue des Rosiers', 'Paris', '75004', 48.8571, 2.3600, true, 4.9, 'Livraison France 4,90 EUR - offerte des 60 EUR', 24],
    ['Chanvre & Co Lyon Bellecour', '5 place Bellecour', 'Lyon', '69002', 45.7578, 4.8320, true, 6.5, 'Retrait en boutique ou coursier Lyon intra-muros', 2]
  ]],
  ['Green Valley', 'hello@greenvalley.fr', 'premium', [
    ['Green Valley Bordeaux', '32 rue Sainte-Catherine', 'Bordeaux', '33000', 44.8404, -0.5741, true, 4.5, 'Colissimo 48h - offerte des 50 EUR', 48],
    ['Green Valley Toulouse', '11 rue du Taur', 'Toulouse', '31000', 43.6045, 1.4430, false, 0, 'Retrait en boutique uniquement', 0]
  ]],
  ['Herbe Fine', 'pro@herbefine.fr', 'basic', [
    ['Herbe Fine Marseille', '7 cours Julien', 'Marseille', '13006', 43.2946, 5.3830, true, 5.9, 'Mondial Relay 3-5 jours', 72]
  ]],
  ['Terpene Lab', 'contact@terpenelab.fr', 'premium', [
    ['Terpene Lab Lille', '24 rue Esquermoise', 'Lille', '59000', 50.6390, 3.0603, true, 3.9, 'Livraison 24h Hauts-de-France', 24],
    ['Terpene Lab Nantes', '9 rue Crebillon', 'Nantes', '44000', 47.2140, -1.5600, true, 4.9, 'Chronopost 24h', 24]
  ]],
  ['Alpine CBD', 'shop@alpinecbd.fr', 'basic', [
    ['Alpine CBD Grenoble', '3 place Grenette', 'Grenoble', '38000', 45.1920, 5.7260, true, 5.5, 'Colissimo 48h', 48]
  ]],
  ['Riviera Hemp', 'contact@rivierahemp.fr', 'pro', [
    ['Riviera Hemp Nice', '15 rue Massena', 'Nice', '06000', 43.6980, 7.2680, true, 4.9, 'Livraison Alpes-Maritimes en 24h', 24]
  ]]
];

// [type, nom, variete, taux_cbd, thc, prix, unite, stock, culture, spectre, terpenes]
const CATALOGUE = [
  ['fleur', 'Amnesia Haze', 'Amnesia Haze', 18, 0.25, 9.90, 'g', 400, 'Indoor', 'Full spectrum', 'Limonene, Myrcene'],
  ['fleur', 'Gorilla Glue', 'Gorilla Glue #4', 16, 0.20, 8.90, 'g', 350, 'Indoor', 'Full spectrum', 'Caryophyllene, Pinene'],
  ['fleur', 'Orange Bud', 'Orange Bud', 12, 0.18, 6.50, 'g', 600, 'Greenhouse', 'Full spectrum', 'Limonene, Linalol'],
  ['fleur', 'Purple Haze Outdoor', 'Purple Haze', 9, 0.15, 4.90, 'g', 900, 'Outdoor', 'Full spectrum', 'Myrcene'],
  ['resine', 'Pollen Marocain 22%', 'Ketama', 22, 0.28, 12.00, 'g', 180, 'Extraction a sec', 'Full spectrum', 'Caryophyllene'],
  ['resine', 'Ice-o-lator 35%', 'Static Melt', 35, 0.29, 19.00, 'g', 60, 'Ice-o-lator', 'Full spectrum', 'Myrcene, Pinene'],
  ['huile', 'Huile Full Spectrum 10%', null, 10, 0.20, 39.90, 'flacon 10 ml', 120, 'CO2 supercritique', 'Full spectrum', 'Profil complet'],
  ['huile', 'Huile Broad Spectrum 20%', null, 20, 0.0, 69.90, 'flacon 10 ml', 80, 'CO2 supercritique', 'Broad spectrum', 'Sans THC'],
  ['huile', 'Huile Isolat 5% neutre', null, 5, 0.0, 24.90, 'flacon 10 ml', 150, 'Isolat', 'Isolat', 'Neutre'],
  ['eliquide', 'E-liquide Mangue 300 mg', null, 3, 0.0, 16.90, 'flacon 10 ml', 200, 'Isolat', 'Isolat', 'Mangue'],
  ['eliquide', 'E-liquide Amnesia 600 mg', null, 6, 0.0, 24.90, 'flacon 10 ml', 140, 'Broad spectrum', 'Broad spectrum', 'Amnesia'],
  ['pommade', 'Baume musculaire 1000 mg', null, 2, 0.0, 34.90, 'pot 50 ml', 90, 'Isolat', 'Isolat', 'Menthol, Arnica'],
  ['pommade', 'Creme apaisante 500 mg', null, 1, 0.0, 22.90, 'pot 50 ml', 110, 'Broad spectrum', 'Broad spectrum', 'Calendula'],
  ['infusion', 'Infusion Nuit Camomille', null, 5, 0.20, 12.90, 'sachet 30 g', 220, 'Outdoor', 'Full spectrum', 'Camomille, Tilleul'],
  ['comestible', 'Gummies 25 mg x20', null, 0, 0.0, 29.90, 'boite de 20', 130, 'Isolat', 'Isolat', 'Fruits rouges'],
  ['cristaux', 'Cristaux 99,5%', null, 99.5, 0.0, 39.00, 'g', 70, 'Cristallisation', 'Isolat', 'Aucun'],
  ['cosmetique', 'Serum visage chanvre', null, 1, 0.0, 28.00, 'flacon 30 ml', 95, 'Isolat', 'Isolat', 'Neroli'],
  ['cosmetique', 'Savon surgras chanvre', null, 0.5, 0.0, 9.50, 'pain 100 g', 300, 'Huile de graines', 'Sans CBD actif', 'Lavande']
];

function seed(db) {
  const rnd = (n) => crypto.randomBytes(3).toString('hex').slice(0, n);
  let seq = 1;
  const nid = (p) => p + '_' + (seq++).toString(36) + rnd(4);

  DISTRIBUTEURS.forEach(([nom, email, plan, shops], di) => {
    const dist = {
      id: nid('dist'), nom, email, plan,
      token: crypto.randomBytes(24).toString('hex'),
      siret: '000' + (100000000 + di * 7919).toString(),
      cree_le: new Date(Date.now() - (60 - di * 5) * 86400000).toISOString(),
      verifie: true
    };
    db.distributeurs.push(dist);
    db.abonnements.push({
      id: nid('sub'), distributeur_id: dist.id, plan, statut: 'actif',
      debut: dist.cree_le,
      fin: new Date(Date.now() + 30 * 86400000).toISOString()
    });

    shops.forEach(([snom, adresse, ville, cp, lat, lng, livre, fraisPort, condLiv, delai]) => {
      const shop = {
        id: nid('shop'), distributeur_id: dist.id, nom: snom,
        adresse, ville, code_postal: cp, lat, lng,
        telephone: '01 00 00 00 0' + (seq % 10),
        horaires: Object.assign({}, HORAIRES_STD),
        livraison: livre, frais_livraison: fraisPort,
        conditions_livraison: condLiv, delai_livraison_h: delai,
        click_and_collect: true,
        note: Math.round((4.1 + (seq % 9) / 10) * 10) / 10,
        avis: 20 + ((seq * 13) % 180),
        actif: true,
        cree_le: dist.cree_le
      };
      db.boutiques.push(shop);

      // Chaque boutique prend une tranche du catalogue, prix legerement variables.
      const start = (seq * 3) % CATALOGUE.length;
      for (let k = 0; k < 8; k++) {
        const c = CATALOGUE[(start + k) % CATALOGUE.length];
        const [type, pnom, variete, cbd, thc, prix, unite, stock, culture, spectre, terpenes] = c;
        const coef = 1 + (((seq + k) % 7) - 3) / 40; // +/- 7.5 %
        db.produits.push({
          id: nid('prod'), boutique_id: shop.id, distributeur_id: dist.id,
          type, nom: pnom, variete, taux_cbd: cbd, taux_thc: thc,
          prix: Math.round(prix * coef * 100) / 100, unite, stock,
          culture, spectre, terpenes,
          lot: 'L' + (2600 + seq * 3 + k),
          coa: true,
          description: pnom + ' - ' + spectre + ', ' + cbd + ' % de CBD, ' + thc + ' % de THC. Analyse de lot disponible.',
          actif: true,
          cree_le: shop.cree_le
        });
      }
    });
  });

  db.seq = seq;
}

module.exports = { seed, CATALOGUE };

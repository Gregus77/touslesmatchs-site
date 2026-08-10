'use strict';
// Filtre de conformite : rien ne passe en ligne sans avoir traverse ce module.

const MOLECULES_INTERDITES = [
  'hhc', 'hhc-o', 'hhco', 'hhcp', 'thcp', 'thco', 'thc-o', 'thcjd', 'thcb',
  'delta 8', 'delta-8', 'delta 9', 'delta-9', 'delta 10', 'delta-10',
  'thcv synthetique', 'cannabinoide de synthese'
];

// Allegations therapeutiques interdites (reglement UE 1924/2006, code de la sante publique).
const ALLEGATIONS_INTERDITES = [
  'soigne', 'guerit', 'guerir', 'traite la', 'traitement de', 'remede',
  'anti-cancer', 'cancer', 'anxiete', 'depression', 'insomnie', 'douleur',
  'arthrose', 'epilepsie', 'medicament', 'therapeutique', 'medical',
  'remplace votre traitement', 'sans risque', 'anti-inflammatoire',
  'antidouleur', 'calme les crises', 'diabete', 'alzheimer', 'parkinson'
];

const THC_MAX = 0.3;

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Verifie une fiche produit. Retourne { ok, erreurs: [] }.
function verifierProduit(p) {
  const erreurs = [];
  const texte = norm([p.nom, p.description, p.variete, p.terpenes, p.spectre].join(' '));

  for (const m of MOLECULES_INTERDITES) {
    if (texte.includes(norm(m))) {
      erreurs.push('Molecule interdite en France detectee : ' + m.toUpperCase() + '. Reference refusee.');
    }
  }
  for (const a of ALLEGATIONS_INTERDITES) {
    if (texte.includes(norm(a))) {
      erreurs.push('Allegation therapeutique interdite : "' + a + '". Reformulez sans reference a une pathologie ou a un effet de sante.');
    }
  }

  const thc = Number(p.taux_thc);
  if (!isFinite(thc) || thc < 0) erreurs.push('Taux de THC manquant ou invalide.');
  else if (thc > THC_MAX) erreurs.push('Taux de THC de ' + thc + ' % superieur au maximum legal de ' + THC_MAX + ' %.');

  const cbd = Number(p.taux_cbd);
  if (!isFinite(cbd) || cbd < 0 || cbd > 100) erreurs.push('Taux de CBD manquant ou invalide.');

  if (p.coa !== true) erreurs.push('Certificat d\'analyse (COA) de laboratoire independant obligatoire.');
  if (!p.lot) erreurs.push('Numero de lot obligatoire pour la tracabilite.');
  if (!Number(p.prix) || Number(p.prix) <= 0) erreurs.push('Prix invalide.');

  return { ok: erreurs.length === 0, erreurs };
}

module.exports = { verifierProduit, MOLECULES_INTERDITES, ALLEGATIONS_INTERDITES, THC_MAX };

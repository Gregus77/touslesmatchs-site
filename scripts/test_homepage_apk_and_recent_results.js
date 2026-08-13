#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error('homepage_apk_and_recent_results: FAIL');
    console.error(message);
    process.exit(1);
  }
}

assert(index.includes('nav-apk-cta'), 'CTA APK manquant dans la navigation desktop');
assert(index.includes('Télécharger l’app Android bêta'), 'CTA APK manquant dans le menu mobile / encart site');
assert(index.includes('Gmail bloque les fichiers APK'), 'Explication Gmail/APK manquante');
assert(index.includes('/downloads/TousLesMatchs-Goal05-beta.apk'), 'Lien APK officiel manquant');
assert(index.includes('var seenProof={}'), 'Dédoublonnage des résultats récents manquant');
assert(index.includes("if(seenProof[key]) return false"), 'Filtre anti-doublon absent');
assert(!index.includes('partner-btn pb-betclic'), 'Betclic encore visible dans les partenaires publics');
assert(index.includes('partner-btn pb-winamax'), 'Winamax manquant');
assert(index.includes('partner-btn pb-unibet'), 'Unibet manquant');
assert(index.includes('partner-btn pb-pmu'), 'PMU manquant');

console.log('homepage_apk_and_recent_results: OK');

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const apkPath = path.join(root, 'public', 'downloads', 'TousLesMatchs-Goal05-beta.apk');
const index = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.html'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error('apk_download_tunnel: FAIL');
    console.error(message);
    process.exit(1);
  }
}

assert(fs.existsSync(apkPath), 'APK publique absente');
assert(fs.statSync(apkPath).size > 10000, 'APK publique trop petite ou invalide');
assert(index.includes('/downloads/TousLesMatchs-Goal05-beta.apk'), 'Lien APK manquant sur accueil');
assert(index.includes('Télécharger l\'APK Android bêta'), 'CTA APK accueil manquant');
assert(app.includes('/downloads/TousLesMatchs-Goal05-beta.apk'), 'Lien APK manquant sur app.html');
assert(app.includes('Télécharger l\'APK Android'), 'CTA APK app manquant');
assert(app.includes('Football uniquement'), 'Cadre football uniquement manquant');
assert(index.includes('Version bêta privée, football uniquement, 18+'), 'Mention beta/18+ accueil manquante');

console.log('apk_download_tunnel: OK');

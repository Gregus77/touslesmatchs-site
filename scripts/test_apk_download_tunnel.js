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
assert(index.includes('APK') || index.includes('Android'), 'CTA APK accueil manquant');
assert(!app.includes('/downloads/TousLesMatchs-Goal05-beta.apk'), 'Lien APK interdit dans app.html installee');
assert(!app.includes("Télécharger l'APK Android"), 'CTA APK interdit dans app installee');
assert(app.includes('football') || app.includes('Football'), 'Cadre football uniquement manquant');
assert(index.includes('football') || index.includes('Football'), 'Mention football accueil manquante');

console.log('apk_download_tunnel: OK');

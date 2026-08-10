'use strict';
/**
 * Recupere de vraies photos pour les 9 rubriques produits et les installe
 * dans public/media/produits/. A lancer depuis VOTRE machine (le conteneur de
 * developpement distant n'a pas acces aux hebergeurs d'images).
 *
 *   1) Automatique via Pexels (recommande, cle gratuite en 2 minutes sur
 *      https://www.pexels.com/api/ — licence gratuite, usage commercial autorise)
 *
 *        node scripts/photos.js --pexels VOTRE_CLE
 *        PEXELS_KEY=VOTRE_CLE node scripts/photos.js
 *
 *   2) Manuel, a partir d'une liste d'URL que vous avez choisies vous-meme :
 *
 *        node scripts/photos.js --liens mes-photos.txt
 *
 *      Une ligne par rubrique, au format  type=url  :
 *        fleur=https://exemple.fr/fleur.jpg
 *        huile=https://exemple.fr/huile.jpg
 *
 *   3) Depuis un dossier de votre disque (fichiers nommes fleur.jpg, huile.jpg...) :
 *
 *        node scripts/photos.js --dossier ~/mes-photos
 *
 *   Options : --force  remplace les photos deja presentes
 *             --type fleur,huile   limite a certaines rubriques
 *
 * Apres coup : relancer le serveur, puis `node build-demo.js` pour que la
 * version un-fichier embarque les nouvelles photos.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const DEST = path.join(__dirname, '..', 'public', 'media', 'produits');
const MIN_OCTETS = 8 * 1024;
const EXT_PAR_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' };

// Plusieurs requetes par rubrique : on prend la premiere qui donne un resultat.
const REQUETES = {
  fleur: ['hemp flower macro', 'cannabis bud close up', 'dried hemp buds'],
  resine: ['hemp resin block', 'brown resin texture', 'crumbled brown resin'],
  huile: ['cbd oil dropper bottle', 'essential oil dropper bottle', 'amber glass dropper'],
  eliquide: ['vape liquid bottle', 'e liquid bottle', 'vaping device bottle'],
  pommade: ['cosmetic cream jar', 'balm jar white', 'body cream jar'],
  infusion: ['herbal tea cup dried herbs', 'herbal infusion cup', 'loose leaf tea cup'],
  comestible: ['gummy candies bowl', 'colorful gummies', 'candy sweets close up'],
  cristaux: ['white crystal powder', 'crystalline powder macro', 'salt crystals macro'],
  cosmetique: ['cosmetic serum bottle', 'skincare bottle neutral', 'beauty serum flatlay']
};

const args = process.argv.slice(2);
const opt = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : null; };
const flag = (nom) => args.includes(nom);

const CLE = opt('--pexels') || process.env.PEXELS_KEY || '';
const FICHIER_LIENS = opt('--liens');
const DOSSIER = opt('--dossier');
const FORCE = flag('--force');
const FILTRE = (opt('--type') || '').split(',').map((s) => s.trim()).filter(Boolean);

function get(url, entetes) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: Object.assign({ 'User-Agent': 'CBD-Atlas/1.0' }, entetes || {}) }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(get(res.headers.location, entetes));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode + ' sur ' + url));
      }
      const morceaux = [];
      res.on('data', (c) => morceaux.push(c));
      res.on('end', () => resolve({ corps: Buffer.concat(morceaux), type: res.headers['content-type'] || '' }));
    });
    req.on('error', reject);
    req.setTimeout(25000, () => req.destroy(new Error('Delai depasse sur ' + url)));
  });
}

async function chercherPexels(requete) {
  const url = 'https://api.pexels.com/v1/search?per_page=3&orientation=square&query=' + encodeURIComponent(requete);
  const { corps } = await get(url, { Authorization: CLE });
  const data = JSON.parse(corps.toString('utf8'));
  const p = (data.photos || [])[0];
  if (!p) return null;
  return { url: p.src.large || p.src.medium, auteur: p.photographer, page: p.url };
}

async function enregistrer(type, url) {
  const { corps, type: mime } = await get(url);
  const ext = EXT_PAR_MIME[mime.split(';')[0].trim()];
  if (!ext) throw new Error('Type de fichier inattendu (' + mime + ')');
  if (corps.length < MIN_OCTETS) throw new Error('Image trop petite (' + corps.length + ' octets)');
  fs.mkdirSync(DEST, { recursive: true });
  for (const e of Object.values(EXT_PAR_MIME)) {
    const ancien = path.join(DEST, type + e);
    if (fs.existsSync(ancien)) fs.unlinkSync(ancien);
  }
  const cible = path.join(DEST, type + ext);
  fs.writeFileSync(cible, corps);
  return { cible, ko: Math.round(corps.length / 1024) };
}

function dejaPresente(type) {
  return Object.values(EXT_PAR_MIME).some((e) => fs.existsSync(path.join(DEST, type + e)));
}

function lireLiens(fichier) {
  const liens = {};
  for (const ligne of fs.readFileSync(fichier, 'utf8').split('\n')) {
    const t = ligne.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) liens[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return liens;
}

async function main() {
  const types = Object.keys(REQUETES).filter((t) => !FILTRE.length || FILTRE.includes(t));
  const liens = FICHIER_LIENS ? lireLiens(FICHIER_LIENS) : null;

  // Copie depuis un dossier local : les fichiers doivent porter le nom de la rubrique.
  if (DOSSIER) {
    fs.mkdirSync(DEST, { recursive: true });
    let n = 0;
    for (const f of fs.readdirSync(DOSSIER)) {
      const ext = path.extname(f).toLowerCase();
      const type = path.basename(f, ext).toLowerCase();
      if (!Object.values(EXT_PAR_MIME).includes(ext) || !REQUETES[type]) continue;
      if (FILTRE.length && !FILTRE.includes(type)) continue;
      if (dejaPresente(type) && !FORCE) { console.log('· ' + type.padEnd(11) + 'deja presente, ignoree'); continue; }
      fs.copyFileSync(path.join(DOSSIER, f), path.join(DEST, type + ext));
      console.log('✓ ' + type.padEnd(11) + 'copiee depuis ' + f);
      n++;
    }
    console.log('\n' + n + ' photo(s) copiee(s). Etape suivante : relancer le serveur, puis `node build-demo.js`.');
    return;
  }

  if (!liens && !CLE) {
    console.error('Aucune source indiquee.\n' +
      '  Cle Pexels : node scripts/photos.js --pexels VOTRE_CLE\n' +
      '  Liste d\'URL : node scripts/photos.js --liens mes-photos.txt\n' +
      'Cle gratuite sur https://www.pexels.com/api/');
    process.exit(1);
  }

  const credits = [];
  let ok = 0, ignores = 0, echecs = 0;

  for (const type of types) {
    if (dejaPresente(type) && !FORCE) {
      console.log('· ' + type.padEnd(11) + 'deja presente, ignoree (--force pour remplacer)');
      ignores++;
      continue;
    }
    try {
      let source = null;
      if (liens) {
        if (!liens[type]) { console.log('· ' + type.padEnd(11) + 'absente du fichier de liens'); ignores++; continue; }
        source = { url: liens[type] };
      } else {
        for (const r of REQUETES[type]) {
          source = await chercherPexels(r);
          if (source) break;
        }
        if (!source) throw new Error('aucun resultat Pexels');
      }
      const { ko } = await enregistrer(type, source.url);
      console.log('✓ ' + type.padEnd(11) + ko + ' Ko' + (source.auteur ? '  photo : ' + source.auteur : ''));
      if (source.auteur) credits.push(type + ' — ' + source.auteur + ' (Pexels) ' + source.page);
      ok++;
    } catch (e) {
      console.log('✗ ' + type.padEnd(11) + e.message);
      echecs++;
    }
  }

  if (credits.length) {
    fs.writeFileSync(path.join(DEST, 'CREDITS.txt'),
      'Photos utilisees pour les rubriques produits.\n' +
      'Licence Pexels : gratuite, usage commercial autorise, attribution non obligatoire.\n' +
      'Credits conserves par correction.\n\n' + credits.join('\n') + '\n');
  }

  console.log('\n' + ok + ' photo(s) installee(s), ' + ignores + ' ignoree(s), ' + echecs + ' echec(s).');
  if (ok) console.log('Etape suivante : relancer le serveur, puis `node build-demo.js`.');
}

main().catch((e) => { console.error('Erreur : ' + e.message); process.exit(1); });

'use strict';
/**
 * Visuels produits.
 *
 * Priorite : 1. photo envoyee par le distributeur pour CE produit
 *            2. photo de rubrique deposee dans public/media/produits/<type>.(jpg|webp|png)
 *            3. rendu studio genere (SVG), utilise tant qu'aucune photo n'existe
 *
 * Deposer un fichier dans public/media/produits/ suffit : aucun code a modifier,
 * le catalogue bascule sur la photo au redemarrage.
 */
const fs = require('fs');
const path = require('path');

const MEDIA_DIR = path.join(__dirname, '..', 'public', 'media', 'produits');
const EXTENSIONS = ['.jpg', '.jpeg', '.webp', '.png', '.avif'];

// Scanne le dossier au demarrage : { fleur: '/media/produits/fleur.jpg', ... }
function photosDeRubrique() {
  const trouve = {};
  let fichiers = [];
  try { fichiers = fs.readdirSync(MEDIA_DIR); } catch (e) { return trouve; }
  for (const f of fichiers) {
    const ext = path.extname(f).toLowerCase();
    if (!EXTENSIONS.includes(ext)) continue;
    const type = path.basename(f, ext).toLowerCase();
    if (!trouve[type]) trouve[type] = '/media/produits/' + f;
  }
  return trouve;
}

let RUBRIQUES = photosDeRubrique();
const rafraichir = () => { RUBRIQUES = photosDeRubrique(); return RUBRIQUES; };

/** Visuel a afficher pour un produit. */
function visuelProduit(p) {
  if (Array.isArray(p.photos) && p.photos.length) return p.photos[0];
  if (RUBRIQUES[p.type]) return RUBRIQUES[p.type];
  return '/img/produit/' + p.type + '.svg';
}

const estPhoto = (p) => Boolean((Array.isArray(p.photos) && p.photos.length) || RUBRIQUES[p.type]);

/**
 * Valide une photo envoyee par un distributeur.
 * Accepte un chemin interne (/media/...) ou une URL https, jamais de data: ni de script.
 */
function validerPhoto(u) {
  const s = String(u || '').trim();
  if (!s) return null;
  if (s.startsWith('/media/') && !s.includes('..')) return s;
  if (/^https:\/\/[\w.-]+\/[\w\-./%]+\.(jpe?g|png|webp|avif)$/i.test(s)) return s;
  return null;
}

// ----------------------------------------------------------------- rendu studio

const PALETTE = {
  fleur: ['#1c3d29', '#2f7d4f', '#a8d8b9'], resine: ['#31200f', '#6b4423', '#c99a63'],
  huile: ['#3a2e0c', '#9a7a20', '#f2d675'], eliquide: ['#0f2d42', '#1f5f8a', '#8fd0f2'],
  pommade: ['#3a2233', '#7a4a6b', '#e2b7d6'], infusion: ['#22381a', '#4a7a3c', '#c6e2a4'],
  comestible: ['#4a1520', '#a33b4e', '#f2a3b1'], cristaux: ['#1b2a3d', '#3d5a80', '#dbe9f4'],
  cosmetique: ['#3d2711', '#8a5a2b', '#f0cfa8']
};

// Sujet dessine au centre, pose sur une ombre portee douce.
const SUJET = {
  fleur: `<ellipse cx="200" cy="330" rx="86" ry="18" fill="rgba(0,0,0,.30)"/>
    <g><path d="M200 118c34 26 52 62 52 100 0 44-24 76-52 96-28-20-52-52-52-96 0-38 18-74 52-100z" fill="url(#chair)"/>
    <path d="M200 130c22 22 34 54 34 86 0 36-16 62-34 78-18-16-34-42-34-78 0-32 12-64 34-86z" fill="rgba(255,255,255,.16)"/>
    <path d="M200 140v170" stroke="rgba(0,0,0,.28)" stroke-width="5" stroke-linecap="round"/>
    <path d="M200 190c-22-16-42-18-56-12M200 232c-24-14-46-14-60-6M200 190c22-16 42-18 56-12M200 232c24-14 46-14 60-6"
      stroke="rgba(255,255,255,.22)" stroke-width="5" fill="none" stroke-linecap="round"/></g>`,
  resine: `<ellipse cx="200" cy="308" rx="96" ry="18" fill="rgba(0,0,0,.30)"/>
    <path d="M122 240l24-88 62-34 74 26 16 92-88 42z" fill="url(#chair)"/>
    <path d="M146 152l62-34 74 26-72 40z" fill="rgba(255,255,255,.24)"/>
    <path d="M210 184l88-6-16 92-88 42z" fill="rgba(0,0,0,.16)"/>
    <path d="M158 210l30-8 22 18M236 216l28-10" stroke="rgba(255,255,255,.20)" stroke-width="6"
      fill="none" stroke-linecap="round"/>`,
  huile: `<ellipse cx="200" cy="338" rx="70" ry="16" fill="rgba(0,0,0,.30)"/>
    <rect x="176" y="70" width="48" height="44" rx="9" fill="rgba(255,255,255,.30)"/>
    <path d="M162 112h76v186a26 26 0 01-26 26h-24a26 26 0 01-26-26z" fill="url(#chair)"/>
    <rect x="176" y="168" width="48" height="104" rx="8" fill="rgba(255,255,255,.14)"/>
    <path d="M176 128c0 60 0 120 0 170" stroke="rgba(255,255,255,.35)" stroke-width="6" stroke-linecap="round"/>`,
  eliquide: `<ellipse cx="200" cy="338" rx="58" ry="15" fill="rgba(0,0,0,.30)"/>
    <rect x="170" y="86" width="60" height="212" rx="26" fill="url(#chair)"/>
    <rect x="184" y="112" width="16" height="150" rx="8" fill="rgba(255,255,255,.30)"/>
    <rect x="182" y="292" width="36" height="42" rx="12" fill="rgba(255,255,255,.22)"/>
    <rect x="180" y="62" width="40" height="30" rx="12" fill="rgba(255,255,255,.18)"/>`,
  pommade: `<ellipse cx="200" cy="326" rx="88" ry="17" fill="rgba(0,0,0,.30)"/>
    <rect x="120" y="168" width="160" height="140" rx="22" fill="url(#chair)"/>
    <rect x="136" y="130" width="128" height="44" rx="16" fill="rgba(255,255,255,.24)"/>
    <ellipse cx="200" cy="176" rx="64" ry="15" fill="rgba(255,255,255,.30)"/>
    <rect x="146" y="212" width="108" height="10" rx="5" fill="rgba(255,255,255,.20)"/>`,
  infusion: `<ellipse cx="196" cy="330" rx="84" ry="17" fill="rgba(0,0,0,.30)"/>
    <path d="M112 158h168v74a84 84 0 01-168 0z" fill="url(#chair)"/>
    <path d="M280 178h26a40 40 0 010 80h-26" fill="none" stroke="url(#chair)" stroke-width="20" stroke-linecap="round"/>
    <ellipse cx="196" cy="158" rx="84" ry="20" fill="rgba(255,255,255,.26)"/>
    <path d="M170 96c14-16 4-30-2-40M212 96c14-16 4-30-2-40" stroke="rgba(255,255,255,.30)" stroke-width="7" fill="none" stroke-linecap="round"/>`,
  comestible: `<ellipse cx="200" cy="326" rx="92" ry="18" fill="rgba(0,0,0,.30)"/>
    <circle cx="158" cy="216" r="54" fill="url(#chair)"/>
    <circle cx="240" cy="252" r="42" fill="url(#chair)" opacity=".88"/>
    <circle cx="232" cy="164" r="34" fill="url(#chair)" opacity=".76"/>
    <circle cx="142" cy="198" r="16" fill="rgba(255,255,255,.30)"/>
    <circle cx="228" cy="240" r="11" fill="rgba(255,255,255,.24)"/>`,
  cristaux: `<ellipse cx="200" cy="330" rx="86" ry="17" fill="rgba(0,0,0,.30)"/>
    <path d="M200 96l68 66-68 66-68-66z" fill="url(#chair)"/>
    <path d="M200 96l68 66-68 22-68-22z" fill="rgba(255,255,255,.26)"/>
    <path d="M200 238l46 46-46 46-46-46z" fill="url(#chair)" opacity=".85"/>
    <path d="M200 238l46 46-46 14-46-14z" fill="rgba(255,255,255,.22)"/>`,
  cosmetique: `<ellipse cx="200" cy="334" rx="66" ry="16" fill="rgba(0,0,0,.30)"/>
    <rect x="156" y="122" width="88" height="196" rx="20" fill="url(#chair)"/>
    <rect x="178" y="76" width="44" height="50" rx="12" fill="rgba(255,255,255,.24)"/>
    <rect x="172" y="176" width="56" height="88" rx="10" fill="rgba(255,255,255,.16)"/>
    <path d="M176 146c0 60 0 120 0 156" stroke="rgba(255,255,255,.32)" stroke-width="5" stroke-linecap="round"/>`
};

/** Rendu studio : fond degrade, lumiere rasante, grain, sujet pose sur son ombre. */
function svgProduit(type) {
  const [sombre, moyen, clair] = PALETTE[type] || PALETTE.fleur;
  const sujet = SUJET[type] || SUJET.fleur;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img" aria-label="Visuel ${type}">
<defs>
  <linearGradient id="fond" x1="0" y1="0" x2=".4" y2="1">
    <stop offset="0" stop-color="${moyen}"/><stop offset="1" stop-color="${sombre}"/></linearGradient>
  <radialGradient id="lumiere" cx=".32" cy=".22" r=".8">
    <stop offset="0" stop-color="${clair}" stop-opacity=".55"/>
    <stop offset="1" stop-color="${clair}" stop-opacity="0"/></radialGradient>
  <linearGradient id="chair" x1=".2" y1="0" x2=".9" y2="1">
    <stop offset="0" stop-color="${clair}"/><stop offset="1" stop-color="${moyen}"/></linearGradient>
  <radialGradient id="vignette" cx=".5" cy=".5" r=".78">
    <stop offset=".55" stop-color="#000" stop-opacity="0"/>
    <stop offset="1" stop-color="#000" stop-opacity=".38"/></radialGradient>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="7"/>
    <feColorMatrix type="saturate" values="0"/></filter>
  <filter id="flou"><feGaussianBlur stdDeviation="14"/></filter>
</defs>
<rect width="400" height="400" fill="url(#fond)"/>
<rect width="400" height="400" fill="url(#lumiere)"/>
<ellipse cx="200" cy="352" rx="150" ry="46" fill="${sombre}" opacity=".45" filter="url(#flou)"/>
${sujet}
<rect width="400" height="400" fill="url(#vignette)"/>
<rect width="400" height="400" filter="url(#grain)" opacity=".07"/>
</svg>`;
}

module.exports = { svgProduit, visuelProduit, estPhoto, validerPhoto, photosDeRubrique, rafraichir, MEDIA_DIR };

'use strict';

const assert = require('assert');
const fs = require('fs');

const home = fs.readFileSync('public/index.html', 'utf8');
const app = fs.readFileSync('public/app.html', 'utf8');
const live = fs.readFileSync('public/live-ia.html', 'utf8');

for (const [name, source] of [['site', home], ['application', app], ['Live IA', live]]) {
  assert.match(source, /consensus-insufficient/, `${name}: état rouge insuffisant absent`);
  assert.match(source, /consensus-valid/, `${name}: état bleu-vert valide absent`);
  assert.match(source, /prefers-reduced-motion/, `${name}: le clignotement doit respecter la réduction des animations`);
}

assert.match(home, /consensusCount\s*>=\s*4/, 'site: le seuil visuel valide doit rester 4 IA sur 5');
assert.match(app, /consensusCount\s*>=\s*4/, 'application: le seuil visuel valide doit rester 4 IA sur 5');

console.log('PASS consensus insuffisant rouge, consensus valide bleu-vert, mouvement réduit respecté');

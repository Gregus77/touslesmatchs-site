'use strict';
const fs=require('fs');
const path=require('path');
const assert=require('assert/strict');

const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const rules=read('CURRENT_RULES.md');
const agents=read('AGENTS.md');
const home=read('public/index.html');
const app=read('public/app.html');
const live=read('public/live-ia.html');
const perf=read('public/performances.html');
const faq=read('public/faq.html');
const cgv=read('public/cgv.html');
const i18n=read('public/js/i18n.js');

assert.match(rules,/\+0,5 but équipe favorite/);
assert.match(rules,/30 et 85/);
assert.match(rules,/4 IA sur 5/);
assert.match(rules,/O\/U 2,5 n'est plus la stratégie principale/);

assert.match(agents,/stratégie client actuelle est \*\*\+0,5 but de l’équipe favorite\*\*/);
assert.match(agents,/O\/U 2,5 est un ancien système/);
assert.match(agents,/ne doivent plus être présentés comme la stratégie actuelle/);

assert.match(home,/Votre signal<br>\+0,5 but équipe favorite/);
assert.match(home,/4 IA \/ 5 minimum/);
assert.match(home,/tlm-goal05-current-box/);
assert.match(home,/L’ancien O\/U 2,5 reste conservé uniquement dans l’historique/);
assert.doesNotMatch(home,/Votre signal<br>Over ou Under 2,5/);

assert.match(app,/Votre signal \+0,5 but équipe favorite/);
assert.match(app,/<script id="tlm-goal05-live-pro-js">/);
assert.doesNotMatch(app,/tlm-goal05-live-pro-js" type="application\/x-disabled"/);
assert.doesNotMatch(app,/Ancien produit \+0,5 abandonné/);
assert.match(app,/var rows=\(\(all\[0\]\.analyses\)\|\|\[\]\)\.slice\(\)/);
assert.doesNotMatch(app,/var rows=\(\(all\[0\]\.analyses\)\|\|\[\]\)\.filter\(is05\)/);
assert.match(app,/Historique total/);
assert.match(app,/Ancien O\/U 2,5/);
assert.match(app,/Actuel \+0,5/);
assert.match(app,/min>=30&&min<=85/);

assert.match(live,/Stratégie actuelle/);
assert.match(live,/\+0,5 but de l’équipe favorite/);
assert.match(live,/Historique · O\/U 2,5 \(ancien système\)/);
assert.doesNotMatch(live,/TLM_DISPLAY_OU25_ONLY_V1/);

assert.match(perf,/La stratégie actuelle est \+0,5 but de l’équipe favorite/);
assert.match(perf,/productHistoryBadge/);
assert.match(perf,/Historique · O\/U 2,5/);
assert.match(perf,/Actuel · \+0,5 but/);

assert.match(faq,/stratégie actuelle \+0,5 but/i);
assert.match(faq,/4 IA sur 5/);
assert.match(faq,/30e à la 85e minute/);
assert.match(cgv,/signaux football \+0,5 but équipe/);
assert.match(cgv,/ancien historique O\/U 2,5 reste consultable/);

assert.match(i18n,/\+0,5 but · minimum 4 IA sur 5/);
assert.match(i18n,/legacy O\/U 2\.5 preserved/);

for(const file of ['public/index.html','public/app.html','public/live-ia.html','public/performances.html','public/faq.html']){
  const html=read(file);
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    if(/src=|application\/ld\+json|x-disabled/i.test(match[1])) continue;
    new Function(match[2]);
  }
}

console.log('CURRENT_PRODUCT_GOAL05_AND_HISTORY_OK');

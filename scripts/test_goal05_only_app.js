const fs = require('fs');
const app = fs.readFileSync('public/app.html', 'utf8');
const android = fs.readFileSync('mobile/android/app/src/main/java/com/touslesmatchs/app/MainActivity.java', 'utf8');
function assert(c,m){ if(!c){ console.error('goal05_only_app: FAIL'); console.error(m); process.exit(1); } }
for (const txt of [
  'L’équipe forte doit marquer',
  'Football IA',
  'goal05-palmeiras-card-20260814b',
  'goal05-verdict-card',
  'SIGNAL EN ATTENTE',
  '@—',
  'Aucun match validé +0,5',
  'Bilan +0,5 en cours',
  '/api/analysis-history?limit=160',
  'Résultats +0,5',
  'Surveillance live',
  'body.tlm-page-app .tlm-floating-widgets',
  'reg.unregister()',
  'caches.delete(key)'
]) assert(app.includes(txt), 'Texte/comportement +0,5 manquant: '+txt);
for (const forbidden of ['Aucun autre pari','Aucun signal +0,5 validé maintenant','Standard','Premium','Elite-VIP','Télécharger l\'APK Android','/current-pick','/#plans','Voir les offres','Voir les abonnements','widgets.js','tlm-wow-theme.js','serviceWorker.register']) {
  assert(!app.includes(forbidden), 'Texte/comportement interdit dans l’app: '+forbidden);
}
assert(android.includes('app=goal05'), 'APK ne charge pas le mode goal05');
assert(android.includes('20260814_goal05_palmeiras_ui'), 'APK sans version anti-cache');
assert(android.includes('LOAD_NO_CACHE'), 'WebView cache non désactivé');
assert(android.includes('clearCache(true)'), 'WebView ne vide pas le cache');
console.log('goal05_only_app: OK');
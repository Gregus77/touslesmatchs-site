const fs = require('fs');
const app = fs.readFileSync('public/app.html', 'utf8');
const android = fs.readFileSync('mobile/android/app/src/main/java/com/touslesmatchs/app/MainActivity.java', 'utf8');
function assert(c,m){ if(!c){ console.error('goal05_only_app: FAIL'); console.error(m); process.exit(1); } }
for (const txt of [
  'L’équipe forte doit marquer',
  'Aucun signal +0,5 validé maintenant',
  'Aucun autre pari',
  'Résultats +0,5',
  'Surveillance live'
]) assert(app.includes(txt), 'Texte +0,5 manquant: '+txt);
for (const forbidden of ['Standard','Premium','Elite-VIP','Télécharger l\'APK Android','/current-pick','/#plans','Voir les offres','Voir les abonnements']) {
  assert(!app.includes(forbidden), 'Texte/comportement interdit dans l’app: '+forbidden);
}
assert(android.includes('app=goal05'), 'APK ne charge pas le mode goal05');
assert(android.includes('20260813_goal05_only'), 'APK sans version anti-cache');
assert(android.includes('LOAD_NO_CACHE'), 'WebView cache non désactivé');
assert(android.includes('clearCache(true)'), 'WebView ne vide pas le cache');
console.log('goal05_only_app: OK');

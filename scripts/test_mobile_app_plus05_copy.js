const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('public/app.html', 'utf8');
const forbidden = [/football, basket/i, /basket, hockey/i, /baseball/i, /plus de sports/i, /multisport/i, /current-pick/i, /Télécharger l'APK Android/i];

assert(app.includes('Goal +0,5'), 'bloc Goal +0,5 manquant');
assert(app.includes('L’équipe forte doit marquer'), 'promesse +0,5 manquante');
assert(app.includes('+0,5 but — bêta privée'), 'offre beta +0,5 manquante');
assert(app.includes('Aucun autre pari'), 'cadre pari unique +0,5 manquant');
assert(app.includes('Aucun signal +0,5 validé maintenant'), 'etat sans signal +0,5 manquant');
for (const re of forbidden) assert(!re.test(app), 'texte ou comportement interdit dans app.html: ' + re);

const android = fs.readFileSync('mobile/android/app/src/main/java/com/touslesmatchs/app/MainActivity.java', 'utf8');
assert(android.includes('https://www.touslesmatchs.com/app.html?source=android'), 'APK ne pointe pas vers app.html');

console.log('mobile_app_plus05_copy: OK');

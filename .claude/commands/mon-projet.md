# /mon-projet — Tableau de bord TousLesMatchs

Affiche immédiatement le tableau de bord du projet sans poser de questions.

## Identité du projet
**TousLesMatchs** — Site de picks sportifs IA (Concile de 5 IA).
- Stack : HTML/CSS/JS vanilla · Caddy · Docker · Python · SQLite
- VPS branch : `claude/busy-bardeen-793p0k` (JAMAIS changer)
- URL : https://touslesmatchs.com

## État des fonctionnalités

### ✅ Terminé
- [x] Design dark indigo/violet homepage complète
- [x] Système auth email + code (codes.db SQLite)
- [x] Se souvenir de moi (localStorage pré-remplissage modal)
- [x] Code oublié → email Brevo automatique
- [x] FAQ accordéon (8 Q&A)
- [x] Bouton Telegram flottant (toutes les pages)
- [x] Section Telegram footer homepage
- [x] Popup email après 25s → inscription Brevo
- [x] Endpoint /subscribe-email (Brevo contacts)
- [x] Endpoint /forgot-code (Brevo transactionnel)
- [x] Email pick quotidien via Brevo (council/tools/brevo.py)
- [x] Health check Hermes (council/health_check.py)
- [x] Boutons bookmakers avec liens affiliation (Winamax, Betclic, Unibet, PMU)
- [x] Live IA : fix match terminé (Germany/CIV) qui restait affiché en 0-0
- [x] Live IA : carte countdown prochain match à venir

### 🔄 En cours / Partiel
- [ ] Live IA : score persistence localStorage/sessionStorage entre rechargements
- [ ] Concordance picks/gains rendue plus vendeuse sur homepage

### ❌ Pas encore fait (liste originale 13 tâches)
- [ ] #2 : Upcoming matches countdown sur Live IA (timezone visiteur) — FAIT partiellement
- [ ] #4 : Statistiques source unique vérité (même chiffres sur toutes les pages)
- [ ] #11 : Historique amélioré (écussons équipes, statuts ✅/❌/⏳)
- [ ] #12 : Page Preuves qualité (chargement rapide, responsive, screenshots API)

## Règles absolues à rappeler avant chaque session
1. **VPS = `claude/busy-bardeen-793p0k` UNIQUEMENT** — ne jamais changer
2. Modifications chirurgicales — ne changer QUE ce qui est demandé
3. Commit après chaque tâche fonctionnelle
4. Toujours `git pull` sur VPS avant `docker compose up -d --build site`
5. Jamais `docker compose up -d --build` sans spécifier `site` ou `api`
6. Utiliser `/verifier` avant de donner une commande de déploiement

## Commande déploiement rapide
```bash
# Sur VPS :
cd /opt/touslesmatchs && git pull origin claude/busy-bardeen-793p0k && docker compose up -d --build site
# Si api_server.js modifié aussi :
cd /opt/touslesmatchs && git pull origin claude/busy-bardeen-793p0k && docker compose up -d --build site api
```

## Variables d'environnement importantes
- `BREVO_API_KEY` — dans /opt/touslesmatchs/.env ✅ (ajouté)
- `GROQ_API_KEY` — Hermes IA principale
- `STRIPE_*` — paiements (pas encore configurés en prod)
- `JWT_SECRET` — auth tokens

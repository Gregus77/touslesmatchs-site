# /chef — Chef de Projet TousLesMatchs

## État du projet
Site de picks sportifs IA. Stack : HTML/CSS/JS vanilla, Caddy, Docker, Python (Conseil Hermes 5 IA), SQLite.

## RÈGLE ABSOLUE N°1 — Branches
- **VPS = `claude/busy-bardeen-793p0k` UNIQUEMENT**
- `claude/happy-bell-h9zj83` = INTERDIT sur VPS (ancienne version noir/or)
- Développement local/tests = `claude/happy-bell-h9zj83` uniquement
- Ne JAMAIS `git checkout` une autre branche sur le VPS

## RÈGLE ABSOLUE N°2 — Modifications chirurgicales
- Ne modifier QUE ce qui est demandé
- Faire une sauvegarde (commit) après chaque tâche qui fonctionne
- Ne pas refactorer, nettoyer ou "améliorer" ce qui n'est pas cassé

## Architecture fichiers critiques
- `public/index.html` — page principale (1500+ lignes, tout en un fichier)
- `public/live-ia.html` — page Live IA avec auth gate
- `public/js/i18n.js` — système i18n, chargé APRÈS les scripts inline
- `docker-compose.yml` — 4 services : site, api, bot, hermes-admin
- `council/hermes.py` — Conseil Hermes (orchestrateur 5 IA)
- `council/tools/telegram_bot.py` — publication Telegram

## Comptes admin SQLite
- `codes.db` sur VPS : `/var/touslesmatchs/codes.db`
- ELITE-ADMIN4 : aregnt.conscient@proton.me
- Admin principal : gregoryguyot.gg@gmail.com

## Variables d'environnement manquantes (à configurer)
- `TELEGRAM_FREE_CHANNEL_ID` — canal Telegram gratuit
- `TELEGRAM_PREMIUM_CHANNEL_ID` — canal Telegram premium
- Note : hermes-admin utilise `HERMES_ADMIN_TLM_BOT` (pas `TELEGRAM_BOT_TOKEN`)

## Design système
- Couleurs : `--indigo` → `--violet` (gradient principal)
- Classe `.prim` = bouton gradient indigo→violet
- Classe `.nav-cta` = CTA nav gradient
- Classe `.nav-login` = bouton connexion (toujours visible, même mobile)
- `#plan-carte` = ancre carte À la carte (1€)
- `#plans` = ancre section abonnements

## PICKS_FEED — données réelles
```js
const PICKS_FEED = [
  { id:"maroc-ecosse", date:"2026-06-19", home:"Maroc", away:"Écosse", cote:1.78, status:"finished", result:"win", score:"1-0" },
  { id:"turquie-paraguay", date:"2026-06-20", home:"Turquie", away:"Paraguay", cote:1.52, status:"upcoming", result:null },
];
```
Ajouter chaque nouveau pick ici. KPI et graphique ROI sont calculés dynamiquement depuis ces données.

## Commande déploiement VPS
```bash
git push -u origin claude/busy-bardeen-793p0k
# Sur VPS :
cd /var/touslesmatchs && git pull origin claude/busy-bardeen-793p0k && docker compose up -d --build site
```

## Erreurs à ne jamais répéter
1. Switcher la branche VPS → ancienne version noir/or s'affiche
2. Cacher `.nav-login` en CSS mobile → bouton connexion disparaît
3. Appeler `buildChart()` en synchrone → canvas sans dimensions, chart vide
4. Modifier `docker-compose.yml` sans vérifier les env vars existants
5. Utiliser `git add -A` → risque d'inclure `.env` ou binaires

## Protocole avant chaque action
1. Confirmer la branche : `git branch --show-current`
2. Vérifier ce qui va changer (lire le fichier si nécessaire)
3. Faire la modification minimale
4. Tester / vérifier
5. Commit immédiat si ça fonctionne

# Automatisation VPS Goal +0,5

Objectif : le moteur Goal +0,5 doit tourner sur le VPS, même si le PC maison est éteint.

## Rôle des machines

- VPS Hostinger : production autonome, scans API-Football, filtres Goal +0,5, envois Telegram, logs et rapports.
- GitHub : source de vérité du code.
- PC maison : copie de travail et sauvegarde secondaire, jamais nécessaire pour envoyer un signal.

## Réglages par défaut

- `GOAL05_SEND_TELEGRAM=1` : envoi client uniquement si tous les critères sont validés.
- `GOAL05_SEND_ADMIN_WATCHLIST=1` : envoi admin des refus intéressants.
- `GOAL05_SCAN_DAYS_AHEAD=3` : aujourd'hui + trois jours à venir.
- `GOAL05_ODDS_PAGES=3` : plus de couverture API pour Goal +0,5.
- `GOAL05_MAX_DEEP_CANDIDATES=6` : approfondissement limité aux candidats déjà préfiltrés.
- `GOAL05_MAX_EVENT_CALLS=2` : contrôle des passes décisives sans exploser les requêtes.
- `GOAL05_API_DELAY_MS=2500` et `GOAL05_RATE_LIMIT_WAIT_MS=70000` : respect du fournisseur API.

## Philosophie produit

Le +0,5 équipe est prioritaire pour l'acquisition client : simple à comprendre, facile à suivre, mais très exigeant à valider. Les marchés classiques peuvent rester plus économes en API tant que la pépite commerciale est le Goal +0,5.

## Cron conseillé

Pendant la bêta : toutes les deux heures de 8h à 23h, heure serveur.

```cron
12 8-23/2 * * * cd /opt/touslesmatchs && bash scripts/run_goal05_vps.sh >> logs/goal05-cron.log 2>&1
```

Chaque exécution écrit aussi les rapports JSON dans `docs/goal-05/analyses/`.

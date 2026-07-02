# CLAUDE.md — TousLesMatchs

## Architecture

- **Stack** : Docker Compose (4 services)
  - `site` : Caddy, sert `/public` depuis `/srv`
  - `api` : Node.js (port 3001), fichier principal `scripts/api_server.js`
  - `council` : Python, Concile Hermes (4 agents + Chief)
  - `hermes-admin` : Python, bot admin Telegram
- **VPS** : Hostinger KVM 2, Ubuntu 24.04, `/opt/touslesmatchs`
- **Branche de dev** : toujours pusher sur la branche assignee, jamais sur main directement

## Regles metier

### Tunnel de vente (ne jamais complexifier)
TikTok -> TousLesMatchs.com -> Telegram Gratuit -> Analyse a 1 euro -> Pro (9.90/mois) -> Elite (19.90/mois)

### ANJ (Autorite Nationale des Jeux)
- JAMAIS utiliser le mot "pari" dans les contenus publics (site, emails, Telegram)
- Utiliser : "analyse IA", "pick", "selection", "recommandation"
- Toujours afficher le disclaimer joueurs-info-service.fr
- Ne jamais garantir de gains
- Ne jamais falsifier de statistiques

### Analyses sportives
- **Default** : Moins de 2.5 buts (Under 2.5) comme type d'analyse par defaut
- **Coupe du Monde exclue** de toutes les analyses
- **Ligues fiables uniquement** : systeme whitelist (`TRUSTED_COMPETITIONS`) + blacklist (`LOW_TRUST_COMPETITION_KEYWORDS`)
- **Cotes** : formule `Math.min(1.95, ((1 / (confidence / 100)) * 1.45))`, jamais au-dessus de 1.95
- **Signal Fort** : alerte quand confiance >= 80%

### Anonymat du fondateur
Ne jamais creer de fonctionnalite qui expose le nom, prenom, photo, voix, adresse ou telephone du fondateur. La marque communique, jamais le fondateur.

## Priorites de developpement

Chaque dev doit repondre a AU MOINS un de ces objectifs :
1. Augmenter le chiffre d'affaires
2. Augmenter le taux de conversion
3. Ameliorer la confiance utilisateur
4. Ameliorer l'automatisation
5. Ameliorer la vitesse du site
6. Ameliorer l'experience utilisateur

Si aucun objectif n'est rempli : ne pas developper.

## Ne jamais casser

- Stripe (paiements, webhooks)
- Telegram (bots, canaux gratuit/premium)
- Hermes / Concile IA (analyse des matchs)
- Live IA (analyse en direct)
- Brevo (emails, nurturing)
- Responsive mobile
- SEO

## Design

- Mobile first
- Design premium, sobre, epure
- Pas de sections redondantes sur la page d'accueil
- Les sections masquees (display:none) dans index.html sont volontairement cachees pour epurer la page

## Commandes utiles

```bash
# Deployer
cd /opt/touslesmatchs && git pull origin <branch> && docker compose up -d --build

# Logs
docker logs touslesmatchs-api --tail 100
docker logs touslesmatchs-council --tail 100

# Test API
curl http://localhost:3001/current-pick
curl http://localhost:3001/signal-fort-stats
```

## Fichiers cles

- `scripts/api_server.js` : API Node.js, Concile JS, Stripe, Telegram, Brevo, Signal Fort
- `public/index.html` : page d'accueil unique (SPA-like)
- `public/js/i18n.js` : traductions FR de l'interface
- `council/prompts/agent_prompt.py` : prompt systeme des agents Python
- `council/tools/sports_api.py` : API-Football, ligues autorisees
- `Caddyfile` : config reverse proxy
- `docker-compose.yml` : orchestration des 4 services

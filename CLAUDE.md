# CLAUDE.md — TousLesMatchs

## Handoff urgent Codex - 2026-07-25

Avant toute reprise site/API, lire `docs/handoff/2026-07-25-codex-live-vote-ia.md`.

- Etat valide a preserver : Live IA multisport Football/Basketball/Hockey/Baseball, tennis retire, TheSportsDB en secours, vote public de 5 IA independantes.
- Ne pas reintroduire de "Chief" visible client et ne jamais afficher les agents indisponibles/quota aux clients.
- Claude/Codex peuvent modifier site/API sur demande de Greg. Hermes audite/recommande ; Hermes ne doit pas pousser de modification dans `public/`, `site/`, `scripts/api_server.js`, `scripts/bookmakers.config.js`, `docker-compose.yml` ou `Caddyfile` sans validation explicite de Greg.
- Piege VPS : `site/index.html` est le rendu public servi. Ne jamais ecraser `site/index.html` avec `public/index.html` sans verification navigateur/public.

## Regles automatiques (s'appliquent a CHAQUE session)

### Economie de tokens
- NE PAS relire des fichiers deja connus -- utiliser la reference ci-dessous
- NE PAS explorer le projet pour "comprendre l'architecture" -- tout est documente ici
- Maximum 2 lectures exploratoires par session
- Ecrire en un seul passage, pas de micro-editions
- Paralleliser les taches independantes
- Toujours verifier le travail avant de le declarer termine (checklist verification ci-dessous)

### Verification avant livraison
Avant de declarer un travail termine, verifier :
- Docker : les 4 services sont-ils coherents dans docker-compose.yml ?
- API : les endpoints modifies sont-ils corrects ?
- HTML : le markup est-il valide, responsive, conforme ANJ ?
- Pas de regression : les fonctionnalites existantes sont-elles preservees ?
- Conformite ANJ : aucun mot "pari" dans le contenu public

## Architecture

### Stack : Docker Compose (4 services)
- `site` : Caddy, sert `/public` depuis `/srv`
- `api` : Node.js (port 3001), fichier principal `scripts/api_server.js`
- `council` : Python, Concile Hermes (4 agents IA + Claude Chief)
- `hermes-admin` : Python, bot admin Telegram

### VPS
- Hostinger KVM 2, Ubuntu 24.04, `/opt/touslesmatchs`

### Branche de dev
- Toujours pusher sur la branche assignee, jamais sur main directement

## Fichiers cles (ne pas chercher, lire directement)

| Fichier | Role |
|---------|------|
| `scripts/api_server.js` | API Node.js -- TOUT est la : Concile JS, Stripe, Telegram, Brevo, Signal Fort, Live IA, analytics, auto-concile |
| `public/index.html` | Page d'accueil unique (SPA-like) |
| `public/live-ia.html` | Page Live IA avec onglets En direct / Statistiques |
| `public/js/i18n.js` | Traductions FR de l'interface |
| `council/hermes.py` | Orchestrateur du Concile Python (scheduler 11h59 Paris) |
| `council/agents/` | 4 agents : gpt_agent, gemini_agent, mistral_agent, groq_agent + claude_chief |
| `council/prompts/agent_prompt.py` | Prompt systeme des agents Python |
| `council/tools/sports_api.py` | API-Football, ligues autorisees, multi-sport |
| `council/tools/html_generator.py` | Genere le HTML du pick quotidien |
| `council/tools/history_db.py` | SQLite : picks, premium_picks, agent_votes, concile_analyses |
| `council/tools/telegram_bot.py` | Envoi Telegram (gratuit + premium + admin) |
| `Caddyfile` | Config reverse proxy (routes API, fichiers statiques) |
| `docker-compose.yml` | Orchestration des 4 services |

## Fonctions cles dans api_server.js

| Fonction | Role |
|----------|------|
| `isLowTrustCompetition()` | Filtre les ligues douteuses. Ordre : LOW_TRUST d'abord (return true = bloque), puis TRUSTED (return false = passe), default return true |
| `shouldAutoObserveMatch()` | Decide si un match merite une analyse auto-concile. Verifie : pas fini, sport != Football passe directement, puis filtre low-trust |
| `TRUSTED_COMPETITIONS` | Whitelist des ligues fiables (Ligue 1, Premier League, NBA, NFL, etc.) |
| `LOW_TRUST_COMPETITION_KEYWORDS` | Blacklist par pays/mots-cles (chile, bolivia, ecuador, etc.) |
| `fetchLiveMatches()` | Recupere les matchs en direct depuis API-Sports (multi-sport) |
| `runAutoConcile()` | Lance le concile automatique sur un match observe |
| `buildDailyVisitorReport()` | Rapport visiteurs quotidien (23h Paris) |
| `buildWeeklyMarketingReport()` | Rapport marketing hebdo (lundi 8h) |
| `checkAnalyticsSchedule()` | Scheduler interne (interval 60s) pour rapports |

## Endpoints API importants

| Route | Methode | Role |
|-------|---------|------|
| `/current-pick` | GET | Pick du jour pour le site |
| `/live-matches` | GET | Matchs en direct (filtres low-trust) |
| `/signal-fort-stats` | GET | Stats Signal Fort |
| `/api/analysis-history` | GET | Historique des analyses concile (paginable) |
| `/admin/analytics-report` | GET | Declenchement rapport analytics |
| `/t` | GET | Pixel de tracking visiteurs |
| `/create-checkout-session` | POST | Stripe checkout |
| `/webhook` | POST | Webhook Stripe |

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
- **Ligues fiables uniquement** : whitelist TRUSTED_COMPETITIONS + blacklist LOW_TRUST_COMPETITION_KEYWORDS
- **Ordre de filtrage** : LOW_TRUST verifie en premier (bloque), puis TRUSTED (passe), puis default = bloque
- **Cotes** : formule `Math.min(1.95, ((1 / (confidence / 100)) * 1.45))`, jamais au-dessus de 1.95
- **Signal Fort** : alerte quand confiance >= 80%
- **Multi-sport** : Football, Basketball, Hockey, Baseball, Tennis. Les sports non-Football passent directement le filtre low-trust dans shouldAutoObserveMatch

### Anonymat du fondateur
Ne jamais creer de fonctionnalite qui expose le nom, prenom, photo, voix, adresse ou telephone du fondateur. La marque communique, jamais le fondateur.

### Securite
- Ne JAMAIS afficher, loguer ou partager les cles API / tokens du fichier .env
- Ne JAMAIS inclure de credentials dans les commits

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
- Live IA (analyse en direct + onglet Statistiques)
- Brevo (emails, nurturing)
- Analytics (tracking visiteurs, rapports quotidiens/hebdo)
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
curl http://localhost:3001/live-matches
curl http://localhost:3001/api/analysis-history
```

## IAs du projet

| IA | Role | Ou |
|----|------|----|
| **Claude (toi)** | Developpeur principal, cree et modifie le code du site, de l'API, du conseil | Cette conversation |
| **Hermes (Concile Python)** | Orchestrateur du conseil quotidien a 11h59. Coordonne 4 agents, Claude Chief decide | `council/hermes.py`, `council/scheduler.py` |
| **DeepSeek** | Agent analyste du Concile (remplace GPT) | `council/agents/gpt_agent.py` |
| **Gemini Flash** | Agent analyste du Concile | `council/agents/gemini_agent.py` |
| **Mistral** | Agent analyste du Concile | `council/agents/mistral_agent.py` |
| **Groq/Llama3** | Agent analyste du Concile | `council/agents/groq_agent.py` |
| **Claude Chief** | Chef du Concile, prend la decision finale a partir des rapports des 4 agents | `council/agents/claude_chief.py` |
| **Auto-Concile JS** | Version JS simplifiee qui tourne dans api_server.js pour les analyses Live IA en temps reel | `scripts/api_server.js` (fonction `runAutoConcile`) |

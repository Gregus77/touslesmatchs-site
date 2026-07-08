# CLAUDE.md — TousLesMatchs

## Regles session

- NE PAS relire des fichiers deja references ici
- NE PAS explorer le projet — tout est documente ci-dessous
- Max 2 lectures exploratoires / session
- Ecrire en un seul passage, paralleliser les taches independantes
- Verifier avant livraison : Docker coherent, endpoints corrects, HTML valide+responsive, pas de regression, aucun mot "pari" public

## Architecture

```
Docker Compose — 4 services
┌─────────────────────────────────────────────────┐
│  site (Caddy)          → sert /public depuis /srv│
│  api (Node.js :3001)   → scripts/api_server.js   │
│  council (Python)      → Concile Hermes           │
│  hermes-admin (Python) → bot admin Telegram        │
└─────────────────────────────────────────────────┘

Flux de donnees :
  site ──HTTP──► api ──analyse──► council
                  │                  │
                  ├── Stripe         ├── 4 agents (DeepSeek, Gemini, Mistral, Groq)
                  ├── Telegram       └── Claude Chief (decision finale)
                  ├── Brevo
                  ├── Analytics
                  └── Auto-Concile JS (Live IA temps reel)

Tunnel de vente :
  TikTok → site → Telegram Gratuit → 1€ → Pro 9.90€/m → Elite 19.90€/m
```

VPS : Hostinger KVM 2, Ubuntu 24.04, `/opt/touslesmatchs`

## Fichiers cles

| Fichier | Role |
|---------|------|
| `scripts/api_server.js` | API Node — Concile JS, Stripe, Telegram, Brevo, Signal Fort, Live IA, analytics, auto-concile |
| `public/index.html` | Page d'accueil (SPA-like) |
| `public/live-ia.html` | Live IA (onglets En direct / Statistiques) |
| `public/js/i18n.js` | Traductions FR |
| `council/hermes.py` | Orchestrateur Concile Python (scheduler 11h59 Paris) |
| `council/agents/` | DeepSeek (`gpt_agent`), Gemini (`gemini_agent`), Mistral (`mistral_agent`), Groq (`groq_agent`), `claude_chief` |
| `council/prompts/agent_prompt.py` | Prompt systeme agents |
| `council/tools/sports_api.py` | API-Football, ligues autorisees, multi-sport |
| `council/tools/html_generator.py` | HTML du pick quotidien |
| `council/tools/history_db.py` | SQLite : picks, premium_picks, agent_votes, concile_analyses |
| `council/tools/telegram_bot.py` | Envoi Telegram (gratuit/premium/admin) |
| `Caddyfile` | Reverse proxy |
| `docker-compose.yml` | Orchestration 4 services |

## Fonctions cles (api_server.js)

| Fonction | Role |
|----------|------|
| `isLowTrustCompetition()` | Filtre ligues : LOW_TRUST→bloque, TRUSTED→passe, default→bloque |
| `shouldAutoObserveMatch()` | Auto-concile : pas fini + (non-Football→passe, Football→filtre low-trust) |
| `TRUSTED_COMPETITIONS` | Whitelist (Ligue 1, PL, NBA, NFL…) |
| `LOW_TRUST_COMPETITION_KEYWORDS` | Blacklist (chile, bolivia, ecuador…) |
| `fetchLiveMatches()` | Matchs en direct multi-sport via API-Sports |
| `runAutoConcile()` | Lance concile auto sur match observe |
| `buildDailyVisitorReport()` | Rapport visiteurs 23h Paris |
| `buildWeeklyMarketingReport()` | Rapport marketing lundi 8h |
| `checkAnalyticsSchedule()` | Scheduler interne (60s) |

## Endpoints API

| Route | Methode | Role |
|-------|---------|------|
| `/current-pick` | GET | Pick du jour |
| `/live-matches` | GET | Matchs en direct (filtres) |
| `/signal-fort-stats` | GET | Stats Signal Fort |
| `/api/analysis-history` | GET | Historique analyses (paginable) |
| `/admin/analytics-report` | GET | Declenchement rapport |
| `/t` | GET | Pixel tracking |
| `/create-checkout-session` | POST | Stripe checkout |
| `/webhook` | POST | Webhook Stripe |

## Regles metier

### ANJ (CRITIQUE)
- JAMAIS le mot "pari" en public → utiliser "analyse IA", "pick", "selection", "recommandation"
- Disclaimer joueurs-info-service.fr obligatoire
- Jamais garantir de gains ni falsifier de stats

### Analyses sportives
- Default : Under 2.5 buts
- Coupe du Monde exclue
- Filtrage : LOW_TRUST (bloque) → TRUSTED (passe) → default (bloque)
- Cotes : `Math.min(1.95, ((1 / (confidence / 100)) * 1.45))` — max 1.95
- Signal Fort : confiance >= 80%
- Multi-sport : Football, Basketball, Hockey, Baseball, Tennis — non-Football passe le filtre low-trust

### Securite & anonymat
- JAMAIS afficher/loguer/commiter les cles API ou tokens .env
- JAMAIS exposer l'identite du fondateur (nom, photo, voix, adresse, telephone)

## Contraintes

### Priorites dev (au moins 1 requis)
1. Chiffre d'affaires  2. Conversion  3. Confiance  4. Automatisation  5. Vitesse  6. UX

### Ne jamais casser
Stripe, Telegram, Hermes/Concile, Live IA, Brevo, Analytics, Responsive mobile, SEO

### Design
Mobile first, premium/sobre/epure, pas de sections redondantes, sections `display:none` dans index.html = volontairement cachees

### Branche
Toujours pusher sur la branche assignee, jamais main

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

# Agent : Claude

## Roles

### 1. Claude Chief (dans le Conseil Hermes)
- Fichier : `council/agents/claude_chief.py`
- Recoit les rapports des 6 agents + donnees brutes
- Prend la decision finale (PICK ou NOPICK)
- Pondere les avis, detecte les consensus et les divergences

### 2. Claude Dev (cette conversation)
- Developpeur principal du projet
- Cree et modifie le code (API, site, conseil, infra)
- Suit les regles de CLAUDE.md
- Branche de dev : ne push jamais sur main

### 3. Auto-Concile JS (dans api_server.js)
- Version simplifiee du conseil pour le Live IA
- Analyse les matchs en direct en temps reel
- Memes regles (cotes, ligues, BET_TYPES) que le conseil Python

## Fichiers geres
- `scripts/api_server.js` — API complete
- `public/` — Frontend (index.html, live-ia.html, js/, css/)
- `council/` — Conseil Python
- `docker-compose.yml`, `Caddyfile`, `Dockerfile`
- `CLAUDE.md` — Instructions projet

## Contraintes
- Jamais exposer le fondateur
- Jamais le mot "pari" dans le public
- Economie de tokens (pas de lectures inutiles)
- Verifier avant de livrer (Docker, API, HTML, responsive, ANJ)

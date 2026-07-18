# DECISIONS — Registre des decisions architecturales

## 2026-07-18 : Fourchette cotes 1.40-2.30
- **Contexte** : Les cotes trop basses n'offrent pas de value, les cotes trop hautes sont trop risquees
- **Decision** : Restreindre toutes les analyses a la fourchette 1.40-2.30
- **Impact** : betIsPlayable(), estimateMarketOdd(), prompt Hermes, prompt auto-concile JS

## 2026-07-18 : "But en 1ere mi-temps" comme marche prioritaire
- **Contexte** : C'est le marche le plus performant historiquement sur le type de matchs analyses
- **Decision** : Position 1 dans BET_TYPES, directive prioritaire dans tous les prompts
- **Impact** : BET_TYPES, agent_prompt.py, shadow prompt JS, computeAvailableBets

## 2026-07-18 : Harmonisation 6+1 IA
- **Contexte** : Incoherences entre "4+1", "5+1", "4 IA", "5 IA" sur le site
- **Decision** : Standardiser sur "6+1 IA" (6 agents + 1 Chief Claude)
- **Impact** : index.html, i18n.js, telegram_bot.py, hermes.py, site/

## 2026-07 : Architecture mono-fichier API
- **Contexte** : Simplicite > modularite pour un projet avec 1 dev
- **Decision** : Tout le backend dans api_server.js (~3000+ lignes)
- **Impact** : Maintenance facile, pas de modules a synchroniser

## 2026-07 : SQLite comme base de donnees
- **Contexte** : Volume faible (<1000 analyses), pas besoin de concurrence
- **Decision** : SQLite (tlm.db) pour tout : picks, analyses, votes, historique
- **Impact** : Pas de serveur DB, backup simple (cp du fichier)

## 2026-07 : Docker Compose 4 services
- **Contexte** : Separation des responsabilites tout en gardant un seul VPS
- **Decision** : site (Caddy), api (Node), council (Python), hermes-admin (Python)
- **Impact** : Deploiement atomique, logs isoles, restart independant

# Agent : Hermes (Conseil Python)

## Role
Orchestrateur du conseil quotidien. Coordonne 6 agents analystes + Claude Chief pour produire le pick du jour a 11h59 (heure Paris).

## Fichiers
- `council/hermes.py` — Orchestrateur principal
- `council/scheduler.py` — Scheduler (lance a 11h59)
- `council/agents/` — 6 agents (deepseek, gemini, mistral, groq, + 2 autres)
- `council/agents/claude_chief.py` — Chief, decide le pick final
- `council/prompts/agent_prompt.py` — Prompt systeme partage
- `council/tools/sports_api.py` — Donnees API-Football
- `council/tools/html_generator.py` — Genere le HTML du pick
- `council/tools/history_db.py` — SQLite (picks, votes, analyses)
- `council/tools/telegram_bot.py` — Envoi Telegram

## Fonctionnement
1. 11h59 : scheduler declenche hermes.py
2. Hermes recupere les matchs du jour (sports_api.py)
3. Chaque agent analyse et vote independamment
4. Claude Chief recoit les 6 rapports + donnees brutes
5. Chief decide : PICK (confiance >= 8/10) ou NOPICK
6. Si PICK : genere HTML, envoie Telegram, stocke en SQLite

## Regles
- Cotes 1.40-2.30 uniquement
- Marche prioritaire Football : "But en 1ere mi-temps"
- NOPICK > mauvais pick
- Ligues Winamax/Betclic uniquement

## Docker
Service `council` dans docker-compose.yml, image Python 3.12-slim, timezone Europe/Paris.

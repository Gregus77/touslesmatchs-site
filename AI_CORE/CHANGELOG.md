# CHANGELOG — TousLesMatchs

## 2026-07-18
- Filtrage cotes : MIN_PLAYABLE_ODD=1.40, MAX_PLAYABLE_ODD=2.30
- "But en 1ere mi-temps" devient marche prioritaire (position 1 dans BET_TYPES)
- Harmonisation "6+1 IA" sur tout le site (etait 4+1, 5+1, 4 IA, 5 IA)
- Mise a jour prompt Hermes Python (agent_prompt.py) : cotes 1.40-2.30, priorite But 1MT
- computeAvailableBets() : filtre But 1MT apres 46e min ou si but marque
- estimateMarketOdd() : ajout pattern mi-temps, cap a 2.30
- Analyse performance : 391 analyses, 303W/88L, 77.5% WR global

## 2026-07 (anterieur)
- Live IA avec onglets En direct / Statistiques
- Auto-concile JS pour analyses en temps reel
- Signal Fort (alerte confiance >= 80%)
- Rapports analytics quotidiens/hebdo
- Integration Stripe (1€, Pro 9.90€, Elite 19.90€)
- Bot Telegram gratuit + premium
- Brevo nurturing emails
- Multi-sport : Football, Basketball, Hockey, Baseball, Tennis

# TASKS — TousLesMatchs

## En cours
- [ ] Analyser performance par type de match (But 1MT vs Under vs Over)
- [ ] Envoyer rapport Hermes Telegram avec stats completes

## A faire (priorite haute)
- [ ] Blacklister USL League Two (WR 59%, tire les stats vers le bas)
- [ ] Ajouter tracking "But en 1ere mi-temps" dans les stats
- [ ] Verifier que le filtre cotes 1.40-2.30 fonctionne en prod
- [ ] Tester auto-concile avec nouveau BET_TYPES prioritaire

## A faire (priorite moyenne)
- [ ] Dashboard admin avec graphiques winrate par semaine
- [ ] Ameliorer le chatbot IA (plus de contexte sur les analyses)
- [ ] Optimiser SEO (structured data, meta descriptions)
- [ ] Rapport hebdo automatique dans Telegram Hermes

## Fait recemment
- [x] Filtrage cotes MAX_PLAYABLE_ODD = 2.30
- [x] "But en 1ere mi-temps" en position 1 dans BET_TYPES
- [x] Harmonisation 6+1 IA (index.html, i18n, telegram_bot, hermes)
- [x] Mise a jour prompt Hermes (agent_prompt.py)
- [x] computeAvailableBets() filtre HT apres 46e min
- [x] estimateMarketOdd() cap a 2.30

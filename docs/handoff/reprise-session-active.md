# Mission active — reprise de session

**Objectif :** Telegram Gratuit/Premium +0,5 but (cotes réelles, seuil 1,60, quatre partenaires affiliés, lien Premium 14,90 €, présentation combiné risqué), bandeau marketing honnête, et skill de reprise réseau.

**Branche :** `codex/goal05-odds-affiliation-20261008` sur `Gregus77/touslesmatchs-site`.
**PR :** [#163](https://github.com/Gregus77/touslesmatchs-site/pull/163), ouverte et initialement fusionnable ; vérifier les contrôles CI avant toute fusion.
**Dernier état connu :** PR créée, branche committée, tests CI en cours, production non déployée.
**Terminé :**
- Betclic restauré dans `scripts/bookmakers.config.js` avec l'URL déjà affichée sur l'accueil ; Winamax/Unibet/PMU préservés.
- `scripts/telegram_client.js` : cotes horodatées FR/RU pour +0,5 Gratuit/Premium, seuil 1,60, alerte cotes trop basses/absentes/périmées, boutons partenaires ; scanner étiqueté « à surveiller ».
- `scripts/api_server.js` : transmission de `oddFetchedAt` vers Telegram et garde de fraîcheur avant envoi.

**Étape suivante :** contrôler les cinq workflows PR #163, corriger tout échec ; si tout est vert, revue puis fusion. Vérifier ensuite un vrai déploiement de production avant de déclarer le site corrigé.
**Points à surveiller :** aucune cote fabriquée ; ne pas confondre combiné à risque supérieur et signal officiel ; ne pas afficher de faux compte à rebours. Premium affiché 14,90 € sur le site ; Checkout LIVE à vérifier avant lien direct. Ne jamais prétendre l'envoi effectif sans `message_id`.
**Tests :** CI GitHub PR #163 en cours : Goal05 V2, politique Goal05, produit courant, API-Sports et garde produit. Test dédié `scripts/test_goal05_telegram_odds_20261008.js` inclus au workflow politique.
**Mise à jour :** 2026-10-08, mission en cours.

# Mission active — reprise de session

**Objectif :** Telegram Gratuit/Premium +0,5 but (cotes réelles, seuil 1,60, quatre partenaires affiliés, lien Premium 14,90 €, présentation combiné risqué), bandeau marketing honnête, et skill de reprise réseau.

**Branche :** `codex/goal05-odds-affiliation-20261008` sur `Gregus77/touslesmatchs-site`.
**PR :** à créer après vérifications.
**Dernier état connu :** modifications commitées sur la branche dédiée, production non déployée et non testée.
**Terminé :**
- Betclic restauré dans `scripts/bookmakers.config.js` avec l'URL déjà affichée sur l'accueil ; Winamax/Unibet/PMU préservés.
- `scripts/telegram_client.js` : cotes horodatées FR/RU pour +0,5 Gratuit/Premium, seuil 1,60, alerte cotes trop basses/absentes/périmées, boutons partenaires ; scanner étiqueté « à surveiller ».
- `scripts/api_server.js` : transmission de `oddFetchedAt` vers Telegram et garde de fraîcheur avant envoi.

**Étape suivante :** préparer la présentation Premium/combiné et le bandeau de l'offre gratuite, ajouter les tests et exécuter les contrôles CI, ouvrir la PR.
**Points à surveiller :** aucune cote fabriquée ; ne pas confondre combiné à risque supérieur et signal officiel ; ne pas afficher de faux compte à rebours. Premium affiché 14,90 € sur le site ; Checkout LIVE à vérifier avant lien direct. Ne jamais prétendre l'envoi effectif sans `message_id`.
**Tests :** en attente.
**Mise à jour :** 2026-10-08, mission en cours.

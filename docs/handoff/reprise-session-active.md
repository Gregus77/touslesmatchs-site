# Mission active — checkpoint après fusion/déploiement (8 octobre 2026)

## Objectif de la mission terminée
- Cote réelle horodatée dans Telegram Gratuit et Premium FR/RU pour le +0,5 but d'une équipe ;
- alerte sous 1,60 ou cote périmée/absente, contrôle de fraîcheur avant envoi ;
- quatre liens d'affiliation Betclic, Unibet, PMU, Winamax ;
- bouton Premium 14,90 €/mois (paiement direct uniquement après validation LIVE) ;
- rappel combiné de 2 matchs = risque supérieur, sans fabriquer de paire ;
- barre Gratuit/Premium, sans fausse échéance ;
- skill de reprise de connexion.

## Preuves GitHub
- Dépôt : `Gregus77/touslesmatchs-site`, branche par défaut `main`.
- PR **#163** fusionnée par squash dans `main` ; commit **f10f02e2f28e3905e2a6a7759cfca52f9861b064**.
- Tous les cinq workflows de test PR réussis (Goal05 policy, Goal05 V2, current product, API-Sports, garde historique).
- `node scripts/test_goal05_telegram_odds_20261008.js` est exécuté dans le workflow Goal05 policy et passé.

## Preuves production
- Run **37726429935** — déploiement API Goal05 V2 : les logs rapportent `GOAL05_V2_PRODUCTION_DEPLOYED`, `GOAL05_V2_OBSERVER_ACTIVE`, `TELEGRAM_GOAL05_CONFIG_OK`, `PUBLIC_GOAL05_V2_STATS_OK`.
- Run **37726429829** — déploiement public UI : réussi.
- Run **37726429833** — affichage cycle de vie : réussi.
- Run **37726429959** — protection produit courant/historique : réussi.
- Run **37726429913** — déploiement i18n exécuté ; audit navigateur des langues à vérifier et terminer selon la dernière exécution.

## Ce qui reste VRAIMENT à contrôler / faire
1. Vérifier le statut final du workflow i18n **37726429913**, corriger seulement en cas d'échec.
2. Vérifier les notifications `goal05` lors du **prochain vrai signal**, avec preuve d'envoi `telegram_message_id`, cote fraîche, et contenu Gratuit/Premium ; ne pas créer un faux signal de test.
3. Vérifier que les liens partenaires sont bien des URL d'affiliation actives, en particulier Betclic (copié depuis la page d'accueil).
4. Ne mettre une date dans `public/data/free-offer-status.json` et les variables `TLM_FREE_OFFER_CONFIRMED=1`, `TLM_FREE_OFFER_ENDS_AT` que lorsqu'une **vraie fin d'opération** a été décidée (le compteur est actuellement inactif).
5. Vérifier le paiement Stripe **LIVE à 14,90 €/mois** avant d'affirmer que Checkout fonctionne.
6. Pour proposer de VRAIS combinés à deux matchs, développer un moteur dédié avec deux dossiers et deux cotes réelles indépendantes, vote IA et preuve ; ne pas déroger silencieusement au plancher **1,60 individuel** de la stratégie officielle.

## Sécurité / limites
- Pas d'envoi Telegram prouvé pour un nouveau match durant cette intervention.
- Aucune prétention de taux de réussite ni de gain garanti.
- Ce skill permet de reprendre au prochain échange, pas d'exécuter ChatGPT hors connexion.
- Pas de secret ou de donnée personnelle stockés dans le checkpoint.

**Prochaine action automatique lors d'une reprise :** rechercher l'état de l'audit i18n et des livraisons Goal05 depuis le dernier contrôle, puis avancer uniquement sur les points ouverts.

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
- Run **37726429913** — déploiement i18n et audit navigateur dans cinq langues, répété deux fois : **réussi** (`conclusion=success`).

## Ce qui reste VRAIMENT à contrôler / faire
1. Vérifier les notifications `goal05` lors du **prochain vrai signal**, avec preuve d'envoi `telegram_message_id`, cote fraîche, et contenu Gratuit/Premium ; ne pas créer un faux signal de test.
2. Vérifier que les liens partenaires sont bien des URL d'affiliation actives, en particulier Betclic (copié depuis la page d'accueil).
3. Ne mettre une date dans `public/data/free-offer-status.json` et les variables `TLM_FREE_OFFER_CONFIRMED=1`, `TLM_FREE_OFFER_ENDS_AT` que lorsqu'une **vraie fin d'opération** a été décidée (le compteur est actuellement inactif).
4. Vérifier le paiement Stripe **LIVE à 14,90 €/mois** avant d'affirmer que Checkout fonctionne.
5. Pour proposer de VRAIS combinés à deux matchs, développer un moteur dédié avec deux dossiers et deux cotes réelles indépendantes, vote IA et preuve ; ne pas déroger silencieusement au plancher **1,60 individuel** de la stratégie officielle.

## Sécurité / limites
- Pas d'envoi Telegram prouvé pour un nouveau match durant cette intervention.
- Aucune prétention de taux de réussite ni de gain garanti.
- Ce skill permet de reprendre au prochain échange, pas d'exécuter ChatGPT hors connexion.
- Pas de secret ou de donnée personnelle stockés dans le checkpoint.

**Prochaine action automatique lors d'une reprise :** vérifier les preuves des prochaines livraisons officielles Goal05 et le statut Stripe LIVE, puis avancer uniquement sur les points ouverts.

## Checkpoint audit Codex — 9 octobre 2026, vers 03h00 Paris
- Objectif : état réel du jour, preuves Telegram, contrôle social sans pronostic non validé.
- Branche/PR : codex/hermes-audit-20261009, PR brouillon #171 ; correctif initial 50d6775 poussé. Main non fusionné.
- Terminé : correctif script opérateur appliqué sur VPS avec sauvegarde ; base Hermès alignée sur la base API ; confirmation Telegram par message_id avant hash ; cron absent supprimé avec sauvegarde. Observateur API Goal05 conservé.
- Preuves : registre officiel Goal05 = 0 ; scanner FR Gratuit 620/621 et Premium 207/208 ; rapport propriétaire Telegram confirmé message 4001. Tests lecture seule des quatre canaux FR/RU : accessibles, bot administrateur autorisé à publier.
- Tests : bash -n réussi ; montage Docker isolé de /opt/touslesmatchs/data:/data:ro = base 80 035 840 octets ; checks GitHub product-guard et preview réussis sur le correctif initial.
- Blocages : Metricool inaccessible (navigateur échoue, aucun outil Metricool disponible) ; aucune publication sociale prouvée. Scanner RU absent par code ; cadence 2h versus règle 4h. Historique scanner importé incohérent (dates, couleur/note, résultat sans score), cotes absentes : aucun ROI certifié.
- Prochaine action : rétablir Metricool et lire connexions/publications de Tous Les Matchs uniquement ; auditer provenance scanner avant correction de résultats ; vérifier prochain vrai signal Goal05 et prochain rapport phase21 automatique.
- Sécurité : @parrainagebanque exclu ; aucun faux signal ni pronostic public envoyé ; secrets/historique/règles sportives préservés.

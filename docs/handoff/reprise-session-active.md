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


## Reprise Telegram — 9 octobre 2026

### Objectif
Réparer les livraisons et activer la campagne +0,5 V2 avec contenu identique
Gratuit/Premium jusqu’au 7 novembre 2026 inclus (Europe/Paris).

### Branche / PR
- Branche : `codex/telegram-runtime-repair-20261009`.
- PR : https://github.com/Gregus77/touslesmatchs-site/pull/180 (ouverte, non fusionnée).
- Source déployée : module Telegram de la branche, empreinte SHA-256
  `f4304575546845312325bb06793d6224b66f2b0dd14d40ffa66d4c227cde48b0`.

### Dernière étape terminée / preuves
- Audit réel VPS via Actions : run `37968030063`. Hermès Guardian, console
  propriétaire et mission-runner actifs ; bot administrateur dans trois chats distincts.
- Tests explicites Telegram : run `37968258084`, message_id Hermès `4024`,
  Gratuit `633`, Premium `220`. Aucun signal sportif créé pour ces tests.
- Activation réussie : run `37969286415`. Empreinte du module exécuté vérifiée,
  santé publique API/Telegram OK, observateur Goal05 actif avec push activé.
- Image ciblée : `tlm-api-telegram-campaign:20261009t175214z`.
- Sauvegarde privée VPS : `/opt/backups/telegram-campaign-20261009T175214Z`.
- Override Compose persistant : `/opt/tlm-telegram-runtime/campaign.compose.json`.
- Échéance : `2026-11-08T00:00:00+01:00`, fin du 7 novembre en heure de Paris.

### Tests
- Quatre tests des sondes : livraison, non-renvoi, incertitude, destinataires.
- Égalité texte/boutons et échéance de campagne testées RED puis GREEN.
- Goal05 V2 scoring/integration/policy, produit courant/historique et
  cotes/partenaires/reprise passent ; CI de PR sans échec au dernier contrôle.

### Sécurité / limites
- Aucune clé ni fichier .env dans GitHub. Secrets conservés côté VPS.
- Aucune recharge OpenRouter déclenchée. Limite clé observée 10 $, budget
  applicatif 2 €/jour et 400 requêtes/modèle/jour. Paramètres d’auto-recharge
  du compte OpenRouter non exposés par ces endpoints, donc non attestés.
- Un résultat historique en état `uncertain` est conservé sans renvoi aveugle.
- Aucun nouveau signal officiel +0,5 prouvé ; attendre un vrai candidat conforme.
- VPS Hostinger annoncé expirant le 17 octobre 2026 : renouvellement exploitant
  nécessaire pour garantir la continuité jusqu’au 7 novembre. Aucun renouvellement effectué.
- PR non fusionnée : un déploiement général basé sur l’ancien main pourrait
  écraser le module ciblé. Réconcilier la PR avant tout déploiement général,
  en préservant l’historique et sans rejouer les imports anciens.

### Prochaine action
Vérifier le run `37969449046` : audit après activation et réutilisation des trois
reçus TEST sans renvoi. Puis surveiller la prochaine vraie livraison +0,5 avec
preuve de cote fraîche, quorum 4/5, note verte et message_id par canal.

Horodatage : 2026-10-09T19:54:57.929929+02:00

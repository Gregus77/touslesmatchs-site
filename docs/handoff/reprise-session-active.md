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

---

## Checkpoint mission sociale — 09/10/2026, worktree uniquement

- **Objectif** : préparer une pipeline serveur de surveillance/bilan, ordinateur
  propriétaire éteint, sans modifier les décisions sportives.
- **Branche / PR** : `codex/telegram-owner-codex-owner-social-autonomy-20261009-20261009-021821` ;
  base locale `a51fa3bdebab0dd77a90d46e6e15d399fd3fb2c3`. Aucune PR/push/installation
  effectuée ici ; comparaison GitHub/VPS laissée au runner/opérateur, pas prétendue.
- **Dernière étape** : export additionnel API, worker/test/config/systemd, liens
  visibles site/PWA et documentation opérateur préparés. Instructions persistées
  ≠ automatisation installée. Voir `docs/social/README.md` pour le périmètre exact.
- **Preuves** : tests Python hors réseau avec quatre PNG TEST et serveur HTTP local ;
  test JS de l'export réel ; cinq scripts Goal05 réussis. Aucun reçu nouveau réel.
  Reçus FR connus du 09/10 fournis par Greg importés idempotemment seulement au
  lancement production. EN non envoyée, aucune validation d'autres jours.
- **Prochaine action** : appliquer le diff ciblé après comparaison aux travaux
  concurrents, installer dépendances/permissions, activer l'export seul, vérifier
  les données naturelles et l'image privée, puis activer la diffusion par opérateur.
  Pré-match Metricool bloqué ; aucune garantie d'expiration documentée.
- **Tests / limites** : `python3 -m unittest discover -s tests/social -v`,
  `node scripts/test_social_source_20261009.js`, quatre suites produit obligatoires
  et `test_goal05_telegram_odds_20261008.js`. Test React global non exécutable :
  `react-scripts` absent. Unités systemd validées syntaxiquement, avertissements
  étrangers au dépôt signalés dans README. HTTP VPS / Docker non vérifiés.
- **Sécurité** : aucun secret ouvert/affiché/modifié, aucun paiement, aucune sortie
  client de test, aucune modification de stratégie, aucun push/merge/déploiement.
- **Horodatage** : 2026-10-09 (date de mission, non preuve d'activation).


## Préférence visuelle confirmée le 9 octobre
La génération OpenAI doit rester **prioritaire et obligatoire** pour les affiches sociales. Modèle visé : `gpt-image-2.5-flare`, qualité medium. Aucun visuel de secours simpliste ne doit être publié. Clé API VPS actuellement invalide (401), budget images à 0 ; publication externe désactivée en attendant une configuration vérifiée. Ne pas transformer l'abonnement ChatGPT en prétendu crédit API. PR #173, tests GitHub à valider, pas de déploiement confirmé de ces changements.

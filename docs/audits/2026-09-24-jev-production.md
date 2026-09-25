# Jev / TypeSafe — rapport de mise en production

**25 septembre 2026 — 100 % technique. Jev ACTIVÉ et DÉPLOYÉ en production.**

**État final : OK technique / EN ATTENTE D'UNE PREUVE SUR MATCH NATUREL.** La validation réseau et les tests isolés ne constituent pas une preuve sur un vrai match. Au contrôle après déploiement, aucune décision Jev naturelle n'était encore enregistrée.

Branche : `codex/jev-production-20260924`. Base audit : `85efaac` ; préparation : `374a720` ; correctif de découverte des alias : `8b2f1d8`. L'audit des 48 heures n'a pas été recommencé. Les modifications antérieures non liées ont été préservées hors des commits de cette mission.

## 1. Contrôle TypeSafe réel et configuration activée

Sources du contrat : [OpenAPI officiel](https://api.typesafe.ai/openapi.json), [documentation officielle](https://api.typesafe.ai/docs). OpenAPI archivé, version 0.2.0, SHA-256 `a191f8a7df6bd6fedced8120dd0fd106f88575d1d1c8360d08900a6c7c0360d5`.

GET `/v1/models` authentifié : HTTP 200, alias accessibles `jev-latest` et `jev-preview`.

| Contrôle réel accepté | Valeur |
|---|---|
| Endpoint | POST `/v1/systemone` |
| Alias demandé | `jev-latest` |
| Modèle retourné | `jev-1.13.0` |
| HTTP | 200 |
| Question native | `production_decision`, type `choice` |
| Choix | REJECT |
| Confiance | 1,00 |
| Probabilités | SEND 0 ; WAIT 0 ; REANALYZE 0 ; REJECT 1 |
| Tokens entrée / sortie | 403 / 56 |
| Latence mesurée | 551 ms |
| Horodatage | 2026-09-25T02:24:58.291Z |

Ce contrôle indiquait explicitement l'absence de match et l'interdiction de publier. Il n'a créé aucune décision dans SQLite de production, aucun signal ni message Telegram. Les champs de réponse, le schéma natif, les probabilités, le modèle et l'usage ont été validés. Aucun prix/coût monétaire n'était fourni ; il n'est pas inventé.

**Deux POST de test réellement envoyés au total, aucun troisième :**

1. Premier POST sur `jev-preview` : HTTP 200 en 533 ms, rejet local du champ modèle. Le validateur initial imposait à tort que le nom retourné figure parmi les alias du compte ; l'OpenAPI autorise un nom résolu différent. Les autres champs n'avaient pas été conservés avant ce rejet, donc ils ne sont pas déclarés vérifiés.
2. Deuxième POST, expressément autorisé par le propriétaire : réponse valide décrite ci-dessus.

Entre les deux, un lancement du script a échoué **avant son POST**, à cause d'une variable JavaScript masquant le corps de requête. L'exécution complète du script avec transport injecté a reproduit exactement un GET et **zéro POST**. Après correction, le même test valide un seul POST et bloque toute répétition. Cette trace locale est conservée séparément ; elle n'est pas comptée comme un troisième appel fournisseur.

Le contrôle de découverte établit la liaison entre l'alias accessible et le nom de réponse authentifié. En production, les noms autorisés sont figés : pas de joker ni d'admission dynamique d'un nouveau modèle. Un futur nom non reconnu provoquera le repli TLM, pas une acceptation silencieuse.

Configuration réellement chargée dans le conteneur :

```text
JEV_ENABLED=1
JEV_PRODUCTION_MODE=1
JEV_MODEL=jev-latest
JEV_ALLOWED_RESPONSE_MODELS=jev-1.13.0,jev-latest
JEV_MIN_DECISION_CONFIDENCE=0.70
JEV_TIMEOUT_MS=8000
TYPESAFE_API_KEY : configurée, valeur jamais affichée
```

Un GET authentifié supplémentaire, effectué depuis le conteneur API déployé, confirme HTTP 200 et l'accessibilité de l'alias configuré. Aucun POST supplémentaire n'a été effectué pour ce contrôle.

## 2. Rôle de Jev et règles conservées

Pipeline effectif : votes réels et données live → snapshot immuable → évaluation traditionnelle → Jev natif → décision structurée → registre officiel → file Telegram et vues site/application.

Le propriétaire a explicitement autorisé SEND Jev à dépasser les refus **quantitatifs** traditionnels. Quorum 4/5, confiance 80 %, cote connue 1,50–2,10, classement ≥5 et Recovery restent dans le code et dans les traces. Les votes et la confiance du Concile restent leurs valeurs réelles : un scrutin 2/5 ne devient jamais artificiellement 4/5.

Restent infranchissables : Football officiel, compétition autorisée, exclusions féminines/jeunes/amicaux/coupes/barrages, intégrité des données, score cohérent, première mi-temps ouverte, diffusion à partir de 35 minutes et aucun signal après sa fin vérifiée. Un marché déjà résolu par trois buts est refusé.

- **SEND ≥0,70** : poursuit après revalidation fraîche du score et de la période ; dépassement quantitatif uniquement avec une décision Jev authentique persistée pour le même snapshot.
- **WAIT / confiance <0,70** : aucun envoi ; nouvelle observation naturelle seulement si la première mi-temps le permet.
- **REANALYZE** : aucun envoi ; nouvelle analyse uniquement si le mécanisme existant autorise un nouveau snapshot naturel. Les budgets/limites des cinq sièges ne sont pas réinitialisés.
- **REJECT** : aucun envoi ; choix et source de décision conservés. Aucun motif textuel supplémentaire n'est inventé lorsque l'API ne le fournit pas.
- **Indisponibilité Jev** : uniquement les candidats intégralement admissibles traditionnellement peuvent poursuivre, avec `decision_source=tlm_fallback_jev_unavailable`. Aucune décision Jev fictive.

Les réobservations sont bornées à douze passages sur douze minutes et deux analyses supplémentaires. Le cache persistant `(snapshot_id, model)` évite les appels multiples ; il refuse un état différent sous le même identifiant et les snapshots périmés. Aucun appel au rafraîchissement navigateur. Aucun retry du POST, faute d'idempotence de facturation documentée. Coupe-circuit après trois erreurs ; indisponibilités, erreurs HTTP 401/403/422/429/5xx, timeout et réponses invalides sont catégorisés sans journaliser les en-têtes ni corps d'erreur bruts.

## 3. Données, persistance et administration

Migration additive : `jev_decisions` et `jev_reobservations`, avec index de décision, date, match et snapshot. Les réponses, probabilités, tokens, latence, critères traditionnels, choix final, source et erreur sont enregistrés sans clé.

Le `state` est construit par liste explicite de champs sportifs. Il ne contient aucune donnée client. Cote estimée, statistique manquante ou carton inconnu ne sont pas présentés comme observations réelles. Seules les nouvelles captures sont concernées ; aucun ancien snapshot n'a été réécrit.

`/admin/jev-status` est sécurisé par le middleware admin existant. Il fournit configuration, compteurs, latences, tokens et comparaisons 24 h / 7 jours / 30 jours. Les résultats joints sont les résultats officiels effectivement résolus ; aucune performance supérieure n'est revendiquée et aucun résultat n'est fabriqué pour les décisions refusées.

Le tableau de bord admin affiche Jev. Une erreur de syntaxe préexistante dans son affichage des sauvegardes a été corrigée. Les probabilités et traces techniques Jev ne sont pas ajoutées aux réponses publiques.

Le registre officiel est reconnu par les vues site/application même sous 4/5, avec le vrai scrutin. La preuve de livraison reste distincte : un signal n'est marqué livré qu'avec un reçu Telegram positif.

## 4. Déploiement et rollback

API remplacée le **25/09/2026 à 02:27:25.741 UTC**, seule parmi les quatre services.

| Élément | Référence |
|---|---|
| Image déployée | `touslesmatchs-api:jev-production-20260924` |
| SHA-256 déployé | `254fdb058ddb527762970a57b532b4b4c8fc1cf3e8bf314e0ec8cdb18872eb85` |
| Image de rollback | `touslesmatchs-api:jev-before-20260924` |
| SHA-256 précédent | `498bd03b64fab631ba69f613b5d0120e47ba19f291c54dc0bdc600a57fbf773d` |

Image construite hors réseau à partir de l'image précédente, sans réinstallation des dépendances natives. Les trois fichiers applicatifs remplacés sont `server.js`, `official_signal_snapshots.js`, `jev_decision_engine.js`. Le Dockerfile source inclut le nouveau module pour les reconstructions futures.

La procédure refuse une dérive de source ou de configuration non liée. Elle conserve les sauvegardes, active les variables vérifiées et restaure automatiquement l'image précédente si le health échoue. Le rollback automatique n'a pas été déclenché : le health a réussi.

Rollback manuel préparé, sans suppression des tables additives ni restauration rétroactive des résultats :

```bash
python3 /opt/touslesmatchs/data/audits/2026-09-24-jev-production/deploy.py rollback
```

Il désactive durablement Jev dans `.env`, restaure l'image précédente et recrée uniquement l'API. La clé reste dans `.env` ; aucune copie en clair n'est créée.

## 5. Contrôles réussis et limites

- **30 scénarios déterministes Jev** réussis : choix, confiance faible, erreurs, modèle/schéma/usage, cache, redémarrage logique, score modifié, première mi-temps, repli, secrets, historique, absence de Telegram réel, bornage des réanalyses et reprise d'une requête interrompue.
- **Bloc réel du serveur** exécuté hors réseau : décision → snapshot officiel exact → quatre reçus Telegram simulés en base mémoire. Un SEND à 2/5 reste 2/5 ; WAIT/REANALYZE/REJECT ne publient rien.
- Neuf scripts de validation de l'image candidate ont réussi sans réseau ni secrets ni base de production : deux tests Jev, snapshots officiels, première mi-temps, cohérence live, Telegram quatre canaux, observabilité, garde budget et budget global OpenRouter.
- Deux tests opérateur supplémentaires réussis : découverte des alias et exécution complète du script de contrôle avec transport simulé, y compris interdiction de répéter le POST. **Onze scripts de validation au total.**
- Syntaxe des modules de l'image et du script opérateur validée ; administration parsée avec Acorn ; saisie sécurisée validée avec `bash -n`.
- **Admin authentifié** : `ok=true`, enabled/production/configured vrais, alias `jev-latest`, timeout 8 000 ms, zéro erreur et zéro appel naturel à l'instant du contrôle.
- **Douze contrôles publics conformes** : accueil, live, résultats, application, administration, health, matchs live, historique, historique quotidien, règles et roster HTTP 200 ; endpoint admin Jev sans authentification HTTP 403.
- **Telegram FR gratuit / FR Premium / RU gratuit / RU Premium** : `getMe` et `getChatMember` HTTP 200, bot administrateur avec droit de publier sur chaque destination. Aucun `sendMessage` de test.
- **Quatre services Running**, zéro restart en boucle ; site, council et Hermès n'ont pas été redémarrés par la mission.
- Configuration vérifiée après recréation du conteneur ; tables additives persistantes lisibles depuis le volume hôte et incluses dans la sauvegarde SQLite cohérente après migration. Les tests isolés vérifient aussi la réutilisation d'une décision après reconstruction de l'instance moteur.

Limites : les contrôles site/application sont HTTP et source, pas une session Premium instrumentée dans un navigateur ou un téléphone. La joignabilité Telegram n'est pas une preuve de livraison d'un nouveau signal. L'absence de match naturel n'est pas une preuve que le pipeline a traité un match réel.

## 6. Comparaison historique avant / après

| Données préexistantes | Contrôle |
|---|---|
| 817 snapshots de votes | Empreinte identique |
| 11 sélections officielles | Empreinte identique |
| 11 résultats officiels | Empreinte identique |
| 2 678 analyses déjà résolues | Zéro ligne modifiée ou manquante |

La comparaison élargie couvre **79 tables existantes** : 73 ont toutes leurs lignes préexistantes identiques. Dans six tables, les routines déjà existantes ont actualisé uniquement des métadonnées opérationnelles : `last_updated` dans league_ratings, agent_weights et ai_market_specialization ; `created_at` dans monthly_snapshots ; `disabled_until` dans provider_health ; `last_attempt` dans long_history_worker. Les valeurs des statistiques mensuelles et les résultats sportifs sont identiques. Il serait donc inexact de prétendre que chaque octet de toute la base est inchangé.

Aucune suppression client, aucun ancien signal rejoué, aucun vote/cote/message_id inventé en production, aucun résultat historique réécrit par l'intégration. Le Shadow multisport existant est préservé. Aucun appel OpenRouter de test n'a été déclenché.

## 7. Sauvegardes et preuves

Dossier privé, ignoré par Git : `data/audits/2026-09-24-jev-production/`, répertoire 0700 et preuves sensibles 0600. Fichiers initiaux dans `before/`, sauvegardes des correctifs dans `before-alias-fix/` et `before-second-auth/`. Seuls les noms et présences des variables secrètes sont copiés, jamais leurs valeurs.

Sauvegardes SQLite cohérentes par l'API de backup : `tlm-before-jev.db` et `tlm-after-jev.db` dans ce dossier. Copies supplémentaires prescrites par le projet, dans **/opt/backups et /root/backups** :

- `tlm-20260925_022712-avant-jev-production.db`
- `tlm-20260925_023438-apres-jev-production.db`

Les fichiers nouvellement créés ont été restreints à 0600. Les sauvegardes privées cohérentes incluent les transactions WAL ; elles sont les références pour les comparaisons avant/après.

Preuves principales : `authenticated-check.json` (premier POST), `authenticated-check-attempt-2.json` (second POST valide), reçus distincts du lancement sans POST et `local-preflight-proof.json`, `container-model-check.json`, `deployment.json`, `jev-status-after.json`, `endpoints-after.json`, `telegram-after.json`, `historical-after.json`, `all-existing-tables-comparison.json`, `operational-table-differences.json`, `services-after.json`, `isolated-tests.log` et `.json`.

## 8. Liste des fichiers de la mission

Modifiés et versionnés :

- `scripts/api_server.js` — intégration après scrutin, gardes et traçabilité, réobservations, endpoint admin et reconnaissance du registre officiel.
- `scripts/official_signal_snapshots.js` — dépassement du quorum uniquement sur preuve Jev persistée valide.
- `Dockerfile.api`, `docker-compose.yml` — module et configuration serveur.
- `public/admin-dashboard.html` — supervision et correction de syntaxe.
- `CHANGELOG.md`, `docs/audits/2026-09-24-jev-production.md` — journal et rapport.

Ajoutés et versionnés :

- `scripts/jev_decision_engine.js`
- `scripts/configure_typesafe_key.sh`
- `scripts/verify_jev_api.js`
- `scripts/test_jev_production_20260924.js`
- `scripts/test_jev_pipeline_20260925.js`
- `scripts/test_jev_alias_discovery_20260925.js`
- `scripts/test_jev_smoke_transport_20260925.js`

Configuration non versionnée : `.env` — clé saisie par le propriétaire ; activation, modèle, seuil, noms autorisés et timeout Jev fixés après validation. Preuves et procédures privées dans le dossier d'audit. Les modifications antérieures de Caddy, des pages publiques, du thème, de l'internationalisation et de l'API restent intactes et hors des commits de cette mission.

## 9. Ce qui reste à prouver

**EN ATTENTE D'UNE PREUVE SUR MATCH NATUREL.** Il faudra observer un vrai candidat, ses cinq sièges réels, son snapshot, la réponse Jev, la décision finale et, si SEND, la sélection officielle, les reçus Telegram et l'affichage cohérent site/application. Aucun match ni aucun signal ne sera fabriqué pour obtenir cette preuve.

**Aucun secret affiché, journalisé dans les preuves ou ajouté à Git.**

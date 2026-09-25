# Jev / TypeSafe — intégration de production

État au 25 septembre 2026 : **PARTIEL — code et image candidate validés hors réseau, activation bloquée par l'absence de TYPESAFE_API_KEY**. Progression : 60 %. Ne pas confondre l'image candidate avec le service effectivement déployé. Aucune preuve naturelle Jev n'existe.

## Périmètre et décision propriétaire

Reprise de `85efaac`, sans recommencer l'audit des 48 heures. Branche : `codex/jev-production-20260924`.

Le propriétaire a explicitement autorisé un SEND Jev à dépasser les refus quantitatifs traditionnels : quorum 4/5, confiance 80 %, cote connue 1,50–2,10, écart de classement ≥5 et Recovery. Ces règles restent exécutées, conservées dans le code et enregistrées avec la décision traditionnelle. Aucun vote ni niveau de confiance du Concile n'est remplacé par une valeur artificielle.

Les exclusions structurelles restent impératives : Football officiel, compétitions autorisées, exclusions féminines/jeunes/amicaux/coupes/barrages, données réelles cohérentes, score confirmé, première mi-temps ouverte et diffusion à partir de 35 minutes. Un marché déjà résolu par trois buts est refusé. Un modèle absent, une erreur ou une confiance Jev insuffisante ne peut autoriser un dépassement quantitatif.

## Contrat officiel et modèle

Sources : [OpenAPI officiel](https://api.typesafe.ai/openapi.json) et [documentation officielle](https://api.typesafe.ai/docs).

OpenAPI téléchargé et vérifié le 25/09, version 0.2.0 ; SHA-256 `a191f8a7df6bd6fedced8120dd0fd106f88575d1d1c8360d08900a6c7c0360d5`.

Le client utilise `POST /v1/systemone`, un `state` structuré et la question native `production_decision` de type `choice`, avec SEND, WAIT, REANALYZE et REJECT. La réponse doit contenir le modèle, le choix, une confiance numérique de 0 à 1, les quatre probabilités normalisées et les compteurs de tokens. Le modèle retourné est contrôlé contre une liste explicitement vérifiée sur le compte ; aucune identité de modèle n'est présumée.

**Modèle accessible au compte : non déterminé**, faute de clé. Aucun `GET /v1/models` authentifié ni POST TypeSafe n'a encore été exécuté. `scripts/verify_jev_api.js` effectuera le GET, choisira un modèle Jev effectivement retourné puis un unique POST minimal. Un reçu exclusif est écrit avant ce POST : timeout ou interruption ne déclenchent jamais une deuxième tentative payante. Ce contrôle ne crée ni match ni ligne de décision en production et n'appelle pas Telegram.

## Fonctionnement préparé

1. Les votes réels produisent un snapshot immuable. Les estimations de cote sont exclues des nouveaux snapshots officiels ; une cote inconnue reste nulle.
2. L'évaluation traditionnelle complète est conservée, y compris le contrôle de cote.
3. Jev reçoit uniquement une liste explicite de données sportives : match, scrutin, marché, classement, statistiques, Recovery et intégrité. Une statistique manquante reste inconnue ; les zéros de substitution historiques des cartons ne sont pas envoyés comme observations réelles.
4. SEND avec confiance ≥0,70 peut poursuivre après vérification fraîche de l'état live. Le registre exige une décision Jev persistée correspondant exactement au snapshot pour autoriser un scrutin sous le quorum traditionnel.
5. WAIT/REANALYZE ne publient rien. Les réobservations sont limitées à douze passages sur douze minutes et deux analyses supplémentaires, uniquement sur un nouvel identifiant naturel de snapshot autorisé par la mécanique existante. Les budgets et limites des cinq IA ne sont pas réinitialisés. Sans changement naturel autorisant un nouveau scrutin, aucun appel au Concile n'est forcé.
6. REJECT bloque. Une confiance Jev <0,70 produit WAIT si la première mi-temps est encore ouverte, sinon REJECT.
7. En cas d'indisponibilité, seul un candidat intégralement admissible traditionnellement peut poursuivre avec `tlm_fallback_jev_unavailable`. Aucun choix Jev fictif n'est enregistré.
8. Telegram conserve sa vérification fraîche du score et de la période avant chaque livraison, sa limite d'âge de 120 secondes, sa déduplication et ses preuves positives de livraison.

Le cache est persistant par `(snapshot_id, model)` ; il partage aussi les appels simultanés. Un ancien SEND ne peut pas être réutilisé pour un état différent, un snapshot périmé ou une première mi-temps fermée. Une requête interrompue n'est jamais répétée ; passé son délai, un candidat traditionnel admissible peut reprendre le repli après vérification fraîche.

Timeout préparé : 8 secondes par défaut, configurable et borné à 20 secondes. La valeur de production sera déterminée après l'unique mesure réelle. Aucun retry du POST, car le fournisseur ne documente pas d'idempotence de facturation. Coupe-circuit après trois erreurs, avec conservation du blocage récent au redémarrage.

## Persistance et administration

Migration additive préparée : `jev_decisions` et `jev_reobservations`, index par match, snapshot, date et décision. Les réponses, probabilités, tokens, latence, décision traditionnelle, décision finale, source et catégories d'erreur sont enregistrés sans clé. Les erreurs fournisseur brutes et en-têtes Authorization ne sont jamais journalisés.

`/admin/jev-status` utilise le middleware admin existant. Il expose état/configuration, modèle, compteurs, latences, tokens, dernières activité/erreur, et comparaisons 24 h / 7 jours / 30 jours. Les résultats joints sont les résultats officiels effectivement résolus ; aucun résultat n'est fabriqué pour un candidat rejeté et aucune amélioration de performance n'est revendiquée.

Le tableau de bord admin affiche l'état Jev sans modifier l'accueil client. Une erreur JavaScript antérieure dans l'affichage de la fraîcheur des sauvegardes a été corrigée pour rendre ce tableau fonctionnel. L'API publique reconnaît le registre officiel pour afficher un signal Jev même sous 4/5, en conservant le vrai scrutin. Les probabilités internes ne sont pas ajoutées aux réponses publiques.

## Vérifications accomplies

- 30 scénarios déterministes Jev réussis : quatre choix, faible confiance, timeout, HTTP 401/403/422/429/5xx, JSON/schéma/modèle/probabilités/usage invalides, cache et redémarrage, exclusions, fin de première mi-temps, changement de score, repli, secrets, historique, absence de Telegram réel, boucles bornées, requête interrompue et statistiques inconnues.
- Test exécutant le bloc réel de `api_server.js` : décision → registre immuable → quatre reçus Telegram simulés dans une base en mémoire. Le cas 2/5 reste 2/5. Les décisions bloquantes n'enregistrent pas de signal.
- Neuf scripts de validation exécutés avec succès dans un conteneur `--network none`, sans secrets ni base de production : deux tests Jev, snapshots officiels, première mi-temps, cohérence live, Telegram quatre canaux, observabilité, garde budget et budget global OpenRouter.
- Syntaxe Node des trois modules de l'image candidate validée. Script principal de l'administration parsé avec Acorn ; script de saisie de clé validé avec `bash -n`.
- Vérification du service après reprise : l'API tourne toujours sur l'image précédente ; son code correspond exactement à la sauvegarde initiale. Aucun changement nocturne de code n'a invalidé le rollback. `JEV_ENABLED=0`, `JEV_PRODUCTION_MODE=0`, clé absente et aucune table Jev en production au contrôle.

Les scénarios simulés sont exclusivement des tests isolés. Ils ne prouvent ni une réponse authentifiée TypeSafe ni le passage d'un match naturel en production.

## Images, sauvegardes et reprise

Dossier privé, ignoré par Git : `data/audits/2026-09-24-jev-production/`.

- Fichiers avant modification : `before/`, état Git et empreintes : `baseline.json`.
- Configuration secrète : seulement les noms de variables et leur présence dans `environment-presence.json`, aucune valeur copiée.
- Rollback : `touslesmatchs-api:jev-before-20260924`, image `sha256:498bd03b64fab631ba69f613b5d0120e47ba19f291c54dc0bdc600a57fbf773d`.
- Candidate : `touslesmatchs-api:jev-production-20260924`, image `sha256:254fdb058ddb527762970a57b532b4b4c8fc1cf3e8bf314e0ec8cdb18872eb85` ; dérivée de l'image actuelle sans réseau et sans réinstaller les dépendances natives.
- Preuves : OpenAPI archivé, `runtime-resume.json`, `candidate.json`, `isolated-tests.json`, `isolated-tests.log`.
- Procédure de déploiement préparée : `deploy.py`, copie de `/tmp/tlm-jev-deploy-20260925.py`. Elle exige un contrôle authentifié réussi, refuse toute dérive de code/environnement non liée, prépare une sauvegarde SQLite cohérente et les sauvegardes du projet, active seulement les variables Jev vérifiées, puis remplace uniquement l'API. Retour automatique à l'image précédente si le health échoue. **Cette procédure n'a pas été exécutée en mode deploy.**

Pour enregistrer la clé, le propriétaire doit exécuter dans son terminal VPS :

```bash
bash /opt/touslesmatchs/scripts/configure_typesafe_key.sh
```

Ce script utilise `read -s`, écrit atomiquement `.env` en mode 0600 et n'affiche jamais la valeur. Aucune clé ne doit être collée dans la conversation.

Ensuite : contrôle authentifié unique, fixation du modèle/timeout, déploiement API, sauvegarde après migration, contrôles locaux et publics (dont refus de l'endpoint admin sans authentification), vérification des quatre destinations Telegram sans envoi client, persistance et comparaison des données historiques, puis mise à jour de ce rapport. Ne pas effacer le reçu du POST pour recommencer un appel après timeout.

## Fichiers de la mission

Modifiés : `scripts/api_server.js`, `scripts/official_signal_snapshots.js`, `Dockerfile.api`, `docker-compose.yml`, `public/admin-dashboard.html` ; ajout documentaire à `CHANGELOG.md`.

Ajoutés : `scripts/jev_decision_engine.js`, `scripts/test_jev_production_20260924.js`, `scripts/test_jev_pipeline_20260925.js`, `scripts/verify_jev_api.js`, `scripts/configure_typesafe_key.sh` et ce rapport.

Les modifications antérieures de Caddy, des pages publiques, du thème, de l'internationalisation et les autres modifications préexistantes de l'API sont préservées.

## État final actuel

**PARTIEL — 60 %. Clé requise avant validation authentifiée et activation.** Aucun signal historique rejoué, aucun vote/cote/message_id inventé en production, aucun résultat historique réécrit, aucun appel OpenRouter déclenché par ces vérifications et aucun secret affiché.

**EN ATTENTE D'UNE PREUVE SUR MATCH NATUREL.** Même après validation technique et déploiement, cette réserve restera tant qu'un vrai match n'aura pas traversé Jev et les étapes de diffusion observables.

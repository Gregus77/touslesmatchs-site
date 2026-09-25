# Audit TLM — absence de signal sur 48 heures

Fenêtre figée : **22 septembre 2026 16:14:00 UTC → 24 septembre 2026 16:14:00 UTC** (18:14 Paris). Collecte commencée en lecture seule. Les contrôles instantanés effectués ensuite ne constituent pas un historique de disponibilité.

## Diagnostic enregistré AVANT correction

**CAUSE PRINCIPALE :** aucun scrutin enregistré ne satisfait les critères officiels. Un seul match de championnat est arrivé au Concile : Criciúma–Operário (Serie B, Brésil), avec deux scrutins. Le premier atteint 4/5 mais échoue indépendamment sur la confiance, le classement et Recovery. Le second est à 2/5. Le calendrier est dominé par des compétitions exclues, pas par une panne générale Telegram.

**CAUSES SECONDAIRES :** siège 3 indisponible aux deux scrutins (Kimi sans contenu exploitable, repli Mistral HTTP 429); observabilité incomplète avant les appels IA; liste publique des IA incorrecte; compteur de budget administratif incomplet. Trois matchs internationaux passent les filtres statiques du code mais n'ont aucune analyse : leur cause de rejet effective n'est pas conservée.

**NOMBRE DE SIGNAUX QUI AURAIENT DÛ PARTIR : 0 démontré parmi les scrutins enregistrés.** Impossible d'affirmer combien auraient résulté de matchs jamais analysés. Aucun vote hypothétique n'est reconstitué.

**NOMBRE RÉELLEMENT ENVOYÉ : 0 signal, 0 livraison de signal sur chacun des quatre canaux.** Huit bilans (deux par canal) ont été livrés avec identifiants Telegram; ils ne sont pas comptés comme signaux.

**POINT EXACT DU FUNNEL QUI BLOQUE :** avant le Concile, filtrage du périmètre et de la fenêtre; pour l'unique match analysé, `evaluateClientSignalCriteria()` refuse Recovery, avec également classement insuffisant et confiance insuffisante. Aucun passage au registre officiel, donc aucune mise en file ni tentative Telegram de signal.

Ce diagnostic ne certifie pas le traitement de chaque match pendant les 48 heures : les journaux d'entrée exhaustifs n'existent pas et le conteneur API a été recréé le 24/09 à 00:05:13 UTC. Les logs disponibles couvrent environ 16 h 09, pas 48 heures.

## 1. Services et erreurs

| Service | État constaté | Preuves et limites |
|---|---|---|
| Docker / API | Running, zéro redémarrage du conteneur actuel, pas d'OOM | API recréée le 24/09 00:05 UTC; aucune boucle de crash observée |
| Caddy / site | Running depuis le 22/09 22:21 UTC | Quatre erreurs proxy DNS/connexion pendant la fenêtre conservée; pages publiques actuellement HTTP 200 |
| council Python | Running depuis le 15/09 | Deux sessions quotidiennes, deux décisions NOPICK, rapports administrateur envoyés |
| Hermès admin | Running depuis le 29/08 | Aucun log Docker sur la fenêtre : son fonctionnement complet n'est pas prouvé par le seul état Running |
| Healthchecks Docker | Absents des quatre conteneurs | Running ne signifie pas pipeline validé |
| Telegram | Quatre canaux accessibles | `getMe` et `getChatMember`, administrateur avec droit de publier sur les quatre canaux; aucun envoi de test |
| API-Sports | HTTP 200, plan Pro actif | 2 101/7 500 à la lecture instantanée; expiration déclarée le 03/10 |
| football-data.org | HTTP 200, zéro match retourné au contrôle | Neuf requêtes/minute restantes; six timeouts dans les logs conservés, aucun quota bloquant établi |
| OpenRouter | Lecture `/api/v1/key` HTTP 200 | Aucun appel de génération déclenché pour l'audit |

Le Concile Python est distinct du Concile live à cinq sièges. Il journalise deux refus HTTP 403 de sa passerelle, des réponses NOPICK et un template HTML absent (`/app/site/template.html`). Sa publication publique est explicitement désactivée. Ces défauts ne constituent pas la cause du rejet de Criciúma. Le template de cette ancienne sortie n'est pas réactivé : cela ne doit pas contourner le produit officiel.

## 2. Funnel — comptages, unités et motifs

Les lignes suivantes ne mélangent pas rencontres uniques, scrutins, tentatives fournisseur et messages. `ND` signifie non déterminable à partir des traces conservées, jamais zéro supposé.

| Étape | Entrées → acceptés → rejetés | Motifs / preuve |
|---|---|---|
| 1. Matchs effectivement récupérés en 48 h | ND → ND → ND | Pas d'archive exhaustive des retours live; logs API tronqués par recréation |
| 2. Football effectivement récupéré | ND → ND → ND | Le calendrier relu après coup n'est pas la preuve d'une collecte live passée |
| 3. Championnats autorisés, relecture du calendrier | 387 coups d'envoi → 20 dans le périmètre public → 367 hors périmètre | Parmi les 20, 16 coupes exclues de l'analyse; restent 1 championnat de clubs et 3 CONCACAF Nations League |
| 4. Fenêtre d'analyse effectivement observée | ND → au moins 1 match, 2 états → ND | 37′ à 0–0 puis 45′ à 0–1; aucun historique complet des fenêtres des autres matchs |
| 5. Présentés au Concile | 1 rencontre → 2 scrutins → 0 interruption de ces scrutins | `official_vote_snapshots` et journal d'évaluation |
| 6. Analyses effectuées | 2 scrutins → 2 snapshots immuables → 1 ligne courante par match | `concile_analyses` conserve le dernier état : son compte de 1 n'est pas le nombre d'exécutions |
| 7. Réponses IA exploitables | 10 sollicitations de sièges → 8 votes → 2 sièges indisponibles | 11 tentatives fournisseur, dont un repli supplémentaire |
| 8. Consensus | 2 scrutins → 1 à 4/5, 0 à 3/5, 0 à 5/5 → 1 à 2/5 | Quatre bulletins réels au premier scrutin malgré l'absence du siège 3 |
| 9. Confiance minimale | 2 → 0 à ≥80 % → 2 | 77 % puis 55 % |
| 10. Cote disponible, contrôle indépendant | 2 → 1 vraie cote → 1 indisponible | 1,57 Bet365 à 37′; 2,18 est une estimation, pas une vraie cote |
| 11. Officiellement admissibles | 2 → 0 → 2 | Recovery 1/4 puis 2/4; écart 3<5; confiance; second scrutin sans quorum |
| 12. Signaux enregistrés | 0 → 0 → 0 | Registre officiel vide sur la période |
| 13. Signaux en file Telegram | 0 → 0 → 0 | Aucun `kind=signal` dans l'outbox; timestamps en millisecondes correctement convertis |
| 14. Livraisons avec message_id | 0 → 0 → 0 | Aucun signal livré dans les quatre canaux |
| 15. Signaux visibles site | 0 → 0 → 0 | Pas de nouveau signal officiel; dernier résultat gratuit daté du 20/09 |
| 16. Signaux visibles application | 0 → 0 → 0 | Même historique API; vérification HTTP/source, pas une session Premium sur téléphone |
| 17. Résultats résolus | 1 analyse courante → 1 résolue → 0 en attente dans cette cohorte | Criciúma 0–2, sélection courante Over perdante; zéro nouveau résultat officiel |

Sur les **525 cycles de collecte journalisés** après recréation : **2 832 observations répétées → 32 dans le périmètre public → 2 800 exclues**. Ces nombres ne sont PAS des rencontres uniques. Les 162 cycles auto-concile correspondants donnent zéro candidat.

| Motif logué | Observations répétées | Couples équipes/compétition distincts |
|---|---:|---:|
| Compétition non reconnue/faible | 1 273 | 34 |
| Catégorie interdite | 678 | 13 |
| Sport hors Football | 535 | 64 |
| USA/Canada | 146 | 2 |
| Chili | 100 | 2 |
| Féminin | 68 | 1 |

Le calendrier fournisseur relu contient 496 rencontres sur les trois dates civiles (199, 202 et 95). Seulement 387 coups d'envoi appartiennent à la fenêtre stricte. Il ne remplace pas les journaux d'entrée manquants. Le rejeu utilise les fonctions extraites du code déployé sans lancer le serveur, ses schedulers ou les IA.

Les trois occasions non expliquées par la télémétrie : Turks and Caicos Islands–Montserrat (23/09 19:00 UTC), Bahamas–Saint Martin (20:00), Aruba–Antigua and Barbuda (23:00). Elles passent les filtres statiques par la sous-chaîne `nations league`; ce ne sont pas des championnats domestiques. Leur minute/statistiques live au moment des passages n'est pas disponible. Aucun signal « dû » ne peut leur être attribué.

## 3. Règles réellement actives

| Règle | Code / environnement / API |
|---|---|
| Marché | Over/Under 2,5 FT uniquement pour le Concile client |
| Analyse et diffusion | À partir de 35′, fin réelle de 1H; au-delà de 45′ preuve `first_half_verified` requise |
| Changement de score | Invalidation et réanalyse après 150 s; preuve naturelle : but enregistré à 23:15:43, second scrutin à 23:18:22 |
| Quorum | 4 concordants réels sur 5; pas d'obligation de cinquième vote valide |
| Confiance | Plancher 80 %, confirmé par env/API; majoration des ligues secondaires et autres gardes qualité possibles |
| Cote connue | 1,50–2,10; env et API concordants |
| Cote manquante | Ne bloque pas seule l'analyse ni la diffusion dans le chemin officiel; affichée indisponible; estimation non utilisée comme vraie cote |
| Classement | Écart absolu ≥5; Criciúma 5e contre Operário 8e échoue |
| Top5/Bottom5 | Calculé et annoncé par l'API, mais le tri de l'observateur ne priorise que le sport : priorité de classement NON implémentée |
| Recovery | Actif (`OU25_RECOVERY_MODE=1`); 3 indicateurs convergents sur 4, données récentes et confirmation live |
| Féminines/amicaux/jeunes/coupes/barrages | Gardes présents; `nations league` reste une ouverture internationale du filtre statique |

Les commentaires anciens, AGENTS et la métadonnée historique `analysis_15_45` sont partiellement périmés. Ils ne représentent pas les règles exécutées. Aucune de ces règles n'est modifiée pendant cette mission. La priorité Top5/Bottom5 et le statut des compétitions internationales sont signalés comme divergences, sans changement de sélection.

## 4. Les cinq IA du Concile live

| Place | Libellé / modèle réellement appelé | Sollicitations de siège | Tentatives | Votes | Vide | 402 | 403 | 429 | Timeout |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Perplexity-Web / `perplexity/sonar-pro`, OpenRouter | 2 | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| 2 | DeepSeek-V3 / `deepseek/deepseek-chat`, OpenRouter | 2 | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| 3 | Mistral-Large / `moonshotai/kimi-k2`, OpenRouter; repli `mistral-small-2603` direct | 2 | 3 | 0 | 2 | 0 | 0 | 1 | 0 |
| 4 | OpenRouter-Luna / `openai/gpt-5.6-luna`, OpenRouter | 2 | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| 5 | OpenRouter-Qwen / `qwen/qwen3.7-max`, OpenRouter | 2 | 2 | 2 | 0 | 0 | 0 | 0 | 0 |

Aucune abstention explicite enregistrée. Deux absences ne sont pas des abstentions volontaires. Aucun blocage budgétaire, 402, 403 ou timeout enregistré pour ces cinq sièges pendant la fenêtre. Le repli direct Mistral est mis à l'écart six heures après son 429; la seconde tentative Kimi a bien lieu. Les réponses brutes vides n'étant pas conservées, leur cause interne (fournisseur, longueur, format) n'est pas démontrée : pas de changement de modèle, tokens ou routage sur une supposition.

Kimi au siège 3 provient d'un override explicitement autorisé le 19/09; il est conservé. `/concile-roster` affiche à tort Perplexity, DeepSeek, Kimi, Qwen, Kimi, alors que les places 4 et 5 sont Luna et Qwen. Ce défaut de présentation ne crée pas deux votes Kimi dans les snapshots audités.

Les coûts par modèle du journal local sont des **estimations**, pas des factures. La comptabilité globale contient aussi Python, shadow et essais antérieurs : elle n'est pas attribuable intégralement à ces deux scrutins.

Estimations locales pour les deux sollicitations de chaque siège : Perplexity 0,0114 EUR, DeepSeek 0,00114 EUR, siège Mistral/Kimi 0,0152 EUR (tarif logique Mistral), Luna 0,00456 EUR, Qwen 0,0076 EUR. L'estimation Mistral ne doit pas être présentée comme le tarif réel de Kimi.

## 5. OpenRouter et budgets

- Calendrier réellement exécuté : **2 EUR les jours de semaine, 10 EUR samedi/dimanche**, journée Europe/Paris. La variable historique `OPENROUTER_DAILY_BUDGET_EUR=1.50` ne prime pas sur `OPENROUTER_PARIS_SCHEDULE=1`.
- Limites locales : 2 000 requêtes/jour, 400/modèle/jour, 120 matchs/jour; sous-plafonds configurés Concile 1,25 EUR, Hermès 0,25 EUR, tests 0,25 EUR; hard stop actif. Leurs portées diffèrent : la passerelle globale protège aussi les appels Python.
- `backgroundPaused=false`. Les anciens breakers `spike`, `daily_requests`, `daily_budget` restent archivés en base; le code courant ne les utilise pas aveuglément comme verrou permanent. Aucun `duplicate_burst` actif trouvé.
- Fenêtre : 31 lignes du registre global, dont 28 completed et 3 rejected. Charges journalisées : 0,1479797273 EUR sur la journée Paris du 23 et 0,0414357938 EUR sur celle du 24, soit **0,1894155211 EUR** dans les lignes de la fenêtre.
- Lecture du fournisseur : clé non gratuite, limite 10 USD, restant 9,958564207 USD, usage quotidien 0,041435793 USD. Ne pas confondre limite de clé, solde du compte et budget applicatif en EUR.
- Bug certain : `/admin/ai-budget-stats` affiche zéro appel/coût aujourd'hui car il ne lit que `ai_call_budget_log`, alors que six appels globaux Python sont enregistrés. Il faut exposer séparément le registre global, les réservations et le journal estimatif sans les additionner deux fois.

## 6. API-Sports et sources sportives

Plan Pro actif, limite réelle 7 500/jour; budget configuré `API_SPORTS_DAILY_BUDGET=7000`. Aucun épuisement prouvé dans les traces conservées. L'usage local ne compte pas tous les appels : 83 dans les buckets du 24/09 lors de l'extraction contre 2 101 chez le fournisseur au contrôle suivant. Les appels live directs contournent cette comptabilité locale. Ce compteur ne doit donc pas être présenté comme l'usage fournisseur complet.

Les compteurs/minute historiques API-Sports et l'usage fournisseur des 22/23 ne sont pas archivés : non certifiables rétroactivement. Le dernier contrôle HTTP expose **300 requêtes/minute, 299 restantes**, et **2 170/7 500** sur la journée. football-data.org répond, renvoie zéro match à cet instant et conserve neuf requêtes/minute disponibles. TheSportsDB renvoie zéro événement dans les logs conservés; aucun événement de secours ne peut être inventé.

## 7. Telegram, site et application

| Canal | Signaux en file / tentatives / livraisons 48 h | Bilans livrés, preuves |
|---|---|---|
| FR gratuit | 0 / 0 / 0 | 591, 592 |
| FR Premium | 0 / 0 / 0 | 178, 179 |
| RU gratuit | 0 / 0 / 0 | 65, 66 |
| RU Premium | 0 / 0 / 0 | 84, 85 |

Liste des signaux officiellement admissibles non envoyés : **vide** dans les traces. Dernière livraison de signal prouvée : 20/09 à 18:25:38 UTC. Une ancienne ligne résultat `uncertain` FR gratuit date du 12/09, hors fenêtre; aucune relance manuelle effectuée.

Accueil, Live, Résultats, application : HTTP 200. `/live-matches?cache_only=1`, `/analysis-history`, `/daily-pick-history`, `/tier-stats`, `/signal-fort-stats`, `/current-pick`, `/live-activity` répondent 200. Historique : 528 entrées filtrées; aucun nouveau signal dans la fenêtre. Le 4/5 de Criciúma n'est pas un signal admissible : son absence de l'historique client est cohérente.

Les statistiques publiques ont des populations différentes : `/tier-stats` 130 résolus, `/signal-fort-stats` 617, historique 528 entrées, activité 35 signaux publiés cumulés. Ces totaux ne doivent pas être comparés comme s'ils comptaient la même chose. Aucun résultat historique n'est réécrit. L'accueil/application lisent `/analysis-history`; Résultats ajoute `/daily-pick-history`. Pas de preuve de signal envoyé puis disparu dans cette fenêtre.

Le diagnostic `/admin/reliability` réutilise une preuve persistante du 11/09, ancien quorum 3/5 : ce n'est pas une preuve naturelle du pipeline actuel. La branche shadow multisport ajoutée localement reçoit un flux déjà filtré Football; elle ne prouve donc pas un fonctionnement multisport. Aucun changement de son routage pendant cet audit, aucune intervention sur Jev.

## 8. Corrections prévues après ce diagnostic

Corrections techniques de supervision uniquement : aligner la liste publique sur l'ordre réel des sièges et les modèles résolus, exposer la comptabilité globale dans l'endpoint budget en conservant les champs historiques, corriger la métadonnée périmée de fenêtre dans l'historique. Aucun seuil, vote, résultat, cote, plafond, marché ou modèle changé. Les causes non démontrées ne sont pas « réparées » par hypothèse.

## 9. Preuves et sauvegardes initiales

Preuves locales privées : `data/audits/2026-09-24-48h/` (répertoire 0700, fichiers 0600, ignoré par Git). Exports SQLite lus avec `mode=ro`, logs expurgés, configuration filtrée, snapshots HTTP, calendriers fournisseur, rejeu statique, copie des cinq modules déployés. Aucun fichier `.env` copié dans le rapport ni dans Git. L'empreinte du serveur déployé est identique au fichier local avant correction : `f9caf43503886c7389b54d5219e110b3fddedefe129f24853aab8e7995546201`.

Le diagnostic initial a été figé séparément dans `diagnostic-before-corrections.md` avant la première modification du code. Les éléments ci-dessous sont postérieurs.

## 10. Corrections réellement appliquées et comparaison

Déploiement API seule le **24/09 à 16:42:39 UTC**, depuis une image dérivée de l'image exacte déjà en service; aucune réinstallation de dépendances, aucun changement d'environnement, aucune reconstruction des autres services. Les deux fichiers applicatifs modifiés sont inclus dans l'image : la correction persiste lors d'une recréation de ce conteneur. Le code source est également mis à jour pour les builds suivants.

| Contrôle | Avant | Après |
|---|---|---|
| `/concile-roster` | Perplexity, DeepSeek, Kimi, Qwen, Kimi | Perplexity, DeepSeek, Kimi, Luna, Qwen, ordre réel des cinq sièges |
| `/admin/ai-budget-stats` | Zéro dans le seul journal estimatif local | Journal local conservé et identifié; `global.requests=6`, coût 0,0414357938 EUR, limite 2 EUR, restant 1,9585642062 EUR |
| Réservations du budget | Non exposées par cet endpoint | Charges, réservations incertaines, ouvertures et plancher local distingués, sans double comptage |
| Métadonnée historique | Analyse 15–45 | Depuis 35′ jusqu'à fin vérifiée de première mi-temps |
| Règles publiques | 4/5, 80 %, cote connue 1,50–2,10, écart 5 | Réponse JSON strictement identique |
| Analyses/votes/signaux historiques de la fenêtre | 1 analyse, 2 snapshots, 11 tentatives, 0 signal | Identiques après redémarrage, comparaison de toutes les colonnes exportées |
| Registre global de la fenêtre | 31 lignes | Identique après redémarrage |
| Site / council / Hermès | Running | Running, dates de démarrage inchangées |

Le correctif ne prétend pas rendre Kimi disponible : deux réponses vides ne permettent pas d'établir une réparation précise sans autre preuve. Aucun appel de test payant, changement de modèle, augmentation de tokens ou suppression de breaker n'a été effectué. Les gardes métier bloquants restent actifs.

## 11. Tests et limites de validation

Réussis :

- Syntaxe Node des deux modules modifiés et des tests; `git diff --check`.
- Nouveau test de supervision : coûts Python, réservations incertaines, refus non facturés, borne Paris, absence de double comptage, lecture sans modification des lignes, roster réel.
- 33 assertions du garde-fou IA, zéro échec; tests de réservation globale et de coûts fournisseur.
- Fenêtre 35′/45′/48′ en 1H, refus HT/2H/FT et score modifié; invalidation/réanalyse et immutabilité du snapshot officiel.
- Nouveau test du contrat Telegram courant : quatre destinations, preuves positives, reprise RU indépendante après recréation du publisher, dédoublonnage, expiration à HT, aucun résultat transformé en preuve de signal.
- 36 scripts inline des réponses publiques compilés sans exécution (accueil 13, Live 8, Résultats 3, application 12).
- Douze endpoints locaux HTTP 200 après redémarrage; roster, règles et historique également vérifiés à travers Caddy HTTPS. Aucun `ReferenceError`, `SyntaxError`, `Cannot find module` ou `TypeError` au démarrage observé.
- Comparaison des empreintes du code source avec le code en conteneur; règles publiques et données historiques de la fenêtre inchangées.

Échecs / limites conservés explicitement :

- Le premier lancement SQLite sur l'hôte ne trouve pas `better-sqlite3`; tests réexécutés dans des conteneurs isolés avec les dépendances de production, réseau désactivé et aucune base client montée.
- Le test historique `test_telegram_recap_snapshot.js:41` attend une exception sur un marché inconnu; le module actuel le conserve en attente. **Même échec reproduit sur l'image d'avant correction.** Ce test n'a pas été maquillé pour passer.
- L'option SQLite de `test_telegram_client.js` ne fournit pas le validateur de fraîcheur devenu obligatoire et attend quatre envois alors que le défaut sécurisé en refuse quatre. Le nouveau test fournit explicitement le validateur simulé et couvre le contrat actuel; le validateur réel est testé séparément par `test_first_half_delivery_20260919.js`.
- Pas de validation visuelle dans un navigateur authentifié Premium ni sur un appareil mobile installé. La cohérence vérifiée porte sur HTTP, code consommateur et données partagées, pas sur chaque cache d'appareil.
- Impossible de reconstituer exactement les entrées et rejets live avant 00:05 le 24/09, ni de justifier rétroactivement les trois rencontres CONCACAF sans trace.

## 12. État final et preuve naturelle

**État final : PARTIEL.** Services et transport accessibles, corrections de supervision déployées et vérifiées. Les refus du seul match analysé sont expliqués et conformes aux gardes actifs. Le troisième siège reste à prouver, l'historique d'entrée est incomplet, et les divergences Top5/Bottom5, internationaux, comptage API-Sports et shadow multisport sont documentées sans réécrire les règles ou le routage.

**EN ATTENTE D'UNE PREUVE SUR MATCH NATUREL.** Il faut observer un match réellement admissible de bout en bout : statistiques synchronisées → votes réels → quorum et critères → snapshot officiel → quatre files → réponses Telegram avec identifiants → même signal site/application → résultat. L'absence de match pendant les contrôles n'est pas une preuve de fonctionnement. Une preuve ancienne à 3/5 n'est pas réutilisée comme preuve actuelle à 4/5.

## 13. Fichiers modifiés et sauvegardes

Fichiers de cette mission uniquement :

1. `scripts/api_server.js` — roster et métadonnée historique, modifications ciblées.
2. `scripts/ai_budget_guard.js` — exposition du registre global en lecture; aucune logique de blocage changée.
3. `scripts/test_audit_observability_20260924.js` — nouveau test isolé.
4. `scripts/test_audit_telegram_20260924.js` — nouveau test isolé.
5. `docs/audits/2026-09-24-48h-sans-signal.md` — ce rapport.
6. `CHANGELOG.md` — ajout de passation uniquement.

Les modifications déjà présentes dans Caddy, les pages publiques, l'API et les scripts tiers ne sont pas remplacées ni attribuées à cette mission. Aucun fichier de Jev ou de `council/` modifié.

Sauvegardes : `data/audits/2026-09-24-48h/before/` contient les deux fichiers source et le CHANGELOG avant modification; copie du diagnostic initial, code déployé initial, preuves avant/après, patch exact et reçu de déploiement dans le même dossier privé. Aucune correction de base effectuée, donc pas de restauration ou réécriture SQLite.

Image de retour arrière : `touslesmatchs-api:audit-before-20260924` (`sha256:6780f1d59729f7b1616e2d4c4f7d8f6a1f8eab20f503c8a0be3f5dbd4eb8eaeb`). Image déployée : `touslesmatchs-api:audit-48h-20260924` (`sha256:498bd03b64fab631ba69f613b5d0120e47ba19f291c54dc0bdc600a57fbf773d`). Seuls `/app/server.js` et `/app/ai_budget_guard.js` diffèrent dans l'image.

## 14. Confidentialité

**Aucun secret affiché.** Aucune clé, mot de passe, token ou `.env` dans le rapport/commit. Les preuves sont privées et expurgées; le contrôle contre les valeurs secrètes de l'environnement actif ne trouve aucune correspondance dans les fichiers collectés. Aucun message client de test ni appel de génération OpenRouter lancé par cet audit.

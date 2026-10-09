# Reprise vérifiée du 9 octobre 2026

Worker et unités déjà installés, améliorés après a6030b6. 27 tests réussis ; cycle fictif local marqué TEST NE PAS DIFFUSER, aucun envoi public. Timer social désactivé et enabled=false en attente de validation explicite. Voir data/social-publication/report.json pour les blocages actuels. Clé OpenAI corrigée dans le fichier privé du service ; budget images zéro. Metricool serveur absent. Cartes FR/EN et bilans SEO déjà publiés avec reçus. Le document ancien ci-dessous est historique et ne décrit pas l’état actuel.

---

# Publication serveur — livraison opérateur du 9 octobre 2026

**Installation partielle vérifiée sur le VPS le 9 octobre 2026.** Le timer est actif, les pages FR/EN et l’export canonique fonctionnent. Les nouveaux visuels et la diffusion automatique Metricool restent bloqués. Le reste de ce document décrit la livraison initiale de la mission ; consulter [checkpoint-vps-20261009.md](checkpoint-vps-20261009.md) pour les preuves de production et les étapes restantes.

## Composants et limites exactes

- `scripts/api_server.js` : export additionnel `tlmSocialExport` depuis `tlmScannerTrack`, `tlmScannerResults` et `resolveGoal05SignalResults`. Activation seulement si `/data/social-publication.enabled` existe. Le fragment testé est aussi conservé dans `scripts/social/export-source.inc.js` ; il n'est pas importé au runtime. Aucun changement de Dockerfile nécessaire.
- `/opt/touslesmatchs/data/social-source.json` : fichier atomique factuel, matchs scanner football API-Sports Top5/Bottom5 et whitelist existante. Aucun rating scanner, vote, cote, WIN/LOSS ou ancien historique O/U exporté. Horodatage réel du cache classement, jamais renouvelé artificiellement.
- `scripts/social/pipeline.py` : Python 3.10+, SQLite séparée, Pillow, fontes DejaVu et Node pour réutiliser `telegram_client.destinations` et `bookmakers.config`. Ne charge pas `.env`. Pas de requête API-Sports ; pas de scheduler sportif ni nouveau vote. Le manager systemd injecte l'environnement existant à l'exécution.
- `config/social-publication.json` : configuration publique, inactive, modèle et budget non inventés. Pays/drapeaux FR, DK, KW fournis. Autres pays bloqués tant que leur correspondance ISO et leur dessin de drapeau n'ont pas été ajoutés et testés. Ce n'est pas une nouvelle whitelist sportive.
- `systemd/tlm-social-publication.{service,timer}` : cycle lecture/résolution toutes les cinq minutes Paris, examen de nouveaux candidats une fois par tranche de quatre heures Paris, reprise après arrêt ; verrou exclusif du worker. Le scanner existant continue son propre rythme.
- `public/index.html`, `public/app.html` : un lien visible ajouté dans chaque footer ; `public/sw.js` : nouvelle version du cache. Pas de réécriture. La PWA est `public/app.html`, `manifest.webmanifest` démarre sur `/app?src=pwa`. Caddy utilise `/srv`, monté depuis `/opt/touslesmatchs/public` dans le Compose du dépôt. **Montage VPS non inspecté ici.**
- `public/social/index.html` : page d’attente factuelle avant activation, pour éviter un lien vers le fallback accueil.
- Site runtime : `/social/current/content.json` et pages FR/EN forment une version complète ; le lien symbolique `current` bascule atomiquement. Anciennes versions conservées pour rollback. Bilans datés, titres/meta, liens de langue, CTA Premium. Les observations ne vont jamais dans les KPI. Pas d'image de bookmaker imitée.

## Contrats de vérité

Pré-match = SURVEILLANCE + équipe ciblée +0,5 (au moins un but). Pas de cote requise. Fraîcheur scanner maximum quatre heures ; heure Paris explicite dans les deux langues. Une carte AVANT devient une archive après le coup d'envoi. Avant chaque POST Telegram, l'heure est revérifiée après la génération d'image ; aucun rattrapage prématch après kickoff.

APRÈS exige une archive AVANT enregistrée avant kickoff et un résultat final FT/AET/PEN API-Sports de la même fixture. Scores inconnus/booléens/strings refusés. Pertes et réussites suivent exactement le même chemin. Par défaut : observation positive/négative, pas WIN/LOSS/profit. WIN/LOSS nécessite la lecture **readonly** de `goal05_signal_registry`, `goal05_signal_results` et `telegram_signal_deliveries`, critères V2, cote fraîche lors de décision, décision et message Telegram prouvés avant résolution, score final concordant. Aucun profit n'est calculé, aucune mise n'étant établie. Le worker ne décide ni ne rediffuse les signaux live : le moteur existant les conserve.

SQLite publication : unicité match/phase/langue/destination. Avant tout POST, réservation transactionnelle en état `uncertain`, conservée même après crash. Telegram publié uniquement sur `ok=true` + entier positif `message_id`. Metricool publié uniquement sur statut réseau PUBLISHED + URL + id ; PENDING reste pending. Aucun POST automatique répété après état uncertain/pending. Une destination en échec ne bloque pas les autres.

Le fichier `report.json` contient blocages et liste `attention` pour l'opérateur/Hermès. Le lecteur de supervision doit le surveiller : pas de nouvelle boucle de notifications admin installée ici. Pour Telegram uncertain, obtenir une preuve du canal avant toute résolution manuelle ; **ne pas effacer une ligne pour forcer un renvoi**. Pour Metricool pending, le prochain cycle lit le post par id, sans nouveau POST. Une réponse perdue sans id nécessite réconciliation humaine, jamais un renvoi aveugle.

## Images OpenAI et budget

API officielle : https://developers.openai.com/api/reference/resources/images ; POST `/v1/images/generations`, modèle configurable, PNG base64. Le fond commun à la paire FR/EN est demandé à l'API ; textes et composition sont posés déterministiquement, pour éviter chiffres et traductions inventés. Réponse PNG, prompt, modèle, provenance, date, usage et empreinte conservés dans l'état privé. Le rendu offline utilise un fond neutre, **pas une prétendue image OpenAI**.

L'opérateur doit choisir un modèle accessible supportant `size=1024x1536`, `quality=low`, `output_format=png`, fixer une réservation **majorante vérifiée** en centimes EUR par requête et un plafond quotidien Paris. Valeurs initiales zéro : aucun appel autorisé. La réservation est conservée même après timeout ou erreur ; elle limite le coût autorisé estimé, pas une facture réellement mesurée. Vérifier tarifs/change et limite du projet API pour une borne monétaire réelle. Une requête maximum par match/phase, partagée FR/EN ; changement de prompt ne déclenche pas de nouvelle facturation. Coupe-circuit SQLite persistant sur 401/402/403/429, jamais remis à zéro automatiquement. Réarmement seulement après diagnostic opérateur, sans changement de secret par ce composant. **L'abonnement ChatGPT ne fournit pas les crédits API.**

## Destinations et accès manquants

1. Serveur : installer le worker et les unités, créer l'utilisateur `tlm-social`, accès lecture export et tables officielles, accès écriture uniquement état + `/public/social` + `/public/media/social`. Pillow/DejaVu/Node requis. Le service doit recevoir `OPENAI_API_KEY` existante et les destinations/token Telegram canoniques via l'environnement, sans les imprimer. Leur disponibilité/validité n'a pas été vérifiée ici.
2. OpenAI : modèle accessible, tarification majorante, budget et crédit API ; test PNG réel privé à réaliser avant toute activation. Aucun secret consulté.
3. Telegram : droits `sendPhoto` sur Gratuit/Premium FR à vérifier sans faux signal. FR et EN vont dans ces destinations canoniques ; les destinations RU sont exclues du worker et restent intactes. Traduction des nouvelles cartes RU non implémentée.
4. Metricool serveur : `METRICOOL_API_TOKEN`, `METRICOOL_USER_ID`, `METRICOOL_BLOG_ID=7314226`, abonnement avec accès API et connexions réseau vérifiées. Aucune valeur renseignée ni session/cookie utilisée. Le MCP du poste ne fournit aucun accès serveur. Documentation officielle consultée : https://app.metricool.com/resources/apidocs/index.html et https://app.metricool.com/api/swagger.json ; authentification X-Mc-Auth + userId/blogId ; ScheduledPost.media tableau d'URL, ProviderStatus.status/publicUrl. Revalider ce contrat par la réponse réelle du compte avant d'activer `metricoolEnabled` et `metricoolVerifiedNetworks`.
5. **Metricool pré-match bloqué** : la programmation n'offre pas de garantie documentée de publication avant kickoff. Aucun post prématch n'est programmé par ce worker. Bilans terminés seulement via l'adaptateur ; le reçu PUBLISHED est distinct de la création du post. Il reste à établir un mécanisme fournisseur garantissant l'expiration avant kickoff pour compléter ce besoin.
6. Instagram @touslesmatchs / Facebook marque 7314226 : connexions rapportées par la mission, non revérifiées. Pas de mention « lien bio » tant que `instagramBioVerified` n'est pas vrai. `@parrainagebanque` n'est jamais une destination. YouTube, TikTok et Snapchat non implémentés/activés : vidéo adaptée + connexion YouTube à prouver, TikTok attend eSIM, Snapchat accès inconnu. PNG n'est pas une vidéo.
7. Production : droits d'installation, montage Caddy réel, HTTP public des pages/images, réception Telegram naturelle et URL Metricool encore à prouver par l'opérateur. Aucun accès VPS demandé/utilisé ici.

## Conditions commerciales persistées

Premium 14,90 EUR/mois ; CTA principal https://www.touslesmatchs.com/api/premium-checkout?lang=fr (validation LIVE rapportée par la mission, non retestée ici). Pas de premier mois gratuit annoncé, prix bloqué, future hausse, promesse de gains ou de volume. Le composant réutilise Winamax/Unibet/PMU/Betclic depuis `scripts/bookmakers.config.js` à l'exécution ; boutons secondaires marqués Sponsored. Parrainage/paramètre URL ≠ affiliation ou commission certifiée. Aucun partenariat ParionsSport ajouté. 18+ et joueurs-info-service.fr dans chaque carte.

## Plafonds constatés dans le code, pas valeurs VPS certifiées

| Chemin | Limite constatée |
|---|---|
| API-Sports | `API_SPORTS_DAILY_BUDGET` défaut 90, rationnement horaire dynamique |
| OpenRouter | défaut 100 requêtes/jour et 30 matchs/jour dans `ai_budget_guard.js` |
| Goal05 | `GOAL05_MAX_DEEP_CANDIDATES` défaut 3/cycle ; cote fraîche défaut 120 s ; signal expire en 2 min |
| Scanner | horizon 18 h, 24 fixtures examinées, 8 lignes retournées, scanner existant toutes les 2 h |
| Cache | upcoming 30 min (réutilisé par scanner jusqu'à 2 h), classement 6 h ; le worker refuse >4 h |
| Résolution | 12 lignes par passage ; officiel toutes les 5 min, scanner dépend de son scheduler existant |
| Telegram canonique | 40 éléments par flush, pas de quota quotidien dans `publishStrictGoal05Signals` ; ce n'est pas une preuve de réception propriétaire illimitée |
| Nouveau worker | budget images zéro jusqu'à configuration ; aucun plafond quotidien de réception Telegram ajouté |

Attention audit : `fetchStandings` et certains appels du scanner existant utilisent directement `httpGet`, sans réservation `apiSportsBudgetOk` au point d'appel. Le worker n'ajoute aucun appel, mais cela empêche de certifier ici un budget global inviolable de la collecte existante. Ne pas promettre « sans limite ». Les anciens plafonds de paliers ne sont pas supprimés. Aucun quota d'analyse/données modifié.

Autre conflit préexistant : `TLM_SCANNER_FREE_END=2026-11-07` et les annonces scanner de gratuité ainsi que certains libellés scanner WIN/LOSS sont toujours dans le moteur historique. Cette livraison ne reprend pas ces textes ; **l'opérateur doit traiter ce conflit commercial avant activation globale**, sans changer les règles sportives.

## Tests et commandes opérateur

```sh
python3 -m unittest discover -s tests/social -v
node scripts/test_social_source_20261009.js
node scripts/test_goal05_v2_20261006.js
node scripts/test_goal05_v2_integration_20261006.js
node scripts/test_goal05_policy_20261005.js
node scripts/test_current_product_goal05_20261005.js
node scripts/test_goal05_telegram_odds_20261008.js
python3 scripts/social/pipeline.py offline
python3 scripts/social/pipeline.py once --output reports/social-preview
python3 scripts/social/pipeline.py status
```

`offline` produit des fixtures fictives et deux phases FR/EN, interdit `--publish`, refuse le répertoire public. `once` sans `--publish` est aussi TEST, sans aucun appel externe, images neutres et état séparé. `once --publish` est la commande réelle du service, bloquée par `enabled:false` par défaut. Ne jamais réutiliser le répertoire de test comme état de production.

Tests effectués : 26 tests Python réussis, dont HTTP local 200 et cycle quatre cartes, lecture SQLite officielle sans mutation, anti-doublon, timeout, coupe-circuit ; test export JS réussi ; cinq suites JS listées réussies ; `node --check` réussi. `npm test -- --watchAll=false --passWithNoTests` tenté : **bloqué, react-scripts absent**. `systemd-analyze verify` retourne 0 pour les unités mais signale des avertissements dans un drop-in `tlm-hourly-director` extérieur au dépôt ; pas corrigé. Les quatre services Docker ne sont pas démarrés ici et Compose/Caddy/Dockerfile sont inchangés.

## Migration, installation ciblée, vérification et rollback

Avant installation opérateur : comparer HEAD livré `a51fa3b` + diff avec le SHA courant de production et les modifications concurrentes ; ne pas écraser une branche ou un fichier divergent. Appliquer seulement les ajouts ciblés. Sauvegarder API, deux pages, SW, config, unités et destination `social` si existante. Sauvegarder la SQLite publication avec l'API SQLite backup, pas une simple copie d'une base WAL ouverte. Aucune migration/écriture de la base métier par le worker.

Créer les trois répertoires autorisés avant l'unité, permissions minimales et accès readonly aux fichiers DB/WAL/SHM existants. Faire la revue de l'environnement injecté sans afficher ses valeurs. Après application de l'API selon procédure de déploiement opérateur, créer le marqueur vide `data/social-publication.enabled` pour activer **l'export seul**, laisser `enabled:false`, attendre une collecte naturelle. Vérifier les sources et résultats. Faire un `once` en preview. Choisir modèle/budget et valider une image privée ; inspecter les deux langues. Puis seulement configurer l'activation et démarrer le timer par l'opérateur. Aucun de ces gestes n'a été exécuté par cette mission.

Au premier lancement réel, `seed_october9` importe les reçus fournis par Greg : Gratuit 623, Premium 210 et Metricool 391683938 (URLs dans le code). Portée : AVANT/FR pour les deux fixtures 1549031 et 1622650 ; cela bloque tout doublon FR. Faits archivés du 09/10 uniquement : Nordsjaelland–Odense 19h00 Paris, Kazma–Al Arabi 19h05 Paris ; contrôle fourni 01h45 UTC. Pas de nouvelle validation des rencontres, pas de reçu EN inventé. Comparer au fichier VPS `/opt/touslesmatchs/reports/watchlist-telegram-fr-20261009.json` avant activation. EN reste à produire/envoyer depuis une source fraîche avant kickoff ; sinon laisser cette étape non publiée. Une traduction APRÈS est bloquée sans son AVANT archivé.

Contrôles VPS **encore à exécuter** : `docker compose ps`, logs API expurgés, montage Caddy `/srv` par inspect limité aux mounts (ne pas imprimer l'environnement), `systemctl status tlm-social-publication.timer`, HTTP 200 et contenu exact `/social/current/fr.html`, `/social/current/en.html`, `/social/current/content.json`, `/app`, `/media/social/<carte>.png`. Comparer empreinte HTTP/local pour éviter le fallback Caddy vers l'accueil. Confirmer ensuite message_id et URL réseau naturels. Ce n'est qu'alors que collecte → image → diffusion → site/app pourra être certifié.

Rollback : arrêter uniquement le timer/service social ; retirer le marqueur d'export et remettre `enabled:false`. Restaurer les fichiers ciblés sauvegardés, vérifier les quatre services. Repositionner atomiquement `/social/current` sur l'ancienne version conservée. **Conserver état, réservations, coupe-circuit et reçus** : restaurer une vieille DB publication pourrait provoquer des doublons. Aucun effacement de posts/messages, secrets, historiques ou résultats métier. Les anciennes versions du site ne sont pas purgées automatiquement.


## Manifeste exact des fichiers de cette livraison

Modifiés : `AGENTS.md`, `CHANGELOG.md`, `docs/handoff/reprise-session-active.md`,
`scripts/api_server.js`, `public/index.html`, `public/app.html`, `public/sw.js`.

Ajoutés : `scripts/social/pipeline.py`, `scripts/social/export-source.inc.js`,
`scripts/social/.gitignore`, `scripts/test_social_source_20261009.js`,
`tests/social/test_pipeline.py`, `tests/social/offline.json`, `tests/social/.gitignore`,
`config/social-publication.json`, `systemd/tlm-social-publication.service`,
`systemd/tlm-social-publication.timer`, `public/social/index.html`,
`public/social/.gitignore`, `reports/social-offline/.gitignore`,
`docs/social/README.md`, `docs/social/acceptance.md`,
`docs/superpowers/plans/2026-10-09-social-autonomy.md`.

Artefacts de test reproductibles non suivis : quatre PNG, SQLite TEST et pages
sous `reports/social-offline/`. Aucun de ces artefacts ne doit être copié dans
l'état de production. Les 25 scripts inline des deux pages ont été contrôlés avec
`node --check` ; syntaxe valide.

Le bilan exige aussi un reçu AVANT publié sur la même destination/langue. Sans ce reçu, il reste `before_unpublished` ; une panne initiale ne doit pas produire un faux couple AVANT/APRÈS. Cela limite notamment Metricool aux AVANT déjà publiés et prouvés (migration FR du 9 octobre), tant que la deadline prématch n’est pas prise en charge. Le site refuse sa première publication AVANT à moins de 30 secondes du kickoff et conserve seulement les archives déjà visibles ou diffusées avec preuve.


## État opérateur vérifié du 9 octobre
OpenAI gpt-image-1 : HTTP401 invalid_api_key ; ne pas répéter la requête tant que l’accès n’est pas remplacé. Accès serveur Metricool absent. Migration EN vérifiée : Telegram Gratuit624/Premium211, Metricool391699655 PUBLISHED Facebook et Instagram, URLs conservées dans le seed. Cartes originales FR/EN déjà hébergées et visibles sur le bilan du site ; aucune nouvelle génération API ni commission certifiée.

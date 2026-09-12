# Bilan Telegram et état du signal figé — 12 septembre 2026

Le bilan client lancé à 22 h reprenait la veille et sélectionnait la date UTC brute d'une analyse réécrivable. Il est remplacé par un seul déclenchement à partir de 23 h 45 Europe/Paris, jusqu'à minuit, portant sur la journée civile courante. Les bornes UTC sont calculées séparément pour chaque minuit local (23/24/25 heures selon le changement d'heure). Le bilan administrateur de 22 h reste séparé.

Une transaction SQLite immédiate revendique le jour dans `client_recap_runs` et met toutes les pages FR/RU en file. Une erreur annule la revendication et les pages ensemble. Un autre processus ou redémarrage ne peut pas recréer le bilan. Les reprises réseau utilisent l'outbox existante par destination. Les résultats non résolus restent « en attente », jamais des défaites inventées ; aucune absence de signal n'est maquillée en gain. Les pages sont numérotées au-delà de dix lignes.

Les lignes proviennent de livraisons `ok=1` avec un identifiant Telegram entier strictement positif, par canal et date de livraison, jamais des anciens marqueurs. La sélection est celle de la livraison ; le résultat est recalculé sur les scores finaux connus pour cette sélection. Un signal hors de cette journée ne rentre pas dans le bilan parce que son analyse a changé de date.

Dès qu'un premier signal est mis en file, `client_signal_snapshots` fige minute, scores initiaux, sélection, cote réelle disponible et date UTC. L'insertion du snapshot et de l'outbox est atomique. Les langues suivantes réutilisent ces données. Un trigger SQLite protège ces colonnes dans l'analyse contre toutes les mises à jour ultérieures ; les scores finaux et la résolution restent modifiables par le chemin de résolution existant. Une reprise ne régénère pas le texte avec une minute plus tardive. Aucune modification de seuil, modèle ou marché.

## Audit historique du 11 septembre

| Match | FR Gratuit | FR Premium | RU Gratuit | RU Premium | Résultat final |
|---|---:|---:|---:|---:|---|
| Nürnberg — Hannover | 556 | 133 | 29 | 39 | 2–1, Over 2,5 gagné |
| Darmstadt — Bielefeld | aucune preuve | 134 | aucune preuve | 40 | 2–1, Over 2,5 gagné |
| Copenhagen — Horsens | aucune preuve | 135 | aucune preuve | 41 | 2–0, Over 2,5 perdu |

Les identifiants ci-dessus sont présents dans `telegram_signal_deliveries` et corroborés par les événements `delivery` du journal, avec `delivery_ok=1`. Aucun identifiant créé ni conversion Standard/Elite. Les lignes existaient déjà : leur sélection dans le bilan est corrigée, pas leur preuve réinventée.

Le message public Nürnberg 556 est lisible à https://t.me/TousLesMatchs_Free/556 : 21e minute, 1–1, trois votes et confiance 82. Le journal à 16:52:59 UTC le corrobore. La ligne d'analyse avait été réécrite à 45 minutes. La cote du signal initial n'est pas visible dans le teaser et n'est pas récupérable dans la preuve examinée : ne pas réutiliser 1,36 de la réanalyse en la présentant comme cote envoyée. La réparation historique trace l'ancien état, restaure uniquement les données prouvées et laisse cette cote inconnue.

Bilan corrigé attendu : FR/RU Premium 2 gagnés, 1 perdu ; FR/RU Gratuit 1 gagné, 0 perdu. Il remplace les quatre messages erronés déjà prouvés (559, 137, 32, 43), par édition de ces messages, sans nouvel envoi de signal. Chaque édition doit être confirmée par Telegram et journalisée séparément avant de déclarer la correction effective.

## Vérifications

Suite entière exécutée sur main puis candidat dans des conteneurs sans réseau ; aucune nouvelle régression. Tests dédiés : UTC, minuit Paris, été/hiver et jours de 23/25 h, suppression du déclenchement client de 22 h, snapshot figé avant livraison, refus de réécriture, FR/RU, identifiants nuls/négatifs, pertes, attente, redémarrage, deux connexions SQLite, reprise russe et rollback transactionnel.

Les tests historiques du front échouent déjà sur main (offres, ancien tunnel, chargement, porte d'accès homepage, version PWA). Le test historique de fenêtre cherche une signature désormais absente ; non désactivé. Les tests nécessitant `node:sqlite` sont aussi exécutés avec Node 22 ; la réparation de données publique échoue déjà sur main. Le garde-fou de budget passe avec un répertoire de test inscriptible. Le test React est exécuté séparément avec les dépendances VPS. Le test React échoue sur main comme sur le candidat (`IntersectionObserver` absent de son environnement) ; il n’est pas désactivé. Les échecs ne sont pas déclarés comme des succès.

Déploiement limité à `scripts/api_server.js` et `scripts/telegram_client.js` : image dérivée de l'image API déjà exécutée, sans réinstallation des dépendances. Sauvegardes SQLite cohérentes et fichiers/configuration protégés, comparaison des empreintes avant copie. Aucun changement aux fichiers locaux du site, à Stripe, aux cinq IA ni à BTTS.

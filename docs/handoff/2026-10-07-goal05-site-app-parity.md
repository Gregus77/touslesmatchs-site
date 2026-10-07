# Statistiques +0,5 et application identique au site

## Source et périmètre

- Base vérifiée sur le VPS : `07bb876639ca5630327ec802b6b3de24f1395df1`.
- Le conteneur site sert `/opt/touslesmatchs/public` comme `/srv`.
- Branche source isolée : `codex/goal05-stats-app-parity`. Publication autorisée par Greg et exécutée le 7 octobre 2026.
- Aucun changement visuel de l’accueil, des offres, de Stripe, de Telegram, des règles sportives ou des données.
- Ne pas intégrer la refonte rejetée `codex/salle-decision-ia2`.

## Modifications

- `public/performances.html` garde le design courant et ses anciens indicateurs. Le détail +0,5 affiche les lignes officielles et scanner avec provenance explicite, équipe ciblée, état et cote disponible.
- `public/js/goal05-results.js` suit le vrai contrat `/api/goal05/stats` : officiel `team/odd`, scanner `target_team/odd_at_pick`. Les contenus sont échappés. Cote manquante reste manquante; aucun ROI inventé.
- `public/app.html` devient l’entrée des mêmes pages que le site. L’APK Android existant ouvre cette URL; les liens `tab=perf/live/me/pick` restent reconnus. Le stockage de session n’est ni effacé ni recopié dans les URL.
- Les clés historiques d’accès ne sont pas des sessions OTP du compte moderne : une reconnexion au compte peut être nécessaire. Aucun changement du mécanisme d’authentification serveur.
- Correction ciblée sans changement visuel : l’accueil reconnaît `tlm_session_token`; le compte conserve le plan renvoyé par le serveur seulement lorsque le statut est actif. Cela évite la boucle de connexion des abonnés OTP. Les autorisations serveur ne changent pas.
- Accord de Greg : conserver les alertes popup + son. Module partagé sur accueil, direct, résultats et compte; activation/désactivation et test sonore dans Mon compte. Le choix existant `tlm_signal_alerts` est conservé.
- Alertes uniquement après autorisation serveur de `/api/goal05/latest`, pour un signal officiel actif reçu depuis moins de deux minutes. Aucun calcul de pronostic côté navigateur et aucune observation scanner transformée en signal. Les réponses liées à une ancienne session sont ignorées; les requêtes bloquées sont annulées après dix secondes.
- Anti-doublon par compte et signal entre pages. Web Locks rend le traitement atomique entre onglets compatibles; stockage bloqué = aucune alerte plutôt que répétitions. À défaut de Web Locks, dédoublonnage par stockage local sans garantie atomique inter-onglets.
- Le bridge Android existant et le service worker sont inchangés. L’ancienne activation Web Push de `app.html` appelait des routes absentes du serveur de référence; ne pas la présenter comme fonctionnelle. Les popups/sons sont validés en navigateur ouvert et visible; ils ne sont pas des notifications lorsque l’application est fermée. Activation/réception native et audition sur téléphone réel restent à vérifier.

## Vérifications

- Quatre tests obligatoires Goal05 V2, politique et produit : réussis.
- Huit tests comportementaux de rendu/redirection : réussis, avec reproduction puis correction du contrat officiel et des signaux sans résultat final.
- Sept tests d’alertes : autorisation, fraîcheur, identité, anti-doublon, stockage bloqué et reprise après blocage réseau. Réussis, y compris reproduction du blocage sans délai puis correction.
- Chrome réel : activation volontaire, popup mobile sans HTML exécuté, oscillateur audio réel démarré après geste utilisateur, absence de répétition entre pages, désactivation, réponse verrouillée et signal ancien ignorés. Réussis. Cela ne prouve pas qu’un utilisateur entend le son sur son téléphone.
- Navigateur Chrome réel, vues 1440 et 390 pixels : statistiques séparées, gains/pertes/attente, cote absente, conservation du total historique 523 (fixture), erreur API explicite, app vers accueil/résultats et stockage de session conservé : réussis.
- Parcours OTP via vrais formulaires et réponses serveur fictives isolées : compte Premium vers accueil et clic analyse autorisé; compte gratuit encore intercepté. Réussi. Aucun email réel envoyé.
- Les captures sous `work/` et les jeux de données navigateur sont uniquement des tests locaux, pas des preuves de résultats sportifs réels.
- `npm test -- --watchAll=false` ne démarre pas : `react-scripts` absent de cette copie. Ne pas appeler la suite générale réussie.

## Publication exécutée et vérifiée

- Version publique exacte : `63505d9fa9fc5eb4cb55bb28c99975e405dc93ac`.
- Branche VPS dédiée : `codex/goal05-site-app-live-20261007T162036Z`. La branche `main` demeure à la base `07bb876639ca5630327ec802b6b3de24f1395df1`.
- Sauvegarde : `/opt/touslesmatchs-backups/goal05-site-app-20261007T162036Z`, avec archive et empreintes des cinq pages existantes, commit/branche de base et état préalable. Les quatre nouveaux fichiers étaient absents de la base et restent récupérables par Git.
- Neuf fichiers publics seulement : `app.html`, `performances.html`, `index.html`, `dashboard.html`, `live-ia.html`, `js/app-site-parity.js`, `js/goal05-results.js`, `js/signal-alerts.js`, `css/signal-alerts.css`. Aucun remplacement global, aucune fusion de la refonte rejetée, aucun redémarrage ou rebuild des quatre conteneurs métier.
- `scripts/test_goal05_public_release_20261007.py` vérifie les neuf empreintes HTTP contre les blobs Git exacts de la version publiée. Contrôles Chrome en ligne à 1440 et 390 pixels, redirection réelle de l’entrée Android vers accueil/résultats, en-tête et contrôles d’alertes du compte : réussis. Les requêtes non-GET et les API hors liste de lecture sûre sont bloquées; aucun email, paiement, pronostic ou notification réelle déclenché.
- Données réelles après publication : officiels 0; scanner 8 (5 gagnés, 1 perdu, 2 en attente, 83,3 % sur les 6 résolus); verts 6 (4 gagnés, 2 en attente). Aucune cote disponible dans ces observations : aucun ROI ajouté. Ancien historique : 523 résolus, 427 gagnés, 96 perdus, 82 %; 33 en attente séparés. Empreintes de l’API et du thème inchangées.
- Deux erreurs de l’accueil restent présentes : accès à `minute` lorsque le match est absent dans `heroGoal05State`, et double déclaration de `i18n`. Toutes deux reproduites avec la page originale `07bb876` sous le même contrôle navigateur; aucune nouvelle erreur détectée dans le parcours ciblé. Ne pas présenter l’accueil comme exempt d’erreurs ni les corriger silencieusement hors périmètre.
- Limite restante : validation sur APK physique, reconnexion éventuelle, affichage et son sur téléphone réel. Notification native/application fermée non validée. Les tests navigateur ne remplacent pas ce contrôle.

## Retour arrière ciblé

- Vérifier d’abord HEAD et absence de modifications suivies concurrentes sur le VPS. Ne jamais forcer, nettoyer ou réinitialiser la copie.
- Si `main` est toujours au commit de base indiqué, `git switch main` rétablit les cinq pages antérieures et retire les quatre fichiers ajoutés par cette branche. Si `main` a évolué, revenir sans forcer au commit de base exact après contrôle des changements concurrents.
- L’archive des pages et les empreintes sont disponibles dans la sauvegarde ci-dessus. Aucun retour arrière de base de données, paiement ou configuration n’est nécessaire.

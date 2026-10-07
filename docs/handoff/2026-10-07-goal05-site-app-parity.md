# Statistiques +0,5 et application identique au site

## Source et périmètre

- Base vérifiée sur le VPS : `07bb876639ca5630327ec802b6b3de24f1395df1`.
- Le conteneur site sert `/opt/touslesmatchs/public` comme `/srv`.
- Branche isolée : `codex/goal05-stats-app-parity`. Aucun déploiement exécuté.
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

## Publication, seulement après validation de Greg

1. Recontrôler HEAD, état du VPS et montage servi; ne pas écraser un serveur ayant évolué.
2. Sauvegarder les neuf fichiers publics concernés et relever leurs empreintes.
3. Appliquer seulement les neuf fichiers publics : `app.html`, `performances.html`, `index.html`, `dashboard.html`, `live-ia.html`, `js/app-site-parity.js`, `js/goal05-results.js`, `js/signal-alerts.js`, `css/signal-alerts.css`. Aucun remplacement global de `public/`, aucune fusion de la refonte rejetée. Le design de fond reste inchangé; seuls les contrôles d’alertes du compte et la popup sont ajoutés.
4. Vérifier les URL publiques et `/api/goal05/stats`, puis APK Android réel avec connexion et notifications. La validation navigateur n’est pas une validation APK.
5. En cas de problème, restaurer ces neuf fichiers depuis la sauvegarde; aucun retour arrière de base de données n’est nécessaire.

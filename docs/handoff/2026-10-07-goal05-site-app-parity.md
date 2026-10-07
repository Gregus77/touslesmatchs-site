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
- Le bridge Android existant et le service worker sont inchangés. L’ancienne activation Web Push de `app.html` appelait des routes absentes du serveur de référence; ne pas la présenter comme fonctionnelle. Activation/réception native et alertes popup/son ne sont pas validées par cette livraison. Une vérification sur téléphone réel reste nécessaire.

## Vérifications

- Quatre tests obligatoires Goal05 V2, politique et produit : réussis.
- Huit tests comportementaux de rendu/redirection : réussis, avec reproduction puis correction du contrat officiel et des signaux sans résultat final.
- Navigateur Chrome réel, vues 1440 et 390 pixels : statistiques séparées, gains/pertes/attente, cote absente, conservation du total historique 523 (fixture), erreur API explicite, app vers accueil/résultats et stockage de session conservé : réussis.
- Parcours OTP via vrais formulaires et réponses serveur fictives isolées : compte Premium vers accueil et clic analyse autorisé; compte gratuit encore intercepté. Réussi. Aucun email réel envoyé.
- Les captures sous `work/` et les jeux de données navigateur sont uniquement des tests locaux, pas des preuves de résultats sportifs réels.
- `npm test -- --watchAll=false` ne démarre pas : `react-scripts` absent de cette copie. Ne pas appeler la suite générale réussie.

## Publication, seulement après validation de Greg

1. Recontrôler HEAD, état du VPS et montage servi; ne pas écraser un serveur ayant évolué.
2. Sauvegarder les six fichiers publics concernés et relever leurs empreintes.
3. Appliquer seulement les six fichiers publics de cette livraison (`app.html`, `performances.html`, `index.html`, `dashboard.html` et les deux scripts). Les deux dernières pages ont uniquement une correction de connexion, aucun changement de design. Aucun remplacement global de `public/`, aucune fusion de la refonte rejetée.
4. Vérifier les URL publiques et `/api/goal05/stats`, puis APK Android réel avec connexion et notifications. La validation navigateur n’est pas une validation APK.
5. En cas de problème, restaurer ces six fichiers depuis la sauvegarde; aucun retour arrière de base de données n’est nécessaire.

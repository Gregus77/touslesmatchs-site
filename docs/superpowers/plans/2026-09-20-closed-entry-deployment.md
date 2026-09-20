# Entrée fermée, historique conservé — preuve de publication

Publication réussie le 20 septembre 2026 à 01:48:54 UTC (03:48 Paris).

- Code : `37aee86`, adaptation conservatrice production : `af97d1d`.
- Run réussi : https://github.com/Gregus77/touslesmatchs-site/actions/runs/35482349467
- Sauvegarde : `/opt/backups/tlm-entry-closed-20260920T014852Z`.
- Quatre fichiers frontend seulement, aucun redémarrage API, aucune mutation des
  votes, résultats, abonnements, messages Telegram ou secrets.
- Première tentative `35482205160` refusée AVANT remplacement : variantes de
  production plus récentes (réponses terminales, compteur et preuve de livraison).
  Ces variantes ont été conservées par remplacements de tokens uniques inspectés.

## Vérifications

- Local : affichage fermé, archives, fenêtre 35/mi-temps, session et cohérence OK.
- Patch : idempotence, conservation du verdict production, conflit sans écriture
  partielle OK. Revue indépendante : état périmé corrigé après reproduction.
- Fichiers publics réels copiés dans un jeu de test : correctif appliqué, syntaxe
  des scripts intégrés et test comportemental d'affichage OK avant déploiement.
- Serveur : `CLOSED_SIGNAL_DISPLAY_OK`, `PRESERVED_HALF_TIME_VOTES_OK`.
- Publication : comparaison intégrale des quatre fichiers servis avec la copie
  testée. Retour arrière automatique prévu sur erreur.
- Après publication : téléchargement public neuf des quatre fichiers, exécution
  de `test_closed_signal_display.js` contre CE contenu : OK.
- Routes non-www `/`, `/live-ia`, `/app` : HTTP réussi et nouvelle version JS.

## Portée et limites

Après HT ou en seconde période : avertissement explicite visible sans déplier,
votes historiques grisés, aucune nouvelle analyse proposée, minute/score d'origine
conservés. Données périmées/inconnues : entrée fermée par prudence. Temps additionnel
de première période confirmé : reste admissible. Aucun résultat réécrit.

Tests exécutent les fonctions réelles ; pas de validation visuelle sur un téléphone
physique. Aucun ancien message Telegram modifié par cette publication. Pas de
nouvelle réanalyse IA de seconde période ; ceci ferme l'entrée, pas le pari déjà pris.
Les autres travaux Premium/Brevo/statistiques restent séparés.
